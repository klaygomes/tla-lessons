def claim(status, transfers):
    if status == "approved":
        return "claimed", transfers, "send"
    return status, transfers, "Done"

def send(status, transfers):
    return status, transfers + 1, "mark"

def mark(status, transfers):
    return "paid", transfers, "Done"

NOOR = {"claim": claim, "send": send, "mark": mark}

status, transfers = "approved", 0
pc = {"A": "claim", "B": "claim"}
from collections import deque

def explore(prog, workers="AB"):
    first = next(iter(prog))
    start = ("approved", 0, (first,) * len(workers))
    parent, queue = {start: None}, deque([start])
    while queue:
        state = queue.popleft()
        status, transfers, pc = state
        if transfers > 1:
            path = []
            while state:
                path.append(state)
                state = parent[state]
            return path[::-1]
        for i, at in enumerate(pc):
            if at in prog:
                s, t, to = prog[at](status, transfers)
                after = (s, t, pc[:i] + (to,) + pc[i + 1:])
                if after not in parent:
                    parent[after] = state
                    queue.append(after)
    return len(parent)

print(explore(NOOR), explore(NOOR, "ABC"))
def check(status, transfers):
    if status == "approved":
        return status, transfers, "claim"
    return status, transfers, "Done"

def write_claim(status, transfers):
    return "claimed", transfers, "send"

HONEST = {"check": check, "claim": write_claim,
          "send": send, "mark": mark}
def merge(first, second, second_label):
    def both(status, transfers):
        s, t, to = first(status, transfers)
        if to == second_label:
            return second(s, t)
        return s, t, to
    return both

ONE = {"check": merge(check, write_claim, "claim"),
       "send": send, "mark": mark}
P101 = {"check": check,
        "claim": merge(write_claim, send, "send"),
        "mark": mark}
P001 = {"check": merge(merge(check, write_claim, "claim"),
                       send, "send"),
        "mark": mark}
print(explore(ONE), len(explore(P101)) - 1, explore(P001))
print(explore(ONE, "ABC"), explore(P001, "ABC"))
assert explore(ONE) == 12 and explore(ONE, "ABC") == 32
assert len(explore(P101)) - 1 == 4
assert explore(P001) == 8
