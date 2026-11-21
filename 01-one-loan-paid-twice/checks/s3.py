from collections import deque


def check(init, invariant):
    parent = {init: None}
    queue = deque([init])
    while queue:
        state = queue.popleft()
        if not invariant(state):
            trace = []
            while state is not None:
                trace.append(state)
                state = parent[state]
            return trace[::-1]
        for _, after in next_states(state):
            if after not in parent:
                parent[after] = state
                queue.append(after)
    return len(parent)

no_double_payout = lambda state: state[2] <= 1
for state in check(init, no_double_payout):
    print(state)
