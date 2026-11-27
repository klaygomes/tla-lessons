def books_say(status):
    return (status, 1 if status == "paid" else 0)

tuesday = ["approved", "approved", "paid", "paid"]
bank = [0, 0, 0, 0]
print(books_say(tuesday[-1]), "but the bank made", bank[-1])
