

def behaviors(state):
    moves = list(next_states(state))
    if not moves:
        return [[state]]
    return [[state] + rest
            for _, after in moves
            for rest in behaviors(after)]

every = behaviors(init)
twice = [b for b in every if b[-1][2] > 1]
print(len(every), "behaviors,", len(twice), "pay twice")
