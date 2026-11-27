WORKERS = "AB"
TTL = 2


def next_steps(state, max_time, lookup=False):
    now, status, owner, pc, transfers, keys, crashed = state
    known = any(k[0] == 4471 for k in keys)

    def at(i, to):
        return pc[:i] + (to,) + pc[i + 1:]

    if now < max_time:
        yield (now + 1, status, owner, pc, transfers, keys, crashed)
    for k in keys:
        if now >= k[1] + TTL:
            yield (now, status, owner, pc, transfers, keys - {k},
                   crashed)
    for i, w in enumerate(WORKERS):
        p = pc[i]
        if p == "idle" and status == "approved":
            yield (now, "claimed", w, at(i, "claimed"), transfers,
                   keys, crashed)
        if p == "idle" and status == "claimed" and owner == w:
            to = "looking" if lookup else "claimed"
            yield (now, status, owner, at(i, to), transfers, keys,
                   crashed)
        if p == "idle" and status == "paid":
            yield (now, status, owner, at(i, "done"), transfers, keys,
                   crashed)
        if p == "claimed":
            if known:
                yield (now, status, owner, at(i, "sent"), transfers,
                       keys, crashed)
            else:
                yield (now, status, owner, at(i, "sent"),
                       transfers + 1, keys | {(4471, now)}, crashed)
        if p == "looking":
            to = "sent" if transfers > 0 else "claimed"
            yield (now, status, owner, at(i, to), transfers, keys,
                   crashed)
        if p == "sent":
            yield (now, "paid", owner, at(i, "done"), transfers, keys,
                   crashed)
        if p in ("claimed", "looking", "sent") and not crashed:
            yield (now, status, owner, at(i, "idle"), transfers, keys,
                   True)


def reachable(init, max_time, lookup=False):
    seen, todo = {init}, [init]
    while todo:
        for after in next_steps(todo.pop(), max_time, lookup):
            if after not in seen:
                seen.add(after)
                todo.append(after)
    return seen


init = (0, "approved", "nobody", ("idle", "idle"), 0, frozenset(),
        False)

short = reachable(init, 1)
weekend = reachable(init, 3)
looked = reachable(init, 3, lookup=True)
assert len(short) == 62 and max(s[4] for s in short) == 1
assert len(weekend) == 238 and max(s[4] for s in weekend) == 2
assert len(looked) == 228 and max(s[4] for s in looked) == 1
print(len(short), len(weekend), len(looked))
