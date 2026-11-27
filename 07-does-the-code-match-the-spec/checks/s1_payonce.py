def pay(state):
    status, transfers = state
    if status == "approved":
        yield ("paid", transfers + 1)

init = ("approved", 0)
seen, todo = {init}, [init]
while todo:
    for after in pay(todo.pop()):
        if after not in seen:
            seen.add(after)
            todo.append(after)
print(sorted(seen))
