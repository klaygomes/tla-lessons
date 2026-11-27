from collections import deque

LOAN = 4471


def steps(s, n, key=True, fair_lease=True, mark_first=False,
          split=False):
    queue, status, pc, keys, t, crashed = s
    names = "ABCD"[:n]
    for i, w in enumerate(names):
        def put(v): return pc[:i] + (v,) + pc[i + 1:]
        if pc[i] == "idle" and queue == "visible":
            yield f"Receive({w})", f"work{w}", (
                "hidden", status, put("claimed"), keys, t, crashed)
        if not mark_first:
            if pc[i] == "claimed":
                yield f"Send({w})", f"work{w}", (
                    queue, status, put("sent"), keys, t, crashed)
            if pc[i] == "sent":
                t2 = t if (key and keys) else t + 1
                yield f"Confirm({w})", f"bank{w}", (
                    queue, status, put("confirmed"), True, t2, crashed)
            if pc[i] == "confirmed" and not split:
                yield f"Mark({w})", f"work{w}", (
                    "deleted", "paid", put("done"), keys, t, crashed)
            if pc[i] == "confirmed" and split:
                yield f"Mark({w})", f"work{w}", (
                    queue, "paid", put("marked"), keys, t, crashed)
            if pc[i] == "marked" and split:
                yield f"Delete({w})", f"work{w}", (
                    "deleted", status, put("done"), keys, t, crashed)
            hold = ("claimed", "sent", "confirmed", "marked")
        else:
            if pc[i] == "claimed":
                yield f"Mark({w})", f"work{w}", (
                    "deleted", "paid", put("marked"), keys, t, crashed)
            if pc[i] == "marked":
                yield f"Send({w})", f"work{w}", (
                    queue, status, put("sent"), keys, t, crashed)
            if pc[i] == "sent":
                t2 = t if (key and keys) else t + 1
                yield f"Confirm({w})", f"bank{w}", (
                    queue, status, put("done"), True, t2, crashed)
            hold = ("claimed", "marked", "sent")
        if not crashed and pc[i] in hold:
            yield f"Crash({w})", None, (
                queue, status, put("idle"), keys, t, True)
    if queue == "hidden":
        yield "Expire", "lease" if fair_lease else None, (
            "visible", status, pc, keys, t, crashed)


def at_send(s):
    queue, status, pc, keys, t, crashed = s
    sent = any(p in ("sent", "confirmed", "done") for p in pc)
    return ("paid" if sent else "approved", t)


def at_table(s):
    return (s[1], s[4])


def at_bank(s):
    return ("paid" if s[4] > 0 else "approved", s[4])


def trivial(s):
    return ("approved", 0)


def liar(s):
    return (s[1], 1 if s[1] == "paid" else 0)


MAPPINGS = dict(at_send=at_send, at_table=at_table,
                at_bank=at_bank, trivial=trivial, liar=liar)


def abstract_ok(a, b):
    if a == b:
        return "stutter"
    if a[0] == "approved" and b == ("paid", a[1] + 1):
        return "pay"
    return None


def explore(n=2, key=True, fair_lease=True, mark_first=False,
            mapping=at_bank, split=False):
    init = ("visible", "approved", ("idle",) * n, False, 0, False)
    kw = dict(key=key, fair_lease=fair_lease, mark_first=mark_first,
              split=split)
    parent = {init: None}
    order, q = [], deque([init])
    generated = 1
    first_bad = None
    counts = {"pay": 0, "stutter": 0, "bad": 0}
    edges = {}
    while q:
        s = q.popleft()
        order.append(s)
        edges[s] = []
        for a, fair, s2 in steps(s, n, **kw):
            generated += 1
            edges[s].append((a, fair, s2))
            kind = abstract_ok(mapping(s), mapping(s2))
            counts[kind or "bad"] += 1
            if kind is None and first_bad is None:
                first_bad = (s, a, s2)
            if s2 not in parent:
                parent[s2] = (s, a)
                q.append(s2)

    def trace(s):
        out = []
        while parent[s]:
            s, a = parent[s]
            out.append(a)
        return out[::-1]

    color = {}

    def cyclic(s):
        color[s] = 1
        for _, _, s2 in edges[s]:
            if color.get(s2) == 1 or (s2 not in color and cyclic(s2)):
                return True
        color[s] = 2
        return False

    acyclic = not any(s not in color and cyclic(s) for s in order)

    def may_stop(s):
        return not any(f for _, f, _ in edges[s])

    lassos = [s for s in order
              if may_stop(s) and mapping(s)[0] == "approved"]
    init_ok = mapping(init) == ("approved", 0)
    double = next((s for s in order if s[4] > 1), None)
    return dict(
        states=len(order), generated=generated, acyclic=acyclic,
        init_ok=init_ok, counts=counts,
        bad_step=(trace(first_bad[0]) + [first_bad[1]]
                  if first_bad else None),
        lassos=len(lassos),
        first_lasso=(trace(lassos[0]) + ["stutter forever"]
                     if lassos else None),
        double=trace(double) if double else None,
        max_transfers=max(s[4] for s in order),
        depth=max(len(trace(s)) for s in order) + 1)


def abstract_payonce():
    init = ("approved", 0)
    seen, todo = {init}, [init]
    while todo:
        s = todo.pop()
        if s[0] == "approved":
            s2 = ("paid", s[1] + 1)
            if s2 not in seen:
                seen.add(s2)
                todo.append(s2)
    return sorted(seen)


def idemkey_refines():
    def isteps(s):
        status, owner, pc, t, k, crashed = s
        for i, w in enumerate("AB"):
            def put(v): return pc[:i] + (v,) + pc[i + 1:]
            if pc[i] == "idle" and status == "approved":
                yield "work", ("claimed", w, put("claimed"),
                               t, k, crashed)
            if (pc[i] == "idle" and status == "claimed"
                    and owner == w):
                yield "work", (status, owner, put("claimed"),
                               t, k, crashed)
            if pc[i] == "idle" and status == "paid":
                yield "work", (status, owner, put("done"),
                               t, k, crashed)
            if pc[i] == "claimed":
                yield "work", (status, owner, put("sent"),
                               t if k else t + 1, True, crashed)
            if pc[i] == "sent":
                yield "work", ("paid", owner, put("done"),
                               t, k, crashed)
            if not crashed and pc[i] in ("claimed", "sent"):
                yield None, (status, owner, put("idle"),
                             t, k, True)
    init = ("approved", "nobody", ("idle", "idle"), 0, False, False)
    seen, q = {init}, deque([init])
    gen, bad, stuck = 1, 0, 0
    f = lambda s: ("paid" if s[3] > 0 else "approved", s[3])
    while q:
        s = q.popleft()
        succ = list(isteps(s))
        if f(s)[0] == "approved" and not any(k for k, _ in succ):
            stuck += 1
        for _, s2 in succ:
            gen += 1
            if abstract_ok(f(s), f(s2)) is None:
                bad += 1
            if s2 not in seen:
                seen.add(s2)
                q.append(s2)
    return dict(states=len(seen), generated=gen, bad=bad, stuck=stuck)


def books_ok(s, t):
    a, b = (s[1], s[4]), (t[1], t[4])
    if a == b:
        return True
    if a[1] == 0 and b == (a[0], 1):
        return True
    return a == ("approved", 1) and b == ("paid", 1)


def books(mark_first=False):
    init = ("visible", "approved", ("idle", "idle"), False, 0, False)
    seen, q, gen, bad = {init}, deque([init]), 1, []
    while q:
        s = q.popleft()
        for a, fair, t in steps(s, 2, mark_first=mark_first):
            gen += 1
            if not books_ok(s, t):
                bad.append(a)
            if t not in seen:
                seen.add(t)
                q.append(t)
    stuck = [s for s in seen if s[1] != "paid"
             and not any(f for _, f, _ in steps(s, 2,
                                                mark_first=mark_first))]
    return dict(states=len(seen), generated=gen, bad=len(bad),
                first_bad=bad[:1], stuck=len(stuck))


if __name__ == "__main__":
    print("PayOnce abstract states:", abstract_payonce())
    runs = [
        ("fixed, at_bank", dict()),
        ("fixed, at_send", dict(mapping=at_send)),
        ("fixed, at_table", dict(mapping=at_table)),
        ("fixed, trivial", dict(mapping=trivial)),
        ("no key, at_bank", dict(key=False)),
        ("unfair lease, at_bank", dict(fair_lease=False)),
        ("fixed 3 workers, at_bank", dict(n=3)),
        ("no key 3 workers, at_bank", dict(n=3, key=False)),
        ("mark first, at_bank", dict(mark_first=True)),
        ("mark first, at_table", dict(mark_first=True,
                                      mapping=at_table)),
        ("mark first, liar", dict(mark_first=True, mapping=liar)),
        ("fixed, liar", dict(mapping=liar)),
        ("mark first 3 workers, at_bank", dict(n=3, mark_first=True)),
        ("split mark, at_bank", dict(split=True)),
    ]
    for name, kw in runs:
        print(name, explore(**kw))
    print("IdemKey (lesson 2) refines PayOnce:", idemkey_refines())
    print("QueueDesk refines PayRecord:", books())
    print("pilot refines PayRecord:", books(mark_first=True))
    print()
    print("act 1 grid, fixed design (n, mapping):")
    for n in (2, 3):
        for m in MAPPINGS:
            r = explore(n=n, mapping=MAPPINGS[m])
            print(n, m, r["states"], r["counts"],
                  r["bad_step"], r["lassos"], r["first_lasso"])
    print()
    print("act 2 grid, at_bank (n, mark_first, key, fair_lease):")
    for n in (2, 3):
        for mf in (False, True):
            for key in (True, False):
                for fl in (True, False):
                    r = explore(n=n, key=key, fair_lease=fl,
                                mark_first=mf)
                    others = [m for m in MAPPINGS if m != "at_bank"
                              and explore(n=n, key=key, fair_lease=fl,
                                          mark_first=mf,
                                          mapping=MAPPINGS[m])
                              ["bad_step"] is None
                              and explore(n=n, key=key, fair_lease=fl,
                                          mark_first=mf,
                                          mapping=MAPPINGS[m])
                              ["lassos"] == 0]
                    steps_ok = r["bad_step"] is None
                    live = r["lassos"] == 0
                    print(n, "mark-first" if mf else "send-first",
                          "key" if key else "no-key",
                          "lease" if fl else "no-lease",
                          r["states"],
                          "steps ok" if steps_ok
                          else f"bad at step {len(r['bad_step'])}"
                          f" {r['bad_step']}",
                          "live" if live else
                          f"stuck {r['lassos']} {r['first_lasso']}",
                          "PASS" if steps_ok and live else "",
                          "also passes under:", others)
