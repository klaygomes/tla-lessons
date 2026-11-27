import itertools
from collections import deque


def successors(s, n_w, n_l, cap, bank_mode, counter, florist):
    status, owner, pc, held, tr, keys, crashed, retries = s

    def put(t, i, v):
        return t[:i] + (v,) + t[i + 1:]

    def key_of(l):
        return "florist" if l in florist else l

    def bank(l):
        if bank_mode == "none":
            return put(tr, l, tr[l] + 1), keys
        k = l if bank_mode == "loan" else key_of(l)
        if k in keys:
            return tr, keys
        return put(tr, l, tr[l] + 1), keys | {k}

    for w in range(n_w):
        if pc[w] == "idle":
            for l in range(n_l):
                if status[l] == "approved":
                    yield "Claim", True, (
                        put(status, l, "claimed"), put(owner, l, w),
                        put(pc, w, "claimed"), put(held, w, l),
                        tr, keys, crashed, retries)
                if status[l] == "claimed" and owner[l] == w:
                    yield "Resume", True, (
                        status, owner, put(pc, w, "claimed"),
                        put(held, w, l), tr, keys, crashed, retries)
        if pc[w] == "claimed":
            tr2, k2 = bank(held[w])
            yield "Send", True, (status, owner, put(pc, w, "sent"),
                                 held, tr2, k2, crashed, retries)
            if cap is None or retries < cap:
                r2 = retries + 1 if counter else retries
                yield "Lost", True, (status, owner, pc, held, tr2,
                                     k2, crashed, r2)
        if pc[w] == "sent":
            yield "Mark", True, (
                put(status, held[w], "paid"), owner,
                put(pc, w, "idle"), put(held, w, -1),
                tr, keys, crashed, retries)
        if not crashed and pc[w] != "idle":
            yield "Crash", False, (status, owner, put(pc, w, "idle"),
                                   put(held, w, -1), tr, keys, True,
                                   retries)


def init(n_w, n_l):
    return (("approved",) * n_l, (-1,) * n_l, ("idle",) * n_w,
            (-1,) * n_w, (0,) * n_l, frozenset(), False, 0)


def permute(s, pw, pl):
    status, owner, pc, held, tr, keys, crashed, retries = s
    n_w, n_l = len(pc), len(status)

    def by_loan(t, f=lambda x: x):
        out = [None] * n_l
        for l in range(n_l):
            out[pl[l]] = f(t[l])
        return tuple(out)

    def by_worker(t, f=lambda x: x):
        out = [None] * n_w
        for w in range(n_w):
            out[pw[w]] = f(t[w])
        return tuple(out)

    ow = lambda w: -1 if w < 0 else pw[w]
    ol = lambda l: -1 if l < 0 else pl[l]
    k2 = tuple(sorted(pl[k] for k in keys))
    return (by_loan(status), by_loan(owner, ow), by_worker(pc),
            by_worker(held, ol), by_loan(tr), k2, crashed, retries)


def no_double(s):
    return all(t <= 1 for t in s[4])


def paid_means_money(s):
    return all(st != "paid" or t == 1 for st, t in zip(s[0], s[4]))


def explore(n_w, n_l, cap=1, bank_mode="loan", counter=True,
            symmetry=False, constraint=None,
            invariants=(no_double,), florist=(), limit=None):
    perms = [(pw, pl)
             for pw in itertools.permutations(range(n_w))
             for pl in itertools.permutations(range(n_l))]

    def canon(s):
        if not symmetry:
            return s
        return min(permute(s, pw, pl) for pw, pl in perms)

    s0 = init(n_w, n_l)
    parent = {canon(s0): None}
    q = deque([(s0, 0)])
    generated, depth, edges = 1, 1, {}

    def trace(c):
        out = []
        while parent[c]:
            c, a = parent[c]
            out.append(a)
        return out[::-1]

    while q:
        s, d = q.popleft()
        depth = max(depth, d + 1)
        if constraint and not constraint(s, d):
            continue
        out = []
        for a, fair, s2 in successors(s, n_w, n_l, cap, bank_mode,
                                      counter, florist):
            generated += 1
            c2 = canon(s2)
            out.append((fair, c2))
            if c2 in parent:
                continue
            if not all(inv(s2) for inv in invariants):
                parent[c2] = (canon(s), a)
                return dict(bad=trace(c2), states=len(parent) - 1)
            parent[c2] = (canon(s), a)
            if constraint and not constraint(s2, d + 1):
                del parent[c2]
                continue
            q.append((s2, d + 1))
        edges[canon(s)] = out
        if limit and len(parent) > limit:
            return dict(states=len(parent), queue=len(q),
                        depth=depth, stopped=True)
    stuck = [s for s, out in edges.items()
             if not any(f for f, c in out if c != s)
             and any(x != "paid" for x in s[0])]
    return dict(states=len(parent), generated=generated,
                depth=depth, stuck=len(stuck))


def budget(s, d):
    return d < 4


def bounds(s, d):
    return s[7] <= 1


if __name__ == "__main__":
    print("growth, MaxRetries 1 (workers, loans):")
    for n_w in (1, 2, 3, 4):
        for n_l in (1, 2, 3, 4):
            if n_w * n_l <= 12:
                print(n_w, n_l, explore(n_w, n_l))
    print("symmetry:")
    for n_w, n_l in ((2, 2), (3, 3), (3, 4), (4, 4)):
        print(n_w, n_l, explore(n_w, n_l, symmetry=True))
    print("MaxRetries 0..4, 2 workers 2 loans:")
    for cap in range(5):
        print(cap, explore(2, 2, cap=cap))
    print("constraint retries <= 1, unbounded Lost, 3x3:",
          explore(3, 3, cap=None, constraint=bounds))
    print("no counter 2x2:", explore(2, 2, cap=None, counter=False))
    print("no counter 3x3:", explore(3, 3, cap=None, counter=False))
    print("unbounded 3x3, stopped:",
          explore(3, 3, cap=None, limit=300000))
    for n in (1, 2, 3):
        print(f"no key {n}x{n}:",
              explore(n, n, bank_mode="none"))
    inv = (no_double, paid_means_money)
    print("florist one van:", explore(3, 2, bank_mode="account",
                                      florist=(1,), invariants=inv))
    print("florist two vans:", explore(3, 3, bank_mode="account",
                                       florist=(1, 2), invariants=inv))
    print("florist two vans, budget:",
          explore(3, 3, bank_mode="account", florist=(1, 2),
                  invariants=inv, constraint=budget))
    print()
    print("lab table: workers loans mode symmetry -> states")
    for n_w in (1, 2, 3):
        for n_l in (1, 2, 3):
            for mode in ("R0", "R1", "R2", "nocount"):
                cap = None if mode == "nocount" else int(mode[1])
                for sym in (False, True):
                    r = explore(n_w, n_l, cap=cap,
                                counter=mode != "nocount",
                                symmetry=sym)
                    print(n_w, n_l, mode, sym, r["states"],
                          "stuck" if r["stuck"] else "live")
