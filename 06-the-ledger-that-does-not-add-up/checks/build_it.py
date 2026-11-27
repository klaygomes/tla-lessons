from collections import deque

LOANS, POT = (4471, 4472), 200_000
AMOUNT = {4471: 50_000, 4472: 30_000}


def steps(s, keyed):
    fund, credit, status, outbox, held, crashed = s
    for i, l in enumerate(LOANS):
        def put(t, v):
            return t[:i] + (v,) + t[i + 1:]
        if status[i] == "approved":
            yield "work", (fund - AMOUNT[l], credit, put(status, "paid"),
                           outbox | {l}, held, crashed)
        if l in outbox and l not in held:
            new = AMOUNT[l] if keyed else credit[i] + AMOUNT[l]
            yield "work", (fund, put(credit, new), status, outbox,
                           held | {l}, crashed)
        if l in held:
            yield "work", (fund, credit, status, outbox - {l},
                           held - {l}, crashed)
    if held and not crashed:
        yield "crash", (fund, credit, status, outbox, frozenset(), True)


def total(s):
    fund, credit, _, outbox, _, _ = s
    c = dict(zip(LOANS, credit))
    flying = sum(AMOUNT[l] for l in outbox if c[l] == 0)
    return fund + flying + sum(credit)


def settled(s):
    return not s[3] and all(c == AMOUNT[l] for l, c in zip(LOANS, s[1]))


def check(keyed):
    init = (POT, (0, 0), ("approved", "approved"), frozenset(),
            frozenset(), False)
    depth, todo = {init: 0}, deque([init])
    while todo:
        s = todo.popleft()
        for _, t in steps(s, keyed):
            if t not in depth:
                depth[t] = depth[s] + 1
                todo.append(t)
    states = list(depth)
    bad = [s for s in states if total(s) != POT]
    stuck = [s for s in states if not settled(s)
             and "work" not in {k for k, _ in steps(s, keyed)}]
    first_bad = min((depth[s] for s in bad), default=None)
    return states, bad, stuck, first_bad


states, bad, stuck, _ = check(keyed=True)
assert len(states) == 37 and not bad and not stuck
states, bad, stuck, first_bad = check(keyed=False)
assert len(states) == 49 and first_bad == 4
print("keyed: 37 states, none bad, none stuck")
print("plain:", len(states), "states,", len(bad), "bad,",
      len(stuck), "stuck, first bad after", first_bad, "steps")
