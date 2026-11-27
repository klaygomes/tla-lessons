from collections import deque
from functools import lru_cache
import itertools

def put(t, i, v):
    return t[:i] + (v,) + t[i + 1:]

def run(labels, g0, l0, start, n, ok=lambda g: True,
        paid=None, fair=True):
    init = (g0, (l0,) * n, (start,) * n)
    def succ(s):
        g, loc, pc = s
        out = []
        for i in range(n):
            if pc[i] in labels:
                for g2, l2, nxt in labels[pc[i]](g, loc[i], i):
                    out.append((g2, put(loc, i, l2), put(pc, i, nxt)))
        return out
    parent = {init: None}
    order, q = [], deque([init])
    generated = 1
    while q:
        s = q.popleft()
        order.append(s)
        nxt = succ(s)
        generated += len(nxt) + (all(p == "Done" for p in s[2]))
        for t in nxt:
            if t not in parent:
                parent[t] = s
                q.append(t)
    def trace(s):
        out = []
        while s is not None:
            out.append(s)
            s = parent[s]
        return out[::-1]
    bad = next((s for s in order if not ok(s[0])), None)
    edges = {s: succ(s) for s in order}
    color = {}
    def cyc(s):
        color[s] = 1
        for t in edges[s]:
            if color.get(t) == 1 or (t not in color and cyc(t)):
                return True
        color[s] = 2
        return False
    acyclic = not any(s not in color and cyc(s) for s in order)
    @lru_cache(None)
    def paths(s):
        if not edges[s]:
            return (1, 0 if ok(s[0]) else 1)
        a = b = 0
        for t in edges[s]:
            x, y = paths(t)
            a += x
            b += y
        return (a, b)
    res = dict(states=len(order), generated=generated,
               acyclic=acyclic,
               depth=max(len(trace(s)) for s in order),
               bad_steps=len(trace(bad)) - 1 if bad else None,
               bad_trace=[s[2] for s in trace(bad)] if bad else None)
    if acyclic:
        res["behaviors"], res["pay_twice"] = paths(init)
    if paid:
        stuck = [s for s in order if not paid(s[0])
                 and (not fair or not edges[s])]
        res["lassos"] = len(stuck)
    return res

def single(b1, b2, b3):
    stm = ["test", "claimed", "send", "mark"]
    cuts = [True, b1, b2, b3]
    blocks, cur = [], []
    for s, c in zip(stm, cuts):
        if c and cur:
            blocks.append(cur)
            cur = []
        cur.append(s)
    blocks.append(cur)
    for b in blocks:
        if "claimed" in b and "mark" in b:
            return None
    names = [f"L{i}" for i in range(len(blocks))]
    labels = {}
    for i, b in enumerate(blocks):
        nxt = names[i + 1] if i + 1 < len(blocks) else "Done"
        def f(g, loc, me, b=b, nxt=nxt):
            st, t = g
            for s in b:
                if s == "test" and st != "approved":
                    return [((st, t), loc, "Done")]
                if s == "claimed":
                    st = "claimed"
                if s == "send":
                    t += 1
                if s == "mark":
                    st = "paid"
            return [((st, t), loc, nxt)]
        labels[names[i]] = f
    return labels

ok1 = lambda g: g[1] <= 1

def readwrite(merged):
    def read(g, seen, me):
        return [(g, g[0], "claim")]
    def claim(g, seen, me):
        st, t = g
        if merged:
            seen = st
        if seen == "approved":
            return [(("claimed", t), seen, "send")]
        return [(g, seen, "Done")]
    def send(g, seen, me):
        return [((g[0], g[1] + 1), seen, "mark")]
    def mark(g, seen, me):
        return [(("paid", g[1]), seen, "Done")]
    labs = dict(claim=claim, send=send, mark=mark)
    if not merged:
        labs["read"] = read
    return labs, ("read" if not merged else "claim")

W = "ABC"

def desk_labels():
    def poll(g, loc, me):
        st, own, t, k, cr = g
        out = []
        if st == "approved":
            out.append((("claimed", W[me], t, k, cr), loc, "send"))
        if st == "claimed" and own == W[me]:
            out.append((g, loc, "send"))
        if st == "paid":
            out.append((g, loc, "Done"))
        return out
    def crash(g, loc):
        st, own, t, k, cr = g
        return [] if cr else [((st, own, t, k, True), loc, "poll")]
    def send(g, loc, me):
        st, own, t, k, cr = g
        t2 = t if k else t + 1
        return [((st, own, t2, True, cr), loc, "mark")] + crash(g, loc)
    def mark(g, loc, me):
        st, own, t, k, cr = g
        return [(("paid", own, t, k, cr), loc, "Done")] + crash(g, loc)
    return dict(poll=poll, send=send, mark=mark)

DESK0 = ("approved", "nobody", 0, False, False)

LOANS = (4471, 4472)

def twoloans_labels():
    def claim(g, mine, me):
        st, t = g
        return [((put(st, i, "claimed"), t), LOANS[i], "send")
                for i in range(2) if st[i] == "approved"]
    def send(g, mine, me):
        st, t = g
        i = LOANS.index(mine)
        return [((st, put(t, i, t[i] + 1)), mine, "mark")]
    def mark(g, mine, me):
        st, t = g
        i = LOANS.index(mine)
        return [((put(st, i, "paid"), t), mine, "claim")]
    return dict(claim=claim, send=send, mark=mark)

def twoloans_split_labels():
    def pick(g, mine, me):
        st, t = g
        return [(g, LOANS[i], "claim")
                for i in range(2) if st[i] == "approved"]
    def claim(g, mine, me):
        st, t = g
        i = LOANS.index(mine)
        return [((put(st, i, "claimed"), t), mine, "send")]
    def send(g, mine, me):
        st, t = g
        i = LOANS.index(mine)
        return [((st, put(t, i, t[i] + 1)), mine, "mark")]
    def mark(g, mine, me):
        st, t = g
        i = LOANS.index(mine)
        return [((put(st, i, "paid"), t), mine, "pick")]
    return dict(pick=pick, claim=claim, send=send, mark=mark)

def line_graph():
    init = ("approved", 0, "free", ("claim", "claim"), "take")
    def succ(s):
        st, t, line, pc, r = s
        out = []
        for i in range(2):
            if pc[i] == "claim" and st == "approved":
                out.append((i, ("claimed", t, line,
                                put(pc, i, "send"), r)))
            if pc[i] == "send" and line == "free":
                out.append((i, (st, t + 1, line,
                                put(pc, i, "mark"), r)))
            if pc[i] == "mark":
                out.append((i, ("paid", t, line,
                                put(pc, i, "Done"), r)))
        if r == "take" and line == "free":
            out.append(("r", (st, t, "busy", pc, "give")))
        if r == "give":
            out.append(("r", (st, t, "free", pc, "take")))
        return out
    seen, todo, edges = {init}, [init], {}
    while todo:
        s = todo.pop()
        edges[s] = succ(s)
        for _, t in edges[s]:
            if t not in seen:
                seen.add(t)
                todo.append(t)
    return seen, edges

def sccs(nodes, edges):
    index, low, stack, on, out = {}, {}, [], set(), []
    counter = [0]
    def visit(v):
        index[v] = low[v] = counter[0]
        counter[0] += 1
        stack.append(v)
        on.add(v)
        for _, w in edges[v]:
            if w not in nodes:
                continue
            if w not in index:
                visit(w)
                low[v] = min(low[v], low[w])
            elif w in on:
                low[v] = min(low[v], index[w])
        if low[v] == index[v]:
            comp = set()
            while True:
                w = stack.pop()
                on.discard(w)
                comp.add(w)
                if w == v:
                    break
            out.append(comp)
    for v in nodes:
        if v not in index:
            visit(v)
    return out

def fair_cycle(nodes, edges, fairness):
    for comp in sccs(nodes, edges):
        taken = {p for s in comp for p, t in edges[s] if t in comp}
        ok, drop = True, set()
        for proc, kind in fairness.items():
            if proc in taken:
                continue
            en = {s for s in comp if any(p == proc for p, _ in edges[s])}
            if not en:
                continue
            if kind == "WF" and en == comp:
                ok = False
            if kind == "SF":
                drop |= en
        if not ok:
            continue
        if not drop:
            return comp
        rest = comp - drop
        if rest:
            found = fair_cycle(rest, edges, fairness)
            if found:
                return found
    return None

if __name__ == "__main__":
    print("label placements (b1 check|claim, b2 claim|send,",
          "b3 send|mark):")
    for n in (2, 3):
        for b in itertools.product((0, 1), repeat=3):
            labs = single(*b)
            if labs is None:
                print(n, b, "translator refuses: status twice")
                continue
            r = run(labs, ("approved", 0), None, "L0", n, ok1)
            print(n, b, {k: r[k] for k in ("states", "generated",
                  "depth", "bad_steps", "behaviors", "pay_twice")})
    print()
    for name, merged in (("ReadWrite", False), ("ReadWriteOne", True)):
        for n in (2, 3):
            labs, start = readwrite(merged)
            r = run(labs, ("approved", 0), "nothing", start, n, ok1)
            print(name, n, {k: r[k] for k in ("states", "generated",
                  "depth", "bad_steps", "behaviors", "pay_twice")})
    print()
    for n in (2, 3):
        for fair in (True, False):
            r = run(desk_labels(), DESK0, None, "poll", n,
                    lambda g: g[2] <= 1, paid=lambda g: g[0] == "paid",
                    fair=fair)
            print("Desk", n, "fair" if fair else "unfair",
                  {k: r[k] for k in ("states", "generated", "depth",
                   "acyclic", "bad_steps", "lassos")})
    print()
    for n in (2, 3):
        r = run(twoloans_labels(), (("approved",) * 2, (0, 0)), 0,
                "claim", n, lambda g: max(g[1]) <= 1)
        print("TwoLoans", n, {k: r[k] for k in ("states", "generated",
              "depth", "acyclic", "bad_steps")})
    for n in (2, 3):
        r = run(twoloans_split_labels(), (("approved",) * 2, (0, 0)),
                0, "pick", n, lambda g: max(g[1]) <= 1)
        print("TwoLoansSplit", n, {k: r[k] for k in ("states",
              "generated", "depth", "acyclic", "bad_steps")})
    print()
    nodes, edges = line_graph()
    unpaid = {s for s in nodes if s[0] != "paid"}
    print("Line states", len(nodes),
          "max transfers", max(s[1] for s in nodes))
    for kind in ("WF", "SF"):
        c = fair_cycle(unpaid, edges, {0: kind, 1: kind, "r": "WF"})
        print("Line workers", kind, "unpaid fair cycle:",
              sorted(c) if c else None)
    print()
    r = run(single(1, 1, 1), ("approved", 0), None, "L0", 2, ok1)
    print("TwoLabels shortest trace:")
    for pc in r["bad_trace"]:
        print(" ", pc)
