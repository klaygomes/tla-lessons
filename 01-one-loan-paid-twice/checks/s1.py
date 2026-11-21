WORKERS = "AB"

def next_states(state):
    status, pc, transfers = state
    for i, w in enumerate(WORKERS):
        def move(to):
            return pc[:i] + (to,) + pc[i + 1:]
        if pc[i] == "idle" and status == "approved":
            yield f"Check({w})", (status, move("checked"),
                                  transfers)
        if pc[i] == "idle" and status == "paid":
            yield f"Skip({w})", (status, move("done"), transfers)
        if pc[i] == "checked":
            yield f"Send({w})", (status, move("sent"),
                                 transfers + 1)
        if pc[i] == "sent":
            yield f"Mark({w})", ("paid", move("done"), transfers)

init = ("approved", ("idle", "idle"), 0)
for name, after in next_states(init):
    print(name, after)
