from collections import deque
from itertools import product

PCS = ("idle", "claimed", "sent", "done")
STATUSES = ("approved", "claimed", "paid")


def desk_steps(s, n, lease=False):
    status, pc, t = s
    for w in range(n):
        name = "ABCDEFGHIJKL"[w]
        def put(v): return pc[:w] + (v,) + pc[w + 1:]
        if pc[w] == "idle" and status == "approved":
            yield f"Claim({name})", ("claimed", put("claimed"), t)
        if pc[w] == "claimed":
            yield f"Send({name})", (status, put("sent"), t + 1)
        if pc[w] == "sent":
            yield f"Mark({name})", ("paid", put("done"), t)
        if pc[w] == "idle" and status == "paid":
            yield f"Skip({name})", (status, put("done"), t)
    if lease and status == "claimed":
        yield "Expire", ("approved", pc, t)


def bfs(inits, steps, inv=None):
    parent = {s: None for s in inits}
    q = deque(inits)
    order = []
    while q:
        s = q.popleft()
        order.append(s)
        if inv and not inv(s):
            tr = []
            while parent[s]:
                s, a = parent[s]
                tr.append(a)
            return order, tr[::-1]
        for a, s2 in steps(s):
            if s2 not in parent:
                parent[s2] = (s, a)
                q.append(s2)
    return order, None


def desk_init(n):
    return ("approved", ("idle",) * n, 0)


def typeok_states(n):
    return [(st, pc, t) for st in STATUSES
            for pc in product(PCS, repeat=n) for t in range(3)]


def no_double(s): return s[2] <= 1
def owed(s): return s[2] + s[1].count("claimed") <= 1
def unclaimed(s):
    return s[0] != "approved" or (
        s[2] == 0 and all(p == "idle" for p in s[1]))
def inv(s): return owed(s) and unclaimed(s)
def only_one_busy(s): return sum(p != "idle" for p in s[1]) <= 1
def typeok(s): return s[0] in STATUSES and 0 <= s[2] <= 2


def ctis(pred, n, lease=False):
    out = []
    for s in typeok_states(n):
        if not pred(s):
            continue
        for a, s2 in desk_steps(s, n, lease):
            if not (typeok(s2) and pred(s2)):
                out.append((s, a, s2))
                break
    return out


print("== Reachable states of the claim desk (Skip only on paid)")
for n in range(1, 7):
    order, bad = bfs([desk_init(n)], lambda s: desk_steps(s, n), no_double)
    assert len(order) == 2 * n + 2 ** n and bad is None
    print(n, "workers:", len(order), "states, NoDoublePayout holds")
print("300 workers: 2*300 + 2**300 has", len(str(600 + 2 ** 300)), "digits")

print("\n== TypeOK sizes and CTI counts")
for n in range(1, 6):
    T = typeok_states(n)
    reach = set(bfs([desk_init(n)], lambda s: desk_steps(s, n))[0])
    row = [n, len(T)]
    for name, p in [("ndp", no_double), ("owed", owed), ("inv", inv)]:
        sat = [s for s in T if p(s)]
        c = ctis(p, n)
        row += [name, len(sat), len(c), sum(s in reach for s, _, _ in c)]
    print(*row)
    assert all(inv(s) for s in reach)

print("\n== First CTIs, N=2, in TypeOK enumeration order")
for name, p in [("ndp", no_double), ("owed", owed)]:
    c = ctis(p, 2)
    print(name, c[0])
    reach2 = set(bfs([desk_init(2)], lambda s: desk_steps(s, 2))[0])
    print("  reachable?", c[0][0] in reach2)

print("\n== The example CTI from the prose")
s = ("claimed", ("sent", "claimed"), 1)
print(s, no_double(s), [x for x in desk_steps(s, 2)])
reach2 = set(bfs([desk_init(2)], lambda s: desk_steps(s, 2))[0])
print("reachable:", s in reach2)
s = ("approved", ("idle", "claimed"), 0)
print(s, "owed", owed(s), [x for x in desk_steps(s, 2)],
      "reachable:", s in reach2)

print("\n== CTI breakdown by action, N=2 and 3")
for n in (2, 3):
    for name, p in [("ndp", no_double), ("owed", owed)]:
        kinds = {}
        for s, a, s2 in ctis(p, n):
            k = a.split("(")[0]
            kinds[k] = kinds.get(k, 0) + 1
        print(n, name, kinds)

print("\n== Only-one-busy: a wrong strengthening")
for n in (2, 3):
    order, bad = bfs([desk_init(n)], lambda s: desk_steps(s, n),
                     only_one_busy)
    c = ctis(lambda s: inv(s) and only_one_busy(s), n)
    reach = set(bfs([desk_init(n)], lambda s: desk_steps(s, n))[0])
    print(n, "reachable violation:", bad, "after", len(order),
          "states; CTIs of Inv/\\OnlyOneBusy:", len(c),
          "reachable CTIs:", sum(s in reach for s, _, _ in c))

print("\n== Vacuous inductive check: Inv == FALSE")
print("states in TypeOK /\\ FALSE:",
      len([s for s in typeok_states(2) if False]))

print("\n== Lease (Expire added, no crash): Inv")
for n in (2,):
    c = ctis(inv, n, lease=True)
    print(n, "CTIs of Inv with Expire:", len(c), "first:", c[0])
    order, bad = bfs([desk_init(n)], lambda s: desk_steps(s, n, True),
                     no_double)
    print("  NoDoublePayout reachable violation:", bad,
          "after", len(order))

print("\n== Smallest number of workers that shows each earlier bug")


def naive_steps(s, n):
    status, pc, t = s
    for w in range(n):
        def put(v): return pc[:w] + (v,) + pc[w + 1:]
        if pc[w] == "idle" and status == "approved":
            yield "Check", (status, put("checked"), t)
        if pc[w] == "idle" and status == "paid":
            yield "Skip", (status, put("done"), t)
        if pc[w] == "checked":
            yield "Send", (status, put("sent"), t + 1)
        if pc[w] == "sent":
            yield "Mark", ("paid", put("done"), t)


def l2_steps(s, n, lease, resume, key):
    status, owner, pc, t, k, crashed = s
    for w in range(n):
        name = "ABC"[w]
        def put(v): return pc[:w] + (v,) + pc[w + 1:]
        if pc[w] == "idle" and status == "approved":
            who = name if resume else "nobody"
            yield "Claim", ("claimed", who, put("claimed"), t, k, crashed)
        if resume and pc[w] == "idle" and status == "claimed" \
                and owner == name:
            yield "Resume", (status, owner, put("claimed"), t, k, crashed)
        if pc[w] == "idle" and status == "paid":
            yield "Skip", (status, owner, put("done"), t, k, crashed)
        if pc[w] == "claimed":
            t2 = t if (key and k) else t + 1
            yield "Send", (status, owner, put("sent"), t2, key, crashed)
        if pc[w] == "sent":
            yield "Mark", ("paid", owner, put("done"), t, k, crashed)
        if not crashed and pc[w] in ("claimed", "sent"):
            yield "Crash", (status, owner, put("idle"), t, k, True)
    if lease and status == "claimed":
        yield "Expire", ("approved", owner, pc, t, k, crashed)


def l2_init(n):
    return ("approved", "nobody", ("idle",) * n, 0, False, False)


small = {}
for n in (1, 2, 3):
    o, b = bfs([("approved", ("idle",) * n, 0)],
               lambda s: naive_steps(s, n), lambda s: s[2] <= 1)
    small[("naive", n)] = (len(o), b)
    for label, kw in [("lease", dict(lease=True, resume=False, key=False)),
                      ("resume", dict(lease=False, resume=True, key=False))]:
        o, b = bfs([l2_init(n)], lambda s: l2_steps(s, n, **kw),
                   lambda s: s[3] <= 1)
        small[(label, n)] = (len(o), b)
for k, v in small.items():
    print(k, "states seen:", v[0], "counterexample:", v[1])

print("\n== Problem 1: lesson 2's fixed desk with unlimited crashes")


def p1_steps(s, n):
    status, owner, pc, t, keyed = s
    for w in range(n):
        name = "ABC"[w]
        def put(v): return pc[:w] + (v,) + pc[w + 1:]
        if pc[w] == "idle" and status == "approved":
            yield "Claim", ("claimed", name, put("claimed"), t, keyed)
        if pc[w] == "idle" and status == "claimed" and owner == name:
            yield "Resume", (status, owner, put("claimed"), t, keyed)
        if pc[w] == "idle" and status == "paid":
            yield "Skip", (status, owner, put("done"), t, keyed)
        if pc[w] == "claimed":
            yield "Send", (status, owner, put("sent"),
                           t if keyed else t + 1, True)
        if pc[w] == "sent":
            yield "Mark", ("paid", owner, put("done"), t, keyed)
        if pc[w] in ("claimed", "sent"):
            yield "Crash", (status, owner, put("idle"), t, keyed)


for n in (2, 3):
    init = ("approved", "nobody", ("idle",) * n, 0, False)
    o, b = bfs([init], lambda s: p1_steps(s, n), lambda s: s[3] <= 1)
    reach = set(o)
    owners = ["nobody"] + list("ABC"[:n])
    T = [(st, ow, pc, t, ky) for st in STATUSES for ow in owners
         for pc in product(PCS, repeat=n) for t in range(3)
         for ky in (False, True)]
    def p1_ctis(pred):
        out = []
        for s in T:
            if not pred(s):
                continue
            for a, s2 in p1_steps(s, n):
                if not (s2[3] <= 2 and pred(s2)):
                    out.append((s, a, s2))
                    break
        return out
    c0 = p1_ctis(lambda s: s[3] <= 1)
    strong = lambda s: s[3] == (1 if s[4] else 0)
    c1 = p1_ctis(strong)
    print(n, "reachable", len(o), "violation", b, "| TypeOK", len(T),
          "| NDP CTIs", len(c0), "first", c0[0],
          "| strengthened sat", sum(map(strong, T)), "CTIs", len(c1),
          "| strong holds in reachable", all(map(strong, reach)))

print("\n== Problem 3: the naive desk's inductive check")


def naive_typeok(n):
    return [(st, pc, t) for st in ("approved", "paid")
            for pc in product(("idle", "checked", "sent", "done"),
                              repeat=n) for t in range(3)]


for n in (2,):
    reach = set(bfs([("approved", ("idle",) * n, 0)],
                    lambda s: naive_steps(s, n))[0])
    c = []
    for s in naive_typeok(n):
        if s[2] > 1:
            continue
        for a, s2 in naive_steps(s, n):
            if s2[2] > 1:
                c.append(s)
                break
    print(n, "TypeOK", len(naive_typeok(n)), "NDP CTIs", len(c),
          "reachable among them", sum(s in reach for s in c))

print("\n== Desk at 12 workers (TLC Desk12.cfg)")
order, bad = bfs([desk_init(12)], lambda s: desk_steps(s, 12), no_double)
assert len(order) == 2 * 12 + 2 ** 12 == 4120 and bad is None
print(12, "workers:", len(order), "states")

print("\n== TLC 'states generated' for the inductive runs")
for n in range(2, 6):
    start = [s for s in typeok_states(n) if inv(s)]
    gen = len(start) + sum(len(list(desk_steps(s, n))) for s in start)
    print(n, "Inv states", len(start), "generated", gen)

print("\n== Lab act 2: conjunct combinations (always TypeOK, NDP)")
CANDS = {"Owed": owed, "Unclaimed": unclaimed, "OnlyOneBusy": only_one_busy}
for n in (2, 3):
    reach = set(bfs([desk_init(n)], lambda s: desk_steps(s, n))[0])
    for k in range(4):
        for combo in __import__("itertools").combinations(CANDS, k):
            p = lambda s, c=combo: no_double(s) and all(
                CANDS[x](s) for x in c)
            sat = [s for s in typeok_states(n) if p(s)]
            c = ctis(p, n)
            print(n, "+".join(combo) or "NDP only", "| states", len(sat),
                  "| Init ok", p(desk_init(n)),
                  "| all reachable ok", all(map(p, reach)),
                  "| CTIs", len(c))

print("\n== Lease CTI: reachable in the lease desk?")
lease_reach = set(bfs([desk_init(2)],
                      lambda s: desk_steps(s, 2, True))[0])
print(("claimed", ("idle", "idle"), 1) in lease_reach,
      len(lease_reach), "reachable states with Expire")


print("\n== Counting form: Inv inductive for many N (workers alike)")


def cinv(st, t, i, c, s, d):
    if st == "approved" and (t or c or s or d):
        return False
    return t + c <= 1


def csteps(st, t, i, c, s, d):
    if i and st == "approved":
        yield "claimed", t, i - 1, c + 1, s, d
    if c:
        yield st, t + 1, i, c - 1, s + 1, d
    if s:
        yield "paid", t, i, c, s - 1, d + 1
    if i and st == "paid":
        yield st, t, i - 1, c, s, d + 1


def counting_check(n):
    count = 0
    for st in STATUSES:
        for t in (0, 1, 2):
            for c in range(n + 1):
                for s in range(n + 1 - c):
                    for d in range(n + 1 - c - s):
                        x = (st, t, n - c - s - d, c, s, d)
                        if not cinv(*x):
                            continue
                        count += 1
                        for y in csteps(*x):
                            assert cinv(*y), (x, y)
    return count


for n in (2, 3, 4, 5, 6, 30, 300):
    print(n, "workers: Inv count-states", counting_check(n), "no CTI")
