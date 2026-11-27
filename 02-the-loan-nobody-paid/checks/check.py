from collections import deque

def steps(s, n, crash, lease, resume, key):
    status, owner, pc, t, k, crashed = s
    for w in range(n):
        name = "ABC"[w]
        def put(v): return pc[:w] + (v,) + pc[w+1:]
        if pc[w] == "idle" and status == "approved":
            who = name if resume else "nobody"
            yield f"Claim({name})", True, ("claimed", who, put("claimed"), t, k, crashed)
        if resume and pc[w] == "idle" and status == "claimed" and owner == name:
            yield f"Resume({name})", True, (status, owner, put("claimed"), t, k, crashed)
        if pc[w] == "idle" and status == "paid":
            yield f"Skip({name})", True, (status, owner, put("done"), t, k, crashed)
        if pc[w] == "claimed":
            t2 = t if (key and k) else t + 1
            yield f"Send({name})", True, (status, owner, put("sent"), t2, key, crashed)
        if pc[w] == "sent":
            yield f"Mark({name})", True, ("paid", owner, put("done"), t, k, crashed)
        if crash and not crashed and pc[w] in ("claimed", "sent"):
            yield f"Crash({name})", False, (status, owner, put("idle"), t, k, True)
    if lease and status == "claimed":
        yield "Expire", True, ("approved", owner, pc, t, k, crashed)

def explore(n=2, crash=False, lease=False, resume=False, key=False, fair=True):
    init = ("approved", "nobody", ("idle",) * n, 0, False, False)
    parent = {init: None}
    q = deque([init]); order = []
    while q:
        s = q.popleft(); order.append(s)
        for a, _, s2 in steps(s, n, crash, lease, resume, key):
            if s2 not in parent:
                parent[s2] = (s, a); q.append(s2)
    def trace(s):
        out = []
        while parent[s]:
            s, a = parent[s]; out.append(a)
        return out[::-1]
    bad = next((s for s in order if s[3] > 1), None)
    edges = {s: [s2 for *_, s2 in steps(s, n, crash, lease, resume, key)] for s in order}
    color = {}
    def cyclic(s):
        color[s] = 1
        for s2 in edges[s]:
            if color.get(s2) == 1 or (s2 not in color and cyclic(s2)): return True
        color[s] = 2
        return False
    acyclic = not any(s not in color and cyclic(s) for s in order)
    def stuck(s):
        if s[0] == "paid": return False
        return not fair or not any(f for _, f, _ in steps(s, n, crash, lease, resume, key))
    lassos = [s for s in order if stuck(s)]
    stuck_claimed = [s for s in order if s[0] == "claimed" and stuck(s)]
    return dict(states=len(order), acyclic=acyclic,
                double=trace(bad) if bad else None,
                lassos=len(lassos), stuck_claimed=len(stuck_claimed),
                first_lasso=trace(lassos[0]) + ["stutter forever"] if lassos else None)

for name, kw in [("Live (no fairness)", dict(fair=False)),
                 ("LiveFair", dict()),
                 ("Crash", dict(crash=True)),
                 ("Crash, no fairness", dict(crash=True, fair=False)),
                 ("Lease", dict(crash=True, lease=True)),
                 ("Resume", dict(crash=True, resume=True)),
                 ("IdemKey", dict(crash=True, resume=True, key=True)),
                 ("IdemKey 3 workers", dict(n=3, crash=True, resume=True, key=True)),
                 ("LeaseKey", dict(crash=True, lease=True, key=True)),
                 ("Key only, no resume", dict(crash=True, key=True))]:
    print(name, explore(**kw))

print()
print("lab combinations, crash on (n, fair, lease, resume, key):")
for n in (2, 3):
    for fair in (False, True):
        for lease in (False, True):
            for resume in (False, True):
                for key in (False, True):
                    r = explore(n=n, crash=True, lease=lease,
                                resume=resume, key=key, fair=fair)
                    safe = r["double"] is None
                    live = r["lassos"] == 0
                    print(n, fair, lease, resume, key, r["states"],
                          "safe" if safe else f"double {len(r['double'])} steps",
                          "live" if live else f"stuck {r['lassos']}")
