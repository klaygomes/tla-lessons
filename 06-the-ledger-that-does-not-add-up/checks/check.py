from collections import deque

POT = 200_000
AMOUNTS = {4471: 50_000, 4472: 30_000, 4473: 20_000}


def sum_over(s, f):
    if not s:
        return 0
    x = min(s)
    return f[x] + sum_over(s - {x}, f)


def naive(loans, order, crash, key=False):
    first, second = order
    mid = "debited" if first == "debit" else "credited"
    amt = {l: AMOUNTS[l] for l in loans}

    def init():
        return (POT, tuple(0 for _ in loans), tuple("todo" for _ in loans),
                False)

    def steps(s):
        fund, credit, pc, crashed = s
        for i, l in enumerate(loans):
            def put(t, v):
                return t[:i] + (v,) + t[i + 1:]

            def do(kind):
                if kind == "debit":
                    return fund - amt[l], credit
                return fund, put(credit, amt[l] if key else credit[i] + amt[l])
            if pc[i] == "todo":
                f2, c2 = do(first)
                yield f"{first.title()}({l})", True, (f2, c2, put(pc, mid), crashed)
            if pc[i] == mid:
                f2, c2 = do(second)
                yield f"{second.title()}({l})", True, (f2, c2, put(pc, "done"),
                                                       crashed)
            if crash and not crashed and pc[i] == mid:
                yield f"Crash({l})", False, (fund, credit, put(pc, "todo"), True)

    def credits(s):
        return sum_over(set(loans), dict(zip(loans, s[1])))

    def conserved(s):
        return s[0] + credits(s) == POT

    def at_rest(s):
        return all(p in ("todo", "done") for p in s[2])

    def in_flight_mem(s):
        flying = {l for l, p in zip(loans, s[2]) if p == "debited"}
        return sum_over(flying, amt)

    inv = dict(
        Conserved=conserved,
        ConservedAtRest=lambda s: not at_rest(s) or conserved(s),
        ConservedMem=lambda s: s[0] + in_flight_mem(s) + credits(s) == POT,
    )

    def settled(s):
        return all(c == amt[l] for l, c in zip(loans, s[1])) and \
            all(p == "done" for p in s[2])
    return init, steps, inv, (lambda s: s[0] + credits(s)), settled


def outbox_spec(loans, key, two_txn=False, any_time=False):
    amt = {l: AMOUNTS[l] for l in loans}

    def init():
        return (POT, tuple(0 for _ in loans), tuple("approved" for _ in loans),
                frozenset(), frozenset(), False, tuple("idle" for _ in loans))

    def steps(s):
        fund, credit, status, outbox, held, crashed, pc = s
        for i, l in enumerate(loans):
            def put(t, v):
                return t[:i] + (v,) + t[i + 1:]
            if not two_txn and status[i] == "approved":
                yield f"Pay({l})", True, (fund - amt[l], credit,
                                          put(status, "paid"), outbox | {l},
                                          held, crashed, pc)
            if two_txn and status[i] == "approved" and pc[i] == "idle":
                yield f"Debit({l})", True, (fund - amt[l], credit,
                                            put(status, "paid"), outbox, held,
                                            crashed, put(pc, "debited"))
            if two_txn and pc[i] == "debited":
                yield f"Enqueue({l})", True, (fund, credit, status,
                                              outbox | {l}, held, crashed,
                                              put(pc, "idle"))
            if two_txn and not crashed and pc[i] == "debited":
                yield f"CrashWorker({l})", False, (fund, credit, status, outbox,
                                                   held, True, put(pc, "idle"))
            if l in outbox and (any_time or l not in held):
                c = amt[l] if key else credit[i] + amt[l]
                yield f"Deliver({l})", True, (fund, put(credit, c), status,
                                              outbox, held | {l}, crashed, pc)
            if l in held:
                yield f"Ack({l})", True, (fund, credit, status, outbox - {l},
                                          held - {l}, crashed, pc)
        if not crashed and held:
            yield "CrashRelay", False, (fund, credit, status, outbox,
                                        frozenset(), True, pc)

    def credits(s):
        return sum_over(set(loans), dict(zip(loans, s[1])))

    def in_flight(s):
        c = dict(zip(loans, s[1]))
        return sum_over({l for l in s[3] if c[l] == 0}, amt)

    def conserved(s):
        return s[0] + in_flight(s) + credits(s) == POT

    inv = dict(
        Conserved=conserved,
        ConservedAtRest=lambda s: not all(p == "idle" for p in s[6])
        or conserved(s),
    )

    def settled(s):
        return not s[3] and all(c == amt[l] for l, c in zip(loans, s[1]))
    return (init, steps, inv, (lambda s: s[0] + in_flight(s) + credits(s)),
            settled)


def atomic(loans):
    amt = {l: AMOUNTS[l] for l in loans}

    def init():
        return (POT, tuple(0 for _ in loans), tuple("todo" for _ in loans))

    def steps(s):
        fund, credit, pc = s
        for i, l in enumerate(loans):
            def put(t, v):
                return t[:i] + (v,) + t[i + 1:]
            if pc[i] == "todo":
                yield f"Transfer({l})", True, (fund - amt[l],
                                               put(credit, amt[l]),
                                               put(pc, "done"))

    def total(s):
        return s[0] + sum_over(set(loans), dict(zip(loans, s[1])))
    inv = dict(Conserved=lambda s: total(s) == POT)
    return init, steps, inv, total, (lambda s: True)


def explore(init, steps):
    s0 = init()
    parent = {s0: None}
    q = deque([s0])
    order = []
    while q:
        s = q.popleft()
        order.append(s)
        for a, _, s2 in steps(s):
            if s2 not in parent:
                parent[s2] = (s, a)
                q.append(s2)

    def trace(s):
        out = []
        while parent[s]:
            s, a = parent[s]
            out.append(a)
        return out[::-1]
    return order, trace


def acyclic(order, steps):
    edges = {s: [s2 for *_, s2 in steps(s) if s2 != s] for s in order}
    color = {}

    def cyc(s):
        color[s] = 1
        for s2 in edges[s]:
            if color.get(s2) == 1 or (s2 not in color and cyc(s2)):
                return True
        color[s] = 2
        return False
    return not any(s not in color and cyc(s) for s in order)


def analyse(spec, invs):
    init, steps, inv, total, settled = spec
    order, trace = explore(init, steps)
    out = dict(states=len(order), acyclic=acyclic(order, steps))
    for n in invs:
        bad = [s for s in order if not inv[n](s)]
        first = bad[0] if bad else None
        out[n] = None if first is None else (len(bad), trace(first),
                                             total(first))
    stuck = [s for s in order if not settled(s)
             and not any(f for _, f, s2 in steps(s) if s2 != s)]
    out["stuck"] = stuck
    out["totals"] = sorted({total(s) for s in order})
    return out, order, total


def report(name, spec, invs):
    out, order, total = analyse(spec, invs)
    print(f"{name}: {out['states']} states, acyclic={out['acyclic']}")
    for n in invs:
        if out[n] is None:
            print(f"  {n}: holds in all {out['states']}")
        else:
            k, t, tot = out[n]
            print(f"  {n}: violated in {k} states; shortest {len(t)} steps "
                  f"{t} total={tot}")
    print(f"  fair liveness: {'holds' if not out['stuck'] else 'stuck ' + str(len(out['stuck']))}")
    print(f"  totals seen: {out['totals']}")
    return out, order, total


L2 = (4471, 4472)
L3 = (4471, 4472, 4473)
print("SumOver credits example:",
      sum_over({4471, 4472}, {4471: 50_000, 4472: 0}))

report("Atomic", atomic(L2), ["Conserved"])
for crash in (False, True):
    report(f"DebitFirst crash={crash}", naive(L2, ("debit", "credit"), crash),
           ["Conserved", "ConservedAtRest", "ConservedMem"])
for crash in (False, True):
    report(f"CreditFirst crash={crash}", naive(L2, ("credit", "debit"), crash),
           ["Conserved", "ConservedAtRest"])
report("DebitFirst key", naive(L2, ("debit", "credit"), True, True),
       ["ConservedAtRest"])
report("CreditFirst key", naive(L2, ("credit", "debit"), True, True),
       ["ConservedAtRest"])
report("Outbox key", outbox_spec(L2, True), ["Conserved"])
report("Outbox no key", outbox_spec(L2, False), ["Conserved"])
report("Outbox key 3 loans", outbox_spec(L3, True), ["Conserved"])
report("Outbox two txn, key", outbox_spec(L2, True, two_txn=True),
       ["ConservedAtRest"])

print("\nFinal states (every job done) and their totals, crash on:")
for order_ in (("debit", "credit"), ("credit", "debit")):
    _, states, total = analyse(naive(L2, order_, True), [])
    done = [s for s in states if all(p == "done" for p in s[2])]
    print(" ", order_[0], "first:", len(done), "final states, totals",
          sorted(total(s) for s in done))

print("\nAt-rest states off the pot, crash on:")
for order_ in (("debit", "credit"), ("credit", "debit")):
    _, states, total = analyse(naive(L2, order_, True), [])
    rest = [s for s in states if all(p in ("todo", "done") for p in s[2])]
    off = sorted({total(s) - POT for s in rest if total(s) != POT})
    print(" ", order_[0], "first:", len(rest), "at rest,",
          sum(total(s) != POT for s in rest), "off by", off)

print("\nLab act 2 (crash on; design, key, loans):")
designs = {
    "debit first": lambda L, k: naive(L, ("debit", "credit"), True, k),
    "credit first": lambda L, k: naive(L, ("credit", "debit"), True, k),
    "outbox, two txns": lambda L, k: outbox_spec(L, k, two_txn=True),
    "outbox, one txn": lambda L, k: outbox_spec(L, k),
}
for name, make in designs.items():
    for k in (False, True):
        for L in (L2, L3):
            out, _, _ = analyse(make(L, k), ["ConservedAtRest"])
            bad = out["ConservedAtRest"]
            inv = "adds up" if bad is None else \
                f"off ({bad[2] - POT:+}) in {len(bad[1])} steps"
            live = "settles" if not out["stuck"] else \
                f"stuck in {len(out['stuck'])}"
            print(f"  {name:17} key={k!s:5} loans={len(L)}: "
                  f"{out['states']:4} states, {inv}, {live}")


def ack_first(loans):
    amt = {l: AMOUNTS[l] for l in loans}

    def init():
        return (POT, tuple(0 for _ in loans), tuple("approved" for _ in loans),
                frozenset(), frozenset(), False)

    def steps(s):
        fund, credit, status, outbox, held, crashed = s
        for i, l in enumerate(loans):
            def put(t, v):
                return t[:i] + (v,) + t[i + 1:]
            if status[i] == "approved":
                yield f"Pay({l})", True, (fund - amt[l], credit,
                                          put(status, "paid"), outbox | {l},
                                          held, crashed)
            if l in outbox:
                yield f"Take({l})", True, (fund, credit, status, outbox - {l},
                                           held | {l}, crashed)
            if l in held:
                yield f"Deliver({l})", True, (fund, put(credit, amt[l]),
                                              status, outbox, held - {l},
                                              crashed)
        if not crashed and held:
            yield "CrashRelay", False, (fund, credit, status, outbox,
                                        frozenset(), True)

    def total(s):
        c = dict(zip(loans, s[1]))
        flying = sum_over({l for l in s[3] if c[l] == 0}, amt)
        return s[0] + flying + sum_over(set(s[4]), amt) + \
            sum_over(set(loans), c)
    inv = dict(ConservedMem=lambda s: total(s) == POT)

    def settled(s):
        return not s[3] and all(c == amt[l] for l, c in zip(loans, s[1]))
    return init, steps, inv, total, settled


print()
report("Outbox ack first", ack_first(L2), ["ConservedMem"])
report("Outbox deliver any time, key",
       outbox_spec(L2, True, any_time=True), ["Conserved"])
init, steps, inv, total, _ = outbox_spec(L2, False, any_time=True)
s = init()
for want in ("Pay(4471)", "Deliver(4471)", "Deliver(4471)"):
    s = next(t for a, _, t in steps(s) if a == want)
print("Outbox deliver any time, no key (state space unbounded):",
      "Pay, Deliver, Deliver total =", total(s), "Conserved",
      inv["Conserved"](s))

_, states, total = analyse(naive(L2, ("credit", "debit"), True, True), [])
done = [s for s in states if all(p == "done" for p in s[2])]
print("CreditFirst key: final states", len(done),
      sorted(total(s) for s in done))
