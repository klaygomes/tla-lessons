from collections import Counter


def paid_at_bank(transfers):
    return ("paid" if transfers > 0 else "approved", transfers)


def abstract_step(before, after):
    if before == after:
        return "stutter"
    if before[0] == "approved" and after == ("paid",
                                             before[1] + 1):
        return "Pay"
    return "not allowed"


def desk(s, key=True, lease=True, mark_first=False):
    queue, status, pc, keyed, transfers, crashed = s
    hold = (("claimed", "marked", "sent") if mark_first
            else ("claimed", "sent", "confirmed"))
    for i, w in enumerate("AB"):
        def go(to, q=queue, st=status, k=keyed, t=transfers,
               c=crashed):
            return q, st, pc[:i] + (to,) + pc[i + 1:], k, t, c
        p = pc[i]
        paid = transfers if key and keyed else transfers + 1
        if p == "idle" and queue == "visible":
            yield f"Receive({w})", True, go("claimed", q="hidden")
        if mark_first and p == "claimed":
            yield f"Mark({w})", True, go("marked", q="deleted",
                                         st="paid")
        if mark_first and p == "marked":
            yield f"Send({w})", True, go("sent")
        if mark_first and p == "sent":
            yield f"Confirm({w})", True, go("done", k=True, t=paid)
        if not mark_first and p == "claimed":
            yield f"Send({w})", True, go("sent")
        if not mark_first and p == "sent":
            yield f"Confirm({w})", True, go("confirmed", k=True,
                                            t=paid)
        if not mark_first and p == "confirmed":
            yield f"Mark({w})", True, go("done", q="deleted",
                                         st="paid")
        if p in hold and not crashed:
            yield f"Crash({w})", False, go("idle", c=True)
    if queue == "hidden":
        yield "Expire", lease, ("visible",) + s[1:]


def refines(**kw):
    init = ("visible", "approved", ("idle", "idle"), False,
            0, False)
    seen, todo, kinds = {init}, [init], Counter()
    while todo:
        s = todo.pop()
        for _, _, t in desk(s, **kw):
            a, b = paid_at_bank(s[4]), paid_at_bank(t[4])
            kinds[abstract_step(a, b)] += 1
            if t not in seen:
                seen.add(t)
                todo.append(t)
    return seen, kinds


def stuck(seen, **kw):
    return [s for s in seen if s[4] == 0 and not any(
        fair for _, fair, _ in desk(s, **kw))]


seen, kinds = refines()
assert len(seen) == 99 and "not allowed" not in kinds
assert not stuck(seen)
seen, kinds = refines(mark_first=True)
assert len(seen) == 60 and "not allowed" not in kinds
assert len(stuck(seen, mark_first=True)) == 1
print(stuck(seen, mark_first=True))
seen, kinds = refines(mark_first=True, key=False)
print(len(seen), dict(kinds))
print("build-it asserts pass")
