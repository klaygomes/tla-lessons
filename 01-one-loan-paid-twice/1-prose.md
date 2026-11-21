# One Loan, Paid Twice

## The loan that was paid twice

Welcome to the payout desk. You work at Linden, a small lender that gives loans to small businesses: bakeries, repair shops, a florist who needs a second van. When a loan is approved, somebody has to actually send the money. That somebody is your code.

The payout service is simple, and it has been running for a year. Approved loans sit in a table. A worker picks a loan, checks that it is still approved, asks the bank to transfer the money, and marks the loan as paid. In TypeScript it is five honest lines:

```ts
async function payOut(loanId: string) {
  const loan = await db.getLoan(loanId);
  if (loan.status !== "approved") return;
  await bank.transfer(loan.account, loan.amount);
  await db.setStatus(loanId, "paid");
}
```

Last month the queue got long, so you started a second worker. Same code, two copies, each picking up loans as fast as it can. The queue emptied. Everyone was happy.

On Monday the bakery on the harbour called. Their loan was €50,000, and €100,000 arrived in their account. They are honest people, and they would like to know which part is theirs.

You open the logs. Worker A transferred €50,000 for loan 4471. Worker B, a few milliseconds later, transferred €50,000 for loan 4471. Both of them checked the status first. Both of them saw “approved”.

[[diagram:race]]

The tests are green. You run the payout test suite ten thousand times in a loop, and it never pays twice. You stare at the five lines and they look correct, because each line on its own *is* correct.

So where is the bug? It isn’t in any line. It lives *between* the lines, in the moments where one worker has done part of its job and the other worker gets to move. Your tests can’t see those moments, and neither can your eyes, because there are more of them than you think.

This lesson is about a tool for seeing all of them at once. It is called TLA+, and by the end you will have used its core idea to find this bug in four steps, and then fixed it so that no ordering of the workers, however unlucky, can pay a loan twice.

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
- where each worker is in its code, which we will call its **pc** (short for “program counter”): `"idle"` before it starts, `"checked"` after Check, `"sent"` after Send, `"done"` at the end;
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

Here is a question worth sitting with before you answer it. Two workers, each with three or so steps. Count every behavior from the start to the point where both workers are done. How many are there, and how many of them pay the bakery twice?

Take a guess. Write it down.

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

TLA+ is typed in plain ASCII (`/\` for “and”, `\E` for “there exists”) and usually read typeset, with the symbols a mathematician would write. The block above shows the typeset form; flip “Show ASCII” to see exactly what you type into the tools. The rule at the top, labelled MODULE Payout, and the double rule at the bottom are not decoration: they are where a module begins and ends, typed as a row of at least four dashes around `MODULE Payout` and a row of at least four equals signs.

It looks dense the first time, so let’s read it the way you would read it aloud.

`Workers == {"A", "B"}` defines a name. The double equals sign means “is defined as”, and the braces make a set: the workers are A and B.

`VARIABLES status, pc, transfers` declares the three variables of the state. `vars` is just a name for all three of them together; the angle brackets `<< >>` make a tuple.

`Init` is the initial condition. The symbol `/\` means “and”, written as a little wedge, and the column of them is a bulleted list where every line must hold. So `Init` says: the status is approved, *and* `pc` is the function that maps every worker to idle, *and* there are zero transfers. The notation `[w \in Workers |-> "idle"]` reads “the function that takes each `w` in `Workers` to `"idle"`”. In Python it is the dict `{w: "idle" for w in WORKERS}`. **`Init` is true of exactly one state: the first row of our tables.**

Now the steps. `Check(w)` describes one step of worker `w`, and here comes the one new idea in TLA+ notation: the prime. In a formula that describes a step, `pc` means the value of `pc` in the state *before* the step, and `pc'` (read “pc prime”) means its value in the state *after*. So a step formula is a statement about a pair of states. Read `Check(w)` line by line:

- `pc[w] = "idle"`: before the step, worker `w` is idle;
- `status = "approved"`: before the step, the loan is approved;
- `pc' = [pc EXCEPT ![w] = "checked"]`: after the step, `pc` is the same function as before except that `w` now maps to `"checked"`. The `!` stands for “the function being changed”, so `![w]` is “its entry at `w`”;
- `UNCHANGED <<status, transfers>>`: after the step, status and transfers are what they were.

**`Check(w)` is true of a pair of states exactly when worker `w` was idle with the loan approved, and afterwards `w` has checked and nothing else changed.** The first two lines mention no primes, so they only constrain the state before: they say *when* the step is allowed. That is why there is no `if` in TLA+. A condition that must hold for a step to happen is just one more line of the “and”.

A formula like `Check(w)`, which describes a kind of step, is called an **action**. `Skip`, `Send` and `Mark` read the same way. Notice that `Send(w)` has `transfers' = transfers + 1`: after the step, one more transfer exists.

`Next` puts the actions together. The symbol `\/` means “or”, and `\E w \in Workers :` reads “there exists a worker `w` in `Workers` such that”. **A step is a `Next` step when, for some worker, it is a Check, a Skip, a Send or a Mark step of that worker.** This is the next-state relation, and it is precisely `next_states` in Python: the `for` loop over workers is the `\E`, and the four `if` blocks are the four actions joined by “or”.

`Spec` says what a behavior of the whole system is. Read `[][Next]_vars` from the inside out. `[Next]_vars` means “a `Next` step, or a step where `vars` stays unchanged”. The box `[]` in front means “always”, at every step of the behavior. **`Spec` is true of a behavior when its first state satisfies `Init` and every step is either a `Next` step or a step where nothing changes.** Those do-nothing steps, called stuttering steps, look odd now; they become important in the next lesson, when we ask whether anything good is *guaranteed* to happen. For today, ignore them.

`NoDoublePayout` is the invariant: a formula about a single state, with no primes, that should be true of every reachable one.

To check it, you give TLC the spec and the name of the invariant in a small configuration file, `Payout.cfg`:

```text
SPECIFICATION Spec
INVARIANT NoDoublePayout
```

and run it with the `-deadlock` flag, which tells TLC that it is fine for the system to stop once both workers are done:

```bash
java -cp tla2tools.jar tlc2.TLC -deadlock Payout.tla
```

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

The same four-step counterexample that TLC prints. When the invariant holds everywhere, `check` returns the number of distinct states it visited instead.

Notice the difference from `behaviors`. That function followed every *path*, and there were 20 of them. This one visits every *state*, and there are only 17 reachable states, because many paths pass through the same state. With two workers the difference is small. With three workers the naive desk has 1,428 behaviors but only 75 states. Counting states instead of paths is what makes model checking practical: the work grows with the number of distinct situations the system can be in, not with the number of ways to get there.

[[diagram:growth]]

The cost is easy to state. If the system has \(S\) reachable states and each state has at most \(b\) possible next steps, breadth-first search does \(O(S \cdot b)\) work and keeps \(O(S)\) states in memory. TLC is this loop, made very fast, with states stored compactly on disk when memory runs out.

**Build it.** Change `next_states` into the three-worker version by setting `WORKERS = "ABC"` and starting from `("approved", ("idle",) * 3, 0)`. Then:

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

Here is why, and it is the most useful sentence in this lesson. **A check and the action it protects are separate steps, so another worker can always act between them.** Adding a second check moves the gap; it doesn’t close it. No number of reads can close it, because the thing that went wrong was never a missing read. It was that “see approved” and “claim the loan” were two steps instead of one.

## Why waiting doesn’t help either

There is one more tempting fix, and it’s worth killing explicitly because it works in testing. Add a random delay before each worker starts, say between zero and two hundred milliseconds, so the workers rarely collide.

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

The desk counts as fixed when the checker finds no state that breaks `NoDoublePayout`, with at least two workers running, and still finds none when you add a third. The bank and the bakery both need the queue to keep moving, so “only one worker” is not an answer.

[[lab-act2]]

## What people get wrong

**“The tests pass, so the code is correct.”** The tests prove that some behaviors are fine. Our tests covered 2 of the 20 behaviors, and they were the only 2 that were safe. A test suite samples orderings; a model checker covers all of them.

**“The bug is rare, so it’s a small bug.”** It was rare in production, but 18 of the 20 orderings pay twice. How often a bug shows up depends on timing, which you don’t control. Whether it *can* show up depends on the design, which you do.

**“Check again right before acting.”** Every check is its own step, and the gap after it is just as wide. Only making the check and the change one atomic step closes the gap.

**“A model is just the code again.”** The model has three variables and four actions. It leaves out the bank’s API, the database driver, retries and logging, on purpose. A spec is useful because it is much smaller than the code: small enough that a machine can examine every state of it.

## Recap and the next bug

Let’s put the pieces back together.

A **state** is one assignment of values to the system’s **variables**. A **step** changes one state into the next, and an **action** is a formula describing a kind of step, with primed variables for the values afterwards. A **behavior** is a sequence of states joined by steps. The **initial condition** (`Init`) and the **next-state relation** (`Next`) together describe every behavior the system can have. An **invariant** is a property that must hold in every reachable state, and a **model checker** like TLC visits all of them, breadth first, and returns the shortest **counterexample** if the invariant fails.

The bakery got paid twice because “check” and “act” were two steps. You fixed it by making them one: an atomic claim, which the database really can do.

Now run your fixed desk past one more scenario. Worker A claims loan 4471, and then the machine it runs on is restarted by a routine deploy, before it sends anything. Add an action for that, `Crash(w)`, and run the checker again.

It passes. No state breaks `NoDoublePayout`. The loan sits there, “claimed”, forever, and nobody will ever pay it twice, because nobody will ever pay it at all.

Your invariant is perfectly happy with a system that does nothing. Next lesson, we learn how to say “and eventually, the money arrives”.

## Concept check

Write your answers down before you move on.

1. In the naive desk, the shortest counterexample has four steps. Is there a counterexample in which worker A has already *marked* the loan as paid before worker B sends? Explain using the actions, not by trying it.
2. Suppose you add a third worker to the naive desk. Will the shortest counterexample get longer, shorter, or stay the same length? Why?
3. A teammate proposes this invariant instead: “if the status is paid, there has been exactly one transfer”. Would the model checker catch the bakery bug with it? Find the state that decides it.
