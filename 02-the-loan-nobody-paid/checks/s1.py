WORKERS = "AB"

def next_steps(state):
    status, pc, transfers, crashed = state
    for i, w in enumerate(WORKERS):
        def move(to, s=status, t=transfers, c=crashed):
            return s, pc[:i] + (to,) + pc[i + 1:], t, c
        if pc[i] == "idle" and status == "approved":
            yield "work", move("claimed", s="claimed")
        if pc[i] == "idle" and status == "paid":
            yield "work", move("done")
        if pc[i] == "claimed":
            yield "work", move("sent", t=transfers + 1)
        if pc[i] == "sent":
            yield "work", move("done", s="paid")
        if pc[i] in ("claimed", "sent") and not crashed:
            yield "crash", move("idle", c=True)
