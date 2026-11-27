from itertools import product

def steps(state):
    status, pc, t = state
    for w, p in enumerate(pc):
        def put(v):
            return pc[:w] + (v,) + pc[w + 1:]
        if p == "idle" and status == "approved":
            yield "claimed", put("claimed"), t
        if p == "claimed":
            yield status, put("sent"), t + 1
        if p == "sent":
            yield "paid", put("done"), t
        if p == "idle" and status == "paid":
            yield status, put("done"), t

def type_ok(n):
    pcs = ("idle", "claimed", "sent", "done")
    return [(s, pc, t)
            for s in ("approved", "claimed", "paid")
            for pc in product(pcs, repeat=n)
            for t in range(3)]

def obligations(inv, n):
    init = ("approved", ("idle",) * n, 0)
    good = [s for s in type_ok(n) if inv(s)]
    keeps = all(inv(a) for s in good for a in steps(s))
    enough = all(s[2] <= 1 for s in good)
    return inv(init), keeps, enough

no_double = lambda s: s[2] <= 1
def first_cti(inv, n):
    for s in type_ok(n):
        for after in steps(s):
            if inv(s) and not inv(after):
                return s, after

def owed(s):
    return s[2] + s[1].count("claimed") <= 1

def unclaimed(s):
    status, pc, t = s
    return status != "approved" or (
        t == 0 and set(pc) == {"idle"})

inv = lambda s: owed(s) and unclaimed(s)

from collections import deque


def reachable(n):
    init = ("approved", ("idle",) * n, 0)
    seen, queue = {init}, deque([init])
    while queue:
        for after in steps(queue.popleft()):
            if after not in seen:
                seen.add(after)
                queue.append(after)
    return seen


def diagnose(candidate, n):
    if not all(map(candidate, reachable(n))):
        return "not an invariant"
    if first_cti(candidate, n):
        return "too weak"
    return "inductive"


def busy(s):
    return inv(s) and sum(p != "idle" for p in s[1]) <= 1


assert len(reachable(2)) == 8 and len(reachable(6)) == 76
assert diagnose(no_double, 2) == "too weak"
assert diagnose(owed, 2) == "too weak"
both = lambda s: no_double(s) and unclaimed(s)
assert diagnose(both, 3) == "too weak"
assert all(diagnose(inv, n) == "inductive" for n in range(1, 6))
assert diagnose(busy, 2) == "not an invariant"
assert diagnose(lambda s: False, 2) == "not an invariant"
print("all asserts pass")
