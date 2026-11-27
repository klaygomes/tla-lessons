# The Ledger That Does Not Add Up

## €50,000 that is nowhere

The bakery on the harbour has its money. Loan 4471 was paid out once, with the loan’s id as the bank’s idempotency key, exactly as lesson 2 built it. Since then you have given the spec a clock, kept the checker small enough to finish, and written the worker as a program. The payout desk has been quiet for weeks.

Then it is month-end, and finance runs the reconciliation.

Linden keeps its books in two places. The **treasury ledger** is a table in the payout desk’s own database: it holds this month’s lending pot, €200,000, and every payout is a debit against it. The **loan ledger** belongs to the loans team. It is a separate service with its own database, and it records, for each loan, how much money has gone out to the borrower. Every euro that leaves the treasury should show up in exactly one loan account. Reconciliation is the check that it does: add the treasury balance to everything in the loan accounts, and you should get the pot back.

This month you don’t. The treasury ledger shows a debit of €50,000 for loan 4471. The loan ledger shows nothing for loan 4471 at all. As far as Linden’s books are concerned, €50,000 has left one ledger and arrived in no other. The bakery has the money in the bank; Linden’s books have lost track of it.

You find the worker’s log line, “debited treasury for loan 4471”, and right after it, a deploy. The worker writes the payout down in two steps, one per system:

```ts
async function book(loan: Loan) {
  await treasury.debit(loan.id, loan.amount);
  await loanLedger.credit(loan.id, loan.amount);
}
```

The deploy landed between the two lines.

[[diagram:two-ledgers]]

A colleague reads over your shoulder and shrugs. “Swap the lines. Credit the loan ledger first. If we crash, at least nothing is missing.” Hold that thought. By the end of this lesson the checker will have shown you what that swap does, and you will have built a design in which a crash anywhere leaves the books adding up. The question is this one: **how do you move money between two ledgers so that neither ever shows it twice or not at all?**

## Where is the money?

Let’s track the money by hand. Two loans go out this month: loan 4471, €50,000 to the bakery, and loan 4472, €30,000 to the florist who needs a second van. The pot starts at €200,000 in the treasury, and both loan accounts start at zero.

Each payout is two **writes**: a debit, which takes the amount off the treasury, and a credit, which adds it to the loan’s account. The last column adds up all three numbers. Before you look at it, ask yourself: what should that column say in every row?

| | step | treasury | 4471 | 4472 | total |
|---|---|---|---|---|---|
| 0 | (start) | 200,000 | 0 | 0 | 200,000 |
| 1 | debit 4471 | 150,000 | 0 | 0 | 150,000 |
| 2 | credit 4471 | 150,000 | 50,000 | 0 | 200,000 |
| 3 | debit 4472 | 120,000 | 50,000 | 0 | 170,000 |
| 4 | credit 4472 | 120,000 | 50,000 | 30,000 | 200,000 |

You might have said €200,000 everywhere. It isn’t. Rows 1 and 3 are short, by the loan being moved. Between the debit and the credit, the money has left one ledger and not yet arrived in the other. It is “in the worker’s hands”, which is a polite way of saying it is in no ledger at all. That dip is normal. It lasts a few milliseconds, and the next write fills it.

Now replay this month, with the deploy:

| | step | treasury | 4471 | 4472 | total |
|---|---|---|---|---|---|
| 0 | (start) | 200,000 | 0 | 0 | 200,000 |
| 1 | debit 4471 | 150,000 | 0 | 0 | 150,000 |
| 2 | crash | 150,000 | 0 | 0 | 150,000 |
| 3 | debit 4471 | 100,000 | 0 | 0 | 100,000 |
| 4 | credit 4471 | 100,000 | 50,000 | 0 | 150,000 |

Row 2 is month-end’s finding: the dip, frozen. The crashed worker forgot it was halfway through, so nobody is coming to fill the hole. Rows 3 and 4 are what happens when the restarted worker finds loan 4471 still waiting and starts it again from the top, the way lesson 2’s workers resumed their claims. It debits a second time, credits once, and finishes. Every job is done, and the books are €50,000 short for good.

Notice where the bug lives. Not in any single write: each one moves the right amount the right way. It lives in the *gap* between two writes to two systems, and in what a crash does to that gap.

[[lab]]

## A conservation invariant

The rule you have been checking by eye has a name. Money is never created or destroyed by moving it, only moved, so the total across every place it can be stays the same. A property of that shape, “this sum never changes”, is a **conservation invariant**. Physics has them for energy. Accountants have one for every ledger they have ever closed. Ours says: **the treasury plus every loan account always adds up to the pot.**

It is an invariant like NoDoublePayout from lesson 1: a statement about one state that should be true in every reachable state. What is new is the sum. The loan accounts are not one variable but one number per loan, so before we can write the invariant down, we need a way to add up a function.

### Adding up a function

Remember lesson 1’s pc: a function from workers to their program counters, written `[w \in Workers |-> "idle"]`. The loan accounts are the same kind of thing, a function from loan ids to amounts. Call it credit. In this month’s crash, after row 4, credit takes 4471 to 50,000 and 4472 to 0. We want one number: the sum of credit over all loans, 50,000.

Python has `sum(credit.values())`. The standard modules that ship with TLC export no such operator (Bags, the standard module for multisets, has one, but keeps it private to itself), so we write one. The idea is the one you would use by hand: if there are no loans, the sum is zero; otherwise, pick any loan, take its amount, and add the sum of all the others.

```tla
RECURSIVE SumOver(_, _)
SumOver(S, f) ==
  IF S = {} THEN 0
  ELSE LET x == CHOOSE y \in S : TRUE
       IN  f[x] + SumOver(S \ {x}, f)
```

That is the first operator in this course that calls itself, so let’s read every piece:

| typeset | you type | say it | in Python |
|---|---|---|---|
| RECURSIVE | `RECURSIVE Op(_, _)` | “Op may call itself; it takes two arguments” | (no declaration needed) |
| { } | `{}` | “the empty set” | `set()` |
| IF … THEN … ELSE | `IF c THEN a ELSE b` | “a if c, otherwise b” | `a if c else b` |
| LET … IN | `LET x == e IN body` | “let x be e in body” | a local variable |
| CHOOSE | `CHOOSE y \in S : P` | “some y in S for which P holds” | `next(y for y in S if P)` |
| \ | `S \ {x}` | “S without x” | `S - {x}` |
| ≠ | `#` | “is not equal to” | `!=` |

The first line declares that SumOver is recursive, with two arguments; TLC needs that declaration before the definition, because the definition mentions SumOver itself. Then: if S is the empty set, the answer is zero. Otherwise, let x be some element of S. CHOOSE with the condition TRUE picks *any* element, but always the same one for the same set, so SumOver is a proper function and not a coin toss. The answer is f at x, plus SumOver of S without x. **SumOver(S, f) is the sum of f’s values over the set S, worked out one element at a time.**

[[diagram:sum-over]]

Push the story through it. SumOver({4471, 4472}, credit) picks, say, 4471, and gives 50,000 plus SumOver({4472}, credit). That picks 4472 and gives 30,000 plus SumOver({}, credit), which is 0. Unwound: 50,000 + 30,000 + 0 = 80,000. In Python, with `min` standing in for CHOOSE (any fixed rule for picking works):

```python
def sum_over(s, f):
    if not s:
        return 0
    x = min(s)
    return f[x] + sum_over(s - {x}, f)

credit = {4471: 50_000, 4472: 30_000}
print(sum_over({4471, 4472}, credit))
print(sum_over(set(), credit))
```

```text
80000
0
```

You may know that TLA+’s Community Modules offer ready-made folds over functions. They don’t ship inside the tla2tools jar this course uses, so we write the five lines ourselves, and the checker runs them.

### The invariant

Now the sentence becomes a formula. The treasury is a variable, fund. Loans and Amount are fixed, and Pot is the €200,000:

```tla
Loans == {4471, 4472}
Amount == [l \in Loans |-> IF l = 4471 THEN 50000 ELSE 30000]
Pot == 200000

Credited == SumOver(Loans, credit)
Conserved == fund + Credited = Pot
```

Amount is a function from each loan to its amount: 50,000 for 4471, and 30,000 for the other. Credited is the sum of every loan account. **Conserved says the treasury plus everything credited equals the pot.** In row 2 of the clean table, 150,000 + 50,000 = 200,000, and Conserved holds. In row 2 of the crash table, 150,000 + 0 is not 200,000, and it fails.

```python
POT = 200_000

def conserved(fund, credit):
    return fund + sum(credit.values()) == POT

print(conserved(120_000, {4471: 50_000, 4472: 30_000}))
print(conserved(150_000, {4471: 0, 4472: 0}))
```

```text
True
False
```

[[diagram:conservation]]

## Two writes, written down

The worker’s two writes become two actions. Each loan has its own transfer job, and pc now maps each *loan* to how far its job has got: todo, debited, or done. Here is debit first, the code that ran this month:

```tla
Debit(l) == /\ pc[l] = "todo"
            /\ fund' = fund - Amount[l]
            /\ pc' = [pc EXCEPT ![l] = "debited"]
            /\ UNCHANGED <<credit, crashed>>

Credit(l) ==
  /\ pc[l] = "debited"
  /\ credit' = [credit EXCEPT ![l] = credit[l] + Amount[l]]
  /\ pc' = [pc EXCEPT ![l] = "done"]
  /\ UNCHANGED <<fund, crashed>>
```

A reminder from lesson 1: `[pc EXCEPT ![l] = "debited"]` is pc with one entry changed, and `![l]` names the entry at l.

Debit reads: loan l’s job hasn’t started; afterwards the treasury is lower by l’s amount, the job is at debited, and the loan accounts and the crash flag are unchanged. **A Debit step takes one loan’s amount off the treasury and nothing else.** Credit reads: l’s job has debited; afterwards l’s account holds what it held before *plus* the amount, the job is done, and the treasury is unchanged. **A Credit step adds one loan’s amount to its account and nothing else.** Look closely at “plus”. The loan ledger appends a credit every time it is asked, exactly like the code’s `loanLedger.credit`. Remember that; it will matter.

```python
AMOUNT = {4471: 50_000, 4472: 30_000}

def debit_step(fund, credit, l):
    return fund - AMOUNT[l], credit

def credit_step(fund, credit, l):
    return fund, {**credit, l: credit[l] + AMOUNT[l]}

state = (200_000, {4471: 0, 4472: 0})
for step in (debit_step, credit_step, credit_step):
    state = step(*state, 4471)
    print(state, state[0] + sum(state[1].values()))
```

```text
(150000, {4471: 0, 4472: 0}) 150000
(150000, {4471: 50000, 4472: 0}) 200000
(150000, {4471: 100000, 4472: 0}) 250000
```

The last line asks the loan ledger to credit 4471 twice, and it obliges.

Before the crash, check the desk without one. Next is “some loan takes a Debit or a Credit step”, and the cfg asks for Conserved. Predict: does it hold?

TLC says no, after one step: Debit(4471), with the treasury at 150,000 and no credit anywhere. Of course. That is row 1 of the clean table, the normal dip. Conserved as written demands something no two-write design can give: the sum stays exact *between* the writes. It is the wrong invariant for this desk, and the checker just told us so in one line.

What finance actually checks is the books when no transfer is in the middle of happening. Call that **at rest**: every job is either todo or done.

```tla
AtRest == \A l \in Loans : pc[l] \in {"todo", "done"}
ConservedAtRest == AtRest => Conserved
```

The upside-down A is “for every”, from lesson 2. The double arrow is “implies”: A implies B is false only when A is true and B is false. **ConservedAtRest says that whenever no job is between its two writes, the books add up.** In a state mid-transfer, AtRest is false, so the implication is true whatever the sum is. In Python, “A implies B” is `not A or B`:

```python
POT = 200_000

def conserved_at_rest(fund, credit, pc):
    at_rest = all(p in ("todo", "done") for p in pc.values())
    return not at_rest or fund + sum(credit.values()) == POT

credit = {4471: 0, 4472: 0}
print(conserved_at_rest(150_000, credit,
                        {4471: "debited", 4472: "todo"}))
print(conserved_at_rest(150_000, credit,
                        {4471: "todo", 4472: "todo"}))
```

```text
True
False
```

Same treasury, same empty accounts. The first state is mid-transfer, the dip is allowed. The second is at rest, and it is month-end’s finding.

Without crashes, TLC reports no error for ConservedAtRest, in 9 distinct states. Nine is easy to count: each of the two jobs is todo, debited or done, independently, and 3 × 3 = 9.

## The crash between two writes

Now the deploy. The Crash action is lesson 2’s, adapted to a job: once per run, a job that has done its first write forgets it, and goes back to todo.

```tla
Crash(l) == /\ ~crashed
            /\ pc[l] = "debited"
            /\ pc' = [pc EXCEPT ![l] = "todo"]
            /\ crashed' = TRUE
            /\ UNCHANGED <<fund, credit>>
```

No crash has happened yet; l’s job has debited; afterwards it is back at todo, as if it had never started; the crash has now happened; the ledgers keep whatever was written to them. **Crash(l) is a step in which a job forgets its first write while both ledgers remember it.** Lesson 2 had the same asymmetry: the process forgets, the world doesn’t. Next becomes “some loan takes a Debit, a Credit or a Crash step”.

Here is TLC, trimmed to the variables that matter:

```text
Error: Invariant ConservedAtRest is violated.
State 1: <Initial predicate>
/\ credit = (4471 :> 0 @@ 4472 :> 0)
/\ fund = 200000
/\ pc = (4471 :> "todo" @@ 4472 :> "todo")
State 2: <Debit ...>
/\ credit = (4471 :> 0 @@ 4472 :> 0)
/\ fund = 150000
/\ pc = (4471 :> "debited" @@ 4472 :> "todo")
State 3: <Crash ...>
/\ credit = (4471 :> 0 @@ 4472 :> 0)
/\ fund = 150000
/\ pc = (4471 :> "todo" @@ 4472 :> "todo")
```

First, the new notation. `4471 :> 0` is how TLC prints “4471 maps to 0”, and `@@` glues two such pieces into one function. So `(4471 :> 0 @@ 4472 :> 0)` is the credit function with both accounts at zero.

Now line by line. State 1 is the start: €200,000 in the treasury, nothing credited, both jobs todo. State 2: Debit(4471), the treasury drops to 150,000, and 4471’s job is mid-transfer, so ConservedAtRest still holds. State 3: Crash(4471). The treasury still says 150,000 and the account still says 0, but the job is back at todo, so the desk is at rest, and 150,000 + 0 is not 200,000. Two steps. That is month-end, exactly.

With `-continue`, which tells TLC to keep going after a violation, it explores all 27 distinct states and reports the invariant broken in 8 of them. Twelve of the 27 are at rest; two thirds of those are wrong.

### Where was the money?

Here is a fair objection. Between Debit and Credit the €50,000 wasn’t really nowhere. The worker knew it owed a credit. What if we count that?

```tla
InFlightMem ==
  SumOver({l \in Loans : pc[l] = "debited"}, Amount)
ConservedMem == fund + InFlightMem + Credited = Pot
```

The braces with a colon build a set: “the loans l in Loans such that l’s job is at debited”. InFlightMem sums their amounts. **ConservedMem says the treasury, plus what the workers are carrying in memory, plus what is credited, equals the pot.** Without crashes it holds in all 9 states, in the middle of transfers too. With the crash, TLC breaks it with the same two steps. Of course it does: the crash is the step that erases the memory. The money in flight was real, but the only record of it lived in a process, and processes are exactly the things that crash. Lesson 2 taught that about who sent a transfer; here it is about where the money is.

## Flip the order

Back to your colleague’s idea: credit first, then debit. The spec swaps the two actions. Credit now needs todo and leaves the job at credited; Debit needs credited and finishes; Crash forgets a job at credited. You tried this order in the lab above. Before reading on, recall what you saw: did flipping fix it, or only change it?

TLC, again in two steps: Credit(4471), then Crash(4471). At rest, the treasury still holds €200,000 and the bakery’s account holds €50,000, so the books show €250,000. The same €50,000 is in both ledgers at once.

Follow it one step further. The restarted worker finds 4471 at todo and starts again, with a credit:

| | step | treasury | 4471 | 4472 | total |
|---|---|---|---|---|---|
| 0 | (start) | 200,000 | 0 | 0 | 200,000 |
| 1 | credit 4471 | 200,000 | 50,000 | 0 | 250,000 |
| 2 | crash | 200,000 | 50,000 | 0 | 250,000 |
| 3 | credit 4471 | 200,000 | 100,000 | 0 | 300,000 |
| 4 | debit 4471 | 150,000 | 100,000 | 0 | 250,000 |

The bakery’s loan account says it received €100,000 for a €50,000 loan. Next month the bakery gets a repayment schedule for twice what it borrowed. That is the other half of this lesson’s question: shown twice.

[[diagram:crash-window]]

So both orders fail, and they fail in mirror image. Debit first, a crash makes money vanish: it shows in no ledger. Credit first, a crash makes money appear: it shows in two. TLC finds both in two steps, out of 27 states, broken in 8 each. Swapping the lines doesn’t close the gap. It decides which way you fall into it.

Can lesson 2’s trick help? Suppose the loan ledger takes the loan’s id as a key and keeps one credit per loan, so a second credit for 4471 changes nothing. With credit first, the retry in row 3 becomes harmless, and the TLC run with that keyed Credit agrees: every finished run adds up. But at rest, right after a crash, the books are still off the pot (€250,000 when the crash hits 4471, €230,000 when it hits 4472): 4 of the 23 states break it. With debit first, the key does nothing at all, because the step that repeats is the debit. The key makes a repeated *write* harmless. It doesn’t close the gap between two writes.

## The model checker as code

Here is the whole search in Python, for both orders at once. The state is a tuple: the treasury, the two loan accounts, the two jobs’ pc, and the crash flag. The three if blocks are Debit or Credit (whichever is first), the other one, and Crash.

```python
AMOUNT, POT = (50_000, 30_000), 200_000

def steps(s, first, second, mid):
    fund, credit, pc, crashed = s
    for i, a in enumerate(AMOUNT):
        def put(t, v):
            return t[:i] + (v,) + t[i + 1:]
        def write(kind, f, c):
            if kind == "debit":
                return f - a, c
            return f, put(c, c[i] + a)
        if pc[i] == "todo":
            f, c = write(first, fund, credit)
            yield f, c, put(pc, mid), crashed
        if pc[i] == mid:
            f, c = write(second, fund, credit)
            yield f, c, put(pc, "done"), crashed
        if pc[i] == mid and not crashed:
            yield fund, credit, put(pc, "todo"), True
```

Then collect every reachable state, keep the ones at rest, and see how far each is from the pot:

```python
def check(*order):
    init = (POT, (0, 0), ("todo", "todo"), False)
    seen, todo = {init}, [init]
    while todo:
        for t in steps(todo.pop(), *order):
            if t not in seen:
                seen.add(t)
                todo.append(t)
    rest = [s for s in seen
            if all(p in ("todo", "done") for p in s[2])]
    off = [s[0] + sum(s[1]) - POT for s in rest]
    n = sum(x != 0 for x in off)
    print(order[0], "first:", len(seen), "states,", n, "of",
          len(rest), "at rest off by", sorted(set(off) - {0}))

check("debit", "credit", "debited")
check("credit", "debit", "credited")
```

```text
debit first: 27 states, 8 of 12 at rest off by [-50000, -30000]
credit first: 27 states, 8 of 12 at rest off by [30000, 50000]
```

The same 27 states TLC found, the same 8 violations. And look at the signs. Debit first is only ever short; credit first is only ever over. The order picks the direction of the error, never its absence.

## Why not make it one step?

Lesson 1 fixed the double payout by making check-and-claim one atomic step. Why not do it again and make the debit and the credit one step?

On paper, nothing stops you:

```tla
Transfer(l) == /\ pc[l] = "todo"
               /\ fund' = fund - Amount[l]
               /\ credit' = [credit EXCEPT ![l] = Amount[l]]
               /\ pc' = [pc EXCEPT ![l] = "done"]
```

**Transfer(l) is a step that moves one loan’s amount from the treasury to its account, with no moment in between.** It sets the account to the amount rather than adding it; with one step per loan and nothing ever retried, setting and adding give the same number. TLC checks Conserved, the strict one, with no “at rest” excuse, and finds no error in all 4 states.

```python
AMOUNT = {4471: 50_000, 4472: 30_000}

def transfer(fund, credit, l):
    return fund - AMOUNT[l], {**credit, l: AMOUNT[l]}

state = (200_000, {4471: 0, 4472: 0})
for l in (4471, 4472):
    state = transfer(*state, l)
    print(state, state[0] + sum(state[1].values()))
```

```text
(150000, {4471: 50000, 4472: 0}) 200000
(120000, {4471: 50000, 4472: 30000}) 200000
```

And that is the trap. TLA+ will let you write any step you like. The spec is only worth something if the system really has that step. Lesson 1’s fix was real because one database ran the conditional update as one transaction. Here, the treasury lives in your database and the loan ledger lives behind someone else’s API. No single transaction spans both.

There is a classic protocol that tries: **two-phase commit**. A coordinator asks every system to *prepare*, which means promising it can commit and holding its locks until told; if every system says yes, the coordinator tells them all to commit. It works, at a price. Both systems must speak the protocol, and the loans team’s HTTP service doesn’t. Locks are held across network round trips. And if the coordinator crashes after the prepares and before the commit, the prepared systems can’t decide on their own: they wait, locks held, until it returns. Distributed atomicity isn’t free. Most teams don’t pay for it, and ours can’t.

[[diagram:two-phase]]

So we can’t make two systems take one step. Here is the turn: we don’t need to. We need one step that *records the debit and the debt together*, in the one system we control.

## The transactional outbox

Look at what went wrong in both orders. The fact “€50,000 is on its way to loan 4471” lived only in a worker’s memory. A crash erased it, and with it the only evidence that a second write was owed.

So write that fact down, durably, in the same place and the same instant as the debit. Add a table to the payout database, called the **outbox**: one row per credit the loan ledger still owes, keyed by loan id. Paying out a loan becomes one local transaction: mark the loan paid, debit the treasury, and insert the outbox row. One database, one transaction, one step. Either all three happen or none do.

```ts
await db.transaction(async (tx) => {
  await tx.setStatus(loan.id, "paid");
  await tx.debitTreasury(loan.id, loan.amount);
  await tx.insertOutbox(loan.id, loan.amount);
});
```

A separate process, the **relay**, reads the outbox, asks the loan ledger to credit each row, and deletes the row once the credit is confirmed:

```ts
for (const row of await db.outboxRows()) {
  await loanLedger.credit(row.loanId, row.amount);
  await db.deleteOutbox(row.loanId);
}
```

The relay can crash too. If it crashes after the credit and before the delete, the row is still there, and when it restarts it delivers that row again. So the relay delivers every row **at least once**: never zero times, sometimes twice. That is half a guarantee, and the other half lives in the loan ledger. It must apply each credit once, however many times it is asked. Lesson 2 called the tool for this an idempotency key; here the key is the loan id, and the loan ledger keeps one credit per loan:

```sql
INSERT INTO credits (loan_id, amount) VALUES ($1, $2)
ON CONFLICT (loan_id) DO NOTHING;
```

Read the second line as: if a row with this loan_id already exists, the insert does nothing. The first credit for 4471 lands; every later one bounces off it.

[[diagram:outbox]]

Run month-end’s numbers through it. After the payout of 4471: treasury €150,000, outbox row “4471, €50,000”, loan account 0. Where is the money? Not in a worker’s head. It is in the outbox, a table you can query. 150,000 in the treasury plus 50,000 owed in the outbox plus 0 credited is 200,000. After the relay credits it: 150,000 + 50,000 credited = 200,000, and the row, now delivered, no longer counts as owed. The books add up in *every* state, not only at rest.

### The outbox as a spec

The spec gains a loan status, the outbox as a set of loan ids, and held, the rows the relay has delivered and is about to delete, which it holds only in memory. Init starts the treasury at the pot, every account at 0, every status at approved, and the outbox and held empty. A word on names, since the lab below uses all of them: a loan’s status goes from approved to paid; the debit-first desk’s jobs went todo, debited, done; and when we later split Pay into two transactions, the worker’s pc goes idle, debited, idle again, through a Debit action, an Enqueue action that writes the outbox row, and CrashWorker, the deploy between them. One transaction, one action:

```tla
Pay(l) == /\ status[l] = "approved"
          /\ status' = [status EXCEPT ![l] = "paid"]
          /\ fund' = fund - Amount[l]
          /\ outbox' = outbox \union {l}
          /\ UNCHANGED <<credit, held, crashed>>
```

Loan l is approved; afterwards it is paid, the treasury is lower by its amount, and the outbox has gained l. The union, from lesson 2, adds an element to a set. **Pay(l) is one step that debits the treasury and records the debt, together.**

```tla
Deliver(l) == /\ l \in outbox
              /\ l \notin held
              /\ credit' = [credit EXCEPT ![l] = Amount[l]]
              /\ held' = held \union {l}
              /\ UNCHANGED <<fund, status, outbox, crashed>>
```

Here ∉, typed `\notin`, is “is not in”. Loan l has an outbox row and the relay isn’t already holding it; afterwards l’s account *is* the amount, and the relay holds l. Compare it with the Credit action from the debit-first desk. There, the account became its old value *plus* the amount. Here it becomes the amount, full stop: writing it a second time writes the same value. That one change is the keyed credit, the `ON CONFLICT DO NOTHING`. **Deliver(l) is a step in which the relay credits loan l’s account with its amount, once per loan however often it runs.**

```tla
Ack(l) == /\ l \in held
          /\ outbox' = outbox \ {l}
          /\ held' = held \ {l}
          /\ UNCHANGED <<fund, credit, status, crashed>>

CrashRelay == /\ ~crashed
              /\ held # {}
              /\ held' = {}
              /\ crashed' = TRUE
              /\ UNCHANGED <<fund, credit, status, outbox>>
```

Ack is the delete: the relay holds l; afterwards the row is gone and the relay holds it no longer. **Ack(l) deletes a delivered row.** CrashRelay is the deploy, once per run: the relay is holding something; afterwards it holds nothing, and the outbox, the ledgers and the statuses keep what was written. **CrashRelay is a step in which the relay forgets which rows it delivered, while every table remembers.** Because the rows stay, Deliver is enabled for them again. That is at least once, written as a spec.

Here are all four, in Python, played through the relay’s worst moment, once with the plain credit and once with the keyed one:

```python
AMOUNT = {4471: 50_000, 4472: 30_000}

def pay(s, l):
    fund, credit, outbox, held = s
    return fund - AMOUNT[l], credit, outbox | {l}, held

def deliver(s, l, keyed):
    fund, credit, outbox, held = s
    new = AMOUNT[l] if keyed else credit[l] + AMOUNT[l]
    return fund, {**credit, l: new}, outbox, held | {l}

def ack(s, l):
    fund, credit, outbox, held = s
    return fund, credit, outbox - {l}, held - {l}

def crash_relay(s):
    return s[0], s[1], s[2], set()

for keyed in (False, True):
    s = (200_000, {4471: 0, 4472: 0}, set(), set())
    s = pay(s, 4471)
    s = deliver(s, 4471, keyed)
    s = crash_relay(s)
    s = ack(deliver(s, 4471, keyed), 4471)
    print("keyed" if keyed else "plain", s)
```

```text
plain (150000, {4471: 100000, 4472: 0}, set(), set())
keyed (150000, {4471: 50000, 4472: 0}, set(), set())
```

Same steps, same crash, same redelivery. The plain credit gives the bakery €100,000; the keyed one, €50,000.

### Counting the money in the outbox

The outbox is a new spec, so it defines its own Conserved, the same idea with a third term: what the outbox still owes.

```tla
InFlight == SumOver({l \in outbox : credit[l] = 0}, Amount)
Conserved == fund + InFlight + Credited = Pot
```

InFlight is the sum of the amounts of outbox rows whose credit hasn’t landed yet. A row that has been delivered but not yet deleted is left out, because its money is already counted in Credited; counting it twice is exactly the bug we are hunting. **Conserved says the treasury, plus what the outbox still owes, plus what is credited, equals the pot, in every state.** No “at rest” this time. Every term lives in a durable table, so no crash can make one vanish.

```python
AMOUNT, POT = {4471: 50_000, 4472: 30_000}, 200_000

def in_flight(outbox, credit):
    return sum(AMOUNT[l] for l in outbox if credit[l] == 0)

def conserved(fund, outbox, credit):
    flying = in_flight(outbox, credit)
    total = fund + flying + sum(credit.values())
    return total, total == POT

print(conserved(150_000, {4471}, {4471: 0, 4472: 0}))
print(conserved(150_000, {4471}, {4471: 50_000, 4472: 0}))
print(conserved(150_000, set(), {4471: 50_000, 4472: 0}))
print(conserved(150_000, {4471}, {4471: 100_000, 4472: 0}))
```

```text
(200000, True)
(200000, True)
(200000, True)
(250000, False)
```

Paid and owed; delivered and not yet deleted; deleted. All three add up. The fourth line is the plain credit after a redelivery: €250,000, money shown twice.

### And the money eventually arrives

An invariant alone would be satisfied by a relay that never runs: the money would sit in the outbox forever, counted, and the bakery’s account would stay at zero. Lesson 2 taught you to spot that: a safe desk that does nothing. So we also ask for liveness:

```tla
AllSettled ==
  <>(outbox = {} /\ \A l \in Loans : credit[l] = Amount[l])
```

The diamond is lesson 2’s “eventually”. Inside it: the outbox is empty, and every loan’s account holds exactly its amount. **AllSettled says that eventually every row is delivered and deleted, and every loan is credited exactly its amount.** “Exactly”, so a doubled credit fails it too.

```python
AMOUNT = {4471: 50_000, 4472: 30_000}

def settled(outbox, credit):
    return not outbox and all(credit[l] == AMOUNT[l]
                              for l in AMOUNT)

print(settled({4471}, {4471: 50_000, 4472: 30_000}))
print(settled(set(), {4471: 50_000, 4472: 30_000}))
print(settled(set(), {4471: 0, 4472: 30_000}))
```

```text
False
True
False
```

Fairness is lesson 2’s, word for word: promise it for the work, never for the crash.

```tla
Work(l) == Pay(l) \/ Deliver(l) \/ Ack(l)
Next == (\E l \in Loans : Work(l)) \/ CrashRelay
Fairness == \A l \in Loans : WF_vars(Work(l))
Spec == Init /\ [][Next]_vars /\ Fairness
```

**For every loan, if some work on it stays enabled, that work eventually happens: it gets paid, delivered and deleted.** In the real world that is a promise about your platform: the relay is kept running, and restarted when it dies.

## What the checker says

The cfg asks for both kinds of property:

```text
SPECIFICATION Spec
INVARIANT Conserved
PROPERTY AllSettled
```

You can already work out runs 1 and 2 from the Python above. Predict runs 3 and 4 before you read on: do they pass?

1. The outbox, keyed credit, relay crash on.
2. The same, with the plain credit.
3. The debit and the outbox row in two separate transactions, with a crash allowed between them.
4. The first, with three loans.

Here is what TLC says.

1. **The outbox with the keyed credit**: “Model checking completed. No error has been found.” 64 states generated, 37 distinct, depth 9. Conserved holds in all 37, and every fair behavior settles.
2. **The plain credit**: Conserved is violated in four steps: Pay(4471), Deliver(4471), CrashRelay, Deliver(4471). State 5 shows `credit = (4471 :> 100000 @@ 4472 :> 0)` and the outbox still holding 4471: 150,000 + 0 + 100,000 = 250,000. At least once, without the key, is sometimes twice.
3. **Two transactions**: Debit (with the status) in one, the outbox row in another. TLC breaks it in two steps, Debit(4471) then a worker crash, and we are back at month-end: €150,000 in the treasury, no row, no credit. In this spec each loan’s worker goes from idle to debited and back to idle: Debit commits the debit and the status, Enqueue writes the outbox row in a second transaction, and CrashWorker is the deploy between them. The liveness run prints a lasso, lesson 2’s counterexample that ends in a loop, here a final “Stuttering”, which means nothing ever changes again: 4471 is delivered, 4472 is debited and never credited, 62 distinct states in all. Moving the second write into an outbox doesn’t help unless it commits *with* the first.
4. **Three loans** (4473 adds €20,000 for the repair shop, swapped in by the cfg as lesson 2 swapped in a third worker): no error, 458 states generated, 181 distinct, depth 12.

Notice who does what, just as in lesson 2. The one-transaction outbox gives safety against the gap: the debit never exists without its debt. The relay with fairness gives liveness: every debt is eventually delivered. The key makes at least once harmless. Take away any one of the three and TLC has a counterexample ready.

[[diagram:at-least-once]]

**Build it.** Extend the Python checker to the outbox. The state is the treasury, the two accounts, the two statuses, the outbox, held, and the crash flag. Write one step each for Pay, Deliver (keyed or plain, by a flag), Ack and CrashRelay, tagging CrashRelay as a crash and the others as work. Search breadth-first, recording each state’s depth. Let bad be the reachable states where the total isn’t 200,000, stuck the unsettled states with no work step enabled, and first_bad the smallest depth of a bad state. With the keyed credit, then the plain one:

```python
assert len(states) == 37 and not bad and not stuck
assert len(states) == 49 and first_bad == 4
```

## Fix the bug

In the lab below, both crashes are always on: one deploy per run, which may hit the worker or the relay. Your panel picks a design: two writes with debit first, two writes with credit first, an outbox written in a separate transaction, or an outbox written in the same transaction as the debit. A switch makes the loan ledger’s credit keyed by loan id, and you can run with two loans or three. The checker shows the states it explored and two lamps: the books add up (at rest, for designs where a worker can sit between two writes; in every state, for the outbox written in one transaction), and every loan eventually settles, which for every design means each loan’s account ends at exactly its amount, with nothing left owed. It draws whatever counterexample it finds.

The desk is fixed when both lamps are green with two loans, and stay green with three. Turning the deploy off is not an answer. Month-end comes whether you model it or not.

[[lab-act2]]

## What people get wrong

**“Just get the order right.”** There is no right order across two systems. Debit first loses money in a crash; credit first doubles it. The order only chooses which way the books are wrong.

**“Exactly-once delivery.”** Over a network, a sender that doesn’t hear back can’t tell a lost request from a lost reply, so it either retries, risking twice, or doesn’t, risking never. What you can build is at least once from the sender plus a receiver that applies each request once. The effect is exactly once; the delivery isn’t.

**“The outbox is a message queue.”** You could relay the rows through a queue, but the queue isn’t the point. The point is that the debt is recorded in the same transaction as the debit. An outbox written in a separate transaction is just two writes again, and TLC breaks it in two steps.

**“Delete the row first, so we never deliver twice.”** That turns at least once into at most once. A relay that deletes, then crashes before the credit, has thrown away the only record of the debt.

## Recap and the next bug

A **conservation invariant** says a sum never changes: here, the treasury plus every loan account equals the pot. Summing over a function takes a **recursive operator**, SumOver, which TLC runs. Two **writes** to two systems leave a gap, and a **crash** in that gap breaks the sum: debit first makes money vanish, credit first makes it appear twice. **Two-phase commit** could close the gap, at the cost of locks, blocking and a protocol both sides must speak. The **transactional outbox** sidesteps it: the debit and an outbox row commit in one local transaction, a **relay** delivers each row **at least once**, and a credit keyed by loan id makes the repeats harmless. TLC checks both halves: Conserved in all 37 states, and AllSettled under fairness.

At the next month-end, the books add up to the euro.

Then the payout desk itself changes. Approved loans will no longer wait in a table to be claimed: each one becomes a message on a queue, and a worker that receives it holds a lease on it. A pilot goes out first. For the full rollout the team writes nine pages: a queue, claims, leases, keys, crashes.

The architecture review is chaired by Maren. She reads the nine pages, walks to the whiteboard, and writes the whole desk in one line: **PayOnce**, each approved loan goes to paid exactly once, in one step. “Everything else is how,” she says. Next lesson takes her question: how do you show the real queue-and-claim design does what the one-line spec promises?

## Concept check

Write your answers down before you move on.

1. With no crash at all, TLC breaks Conserved in one step on the debit-first desk. Is that a bug in the desk? Why does the debit-first desk need “at rest” in its invariant while the outbox’s Conserved needs no such guard?
2. A state of the outbox desk: treasury €120,000, the outbox holds 4471 and 4472, 4471’s account holds €50,000, and 4472’s holds 0. Work out InFlight, Credited and the total. Why does InFlight leave out 4471 although its row is still in the outbox? Now remove the key, let the relay crash and deliver 4471 again: what is the total?
3. A colleague proposes that the relay delete each outbox row *before* calling the loan ledger, “so we never deliver twice”. Which property breaks, and what does the shortest counterexample look like?
