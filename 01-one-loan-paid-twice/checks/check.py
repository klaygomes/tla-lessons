import sys
from collections import deque
from fractions import Fraction
from functools import lru_cache

def steps_naive(state, n, recheck=False):
    status, pc, t = state
    for w in range(n):
        p = pc[w]
        def put(v): return pc[:w] + (v,) + pc[w+1:]
        if p == "idle" and status == "approved":
            yield f"Check({'ABC'[w]})", (status, put("checked"), t)
        if p == "idle" and status == "paid":
            yield f"Skip({'ABC'[w]})", (status, put("done"), t)
        if recheck:
            if p == "checked" and status == "approved":
                yield f"Recheck({'ABC'[w]})", (status, put("rechecked"), t)
            if p == "checked" and status == "paid":
                yield f"Recheck({'ABC'[w]})", (status, put("done"), t)
            if p == "rechecked":
                yield f"Send({'ABC'[w]})", (status, put("sent"), t + 1)
        elif p == "checked":
            yield f"Send({'ABC'[w]})", (status, put("sent"), t + 1)
        if p == "sent":
            yield f"Mark({'ABC'[w]})", ("paid", put("done"), t)

def steps_claim(state, n):
    status, pc, t = state
    for w in range(n):
        p = pc[w]
        def put(v): return pc[:w] + (v,) + pc[w+1:]
        if p == "idle" and status == "approved":
            yield f"Claim({'ABC'[w]})", ("claimed", put("claimed"), t)
        if p == "idle" and status != "approved":
            yield f"Skip({'ABC'[w]})", (status, put("done"), t)
        if p == "claimed":
            yield f"Send({'ABC'[w]})", (status, put("sent"), t + 1)
        if p == "sent":
            yield f"Mark({'ABC'[w]})", ("paid", put("done"), t)

def bfs(steps, n):
    init = ("approved", ("idle",) * n, 0)
    parent = {init: None}
    q = deque([init]); bad = None
    while q:
        s = q.popleft()
        if s[2] > 1 and bad is None: bad = s
        for a, s2 in steps(s):
            if s2 not in parent:
                parent[s2] = (s, a); q.append(s2)
    trace = []
    s = bad
    while s is not None:
        trace.append((parent[s][1] if parent[s] else "Init", s))
        s = parent[s][0] if parent[s] else None
    return len(parent), trace[::-1]

def behaviors(steps, init):
    @lru_cache(None)
    def go(s):
        nxt = list(steps(s))
        if not nxt: return (1, int(s[2] > 1), Fraction(int(s[2] > 1)))
        tot = bad = 0; pr = Fraction(0)
        for a, s2 in nxt:
            t, b, p = go(s2); tot += t; bad += b; pr += p / len(nxt)
        return (tot, bad, pr)
    return go(init)

for name, mk in [("naive", lambda n: lambda s: steps_naive(s, n)),
                 ("recheck", lambda n: lambda s: steps_naive(s, n, True)),
                 ("claim", lambda n: lambda s: steps_claim(s, n))]:
    for n in (1, 2, 3):
        cnt, tr = bfs(mk(n), n)
        tot, bad, pr = behaviors(mk(n), ("approved", ("idle",)*n, 0))
        print(f"{name} n={n}: states={cnt} behaviors={tot} bad={bad} randomP={pr} ({float(pr):.3f}) trace_len={len(tr)-1 if tr else None}")
        if tr and n == 2:
            for a, s in tr: print("   ", a, s)
