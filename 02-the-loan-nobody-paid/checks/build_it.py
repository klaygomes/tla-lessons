WORKERS = "AB"

def next_steps(state):
    status, owner, pc, transfers, keys, crashed = state
    for i, w in enumerate(WORKERS):
        def move(to):
            return pc[:i] + (to,) + pc[i + 1:]
        if pc[i] == "idle" and status == "approved":
            yield "work", ("claimed", w, move("claimed"),
                           transfers, keys, crashed)
        if pc[i] == "idle" and status == "claimed" and owner == w:
            yield "work", (status, owner, move("claimed"),
                           transfers, keys, crashed)
        if pc[i] == "idle" and status == "paid":
            yield "work", (status, owner, move("done"),
                           transfers, keys, crashed)
        if pc[i] == "claimed":
            paid = transfers if 4471 in keys else transfers + 1
            yield "work", (status, owner, move("sent"),
                           paid, keys | {4471}, crashed)
        if pc[i] == "sent":
            yield "work", ("paid", owner, move("done"),
                           transfers, keys, crashed)
        if pc[i] in ("claimed", "sent") and not crashed:
            yield "crash", (status, owner, move("idle"),
                            transfers, keys, True)

def reachable(init):
    seen, todo = {init}, [init]
    while todo:
        for _, after in next_steps(todo.pop()):
            if after not in seen:
                seen.add(after)
                todo.append(after)
    return seen

def may_stop(state, fair):
    kinds = {kind for kind, _ in next_steps(state)}
    return not (fair and "work" in kinds)

init = ("approved", "nobody", ("idle", "idle"), 0,
        frozenset(), False)
states = reachable(init)
stuck = [s for s in states if s[0] != "paid" and may_stop(s, True)]
assert len(states) == 23 and not stuck
assert max(s[3] for s in states) == 1
print(len(states), "states, none stuck, at most one transfer")
