def paid_at_bank(transfers):
    return ("paid" if transfers > 0 else "approved", transfers)

def abstract_step(before, after):
    if before == after:
        return "stutter"
    if before[0] == "approved" and after == ("paid",
                                             before[1] + 1):
        return "Pay"
    return "not allowed"

slow_a = [0, 0, 0, 0, 0, 1, 1, 1, 1, 1]
kinds = [abstract_step(paid_at_bank(a), paid_at_bank(b))
         for a, b in zip(slow_a, slow_a[1:])]
for i, kind in enumerate(kinds, 1):
    if kind != "stutter":
        print("step", i, kind)
print(kinds.count("stutter"), "stutters")

def desk(s, key=True, lease=True):
    queue, status, pc, keyed, transfers, crashed = s
    for i, w in enumerate("AB"):
        def go(to, q=queue, st=status, k=keyed, t=transfers,
               c=crashed):
            return q, st, pc[:i] + (to,) + pc[i + 1:], k, t, c
        if pc[i] == "idle" and queue == "visible":
            yield f"Receive({w})", True, go("claimed", q="hidden")
        if pc[i] == "claimed":
            yield f"Send({w})", True, go("sent")
        if pc[i] == "sent":
            paid = transfers if key and keyed else transfers + 1
            yield f"Confirm({w})", True, go("confirmed", k=True,
                                            t=paid)
        if pc[i] == "confirmed":
            yield f"Mark({w})", True, go("done", q="deleted",
                                         st="paid")
        if pc[i] in ("claimed", "sent", "confirmed"):
            if not crashed:
                yield f"Crash({w})", False, go("idle", c=True)
    if queue == "hidden":
        yield "Expire", lease, ("visible",) + s[1:]

from collections import Counter

def refines(key=True):
    init = ("visible", "approved", ("idle", "idle"), False,
            0, False)
    seen, todo, kinds = {init}, [init], Counter()
    while todo:
        s = todo.pop()
        for _, _, t in desk(s, key=key):
            a, b = paid_at_bank(s[4]), paid_at_bank(t[4])
            kinds[abstract_step(a, b)] += 1
            if t not in seen:
                seen.add(t)
                todo.append(t)
    return seen, kinds

seen, kinds = refines()
print(len(seen), "states", dict(kinds))

print(kinds["stutter"], "of", sum(kinds.values()),
      "steps would be forbidden")

seen, kinds = refines(key=False)
print(len(seen), "states", dict(kinds))

def stuck(seen, lease=True):
    return [s for s in seen if s[4] == 0 and not any(
        fair for _, fair, _ in desk(s, lease=lease))]

seen, kinds = refines()
print(len(stuck(seen)), len(stuck(seen, lease=False)))
print(stuck(seen, lease=False))
