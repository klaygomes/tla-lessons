from itertools import permutations, product

LOANS = ["L4471", "L4472"]
SHAPES = [("idle", None)] + [(pc, l) for pc in ("claimed", "sent")
                             for l in LOANS]
states = list(product(SHAPES, repeat=3))


def rename(state, loan_map):
    return tuple((pc, loan_map.get(l)) for pc, l in state)


def canon(state, loans_too):
    maps = [dict(zip(LOANS, p)) for p in permutations(LOANS)]
    if not loans_too:
        maps = maps[:1]
    return min(tuple(sorted(rename(state, m), key=str))
               for m in maps)


workers_only = {canon(s, False) for s in states}
both = {canon(s, True) for s in states}
assert len(states) == 125
assert len(workers_only) == 35
assert len(both) == 19
print(len(states), len(workers_only), len(both))
