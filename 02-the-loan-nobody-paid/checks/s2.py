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

init = ("approved", ("idle", "idle"), 0, False)
states = reachable(init)
for fair in (False, True):
    stuck = [s for s in sorted(states)
             if s[0] != "paid" and may_stop(s, fair)]
    print(f"fair={fair}: {len(stuck)} of {len(states)} states")
print(*stuck, sep="\n")
