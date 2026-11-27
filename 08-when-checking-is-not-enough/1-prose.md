# When Checking Is Not Enough

## Three hundred workers

The rollout went ahead. It is the busiest month Linden has ever had: a partnership with a chain of hardware stores sends a flood of small loans to the desk, and the platform team does what platform teams do: they turn the autoscaler up. On Monday morning the payout desk runs three hundred workers, just as the capacity line in the rollout plan said.

Nothing goes wrong. The bakery on the harbour, loan 4471, €50,000, was paid long ago, exactly once. The queue drains. But Maren’s question from the design review is still open, and on Monday she sends it again, in writing:

> Your notes say the model checker found no double payout “with 2 and 3 workers”. We now run 300. Did anyone check 300?

You open your configuration files. `Workers = {"A", "B", "C"}`, and one run with a fourth. Nobody checked three hundred.

This is a strange kind of bug. No customer has been paid twice, and maybe nobody ever will be. The bug is in your evidence: the thing you are sure of and the thing you run have drifted apart. Remember lesson 1’s warning, under “What people get wrong”: the checker passed for the spec, with two and three workers, and it can’t tell you whether three hundred workers behave like three. That was a promissory note. This lesson pays it.

By the end you will have an argument that NoDoublePayout holds for *any* number of workers, you will have used TLC to find that argument instead of to enumerate states, and you will know exactly which part of it TLC checked and which part rests on reasoning.

## How fast does the desk grow?

The obvious move is to just give TLC more workers. Let’s see how far that goes.

We will use the heart of the desk, lesson 1’s fix, with nothing else in the way: a worker can **Claim** an approved loan in one atomic step, **Send** the transfer, **Mark** the loan paid, or **Skip** a loan that is already paid. Three variables, as in lesson 1: `status`, `pc`, `transfers`.

Before you look at any number, count one case by hand. With three workers, how many reachable states are there?

Walk through it. At the start everybody is idle and the loan is approved: 1 state. Then one worker claims, and the others can’t, because the loan is no longer approved. That worker is either claimed or sent, and it could be any of the three: 3 × 2 = 6 states. Then it marks the loan paid, and from here every other worker either still sits idle or has seen “paid” and skipped. Each worker is done or idle, independently, except that the all-idle pattern can’t happen because the marking worker is done. That is 2 × 2 × 2 − 1 = 7 states. Total: 1 + 6 + 7 = 14.

The same count for N workers is 1 + 2N + (2^N − 1), which is 2N + 2^N. Here is what TLC says when you run the desk with 2 to 6 workers, and once more with 12. The depth column is lesson 7’s depth: the number of states on the shortest route to the state farthest from the start, counting the first (for two workers, start, Claim, Send, Mark, Skip: five).

| workers | distinct states (TLC) | depth |
|---|---|---|
| 2 | 8 | 5 |
| 3 | 14 | 6 |
| 4 | 24 | 7 |
| 5 | 42 | 8 |
| 6 | 76 | 9 |
| 12 | 4,120 | 15 |

Every row agrees with the formula. And the formula has a 2^N in it: every extra worker roughly doubles the state count, because every worker that is not the payer adds its own little coin, idle or done.

```python
for n in (2, 3, 4, 5, 6, 12):
    print(n, "workers:", 2 * n + 2 ** n, "states")
print(len(str(2 * 300 + 2 ** 300)), "digits at 300 workers")
```

```text
2 workers: 8 states
3 workers: 14 states
4 workers: 24 states
5 workers: 42 states
6 workers: 76 states
12 workers: 4120 states
91 digits at 300 workers
```

A number with 91 digits. There are not that many atoms in a cup of coffee; there aren’t that many in the observable universe either. And this is the *smallest* desk in the course: one loan, no crashes, no clock. Lesson 4 taught you to keep TLC finishing with symmetry, bounds and constraints, and those work for finding bugs. None of them gets you to three hundred.

[[diagram:growth]]

## Is small enough?

Here is the honest case for checking small models, lesson 4’s small-scope hypothesis: most bugs fit in a small model. Every bug in this course showed up with one or two workers. The naive desk of lesson 1 passes with one worker and pays twice with two. Lesson 2’s lease paid twice with two workers; add a crash and it pays twice with a *single* worker, in six steps: it claims, its lease expires, it sends, it crashes, it claims again, it sends again. Lesson 2’s “resume your own claims” without a key paid twice with worker B idle throughout, so one worker is enough. Bugs in concurrent systems usually need only a couple of actors to bump into each other, and a model checker is superb at finding those.

But “usually” is not what Maren asked. Imagine a desk with a pool of six database connections, where a seventh busy worker falls back to some older code path. A bug on that path needs seven workers to show up, and every model with six or fewer would pass. Our desk has no pool, but how would you *know* it has nothing like one, short of checking every size? The checker can’t see a bug that needs more workers than you gave it, and it can’t tell you that such a bug is impossible either.

So we need a different kind of evidence: something that doesn’t walk through states one at a time.

## Dominoes

Think of a long row of dominoes, three hundred of them, or three thousand. How do you know they will all fall, without watching each one? You check two things. The first domino gets pushed. And every domino, *whichever one it is*, is close enough to knock over the next. Those two facts together cover the whole row, however long it is.

Now translate. The dominoes are the states of a behavior: the first state, then the next, then the next. Suppose we had a property of a single state, call it **Inv**, with two features:

1. Every initial state satisfies it. (The first domino falls.)
2. From *any* state that satisfies it, every step leads to a state that also satisfies it. (Each domino knocks over the next.)

Then every reachable state satisfies Inv, by the same argument as the dominoes: the first state of any behavior has it, and each step passes it on. A property with these two features is called an **inductive invariant**. If, on top of that,

3. every state that satisfies Inv also satisfies NoDoublePayout,

then NoDoublePayout holds in every reachable state too.

Read the second condition again, slowly, because it is the whole trick. It says “from *any* state that satisfies Inv”, not “from any reachable state”. To check it, you never have to find out which states are reachable. You don’t follow behaviors at all. You take one state, take one step, and look. And one step of the desk is always one worker doing one thing.

[[diagram:dominoes]]

In TLA+ the three conditions are three formulas, one per line. They live in a module of their own, Proof, whose first line after the header is `EXTENDS Desk`. EXTENDS means “start with every definition of these modules”: lesson 1’s `EXTENDS Naturals` brought in numbers and `+`, and here Desk, this lesson’s copy of the desk spec, brings in Init, Next, NoDoublePayout and the variables.

```tla
InitHolds == Init => Inv
StepKeeps == Inv /\ Next => Inv'
InvEnough == Inv => NoDoublePayout
```

Two symbols you know, and one new use of an old one. The double arrow `=>`, typeset ⇒, is lesson 6’s “implies”: A ⇒ B is false only when A is true and B is false. `/\` is “and”, as in lesson 1, and it binds tighter than `=>`, so StepKeeps reads (Inv ∧ Next) ⇒ Inv′. And `Inv'`, “Inv prime”, is Inv evaluated in the state *after* the step, exactly the way `pc'` meant pc after the step in lesson 1; TLA+ lets you prime a whole formula, and it means “prime every variable in it”.

Read each line from the left. InitHolds: if a state satisfies Init, it satisfies Inv. StepKeeps: if a state satisfies Inv, and a Next step is taken from it, the state after satisfies Inv. InvEnough: if a state satisfies Inv, the bank has made at most one transfer. **Inv is an inductive invariant when the first two lines are true for every state and every step, and it proves NoDoublePayout when the third is true as well.**

Push the desk’s start through them, with NoDoublePayout itself standing in for Inv. Init is approved, everyone idle, 0 transfers, and 0 ≤ 1, so InitHolds is true there. From that state the only steps are Claims, which leave transfers at 0, so StepKeeps is true for those steps. Whether it is true for *every* state with at most one transfer is the question the code below asks.

The Python mirror needs the desk as a function, like lesson 1’s `next_states`, plus a list of candidate states to try. Which states? Every state whose variables have sensible values: a status from the three statuses, a pc for each worker from the four pcs, and a transfer count from 0 to 2. Then the three conditions become three checks.

```python
from itertools import product

def steps(state):
    status, pc, t = state
    for w, p in enumerate(pc):
        def put(v):
            return pc[:w] + (v,) + pc[w + 1:]
        if p == "idle" and status == "approved":
            yield "claimed", put("claimed"), t
        if p == "claimed":
            yield status, put("sent"), t + 1
        if p == "sent":
            yield "paid", put("done"), t
        if p == "idle" and status == "paid":
            yield status, put("done"), t

def type_ok(n):
    pcs = ("idle", "claimed", "sent", "done")
    return [(s, pc, t)
            for s in ("approved", "claimed", "paid")
            for pc in product(pcs, repeat=n)
            for t in range(3)]

def obligations(inv, n):
    init = ("approved", ("idle",) * n, 0)
    good = [s for s in type_ok(n) if inv(s)]
    keeps = all(inv(a) for s in good for a in steps(s))
    enough = all(s[2] <= 1 for s in good)
    return inv(init), keeps, enough

no_double = lambda s: s[2] <= 1
print(obligations(no_double, 2))
```

```text
(True, False, True)
```

We tried the most obvious candidate first: NoDoublePayout itself. It holds initially, and it trivially implies itself. But the middle answer is False. NoDoublePayout is an invariant of the desk, TLC told us so for every size we tried, and yet it is *not* inductive. How can both be true?

## A state nobody reaches

Before you read on, try to find it yourself. You are looking for a state, with two workers, where at most one transfer has been made, and from which one step makes a second transfer.

Here is a search that finds one. What it prints first is folded below, so you can make your own try before you look:

```python
def first_cti(inv, n):
    for s in type_ok(n):
        for after in steps(s):
            if inv(s) and not inv(after):
                return s, after

print(*first_cti(no_double, 2), sep="\n")
```

```text
('approved', ('idle', 'claimed'), 1)
('approved', ('idle', 'sent'), 2)
```

| | status | pc of A | pc of B | transfers |
|---|---|---|---|---|
| before | approved | idle | claimed | 1 |
| after Send(B) | approved | idle | sent | 2 |

Look at the “before” row. The loan is approved, yet worker B holds a claim on it. And the bank has already made one transfer, with nobody having sent anything. Could the desk ever be in this state? No. A claim turns the loan from approved to claimed in the same step, so “approved and claimed by B” never happens, and a transfer happens only at Send. This state satisfies NoDoublePayout, it is not reachable, and from it one step pays twice.

That is the whole explanation. NoDoublePayout is true of every reachable state, but it is also true of some unreachable states, and from those the desk can step to a double payout. Since the dominoes argument looks at *every* state satisfying the candidate, it trips over these.

A state that satisfies a candidate invariant, together with a step from it to a state that does not, is called a **counterexample to inductiveness**, or CTI for short. It is not a bug report. A counterexample, in lesson 1’s sense, is a behavior from the start. A CTI starts wherever it likes. It says: “your candidate allows this state, and from here the candidate breaks”. There are two ways to respond, and choosing between them is the skill of this lesson:

- if the CTI’s first state is unreachable, the candidate is **too weak**: it lets in states the desk never visits. You **strengthen** it, by adding a conjunct that rules that state out;
- if the CTI’s first state is reachable, the desk itself breaks the candidate, and you have found a real counterexample.

[[diagram:cti]]

[[lab]]

## Asking TLC

You can ask TLC for CTIs instead of writing your own search, and it is worth knowing how, because your real specs will be far bigger than this one.

The trick is to lie to TLC about where behaviors start. Normally the configuration says `SPECIFICATION Spec`, and TLC starts from Init. Instead, we tell it to start from *every* state that satisfies the candidate, take the desk’s Next steps from there, and check the candidate in every state it meets. If some step leaves the candidate, TLC reports it as an invariant violation, one step from a starting state. That is a CTI.

There is one catch. To start “from every state satisfying the candidate”, TLC has to list those states, and it can only list states drawn from finite sets of values. NoDoublePayout says `transfers <= 1`, which doesn’t tell TLC what `status` or `pc` could be. So we give it the sensible values, in a formula known as the **type invariant**, written TypeOK by convention:

```tla
Pcs == {"idle", "claimed", "sent", "done"}

TypeOK == /\ status \in {"approved", "claimed", "paid"}
          /\ pc \in [Workers -> Pcs]
          /\ transfers \in 0..2
```

The new piece is `[Workers -> Pcs]`, read “the set of functions from Workers to Pcs”: every way of giving each worker one of the four pcs. With two workers that is 4 × 4 = 16 functions. The `\in`, typeset ∈, is “is an element of”, and `0..2` is the set {0, 1, 2}. **TypeOK is true of a state when the status is one of the three statuses, each worker’s pc is one of the four pcs, and the bank has made 0, 1 or 2 transfers.** With two workers that is 3 × 16 × 3 = 144 states, of which 96 also satisfy NoDoublePayout:

```python
print(len(type_ok(2)), sum(map(no_double, type_ok(2))))
```

```text
144 96
```

TypeOK is the list of states our Python `type_ok` builds. It is not a claim about the desk. It is the edge of the board we play on.

Now the candidate, written for TLC, and its configuration file `Ind0.cfg`:

```tla
Ind0 == TypeOK /\ NoDoublePayout
```

```text
CONSTANT Workers = {"A", "B"}
INIT Ind0
NEXT Next
INVARIANT Ind0
```

**Ind0 is true of a state when its variables have sensible values and the bank has made at most one transfer.** With two workers it is true of the 96 states counted above. The configuration is new in one way. Until now it said `SPECIFICATION Spec`; here that one line is split into its two halves. `INIT Ind0` names the formula a first state must satisfy, in place of Init, and `NEXT Next` names the formula every step must satisfy. `CONSTANT` fills in the set of workers, as in lessons 3 and 4, and `INVARIANT` is the property checked in every state, as always. So it says: start from every Ind0 state, take Next steps, and check Ind0 everywhere. (Python: `first_cti(no_double, 2)` above, since `type_ok` already supplies the TypeOK part.)

TLC answers, with the lines that matter:

```text
Finished computing initial states: 96 distinct states generated
Error: Invariant Ind0 is violated.
Error: The behavior up to this point is:
State 1: <Initial predicate>
/\ status = "approved"
/\ pc = [A |-> "idle", B |-> "claimed"]
/\ transfers = 1
State 2: <Send line 18, col 12 to line 21, col 30 of module Desk>
/\ status = "approved"
/\ pc = [A |-> "idle", B |-> "sent"]
/\ transfers = 2
104 states generated,
  97 distinct states found, 92 states left on queue.
The depth of the complete state graph search is 2.
```

Read it line by line.

- “96 distinct states generated” as *initial* states. In a normal run this number was 1. Here it is every Ind0 state, the 96 we just counted.
- “Invariant Ind0 is violated.” Ind0 is the candidate, so this means a step left it.
- “State 1: <Initial predicate>”. Careful: this does not mean the desk’s Init. It means “one of the states the INIT line allowed”, and this one is our old friend: approved, B claimed, one transfer.
- “State 2: <Send line 18, col 12 to line 21, col 30 of module Desk>”: as in earlier traces, the name in angle brackets is the action that produced the state, here followed by where that action is written: lines 18 to 21 of Desk.tla. B sends, and the bank has made two transfers. Below each header, `pc = [A |-> "idle", B |-> "sent"]` is the function from lesson 1’s `|->` table: A maps to idle, B to sent.
- “104 states generated, 97 distinct states found, 92 states left on queue”: as in lesson 7, generated counts every state TLC produced, starting states and steps alike, and distinct counts the different ones; the queue, from lesson 4, holds states found but not yet explored. TLC stopped at the first violation, with 92 starting states still waiting.
- “depth … is 2”: the trace is two states long. A CTI is always one step.

Same state, same step as the Python search. TLC found it without any idea which states are reachable, which is exactly the point.


## Strengthening, round by round

The CTI shows a state where the bank has already transferred once and a worker still holds a claim, a claim that will turn into a second transfer. On the real desk, money sent and claims in hand never add up to more than one. Think of it as a budget of one payout per loan: a claim is a payout promised, a transfer is a payout made, and you can’t have both outstanding at once.

```tla
Claimed == {w \in Workers : pc[w] = "claimed"}

Owed == transfers + Cardinality(Claimed) <= 1
```

The braces with a colon build a set: `{w \in Workers : pc[w] = "claimed"}` reads “the set of workers w such that w’s pc is claimed”. `Cardinality`, from the standard module FiniteSets (Desk’s first line is `EXTENDS Naturals, FiniteSets`), is “how many elements”, Python’s `len`. **Owed is true of a state when the number of transfers made plus the number of workers holding a claim is at most one.** In the CTI, that is 1 + 1 = 2, so Owed rules it out. Since a count of claims is never negative, Owed also implies NoDoublePayout, so we can drop NoDoublePayout from the candidate.

```python
def owed(s):
    return s[2] + s[1].count("claimed") <= 1

print(sum(map(owed, type_ok(2))))
print(*first_cti(owed, 2), sep="\n")
```

```text
72
('approved', ('idle', 'idle'), 1)
('claimed', ('claimed', 'idle'), 1)
```

Fewer states pass (72 instead of 96), and there is a new CTI. TLC, running `Ind1 == TypeOK /\ Owed` from `Ind1.cfg`, starts from 72 states and prints the same one:

| | status | pc of A | pc of B | transfers |
|---|---|---|---|---|
| before | approved | idle | idle | 1 |
| after Claim(A) | claimed | claimed | idle | 1 |

Is the “before” row reachable? The loan is still approved, nobody has done anything, and the bank has already made a transfer. No: money leaves the bank only at Send, and only after a Claim has turned the loan away from approved. So again the candidate is too weak. What does the real desk know here that Owed doesn’t? That while the loan is approved, nothing has happened yet.

```tla
Unclaimed == status = "approved" =>
               /\ transfers = 0
               /\ \A w \in Workers : pc[w] = "idle"

Inv == TypeOK /\ Owed /\ Unclaimed
```

The `\A w \in Workers :`, typeset ∀, is lesson 2’s “for every worker w in Workers”, and the `=>` makes the rest a promise only about approved loans: when the status is claimed or paid, Unclaimed is true whatever the workers are doing. **Unclaimed is true of a state when, if the loan is still approved, the bank has made no transfer and every worker is idle; and Inv is true of a state when its values are sensible, the payout budget holds, and an approved loan has nobody working on it.** In the new CTI the loan is approved and the bank has made 1 transfer, so Unclaimed is false there and Inv rules it out.

```python
def unclaimed(s):
    status, pc, t = s
    return status != "approved" or (
        t == 0 and set(pc) == {"idle"})

inv = lambda s: owed(s) and unclaimed(s)
for n in (2, 3, 4, 5):
    print(n, sum(map(inv, type_ok(n))), first_cti(inv, n))
print(obligations(inv, 2))
```

```text
2 49 None
3 163 None
4 541 None
5 1783 None
(True, True, True)
```

No CTI, with two, three, four or five workers. TLC agrees. Here is its run with two workers (`Inductive2.cfg`, which says `INIT Inv`, `NEXT Next`, `INVARIANT Inv`):

```text
Finished computing initial states: 49 distinct states generated
Model checking completed. No error has been found.
105 states generated,
  49 distinct states found, 0 states left on queue.
The depth of the complete state graph search is 1.
```

The last line is the one to savour. Depth 1 means TLC never found a state it hadn’t started from: every step from an Inv state landed on another Inv state, which was already in its starting set. That is condition 2, seen from TLC’s side. The 105 generated states are the 49 starting states plus the 56 steps taken from them. With three, four and five workers TLC starts from 163, 541 and 1,783 states, finds no error, and reports depth 1 every time.

Two more checks finish the job. Condition 1, InitHolds, passes in TLC with three workers: an ordinary run from Init with `INVARIANT InitHolds` checks the formula in all 14 reachable states, and only the start state matters: there it says “this state satisfies Inv”, and everywhere else Init is false, so the implication holds for free. Condition 3 holds because Owed implies `transfers <= 1`.

Condition 2 can also be checked as written. `Obligations.cfg` checks StepKeeps as a property of every step: Proof defines `StepProp == [][StepKeeps]_vars`, “always, every step is a StepKeeps step or leaves vars unchanged”, read like lesson 1’s Spec. As in lesson 1, `vars` is the tuple of all the variables, `<<status, pc, transfers>>`. The configuration names StepProp on a `PROPERTY` line, as in lesson 2. Starting from the 163 Inv states for three workers: no error. As a sanity check, the same property written for the weaker candidate, `Ind1`, fails there on the Claim step we saw.

[[diagram:strengthen]]

## Why this holds for three hundred

So far TLC checked the inductive step for up to five workers. That is still five, not three hundred. What makes this better than the 76-state run from the start of the lesson?

The answer is that the inductive step is now small enough to check *by hand*, for every number of workers at once. Take any Inv state, with any number of workers, and any worker w. One step is one of four actions, and each one leaves the budget intact:

| step | what it needs before | what changes | why Inv still holds |
|---|---|---|---|
| Claim(w) | loan approved | status claimed, one claim more | Unclaimed said: no transfer, nobody claimed; now 0 + 1 = 1 |
| Send(w) | w claimed | one claim less, one transfer more | the sum is unchanged; the loan isn’t approved, or Unclaimed would say w is idle |
| Mark(w) | w sent | status paid, w done | transfers and claims unchanged; not approved |
| Skip(w) | loan paid | w done | transfers and claims unchanged; still paid |

TypeOK survives too: every step sets a pc to one of the four and the status to one of the three, and Send runs only when w holds a claim, which leaves the budget no room for an earlier transfer, so transfers goes from 0 to 1 and so never exceeds 1, well inside 0..2.

Read down the “why” column. Not one line mentions how many workers there are. Each step moves one worker, changes the number of claims by at most one and the number of transfers by at most one, and the argument only ever looks at those counts and at the status. Three workers, three hundred, three million: the same four lines. Combine that with condition 1 (the start state is approved, all idle, no transfers) and condition 3, and the dominoes do the rest. **NoDoublePayout holds in every reachable state of the desk, for every number of workers.**

[[diagram:one-worker]]

There is also a way to let a script check the counts at three hundred workers. Every worker runs the same code, and Inv only asks how many workers are in each pc, never which ones. So a state can be summarised by counts: the status, the transfers, and how many workers are idle, claimed, sent and done. That summary is small enough to check at three hundred workers in a moment:

```python
from itertools import product

def count_inv(st, t, i, c, s, d):
    if st == "approved" and (t or c or s or d):
        return False
    return t + c <= 1

def count_steps(st, t, i, c, s, d):
    if i and st == "approved":
        yield "claimed", t, i - 1, c + 1, s, d
    if c:
        yield st, t + 1, i, c - 1, s + 1, d
    if s:
        yield "paid", t, i, c, s - 1, d + 1
    if i and st == "paid":
        yield st, t, i - 1, c, s, d + 1

for n in (3, 30, 300):
    seen = bad = 0
    for st in ("approved", "claimed", "paid"):
        for t, c, s in product(range(3), range(2), range(n + 1)):
            for d in range(n + 1 - c - s):
                x = (st, t, n - c - s - d, c, s, d)
                if count_inv(*x):
                    seen += 1
                    ys = count_steps(*x)
                    bad += sum(not count_inv(*y) for y in ys)
    print(n, "workers:", seen, "count-states,", bad, "CTIs")
```

```text
3 workers: 53 count-states, 0 CTIs
30 workers: 2915 count-states, 0 CTIs
300 workers: 272105 count-states, 0 CTIs
```

Here `count_inv` is Inv on the counts (an approved loan passes only when no transfer has been made and every worker is idle, and transfers plus claims is at most one), and `count_steps` is the desk on the counts: a Claim moves one idle worker to claimed, and so on. The loop only tries one or zero claims, because a state with two claims already breaks `t + c <= 1`. Three hundred workers, no CTI. But notice what this is: a check for three numbers, 3, 30 and 300. Only the per-action argument, one case for each of Claim, Send, Mark and Skip, covers *every* number. The script is a second pair of eyes on it, not a replacement.

TLA+ has a way to state the conclusion as a formula:

```tla
THEOREM Safe == Spec => []NoDoublePayout
```

`THEOREM`, as in lesson 7, announces a claim and gives it a name, Safe; `Spec` is the desk’s Init and Next as one formula, as in lesson 1; and `[]`, typeset □, is lesson 1’s “always”. **Every behavior of the desk satisfies NoDoublePayout in every state.** TLC parses this line happily, and ignores it: a model checker checks models, it doesn’t prove theorems. In Python, the best we can do is the same claim for some sizes, with `obligations` and the two-worker style `inv` from before:

```python
print(all(all(obligations(inv, n)) for n in range(1, 6)))
```

```text
True
```

To have a machine check the hand argument for every number of workers, you would write it as a proof and give it to the TLA+ proof system, TLAPS. The proof would have one case per action: Claim, Send, Mark and Skip. This lesson does not run TLAPS, so take that as a pointer for later, not as something you have seen work.

## Strengthenings that cheat

Strengthening is powerful, and it is easy to strengthen your way into nonsense. Two traps.

**The empty invariant.** Here is the strongest candidate imaginable: FALSE, the TLA+ constant for false (Python’s `False`). No state satisfies it, so no step can leave it. TLC, run with `Vacuous == TypeOK /\ FALSE` on the INIT and INVARIANT lines:

```text
Finished computing initial states: 0 distinct states generated
Model checking completed. No error has been found.
0 states generated,
  0 distinct states found, 0 states left on queue.
```

“No error has been found”, from zero states. The inductive check alone is happy with anything that excludes everything. What catches it is condition 1: the start state doesn’t satisfy FALSE.

```python
print(obligations(lambda s: False, 2))
```

```text
(False, True, True)
```

That is why InitHolds is a separate check, and why “zero initial states” in a TLC inductive run should make you sit up.

**The strengthening that isn’t true.** Suppose you try to be clever: “only one worker is ever busy”, where busy means not idle. It sounds right, since only one worker ever claims. Add it to Inv and run TLC from the 25 states that satisfy both: it reports a CTI, from a paid loan with A idle, B claimed and no transfer, where A skips and two workers are busy. That first state is unreachable (B’s claim would have been sent before anyone could mark the loan paid), so it looks like the “too weak” case. It isn’t. Run the candidate the ordinary way, from Init, and TLC finds a real counterexample in four steps: A claims, sends and marks, then B skips. Now A and B are both done, and done isn’t idle. The candidate is false on a reachable state. No amount of further strengthening rescues a conjunct that the real desk breaks. Everything you add to Inv has to be true of every reachable state; it can only exclude states the desk never visits.

So a CTI always leaves you two questions, in this order. Does the candidate hold on every reachable state (an ordinary TLC run from Init)? If not, your candidate is wrong, or your desk is. If it does, the CTI’s first state is one the desk never visits: strengthen.

## The checker as code

**Build it.** Using `steps`, `type_ok`, `first_cti`, `owed`, `unclaimed` and `inv` from the snippets above (not the counting ones), write two functions. `reachable(n)` returns the set of reachable states of the n-worker desk, breadth first from the start state, as in lesson 1. `diagnose(candidate, n)` returns `"not an invariant"` if some reachable state breaks the candidate, otherwise `"too weak"` if it has a CTI, otherwise `"inductive"`.

```text
assert len(reachable(2)) == 8 and len(reachable(6)) == 76
assert diagnose(no_double, 2) == "too weak"
assert diagnose(owed, 2) == "too weak"
both = lambda s: no_double(s) and unclaimed(s)
assert diagnose(both, 3) == "too weak"
assert all(diagnose(inv, n) == "inductive" for n in range(1, 6))
busy = lambda s: inv(s) and sum(p != "idle" for p in s[1]) <= 1
assert diagnose(busy, 2) == "not an invariant"
assert diagnose(lambda s: False, 2) == "not an invariant"
```

Notice the order inside `diagnose`. Reachability comes first, because a candidate that the desk breaks is not “too weak”, it is wrong, and the FALSE candidate is wrong in the most basic way: the very first state breaks it.

## Fix the bug

The bug in this lesson is the gap in your evidence, so the fix is evidence that has no gap. In the lab below you start with NoDoublePayout as your candidate and a panel of conjuncts you can add: the budget (Owed), “approved means untouched” (Unclaimed), and “only one worker busy”. Run the inductive check with two workers, then three. The lab shows any CTI as a before-and-after pair of states, and asks you whether that first state is reachable.

You are done when three things are true at once: the start state satisfies your candidate, the inductive check finds no CTI with two and with three workers, and your candidate holds on every reachable state. Then the lab asks you for the last piece, the one TLC can’t give you: for each of Claim, Send, Mark and Skip, pick the reason the candidate survives the step, and confirm that none of your reasons mentions the number of workers.

[[lab-act2]]

## What people get wrong

**“It’s an invariant, so it’s inductive.”** NoDoublePayout is true of every reachable state and still fails the inductive step, because unreachable states satisfy it too. Most invariants worth stating are not inductive. You usually have to strengthen them.

**“TLC passed the inductive check, so it holds for any number of workers.”** TLC checked the inductive step for the worker counts you gave it, two to five here. What carries the result to three hundred is the per-action argument, which never mentions how many workers there are. TLC finds that argument quickly; it doesn’t replace it.

**“A CTI is a bug.”** Usually it is a state the desk never visits, and the fix is to strengthen the candidate, not to change the desk. Only when the CTI’s first state is reachable is the desk at fault. Check before you rewrite code.

**“Stronger is always safer.”** FALSE is the strongest candidate there is, and it proves nothing. A conjunct like “only one worker is busy” is false on the real desk. Strengthen only with facts the desk keeps.

## Recap, and where to go from here

TLC checks every reachable state of the model you give it, and the number of states doubles with every worker: 76 at six workers, 4,120 at twelve, 91 digits at three hundred. An **inductive invariant** escapes that: if it holds initially and every step from any state satisfying it leads to a state satisfying it, it holds in every reachable state, however many there are. NoDoublePayout alone isn’t inductive; its **counterexamples to inductiveness** start from states nobody reaches. You **strengthened** it twice, with the payout budget and with “approved means untouched”, until TLC found no CTI, and then the argument per action showed why that holds for any number of workers.

That is the answer for Maren: not “we checked three hundred”, but “we checked that every single step keeps the budget, and a step only ever involves one worker”.

This is the last lesson of the payout desk. The bakery was paid twice, then not at all, then twice again after a long weekend; you modelled time, shrank a desk too big to check until TLC finished, wrote the worker as code, balanced two ledgers, showed the queue design does what the one-line spec promises, and now you have a reason, not a sample, for believing it at any size. Where could you go next? Three directions, none of which this course has run for you:

- **TLAPS, the TLA+ proof system**, to have a machine check the per-action argument for every number of workers instead of trusting your table.
- **Apalache**, a symbolic model checker for TLA+, which can check an inductive step without listing every starting state one by one.
- **Checking production logs against the spec**, sometimes called trace validation: replay what your three hundred workers actually did through the spec, and see whether every logged step is one the spec allows.

## Concept check

Write your answers down before you move on.

1. A teammate proposes the candidate `TypeOK /\ (transfers = 0)`. Which of the three conditions (InitHolds, StepKeeps, InvEnough) does it satisfy, and which does it fail? Is its CTI’s first state reachable?
2. Another teammate proposes `status \in {"approved", "claimed", "paid"}` and shows you that it passes both InitHolds and the inductive check. Why isn’t that a proof of NoDoublePayout?
3. TLC’s inductive check passes for two, three, four and five workers. In one or two sentences, explain what extra reasoning lets you conclude it holds for three hundred, and point at the line of the argument that would break if a single step could move two workers at once.
