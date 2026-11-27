import sys
from collections import deque

LOAN = 4471


def known(keys):
    return any(k[0] == LOAN for k in keys)


def steps(s, spec, n, max_time, ttl, w_len=1, fresh=True, refuse=True):
    now, status, owner, dl, pc, net, t, keys, crashed = s
    timed = spec in ("fix", "deadline")

    def S(**kw):
        d = dict(now=now, status=status, owner=owner, dl=dl, pc=pc,
                 net=net, t=t, keys=keys, crashed=crashed)
        d.update(kw)
        return (d["now"], d["status"], d["owner"], d["dl"], d["pc"],
                d["net"], d["t"], d["keys"], d["crashed"])

    if now < max_time:
        yield "Tick", False, S(now=now + 1)
    for k in keys:
        if now >= k[1] + ttl:
            yield "Forget", False, S(keys=keys - {k})
    if spec not in ("clock", "clockask"):
        for m in net:
            if m[0] == "pay":
                if timed and refuse and now > m[1]:
                    yield "Deliver", False, S(net=net - {m})
                elif known(keys):
                    yield "Deliver", False, S(net=(net - {m}) | {("ok",)})
                else:
                    yield "Deliver", False, S(
                        net=(net - {m}) | {("ok",)}, t=t + 1,
                        keys=keys | {(LOAN, now)})
            if m[0] == "ask":
                if t > 0:
                    reply = ("found",)
                elif spec == "fix":
                    reply = ("absent", now)
                else:
                    reply = ("absent",)
                yield "Answer", False, S(net=(net - {m}) | {reply})
            yield "Drop", False, S(net=net - {m})
    for i in range(n):
        w = "ABC"[i]

        def put(v):
            return pc[:i] + (v,) + pc[i + 1:]

        p = pc[i]
        if p == "idle" and status == "approved":
            extra = dict(dl=now + w_len) if timed else {}
            yield f"Claim({w})", True, S(status="claimed", owner=w,
                                         pc=put("claimed"), **extra)
        if p == "idle" and status == "claimed" and owner == w:
            to = {"clock": "claimed", "lossy": "claimed",
                  "clockask": "looking"}.get(spec, "waiting")
            yield f"Resume({w})", True, S(pc=put(to))
        if p == "idle" and status == "paid":
            yield f"Skip({w})", True, S(pc=put("done"))
        if p == "claimed":
            if spec in ("clock", "clockask"):
                if known(keys):
                    yield f"Send({w})", True, S(pc=put("sent"))
                else:
                    yield f"Send({w})", True, S(
                        pc=put("sent"), t=t + 1, keys=keys | {(LOAN, now)})
            elif spec in ("lossy", "ask"):
                yield f"Send({w})", True, S(
                    net=net | {("pay", now)}, pc=put("waiting"))
            elif now <= dl:
                yield f"Send({w})", True, S(
                    net=net | {("pay", dl)}, pc=put("waiting"))
        if p == "waiting" and spec == "lossy":
            yield f"Retry({w})", True, S(pc=put("claimed"))
        if p == "waiting" and timed and now <= dl:
            yield f"Retry({w})", True, S(pc=put("claimed"))
        if spec == "ask" and p in ("waiting", "asking"):
            yield f"AskBank({w})", True, S(
                net=net | {("ask",)}, pc=put("asking"))
        if spec == "fix" and p in ("claimed", "waiting", "asking") \
                and now > dl:
            yield f"AskBank({w})", True, S(
                net=net | {("ask",)}, pc=put("asking"))
        if owner == w:
            if spec == "lossy" and p in ("claimed", "waiting") \
                    and ("ok",) in net:
                yield f"GotOk({w})", True, S(
                    net=net - {("ok",)}, pc=put("sent"))
            if spec in ("ask", "fix", "deadline"):
                ok_from = ("waiting", "asking") if spec == "ask" \
                    else ("claimed", "waiting", "asking")
                if p in ok_from:
                    for m in net:
                        if m[0] in ("ok", "found"):
                            yield f"GotOk({w})", True, S(
                                net=net - {m}, pc=put("sent"))
                if p == "asking":
                    for m in net:
                        if m[0] != "absent":
                            continue
                        if spec == "ask":
                            yield f"GotAbsent({w})", True, S(
                                net=net - {m}, pc=put("claimed"))
                        elif not fresh or m[1] > dl:
                            yield f"GotAbsent({w})", True, S(
                                net=net - {m}, dl=now + w_len,
                                pc=put("claimed"))
        if p == "looking":
            yield f"Lookup({w})", True, S(
                pc=put("sent" if t > 0 else "claimed"))
        if p == "sent":
            yield f"Mark({w})", True, S(status="paid", pc=put("done"))
        holding = {"clock": ("claimed", "sent"),
                   "clockask": ("claimed", "looking", "sent"),
                   "lossy": ("claimed", "waiting", "sent")}.get(
            spec, ("claimed", "waiting", "asking", "sent"))
        if not crashed and p in holding:
            yield f"Crash({w})", False, S(pc=put("idle"), crashed=True)


def explore(spec, n=2, max_time=3, ttl=2, w_len=1, fresh=True,
            refuse=True):
    init = (0, "approved", "nobody", 0, ("idle",) * n, frozenset(), 0,
            frozenset(), False)
    parent = {init: None}
    queue = deque([init])
    order = []
    while queue:
        s = queue.popleft()
        order.append(s)
        for a, _, s2 in steps(s, spec, n, max_time, ttl, w_len, fresh, refuse):
            if s2 not in parent:
                parent[s2] = (s, a)
                queue.append(s2)

    def trace(s):
        out = []
        while parent[s]:
            s, a = parent[s]
            out.append(a)
        return out[::-1]

    bad = next((s for s in order if s[6] > 1), None)
    dead = [s for s in order if s[1] != "paid" and not any(
        work for _, work, _ in steps(s, spec, n, max_time, ttl, w_len,
                                     fresh, refuse))]
    return dict(states=len(order), max_transfers=max(s[6] for s in order),
                double=trace(bad) if bad else None, dead_ends=len(dead))


def show(name, r):
    d = r["double"]
    verdict = f"double payout in {len(d)} steps: {', '.join(d)}" if d \
        else "no double payout"
    print(f"{name}: {r['states']} states, {verdict}, "
          f"dead ends {r['dead_ends']}")


RUNS = [
    ("Clock MaxTime=3 TTL=2", dict(spec="clock")),
    ("ClockShort MaxTime=1", dict(spec="clock", max_time=1)),
    ("ClockAsk MaxTime=3", dict(spec="clockask")),
    ("ClockAsk MaxTime=6", dict(spec="clockask", max_time=6)),
    ("LossyKeep TTL=9", dict(spec="lossy", ttl=9)),
    ("Lossy TTL=2", dict(spec="lossy")),
    ("Ask TTL=2", dict(spec="ask")),
    ("DeadlineOnly MaxTime=3", dict(spec="deadline")),
    ("Fix MaxTime=3", dict(spec="fix")),
    ("Fix MaxTime=4", dict(spec="fix", max_time=4)),
    ("FixLongWindow Window=2", dict(spec="fix", w_len=2)),
    ("FixStale3 MaxTime=3", dict(spec="fix", fresh=False)),
    ("FixStale MaxTime=4", dict(spec="fix", fresh=False, max_time=4)),
    ("FixNoRefuse MaxTime=3", dict(spec="fix", refuse=False)),
    ("FixNoRefuse MaxTime=4", dict(spec="fix", refuse=False,
                                   max_time=4)),
    ("Clock TTL=6 MaxTime=3", dict(spec="clock", ttl=6)),
    ("Clock TTL=6 MaxTime=6", dict(spec="clock", ttl=6, max_time=6)),
    ("Fix TTL=3 Window=2 MaxTime=5",
     dict(spec="fix", ttl=3, w_len=2, max_time=5)),
    ("Fix TTL=3 Window=3 MaxTime=5",
     dict(spec="fix", ttl=3, w_len=3, max_time=5)),
    ("Fix3 3 workers MaxTime=4", dict(spec="fix", n=3, max_time=4)),
]

STRATEGIES = [
    ("resend on timeout", dict(spec="lossy")),
    ("ask first", dict(spec="ask")),
    ("deadline", dict(spec="deadline")),
    ("ask + deadline", dict(spec="fix", fresh=False)),
    ("ask + deadline + fresh answer", dict(spec="fix")),
]


def lab_table():
    for label, kw in STRATEGIES:
        windows = (1, 2) if kw["spec"] != "lossy" and kw["spec"] != "ask" \
            else (None,)
        for w_len in windows:
            for n in (2, 3):
                for max_time in (1, 3, 4):
                    extra = dict(w_len=w_len) if w_len else {}
                    r = explore(n=n, max_time=max_time, **kw, **extra)
                    d = r["double"]
                    print(f"{label} | window {w_len or '-'} | workers {n}"
                          f" | clock {max_time} | {r['states']} states | "
                          + (f"double in {len(d)}" if d else "safe")
                          + f" | dead ends {r['dead_ends']}", flush=True)


if __name__ == "__main__":
    for name, kw in RUNS:
        show(name, explore(**kw))
    print()
    print("Clock growth (TTL=2), MaxTime -> states:")
    print([(m, explore("clock", max_time=m)["states"]) for m in range(7)])
    if "--big" in sys.argv:
        print("Fix growth (TTL=2, Window=1), MaxTime -> states:")
        print([(m, explore("fix", max_time=m)["states"])
               for m in range(2, 6)])
    if "--lab" in sys.argv:
        lab_table()
