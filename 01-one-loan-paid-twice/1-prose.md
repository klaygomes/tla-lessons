# One Loan, Paid Twice

## The loan that was paid twice

Welcome to the payout desk. You work at Linden, a small lender that gives loans to small businesses: bakeries, repair shops, a florist who needs a second van. When a loan is approved, somebody has to actually send the money. That somebody is your code.

The payout service is simple, and it has been running for a year. Approved loans sit in a table. A worker picks a loan, checks that it is still approved, asks the bank to transfer the money, and marks the loan as paid. In TypeScript it is five short lines:

```ts
async function payOut(loanId: string) {
  const loan = await db.getLoan(loanId);
  if (loan.status !== "approved") return;
  await bank.transfer(loan.account, loan.amount);
  await db.setStatus(loanId, "paid");
}
```

Last month the queue got long, so you started a second worker. Same code, two copies, each picking up loans as fast as it can. The queue emptied. Everyone was happy.

[[diagram:desk]]

On Monday the bakery on the harbour called. Their loan was €50,000, and €100,000 arrived in their account. They are honest people, and they would like to know which part is theirs.

You open the logs. Worker A transferred €50,000 for loan 4471. Worker B, a few milliseconds later, transferred €50,000 for loan 4471. Both of them checked the status first. Both of them saw “approved”.

[[diagram:race]]

The tests are green. You run the payout test suite ten thousand times in a loop, and it never pays twice. You stare at the five lines and they look correct, because each line on its own *is* correct.

So where is the bug? It isn’t in any line. It lives *between* the lines, in the moments where one worker has done part of its job and the other worker gets to move. Your tests can’t see those moments, and neither can your eyes, because there are more of them than you think.

This lesson is about a tool for seeing all of them at once. It is called TLA+, and by the end a model checker will have handed you the exact ordering that pays twice (it takes only four steps), and you will have fixed the code so that no ordering of the workers, however unlucky, can pay a loan twice.

## Your code, as a list of steps

Let’s slow the workers down until we can watch them. A program running on a real machine does many things per line, but for this bug only a few moments matter: the moments where a worker reads or changes something the other worker can also see. There are three such moments in `payOut`:

1. **Check**: read the loan, see that it is approved.
2. **Send**: ask the bank to transfer the money.
3. **Mark**: write “paid” on the loan.

There is also a fourth, quieter one. If a worker reads the loan and it is already paid, the worker gives up. Call that **Skip**.

Each of these is a **step**: one indivisible change from one situation to the next. Nothing can happen “halfway through” a step. Another worker can only act between steps, never inside one.

[[diagram:steps]]

Now, what is a “situation”? Think about what you would need to write down to pause the whole system and resume it later. Three things:

- the loan’s **status**: `"approved"` or `"paid"`;
- where each worker is in its code, which we will call its **pc** (short for “program counter”): idle before it starts, checked after Check, sent after Send, done at the end;
- how many **transfers** the bank has made for this loan: 0, 1, or more.

Each of these is a **variable**, and one assignment of values to all of them is a **state**. Here is the state before anything has happened:

| status | pc of A | pc of B | transfers |
|---|---|---|---|
| approved | idle | idle | 0 |

That’s it. The whole payout desk, as far as this bug is concerned, fits in one row of a table. That’s the first trick of TLA+: throw away every detail that can’t affect the question, until the system is small enough to examine completely.

## One behavior, state by state

Let’s run the system by hand. A step changes one row into the next row. Which steps can happen first? Both workers are idle and the loan is approved, so either A or B can Check. Let A go first. Then B checks too. Then A sends, then B sends.

Before you look at the table below, try to predict: after those four steps, what does the last row say?

| | step | status | pc of A | pc of B | transfers |
|---|---|---|---|---|---|
| 0 | (start) | approved | idle | idle | 0 |
| 1 | Check(A) | approved | checked | idle | 0 |
| 2 | Check(B) | approved | checked | checked | 0 |
| 3 | Send(A) | approved | sent | checked | 1 |
| 4 | Send(B) | approved | sent | sent | 2 |

Two transfers. That is the Monday phone call, written as five rows. Look at row 2, where the damage is done: both workers have checked and found “approved”, and nothing either of them can do afterwards will undo what they believe. From row 2 on, two payouts are guaranteed.

A sequence of states like this one, where each row follows from the one before by a single step, is called a **behavior**. A behavior is one possible history of the system. The table above is one behavior; your test suite exercises other ones.

Which ones? Your tests call `payOut` and wait for it to finish, so each worker runs all of its steps before the other starts:

| | step | status | pc of A | pc of B | transfers |
|---|---|---|---|---|---|
| 0 | (start) | approved | idle | idle | 0 |
| 1 | Check(A) | approved | checked | idle | 0 |
| 2 | Send(A) | approved | sent | idle | 1 |
| 3 | Mark(A) | paid | done | idle | 1 |
| 4 | Skip(B) | paid | done | done | 1 |

One transfer, everyone is happy. Both tables are behaviors of the same five lines of code. The only difference is the order in which the workers took their turns.

[[diagram:behavior]]

## How many orderings are there?

Two workers, each with three or so steps. Count every behavior from the start to the point where both workers are done. How many are there, and how many of them pay the bakery twice? Write your guess down before you read on.

You could enumerate them by hand, but this is exactly the kind of thing a computer is for. Let’s describe the steps in Python: a function that takes a state and lists every state that one step can lead to.

```python
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
```

```text
Check(A) ('approved', ('checked', 'idle'), 0)
Check(B) ('approved', ('idle', 'checked'), 0)
```

Read each `if` as a rule of the form “when this is true, this step may happen, and here is the state it leads to”. From the start, two steps are possible: A checks or B checks. The function doesn’t pick one. It lists both, because both can happen.

Now follow every branch to the end and count:

```python
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
```

```text
20 behaviors, 18 pay twice
```

[[diagram:orderings]]

Eighteen out of twenty. Did you guess that high? Most people guess one or two, because the bug *feels* like a rare accident. It isn’t. Only two behaviors are safe, and you have already met one of them: A does everything, then B skips. The other is its mirror image. Every interleaving where the workers overlap at all pays twice.

So why did ten thousand test runs never catch it? Because tests don’t pick orderings at random. They pick the same ordering every time: the safe one where each worker finishes before the next one starts. In production the two workers really do overlap, but only when they happen to grab the same loan within a few milliseconds, which is rare enough to hide for a month and common enough to hit a bakery eventually. The bug was never rare in the space of orderings. It was rare in the orderings you happened to try.

[[lab]]

## The idea, named

Let’s collect what we just did, because it is the whole of TLA+ in miniature.

We described the system as a **state machine**, which takes two ingredients:

- an **initial condition**, which says which states the system can start in. Here, exactly one: approved, both idle, zero transfers.
- a **next-state relation**, which says, for any state, which states one step can lead to. That was `next_states`.

From those two ingredients you get every behavior of the system for free: start in an initial state, take any allowed step, take any allowed step from there, and so on. A state you can reach this way is a **reachable state**.

Then we asked a question about every reachable state: are there ever two transfers? A property that must be true in every reachable state is called an **invariant**. Ours is short:

> **NoDoublePayout**: the bank has made at most one transfer.

An invariant is a promise about every moment, not about the end. It doesn’t say “the loan ends up paid once”; it says “at no point, in no behavior, have two transfers been made”. That’s stronger, and it is exactly what the bakery cares about.

Finally, the piece that does the work: a **model checker** is a program that visits every reachable state of a state machine and checks the invariant in each one. If the invariant fails in some state, the model checker hands back a behavior that leads there from the start, called a **counterexample**. TLA+ comes with a model checker named TLC. You just watched a twenty-line Python version enumerate behaviors; in a moment we will write the version that TLC actually is.

[[diagram:state-graph]]

## Writing it down in TLA+

Here is the payout desk as a TLA+ specification. It says exactly what our Python said, in the language TLA+ uses: plain mathematics.

```tla
---- MODULE Payout ----
EXTENDS Naturals

Workers == {"A", "B"}
VARIABLES status, pc, transfers
vars == <<status, pc, transfers>>

Init == /\ status = "approved"
        /\ pc = [w \in Workers |-> "idle"]
        /\ transfers = 0

Check(w) == /\ pc[w] = "idle"
            /\ status = "approved"
            /\ pc' = [pc EXCEPT ![w] = "checked"]
            /\ UNCHANGED <<status, transfers>>

Skip(w) == /\ pc[w] = "idle"
           /\ status = "paid"
           /\ pc' = [pc EXCEPT ![w] = "done"]
           /\ UNCHANGED <<status, transfers>>

Send(w) == /\ pc[w] = "checked"
           /\ transfers' = transfers + 1
           /\ pc' = [pc EXCEPT ![w] = "sent"]
           /\ UNCHANGED status

Mark(w) == /\ pc[w] = "sent"
           /\ status' = "paid"
           /\ pc' = [pc EXCEPT ![w] = "done"]
           /\ UNCHANGED transfers

Next == \E w \in Workers :
          Check(w) \/ Skip(w) \/ Send(w) \/ Mark(w)

Spec == Init /\ [][Next]_vars

NoDoublePayout == transfers <= 1
====
```

TLA+ is typed in plain ASCII and usually read typeset, with the symbols a mathematician would write. The lesson page can show the block either way, and its “Show ASCII” switch flips between the two. In both forms, the first and last lines are not decoration. The dashes around MODULE Payout (a thin rule when typeset) mark where the module begins, and the row of equals signs (a double rule) marks where it ends.

What about the line right under the top rule? TLA+ starts out knowing almost nothing, not even what a number is. `EXTENDS Naturals` pulls another module into this one, much as `import` does in Python, and the standard module Naturals supplies the natural numbers 0, 1, 2 and so on, along with `+` and `<=`. Without it, `transfers + 1` would mean nothing.

It looks dense the first time, but it uses only a handful of symbols. Here they all are, with what you type, how you say it, and the closest Python:

| typeset | you type | say it | in Python |
|---|---|---|---|
| ≜ | `==` | “is defined as” | `=` in a definition |
| ∧ | `/\` | “and” | `and` |
| ∨ | `\/` | “or” | `or` |
| ∃ x ∈ S : | `\E x \in S :` | “there is an x in S such that” | `any(... for x in S)` |
| ⟨ a, b ⟩ | `<<a, b>>` | “the tuple a, b” | `(a, b)` |
| [ w ∈ S ↦ v ] | `[w \in S \|-> v]` | “the function taking each w in S to v” | `{w: v for w in S}` |
| pc[w] | `pc[w]` | “pc of w”: the value pc gives w | `pc[w]` |
| x′ | `x'` | “x prime”: x after the step | the new value |
| ≤ | `<=` | “at most” | `<=` |
| □ | `[]` | “always” | (no equivalent) |

Now let’s read the spec one piece at a time.

```tla
Workers == {"A", "B"}
VARIABLES status, pc, transfers
vars == <<status, pc, transfers>>
```

The first line names the set of workers, A and B. The second declares the three variables of the state. The third gives all three a single name, vars, so we can talk about them together later.

```tla
Init == /\ status = "approved"
        /\ pc = [w \in Workers |-> "idle"]
        /\ transfers = 0
```

This is the initial condition. A column of ∧ signs is a bulleted list where every line must hold: the status is approved, and every worker is mapped to idle, and there are zero transfers. **Init is true of exactly one state: the first row of our tables.**

```tla
Check(w) == /\ pc[w] = "idle"
            /\ status = "approved"
            /\ pc' = [pc EXCEPT ![w] = "checked"]
            /\ UNCHANGED <<status, transfers>>
```

First, the `(w)` after the name. Check isn’t one formula but a family of them, one per worker: the definition takes a parameter w, exactly like a function argument, so Check("A") is the formula with "A" put in for every w.

Next, the one new idea in TLA+ notation: the prime. In a formula that describes a step, a plain variable means its value *before* the step, and the same variable with a prime means its value *after*. So Check is a statement about a pair of states, and it reads line by line:

- before the step, worker w is idle (`pc[w]` is pc applied to w, the entry pc holds for that worker);
- before the step, the loan is approved;
- after the step, the program counters are the same as before, except that w’s entry is now “checked”;
- after the step, the status and the transfers are what they were.

That third line deserves a closer look, because every later lesson leans on it. `[pc EXCEPT ![w] = "checked"]` is a new function: a copy of pc with one entry replaced. Inside it, the `!` is a placeholder for the function being changed, and `[w]` after it picks the entry for worker w, so `![w] = "checked"` reads “except that its entry at w is checked”. In Python it is a dictionary copy with one key overwritten, and the old one is left alone:

```python
pc = {"A": "idle", "B": "idle"}
w = "A"
print({**pc, w: "checked"})
print(pc)
```

```text
{'A': 'checked', 'B': 'idle'}
{'A': 'idle', 'B': 'idle'}
```

The last line uses the keyword `UNCHANGED`. `UNCHANGED <<status, transfers>>` says that each variable in the tuple keeps its value: status prime equals status, and transfers prime equals transfers. With only one variable you can drop the angle brackets and write `UNCHANGED status`, as Send does below. Why bother saying it at all? Because a step formula that says nothing about a variable allows it to take *any* value afterwards.

**Check(w) is true of a pair of states exactly when worker w was idle with the loan approved, and afterwards w has checked and nothing else changed.** The first two lines mention no primes, so they only constrain the state before: they say *when* the step is allowed. That is why there is no “if” in TLA+. A condition that must hold for a step to happen is just one more line of the “and”.

A formula like Check, which describes a kind of step, is called an **action**. Skip, Send and Mark read the same way. Send is the one that matters most: its line “transfers prime equals transfers plus one” says that after the step, one more transfer exists.

```tla
Next == \E w \in Workers :
          Check(w) \/ Skip(w) \/ Send(w) \/ Mark(w)
```

**A step is allowed when, for some worker, it is a Check, a Skip, a Send or a Mark step of that worker.** This is the next-state relation, and it is precisely next_states in Python: the loop over workers is the “there is a worker”, and the four if blocks are the four actions joined by “or”.

```tla
Spec == Init /\ [][Next]_vars
```

This says what a behavior of the whole system is. Read the end of it from the inside out. First comes Next in square brackets, followed by vars: typed with an underscore, typeset as a small subscript after the closing bracket. Together they mean “a Next step, or a step where vars stays unchanged”. The box in front, typed as two brackets, means “always”, at every step. **A behavior is allowed when its first state satisfies Init and every step is either a Next step or a step where nothing changes.** Those do-nothing steps, called stuttering steps, look odd now; they become important in the next lesson, when we ask whether anything good is *guaranteed* to happen. For today, ignore them.

```tla
NoDoublePayout == transfers <= 1
```

Finally, the invariant: a formula about a single state, with no primes, that should be true of every reachable one.

To check it, you give TLC the spec and the name of the invariant in a small configuration file, `Payout.cfg`:

```text
SPECIFICATION Spec
INVARIANT NoDoublePayout
```

Each line is a keyword and a name from the module. `SPECIFICATION Spec` tells TLC which formula describes the behaviors to explore, and `INVARIANT NoDoublePayout` tells it which formula to test in every reachable state. TLC finds the file by its name: it sits next to `Payout.tla`.

Then run TLC itself:

```bash
java -cp tla2tools.jar tlc2.TLC -deadlock Payout.tla
```

TLC is a Java program. `-cp tla2tools.jar` tells Java where to find it: the jar you download from the TLA+ project, which holds TLC and the other TLA+ tools. `tlc2.TLC` names the program inside that jar to start, and `Payout.tla` is the spec to check. The `-deadlock` flag tells TLC that it is fine for the system to stop once both workers are done.

TLC reports that `NoDoublePayout` is violated and prints a counterexample, state by state. It is four steps long: A checks, A sends, B checks, B sends. Notice that this isn’t the behavior from our first table. It is a different one, just as short, and it shows something the first table hid. Worker A has *already sent the money*, and worker B still sees “approved”, because A hasn’t reached its Mark step yet. The dangerous window isn’t just between Check and Send. It is everything between Check and Mark.

## The model checker as code

How does TLC find the shortest counterexample? It explores states in **breadth-first** order: first the initial states, then every state one step away, then every state two steps away, and so on, keeping a set of states it has already seen so that it never explores one twice. Because it goes outward one step at a time, the first bad state it meets is one with the shortest possible behavior leading to it.

Here is that algorithm, using `next_states` from before. For each new state it remembers its parent, so that it can walk back from a bad state to the start.

```python
from collections import deque

def check(init, invariant):
    parent = {init: None}
    queue = deque([init])
    while queue:
        state = queue.popleft()
        if not invariant(state):
            trace = []
            while state is not None:
                trace.append(state)
                state = parent[state]
            return trace[::-1]
        for _, after in next_states(state):
            if after not in parent:
                parent[after] = state
                queue.append(after)
    return len(parent)

no_double_payout = lambda state: state[2] <= 1
for state in check(init, no_double_payout):
    print(state)
```

```text
('approved', ('idle', 'idle'), 0)
('approved', ('checked', 'idle'), 0)
('approved', ('sent', 'idle'), 1)
('approved', ('sent', 'checked'), 1)
('approved', ('sent', 'sent'), 2)
```

The same four-step counterexample that TLC prints. When the invariant holds everywhere, `check` returns the number of distinct states it visited instead. Like this function, TLC stops at the first bad state it meets, before it has seen everything. Ask it to keep going, with the `-continue` flag, and it visits all 17 reachable states.

Notice the difference from `behaviors`. That function followed every *path*, and there were 20 of them. This one visits every *state*, and there are only 17 reachable states, because many paths pass through the same state. With two workers the difference is small. With three workers the naive desk has 1,428 behaviors but only 75 states. Counting states instead of paths is what makes model checking practical: the work grows with the number of distinct situations the system can be in, not with the number of ways to get there.

[[diagram:growth]]

The cost is easy to say in words. Every reachable state is taken off the queue once, and from each one the loop tries every possible next step. So the work is the number of states times the number of next steps per state, and the memory is the set of states seen. On the naive desk that is 17 states with at most 2 next steps each, so at most 34 tries (the real count is 24). Write \(S\) for the number of reachable states and \(b\) for the most next steps any state has. Then the work is \(O(S \cdot b)\), read “order S times b”: it grows at most in proportion to S times b. The memory is \(O(S)\), at most in proportion to S alone. **Breadth-first search costs about one try per state per possible step, and remembers every state once.** TLC is this loop, made very fast, with states stored compactly on disk when memory runs out.

**Build it.** Change `next_states` into the three-worker version by setting `WORKERS = "ABC"` and starting from `("approved", ("idle",) * 3, 0)`. Then check the length of the counterexample. Careful: `check` returns the trace, so `len` counts the states along that one behavior, not the states the checker visited.

```python
assert len(check(init, no_double_payout)) == 5
```

The counterexample still has five states: the same four steps, with C idle throughout. More workers don’t make the shortest bug longer.

## The fix that isn’t

You have the counterexample. The natural reaction is to read it and patch the line where it went wrong. B sent money after A had already sent. So, let B look again just before sending:

```ts
const loan = await db.getLoan(loanId);
if (loan.status !== "approved") return;
const again = await db.getLoan(loanId);
if (again.status !== "approved") return;
await bank.transfer(loan.account, loan.amount);
await db.setStatus(loanId, "paid");
```

It feels safer. Is it? Before reading on, decide: will the model checker find a double payout in this version, and if so, how long will the shortest one be?

Modelling it takes one more action, `Recheck(w)`, between Check and Send: a worker that has checked reads the status again, goes on if it is still approved, and gives up if it is paid. Send now requires the worker to have rechecked. Running the checker on that version:

| | step | status | pc of A | pc of B | transfers |
|---|---|---|---|---|---|
| 0 | (start) | approved | idle | idle | 0 |
| 1 | Check(A) | approved | checked | idle | 0 |
| 2 | Recheck(A) | approved | rechecked | idle | 0 |
| 3 | Send(A) | approved | sent | idle | 1 |
| 4 | Check(B) | approved | sent | checked | 1 |
| 5 | Recheck(B) | approved | sent | rechecked | 1 |
| 6 | Send(B) | approved | sent | sent | 2 |

Still broken. The shortest counterexample grew from four steps to six, and that is all the extra check bought. Across every ordering, 60 of the 70 behaviors still pay twice. The state space grew from 17 states to 26, so there are more places for things to go wrong, not fewer.

So why didn’t the second look help? **A check and the action it protects are separate steps, so another worker can always act between them.** Adding a second check moves the gap; it doesn’t close it. No number of reads can close it, because the thing that went wrong was never a missing read. It was that “see approved” and “claim the loan” were two steps instead of one.

## Why waiting doesn’t help either

There is one more tempting fix, and it’s a sneaky one, because it works in testing. Add a random delay before each worker starts, say between zero and two hundred milliseconds, so the workers rarely collide.

Look at the spec and ask: where would that delay go? There is no clock in it. A TLA+ spec doesn’t say how long a step takes or how far apart two steps are; it says only which steps are possible and in which orders. A delay changes how *likely* each ordering is. It doesn’t remove any ordering from the set of possible ones. To the model checker, the jittered system has exactly the same 17 states and the same counterexample.

That’s not a weakness of the tool. It’s the point. You don’t want a payout system that is correct when the network is fast and the database is quiet. You want one that is correct in every ordering, including the one where a garbage-collection pause freezes worker A for a full second between its Check and its Send. The spec gives you a way to ask that question without knowing anything about timing at all.

## The grain of a step

So the bug isn’t in any line, and it can’t be fixed by adding lines. It is a question of *what counts as one step*. In the spec, each action is **atomic**: it happens all at once, and no other worker can act in the middle of it. The design question is which things you are allowed to make atomic, because the real world decides that, not you.

Reading the loan and then writing to it are two round trips to the database, so they are two steps, and anything can happen between them. But databases offer one thing that *is* a single step: a conditional update. This statement reads and writes in one indivisible operation:

```sql
UPDATE loans
SET status = 'claimed'
WHERE id = $1 AND status = 'approved'
```

If the loan is approved, it becomes claimed, and the database reports one row changed. If another worker got there first, the condition fails, nothing changes, and the database reports zero rows. Two workers can run this at the same moment and exactly one of them will see “one row”. In the spec, Check and the write that claims the loan merge into one action:

```tla
Claim(w) == /\ pc[w] = "idle"
            /\ status = "approved"
            /\ status' = "claimed"
            /\ pc' = [pc EXCEPT ![w] = "claimed"]
            /\ UNCHANGED transfers
```

Read it as before: worker `w` was idle and the loan was approved, and afterwards the loan is claimed and `w` has claimed it. **The check and the change are lines of the same “and”, so they happen in the same step, and no other worker can act between them.**

[[diagram:claim]]

You now have everything you need. Go and fix the desk.

## Fix the bug

In the lab below, you are given the payout desk with its four actions, and a panel of changes you can make to it: add a recheck, add a random delay, run a single worker, or replace Check with an atomic Claim. Each change rewrites the spec. Press “Run the checker” to explore every reachable state.

The desk counts as fixed when the checker finds no state that breaks `NoDoublePayout`, with at least two workers running, and still finds none when you add a third. The long queue is why the second worker exists, so “only one worker” is not an answer.

[[lab-act2]]

## What people get wrong

**“A model is just the code again.”** The model has three variables and four actions. It leaves out the bank’s API, the database driver, retries and logging, on purpose. A spec is useful because it is much smaller than the code: small enough that a machine can examine every state of it.

**“A lock around `payOut` makes it atomic.”** Only if every worker takes the same lock. A mutex lives inside one process, and your workers run on separate machines, so each one would happily lock its own copy. The one place both workers meet is the loan’s row in the database, which is why the atomic step lives there.

**“The checker passed, so the service is correct.”** It passed for the spec, with two and three workers. It can’t tell you whether your TypeScript really sends the conditional update, or whether three hundred workers behave like three. Those are real questions, and later lessons take them on.

## Recap and the next bug

The bakery got paid twice because “check” and “act” were two steps, and a test suite only ever tried the one ordering where that didn’t matter. Writing the desk as a state machine let a model checker try all of them. A recheck only moved the gap, and a delay left every ordering possible. Making the check and the change one atomic claim, which the database really can do, closed it.

Now run your fixed desk past one more scenario. Worker A claims loan 4471, and then the machine it runs on is restarted by a routine deploy, before it sends anything. Add an action for that, `Crash(w)`, and run the checker again.

It passes. No state breaks `NoDoublePayout`. The loan sits there, “claimed”, forever, and nobody will ever pay it twice, because nobody will ever pay it at all.

Your invariant is perfectly happy with a system that does nothing. Next lesson, we learn how to say “and eventually, the money arrives”.

## Concept check

Write your answers down before you move on.

1. In the naive desk, the shortest counterexample has four steps. Is there a counterexample in which worker A has already *marked* the loan as paid before worker B sends? Explain using the actions, not by trying it.
2. Suppose you add a third worker to the naive desk. Will the shortest counterexample get longer, shorter, or stay the same length? Why?
3. A teammate proposes this invariant instead: “if the status is paid, there has been exactly one transfer”. Would the model checker catch the bakery bug with it? Find the state that decides it.
