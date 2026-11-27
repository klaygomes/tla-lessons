# Writing the Worker as Code

## The spec that passed

Noor joined the payout desk on a Monday, and by Wednesday she had read every spec in the repository. Her verdict was polite and firm: “I believe these are right. I just can’t read them.”

She had a point. Every action in the desk spec is a block of lines joined by “and”, and every one of them ends with a list of the variables it does *not* touch. The worker’s program counter is spelled out by hand, so you have to keep in your head that “claimed” comes after “idle” and before “sent”. The TypeScript reads top to bottom like a story. The spec reads like a tax form for the same story.

So Noor did what a good engineer does with code that is hard to read. She rewrote it. TLA+ comes with a second language for exactly this, called **PlusCal**: you write the worker as a small program, with assignments, ifs and loops, and a tool translates it into the TLA+ you already know. Noor rewrote the worker’s claim in PlusCal, ran the checker, and got the line everybody loves: no error has been found.

In the same week, she tidied the TypeScript. The old worker claimed a loan with one conditional update, the SQL statement from lesson 1. Noor moved the desk onto the team’s new data layer, which loads a row as an object and saves it back:

```ts
const loan = await loans.find(loanId);
if (loan.status !== "approved") return;
loan.status = "claimed";
await loans.save(loan);
```

Cleaner, she thought, and the spec said the claim was safe. Code review agreed. It shipped.

Three weeks later, finance sent a short message. The bank’s monthly statement has a column that counts requests the bank refused to pay because their idempotency key had already been paid. Since lesson 2, that column held a handful a month: a worker that crashed after sending, came back, and sent again. This month it held dozens, for loans where nobody had crashed at all.

Nobody was paid twice. The key from lesson 2 caught every one of them. But each of those refused requests was a second worker that had claimed a loan another worker had already claimed, and sent its money. Lesson 1’s race was back in production, and the only thing between it and the bakery was the bank’s memory, which lesson 3 taught you not to lean on.

[[diagram:two-calls]]

And the checker had passed. This lesson is about why. By the end you will be able to write a worker in PlusCal, read the TLA+ it turns into, say exactly what counts as one step, and catch the lie in Noor’s spec before it ships.

## PlusCal, one line at a time

Here is Noor’s spec. Before you read the explanation, look at it as code. It should feel familiar.

```tla
---- MODULE OneLabel ----
EXTENDS Naturals

Workers == {"A", "B"}

(* --algorithm OneLabel {
  variables status = "approved", transfers = 0;

  process (w \in Workers) {
    claim: if (status = "approved") {
             status := "claimed";
    send:    transfers := transfers + 1;
    mark:    status := "paid"
           }
  }
} *)

NoDoublePayout == transfers <= 1
====
```

The model is lesson 1’s fixed desk: one loan, its status, and transfers, which counts every request the bank receives for the loan. Lesson 2’s idempotency key is left out on purpose. The key is a safety net. We want to know whether the claim is right on its own.

The first lines are lesson 1’s: the module’s name, then `EXTENDS Naturals`, which loads TLA+’s standard module of natural numbers, where `+` and `<=` are defined. The program lives inside a comment, between `(*` and `*)`, so the TLA+ tools ignore it until it has been translated. The word **algorithm**, written `--algorithm`, opens it and gives it a name. Curly braces group statements, as in TypeScript, and a semicolon separates one statement from the next.

`variables` declares the shared state and its starting values. Here the equals sign means “starts as”: status starts approved, transfers starts at zero. These are the variables every worker can see.

`process (w \in Workers)` says: run one copy of this code for every element of Workers. A **process** is one running copy, and here there are two, A and B. Inside the code a process can refer to its own name, which PlusCal calls `self`. The `w` is just a name for the family of processes. You type `\in`; the listings on this page typeset it as ∈, as they typeset `/\` as ∧, and the “Show ASCII” switch above each listing shows what you type.

Then the body. The `:=` is assignment, as in Pascal: “status becomes claimed”. The `if` is an if. And then there are the words at the start of some lines, `claim:`, `send:` and `mark:`. Those are **labels**, and they are the whole point of this lesson.

A label marks where a step begins. **Everything from one label to the next label runs as one step**, with no other process acting in the middle. So for each worker this program has exactly three steps:

1. `claim`: look at the status, and if it is approved, set it to claimed. One step.
2. `send`: add one transfer. One step.
3. `mark`: set the status to paid. One step.

When a worker reaches the end of its code, it is finished, and PlusCal gives it the label `Done`.

[[diagram:labels]]

Read the whole program aloud once: **each worker, in one step, claims the loan if it is approved; then in a second step sends the money; then in a third marks the loan paid.** That is lesson 1’s fixed desk, the one with the atomic Claim, written as a program.

Here are the three labels as Python functions. Each one takes the shared state and returns the new state and the label the worker goes to next. A worker’s position is just the name of its next label.

```python
def claim(status, transfers):
    if status == "approved":
        return "claimed", transfers, "send"
    return status, transfers, "Done"

def send(status, transfers):
    return status, transfers + 1, "mark"

def mark(status, transfers):
    return "paid", transfers, "Done"

NOOR = {"claim": claim, "send": send, "mark": mark}

status, transfers = "approved", 0
pc = {"A": "claim", "B": "claim"}
for w in "ABAA":
    status, transfers, pc[w] = NOOR[pc[w]](status, transfers)
    print(w, status, transfers, pc)
```

```text
A claimed 0 {'A': 'send', 'B': 'claim'}
B claimed 0 {'A': 'send', 'B': 'Done'}
A claimed 1 {'A': 'mark', 'B': 'Done'}
A paid 1 {'A': 'Done', 'B': 'Done'}
```

One function call per step. That is the mental model to keep: **a label is a function, and a step is one call of it.** Whatever is inside the function happens all at once.

## One behavior, label by label

The dictionary `pc` in that snippet should look familiar: it is lesson 1’s program counter. In PlusCal you never write it. The labels are its values. Let’s run one behavior by hand and watch it.

Both workers start at `claim`. A goes first and finds the loan approved. Then B goes. Predict before you look: what does B find, and where does B go? In the table, claim(A) means worker A, the process whose `self` is A, taking its claim step.

| | step | status | pc of A | pc of B | transfers |
|---|---|---|---|---|---|
| 0 | (start) | approved | claim | claim | 0 |
| 1 | claim(A) | claimed | send | claim | 0 |
| 2 | claim(B) | claimed | send | Done | 0 |
| 3 | send(A) | claimed | mark | Done | 1 |
| 4 | mark(A) | paid | Done | Done | 1 |

B finds “claimed” and is finished in a single step, because its `if` fails and there is nothing after it. That is the same table the snippet printed. There is no row where B has looked but not yet written, because looking and writing are inside one label. No such row can exist.

How many reachable states does Noor’s spec have with two workers? With three? PlusCal chose the program counter’s values for you, so will the counts match lesson 1’s atomic Claim desk, or did the translation add states of its own? Make a guess, then let the computer count. Here is lesson 1’s breadth-first search, rewritten to run any program written as a dictionary of labels. Every worker starts at the program’s first label, and a worker whose label is not in the dictionary, such as `Done`, has no step left. It continues the snippet above.

```python
from collections import deque

def explore(prog, workers="AB"):
    first = next(iter(prog))
    start = ("approved", 0, (first,) * len(workers))
    parent, queue = {start: None}, deque([start])
    while queue:
        state = queue.popleft()
        status, transfers, pc = state
        if transfers > 1:
            path = []
            while state:
                path.append(state)
                state = parent[state]
            return path[::-1]
        for i, at in enumerate(pc):
            if at in prog:
                s, t, to = prog[at](status, transfers)
                after = (s, t, pc[:i] + (to,) + pc[i + 1:])
                if after not in parent:
                    parent[after] = state
                    queue.append(after)
    return len(parent)

print(explore(NOOR), explore(NOOR, "ABC"))
```

```text
12 32
```

When no state has two transfers, `explore` returns how many states it saw; when one does, it returns the path to it. Twelve and thirty-two, the same counts lesson 1’s lab showed for the atomic Claim desk, where a worker that finds the loan taken skips it and finishes, as B does here. (Lesson 2’s 8 states came from a desk where that worker keeps polling instead.) And TLC agrees: on Noor’s translated spec it reports “No error has been found”, 12 distinct states with two workers and 32 with three.

So the spec is fine. It describes a safe desk. Hold that thought, because it is exactly half true.

## What the translator writes

TLC doesn’t read PlusCal. Before it can check anything, a tool called the **translator** turns the algorithm into an ordinary TLA+ spec. It ships in the same jar as TLC: `-cp tla2tools.jar` tells Java to load that jar, and `pcal.trans` names the translator inside it, where lesson 1’s command named `tlc2.TLC`.

```bash
java -cp tla2tools.jar pcal.trans OneLabel.tla
```

The translator writes its output into the same file, below the comment, between two marker lines, `\* BEGIN TRANSLATION` and `\* END TRANSLATION` (in TLA+, `\*` starts a comment that runs to the end of the line). Run it again after every edit to the algorithm. Here is the part it wrote for the `claim` label:

```tla
claim(self) == /\ pc[self] = "claim"
               /\ IF status = "approved"
                     THEN /\ status' = "claimed"
                          /\ pc' = [pc EXCEPT ![self] = "send"]
                     ELSE /\ pc' = [pc EXCEPT ![self] = "Done"]
                          /\ UNCHANGED status
               /\ UNCHANGED transfers
```

That is an action, exactly like the ones you wrote by hand in lessons 1 and 2, one per label, named after the label. Read it line by line. The first line is the guard: process self is at label claim. Then IF, THEN and ELSE, which choose between two lists of “and”: if the status is approved, then afterwards the status is claimed and self’s pc is send; otherwise self’s pc is Done and the status stays as it was. Either way, the transfers stay as they were. The translator also invented the variable `pc` for you, a function from each process to the label it will run next, and wrote the UNCHANGED lists that Noor found so tiring.

**claim(self) is a step in which a worker at the claim label, in one move, reads the status and, if it was approved, writes claimed and moves on to send, and otherwise finishes.** The read and the write are lines of the same formula, so they happen in the same step.

As Python, with the guard turned into “return None when the step can’t happen”:

```python
def claim_action(state, me):
    status, transfers, pc = state
    if pc[me] != "claim":
        return None
    if status == "approved":
        return "claimed", transfers, {**pc, me: "send"}
    return status, transfers, {**pc, me: "Done"}

start = ("approved", 0, {"A": "claim", "B": "claim"})
after = claim_action(start, "A")
print(*after)
print(claim_action(after, "A"))
print(*claim_action(after, "B"))
```

```text
claimed 0 {'A': 'send', 'B': 'claim'}
None
claimed 0 {'A': 'send', 'B': 'Done'}
```

A has already left the claim label, so `claim(A)` can’t happen a second time. B can, and finds the loan claimed.

Below the label actions, the translator wrote the glue:

```tla
w(self) == claim(self) \/ send(self) \/ mark(self)

Terminating == /\ \A self \in ProcSet: pc[self] = "Done"
               /\ UNCHANGED vars

Next == (\E self \in Workers: w(self))
           \/ Terminating

Spec == Init /\ [][Next]_vars

Termination == <>(\A self \in ProcSet: pc[self] = "Done")
```

`w(self)` is named after the process: a step of process self is a step of one of its labels, so the three actions are joined by “or”. `ProcSet` is the set of all processes, here just Workers, and `vars` is the tuple of all the variables, pc included, as in lesson 1. Now picture both workers at Done. No label is left to run, so no worker step is possible, and TLC reports a state with no possible next step as a **deadlock**; that is why lesson 1 ran TLC with `-deadlock`. Terminating says that every process is at Done and nothing changes, which turns that do-nothing step into a Next step, so a finished desk is not a deadlock. Next says a step is some worker’s step, or that do-nothing ending. Spec is lesson 1’s shape: start in Init, and every step is a Next step or a stuttering step. **Termination is a liveness property that the translator writes for free: eventually, every process is at Done.** The diamond is lesson 2’s “eventually”, and the upside-down A is “for every”. The translator only defines Termination. TLC checks it only if you list it on a PROPERTY line.

```python
def terminated(pc):
    return all(at == "Done" for at in pc.values())

behavior = [{"A": "claim", "B": "claim"},
            {"A": "send", "B": "claim"},
            {"A": "send", "B": "Done"},
            {"A": "mark", "B": "Done"},
            {"A": "Done", "B": "Done"}]
print([terminated(pc) for pc in behavior])
print("Termination:", any(map(terminated, behavior)))
```

```text
[False, False, False, False, True]
Termination: True
```

The table from the last section, as a list of program counters: all Done only in the last state, and that is enough for “eventually”.

[[diagram:translation]]

So far PlusCal has been a pure convenience. It wrote the pc, the UNCHANGED lists and the “or” of the actions, and it got them right. Now look again at the one thing it did *not* decide for you. The translator turned each label into one step. Who decided where the labels go?

Noor did.

## Two calls, one label

Look at Noor’s TypeScript again. `loans.find` is one round trip to the database. `loans.save` is another. Between them, the worker holds a copy of the row in memory, and the real row can change under it. That is exactly lesson 1’s check-then-act: two steps, with a gap where the other worker can move.

Noor’s spec puts both inside the single label `claim`. In the spec they are one step. In the code they are two. The spec is a correct description of a desk, just not of the desk she shipped.

The honest version gives the code’s two calls two labels. The read goes under `check`, the write under `claim`:

```tla
  process (w \in Workers) {
    check: if (status = "approved") {
    claim:   status := "claimed";
    send:    transfers := transfers + 1;
    mark:    status := "paid"
           }
  }
```

The only difference is one word, `check:`, at the top. Read it in steps: at check, a worker reads the status and, if approved, moves on to claim, and otherwise finishes; at claim, it writes claimed, *without looking again*, because `loans.save` doesn’t look again. **Each worker reads the loan in one step and writes it in a later one, and the other worker can act in between.** That is the code’s shape, line for line.

Before you run it: will TLC find a double payout, and how many steps long will the shortest one be? Lesson 1’s naive desk needed four steps, a Check and a Send per worker. This one has an extra label per worker.

In Python, `check` is a new label and the old `claim` loses its if. Continuing the snippets above:

```python
def check(status, transfers):
    if status == "approved":
        return status, transfers, "claim"
    return status, transfers, "Done"

def write_claim(status, transfers):
    return "claimed", transfers, "send"

HONEST = {"check": check, "claim": write_claim,
          "send": send, "mark": mark}
for state in explore(HONEST):
    print(state)
```

```text
('approved', 0, ('check', 'check'))
('approved', 0, ('claim', 'check'))
('approved', 0, ('claim', 'claim'))
('claimed', 0, ('send', 'claim'))
('claimed', 1, ('mark', 'claim'))
('claimed', 1, ('mark', 'send'))
('claimed', 2, ('mark', 'mark'))
```

Two transfers, in six steps. Read the second column of program counters: A checks, B checks, and now both are waiting at `claim` with “approved” in their heads. A writes claimed and sends. B writes claimed too, over a row that already says claimed, and sends. The data layer’s save didn’t complain, because nothing told it to.

Here is TLC on the translated honest spec, trimmed: each position note is cut short, and each state’s `pc` is pulled up beside it, written as the label each worker runs next. On a narrow screen, scroll the block sideways to see worker B.

```text
Error: Invariant NoDoublePayout is violated.
State 1: <Initial predicate>      A: check   B: check
State 2: <check line 29, ...>     A: claim   B: check
State 3: <check line 29, ...>     A: claim   B: claim
State 4: <claim line 35, ...>     A: send    B: claim
State 5: <send line 40, ...>      A: mark    B: claim
State 6: <claim line 35, ...>     A: mark    B: send
State 7: <send line 40, ...>      A: mark    B: mark
```

Line by line. The first line names the broken invariant. Each “State” line is one state of the counterexample, and the word in angle brackets is the action that produced it. State 1 has no action before it, so TLC writes `<Initial predicate>`: a state allowed by Init. Look at the other words: check, claim, send. **TLC names each step after the label that took it**, because the translator named each action after its label. You never wrote an action called check, and TLC still reports it, pointing at the line of the generated TLA+ where it lives. Then the program counters. In state 7 the transfers reach 2. Below the trace, cut here, TLC also prints the bookkeeping of lesson 1’s breadth-first search: how many states it generated, how many of them were distinct, and how many were still waiting on its queue when it met the bad one and stopped.

Six steps, the same shape the Python found, state for state. With `-continue`, the flag from lesson 1 that tells TLC to keep exploring after an error, it visits all 34 reachable states. With three workers it still finds the same six steps: as lesson 1 showed, extra workers make more states, not shorter bugs.

So the same five lines of PlusCal, give or take one label, describe two different desks: one where looking and claiming are a single step, and one where they are two. TLC checked the first and said, truthfully, that it was safe. The code was the second.

## Where do the labels go?

Before the rule, play with it. In the lab below you get Noor’s program with a cut line you can switch on or off in each of three gaps: between check and claim, between claim and send, and between send and mark. Every switch is a label. Each combination is a different spec, so a different desk.

Two questions to answer with the lab. Which placements does TLC call safe? And are any of them refused outright?

[[lab]]

## The rule: one label per real interaction

Here is what the lab shows, with two workers. In the first column, “check | claim” means a cut line between check and claim. Every number comes from TLC:

| labels (cut lines) | steps per worker | translator | TLC |
|---|---|---|---|
| none | 1 | refuses | |
| send \| mark only | 2 | translates | no error, 8 states |
| claim \| send only | 2 | translates | no error, 8 states |
| claim \| send and send \| mark (Noor) | 3 | translates | no error, 12 states |
| check \| claim only | 2 | refuses | |
| check \| claim and send \| mark | 3 | translates | paid twice in 4 steps |
| check \| claim and claim \| send | 3 | translates | paid twice in 6 steps |
| all three | 4 | translates | paid twice in 6 steps |

Two patterns jump out. First: every placement that keeps check and claim in one label passes, and every placement that cuts between them fails. Safety lives or dies on that one cut line. Second: two placements don’t translate at all. Both try to set the status to claimed and then, later in the same label, to paid. The translator stops with “Missing label”.

Why? Because a label is one step, and one step is one TLA+ action, and in an action `status'` is the status *after* the step. It has one value. “Claimed, and then paid, within one step” would be a state that no one, not even the other worker, could ever observe. PlusCal refuses to let you write a step whose middle you seem to care about. The fix is a label between the two assignments, which is exactly what the error message asks for. (The translator has a few rules of this kind. A `while` loop, for instance, must start at a label.)

Now the part that no tool will do for you. The table tells you which placements are safe. It cannot tell you which placement is *true*. Only the code knows that.

So here is the rule, and it is the heart of this lesson:

> **One label per real interaction with shared state.**

A **real interaction** is one call that reads or changes something another process can see: a database query, a request to the bank, a message on a queue. Each one is a separate moment in the real world, and other workers can act between any two of them, so each one gets its own label. Work that only touches the worker’s own memory, like an if on a value it already read or a sum, doesn’t need a label of its own; it rides along with the interaction before or after it.

[[diagram:interactions]]

A rough guide for TypeScript: nearly every `await` on a database, a bank or a queue is a label. Count them in Noor’s new code. `loans.find` is one, `loans.save` is another, then the transfer, then marking it paid: four labels, all three cut lines on. The bottom row of the table, paid twice in six steps.

Now count them in the code lesson 1 shipped:

```sql
UPDATE loans
SET status = 'claimed'
WHERE id = $1 AND status = 'approved'
```

That is one statement, one round trip, and the database runs the check and the write as a single step. One interaction, so one label for check and claim together, and Noor’s original spec is the *honest* model of that code. Same text, two different programs, one of them true.

So the spec wasn’t wrong. The code moved out from under it. That suggests a habit: write the call each label stands for right next to it. PlusCal allows ordinary TLA+ comments inside the algorithm:

```tla
  process (w \in Workers) {
    claim: \* UPDATE loans ... WHERE status = 'approved'
           if (status = "approved") {
             status := "claimed";
    send:    \* bank.transfer(account, amount, key)
             transfers := transfers + 1;
    mark:    \* UPDATE loans SET status = 'paid'
             status := "paid"
           }
  }
```

Read it as before: three labels, each naming the one real call it stands for, and the claim label’s comment says the check and the write are the same SQL statement. **The worker claims with one conditional update, then calls the bank, then marks the loan paid: three real interactions, three labels.** Now a reviewer who sees the TypeScript change from one statement to `find` and `save` has a line in the spec that is visibly false.

The same idea in Python is a table from labels to calls, with a check that each label has exactly one:

```python
spec = {"claim": ["UPDATE ... WHERE status = 'approved'"],
        "send": ["bank.transfer"],
        "mark": ["UPDATE ... SET status = 'paid'"]}
noor = {"claim": ["loans.find", "loans.save"],
        "send": ["bank.transfer"],
        "mark": ["db.setStatus"]}
for name, labels in (("lesson 1", spec), ("Noor", noor)):
    bad = [l for l, calls in labels.items() if len(calls) != 1]
    print(name, "labels hiding a gap:", bad)
```

```text
lesson 1 labels hiding a gap: []
Noor labels hiding a gap: ['claim']
```

**Build it.** The lab’s cut lines are easy to mimic in Python, because removing a label means running two label functions inside one call. Write `merge(first, second, second_label)`, which returns a new label function: it runs `first`, and if `first` went on to `second_label`, it runs `second` on the result in the same call. Then build the placements from the table out of the labels in “Two calls, one label” (`check`, `write_claim`, `send`, `mark`) and check them with `explore`. Call them by their cut lines: `ONE` is Noor’s spec, check and claim merged; `P101`, with cut lines only between check and claim and between send and mark, merges `write_claim` and `send`; `P001`, with only the last cut line, merges check, claim and send.

```python
assert explore(ONE) == 12 and explore(ONE, "ABC") == 32
assert len(explore(P101)) - 1 == 4
assert explore(P001) == 8
```

Notice what Python lets you do that PlusCal doesn’t: merge claim all the way through mark. The functions compose without complaint. The translator’s “Missing label” is a rule about steps, not about code.

## The whole desk in PlusCal

A detour before the fix. A real worker needs a few more statements and a word about fairness, and each of them changes what one step is, so they belong in the same toolbox as labels. Noor’s bug comes back at “Fix the bug”. Her rewrite was meant to make the desk readable, so let’s finish the job. Here is lesson 2’s fixed desk, the one with Resume, the idempotency key and one crash per run, as a PlusCal worker. Loan is 4471, as in lesson 2, and `\notin`, typeset ∉, is “is not in”. Ignore the word `fair` for now; it gets its own section. Three new statements appear; read the code first and guess what each does.

```tla
  variables status = "approved", owner = "nobody",
            transfers = 0, keys = {}, crashed = FALSE;

  fair process (w \in Workers) {
    poll:
      either { await status = "approved";
               status := "claimed";
               owner := self }
      or     { await status = "claimed" /\ owner = self }
      or     { await status = "paid";
               goto Done };
    send:
      either { if (Loan \notin keys) {
                 transfers := transfers + 1 };
               keys := keys \union {Loan} }
      or     { await ~crashed;
               crashed := TRUE;
               goto poll };
    mark:
      either { status := "paid" }
      or     { await ~crashed;
               crashed := TRUE;
               goto poll }
  }
```

**await** is a guard. `await status = "approved"` means this step can only happen in a state where the status is approved; until then, the worker waits at its label. In the translation it becomes one more line of the “and”, with no prime, exactly like the first lines of lesson 1’s Check. An await anywhere inside a label holds back the *whole* step, even the assignments written above it, because the whole label is one formula.

**either … or** is a choice. The step takes exactly one of the branches, any one whose awaits are true, and the model checker tries every one of them. In the translation it becomes an “or”. At `poll` the three branches are lesson 2’s three ways to find work: claim an approved loan, resume a loan claimed in your own name, or give up on a loan that is paid. At `send` and `mark`, the second branch is the crash: instead of doing its work, the worker forgets everything and jumps back to `poll`.

**goto** jumps to a label. `goto Done` finishes the worker; `goto poll` sends it back to the top. A goto ends the step, so whatever comes after it belongs to a later one. A branch without a goto runs on to the next label, so claiming and resuming both lead to `send`.

Read the whole worker aloud: **at poll, in one step, a worker claims an approved loan, or resumes its own claim, or finishes if the loan is paid; at send, it either asks the bank, which pays only if it has not seen the key, or crashes once; at mark, it either marks the loan paid or crashes once.** Three labels: one per real interaction, poll with the database, send with the bank, mark with the database.

Here is poll in Python. Each branch whose await holds is one possible step:

```python
def poll(status, owner, me):
    branches = []
    if status == "approved":
        branches.append(("claim it", "send"))
    if status == "claimed" and owner == me:
        branches.append(("resume it", "send"))
    if status == "paid":
        branches.append(("finish", "Done"))
    return branches

print(poll("approved", "nobody", "A"))
print(poll("claimed", "A", "A"))
print(poll("claimed", "A", "B"))
```

```text
[('claim it', 'send')]
[('resume it', 'send')]
[]
```

The empty list is the await at work: B, looking at a loan claimed by A, has no step it can take at poll. It waits.

[[diagram:poll]]

Predict before reading on. Lesson 2’s hand-written version of this desk had 23 reachable states with two workers and 46 with three. The PlusCal version names its program counters differently, poll, send, mark and Done, and models the crash as a branch instead of a separate action. Same counts or different?

TLC on the translation: no error, 23 distinct states, and with three workers, 46. Exactly lesson 2’s numbers. Different names, same situations. That is a good sign that the translation is what you meant, and a cheap test worth running whenever you rewrite a spec: if the counts move, find out why before you trust either version.

### Picking a loan with with

There is one more statement you will want, for the moment there is more than one loan. Here is a worker on a desk with two, 4471 and 4472, that takes whichever approved loan it likes:

```tla
    claim:
      with (l \in {x \in Loans : status[x] = "approved"}) {
        status[l] := "claimed";
        mine := l };
```

**with** picks one element of a set and names it for the rest of the block. On this desk `status` holds one entry per loan, so `status[x]` is loan x’s status. The set here is written with set-builder braces: the loans x such that x’s status is approved. `status[l] := "claimed"` changes loan l’s entry and leaves the other loan’s alone, which the translator writes with lesson 1’s EXCEPT. Like either, with is a choice, and the model checker tries every element. In the translation it becomes “there exists an l in that set such that …”, the ∃ from lesson 1’s Next. `mine` is a **process variable**: declared under the process with `variable mine = 0;`, it is private to each worker, like a local variable in a function, and the translator turns it into a function from processes to values, so every worker has its own. **In one step, the worker chooses any approved loan, claims it, and remembers which one it took.**

```python
status = {4471: "claimed", 4472: "approved"}
choices = [l for l in status if status[l] == "approved"]
print(choices)
status[4472] = "paid"
print([l for l in status if status[l] == "approved"])
```

```text
[4472]
[]
```

When the set is empty, there is nothing to pick, and the step can’t happen at all, like an await that is false. A desk whose workers loop back with `goto claim` after each loan ends with every worker waiting at an empty choice. No worker is at Done, so Terminating can’t help, and TLC calls that a deadlock unless you run it with `-deadlock`: without it, this two-loan desk stops with “Deadlock reached”; with it, no error in 43 states, 91 with three workers.

The claim label does the choosing and the claiming in one step, which is honest only if the code does both in one statement. Splitting them is the same mistake as Noor’s, with a set instead of one loan.

## Fairness, in one word

Look at the first word of the desk’s process: `fair`. Lesson 2 taught you that a spec without fairness allows the desk to stop at any moment, and that weak fairness is the promise that an action which stays enabled eventually happens. In PlusCal you write that promise as one word in front of the process.

Here is what the translator writes for `fair process`:

```tla
Spec == /\ Init /\ [][Next]_vars
        /\ \A self \in Workers : WF_vars(w(self))
```

Lesson 2’s Spec, with lesson 2’s fairness line. WF_vars is weak fairness, and w(self) is the “or” of all the worker’s labels. **For every worker, if that worker can keep taking some step, it eventually takes one.**

Drop the word, write just `process`, and the fairness line disappears. TLC on that version, with EventuallyPaid as a property, prints a lasso. In this run worker B claims, crashes at send, resumes its own claim, sends with the key, and then:

```text
State 5: <send line 61, ...>   pc = [A |-> "poll", B |-> "mark"]
State 6: Stuttering
```

`[A |-> "poll", B |-> "mark"]` is a function written out: A maps to poll, B maps to mark. This is lesson 2’s desk that just stops. B is at mark, mark is enabled, and nothing forces B to take it. Which worker TLC picks for the lasso can change from one run to the next; the shape doesn’t.

```python
loop = [("B at mark", "stuttering")]
enabled = all(at == "B at mark" for at, _ in loop)
taken = any(step == "mark(B)" for _, step in loop)
print("mark enabled in every loop state:", enabled)
print("mark taken in the loop:", taken)
print("weak fairness forbids the loop:", enabled and not taken)
```

```text
mark enabled in every loop state: True
mark taken in the loop: False
weak fairness forbids the loop: True
```

The lasso is one state repeated, mark is enabled in all of it and never taken, which is exactly what weak fairness rules out. Put `fair` back and TLC passes all three properties on all 23 states: NoDoublePayout, EventuallyPaid, and the translator’s own Termination.

There is a subtle difference from lesson 2. There, fairness covered a worker’s work and never its crash. `fair process` covers the whole process, crash branch included. Here that is harmless, because a crash can happen once and nothing ever waits for one, and TLC agrees. When it isn’t harmless, PlusCal lets you adjust per label: a label written `name:-` is left out of its process’s fairness, and `name:+` gets strong fairness of its own. The crash would need a label to itself for that.

### When weak is not enough

Lesson 2 promised that the payout desk didn’t need strong fairness, and so far it hasn’t. Here is a desk that does.

The bank allows Linden one open connection at a time. Each transfer needs it for an instant, and so does the reconciliation job, which runs in a loop: take the line, fetch the statement, give the line back. In PlusCal that is a second kind of process, with a single name instead of a set:

```tla
  variables status = "approved", transfers = 0, line = "free";

  fair process (w \in Workers) {
    claim: await status = "approved";
           status := "claimed";
    send:  await line = "free";
           transfers := transfers + 1;
    mark:  status := "paid"
  }

  fair process (r = "recon") {
    take: while (TRUE) {
            await line = "free";
            line := "busy";
    give:   line := "free"
          }
  }
```

`process (r = "recon")` is a single process named recon. `while (TRUE)` loops forever, and it starts at a label, as the translator requires. Read it aloud: **each worker claims the loan, waits for a free line to send, and marks the loan paid; meanwhile the reconciliation job takes the line and gives it back, forever.**

Predict: with every process fair, does the bakery always get paid?

TLC says no. Here is its lasso, trimmed:

```text
Error: Temporal properties were violated.
State 2: <claim ...>   pc A = "send"   line = "free"
State 3: <take ...>    recon = "give"  line = "busy"
State 4: <give ...>    recon = "take"  line = "free"
Back to state 3: <take ...>
```

“pc A” is worker A’s label and “recon” is the job’s. A has claimed and is waiting to send. The job takes the line, gives it back, takes it again, and “Back to state 3” closes the loop: forever. Half the states of that loop have a free line, so A’s send is enabled half the time. And A never sends.

Lesson 2 drew this picture: an action that flickers. Weak fairness only promises something about an action that is enabled from some point on *forever*, and A’s send keeps switching off whenever the job holds the line. So weak fairness makes no promise, and the scheduler may hand the free line to the job every single time.

```python
loop = ["free", "busy"]
enabled = [line == "free" for line in loop]
print("send enabled in the loop:", enabled)
print("weak fairness applies:", all(enabled))
print("strong fairness applies:", any(enabled))
```

```text
send enabled in the loop: [True, False]
weak fairness applies: False
strong fairness applies: True
```

**Strong fairness**, lesson 2’s bigger promise, is about actions enabled again and again, even with gaps. In PlusCal it is a plus sign: `fair+ process (w \in Workers)`. The translator then writes SF_vars, strong fairness, where it wrote WF_vars before:

```tla
        /\ \A self \in Workers : SF_vars(w(self))
```

**For every worker, if that worker can take a step again and again, even with gaps, it eventually takes one.** TLC on that version: no error, all 14 states, the same 14 the weak version explored before it printed its lasso. Strong fairness doesn’t change which states exist. It changes which infinite behaviors count.

[[diagram:flicker]]

And now lesson 2’s warning, louder. A fairness keyword is a promise about the world, and `fair+` is a bigger promise. It says that whatever hands out the line will not skip a waiting worker forever. A connection pool that queues waiters and serves them in order keeps that promise. A pool where every free moment goes to whoever asks fastest doesn’t, and with it, the honest spec is the one that fails. Typing a plus sign doesn’t make your pool fair.

## Fix the bug

In the lab below you get both halves of Noor’s change: the TypeScript on the left and the PlusCal on the right. The code panel has two versions of the claim: the data layer’s `find` and `save`, or the conditional update. The spec panel has the three cut lines from the first lab. Run the checker with two workers or three.

The desk counts as fixed when the spec is honest, meaning one label for every real interaction in the code you chose, and the checker passes with two workers and again with three. A passing spec that doesn’t match the code is not a fix; it is how this lesson started.

[[lab-act2]]

## What people get wrong

**“More labels is always safer.”** Cutting the conditional update into a check label and a claim label gives you a counterexample, paid twice in six steps, for a race the code doesn’t have. A spec with too many labels is as false as one with too few; it just fails loudly instead of quietly. Aim for honest, not for small.

**“The checker passed, so the code is safe.”** The checker checked the spec. Whether the spec’s labels match the code’s calls is a claim no tool made for you; Noor’s spec passed because it described a desk she no longer ran. Lesson 7 asks how to tie the two together more tightly.

**“PlusCal is a different language with different meanings.”** It is a way to write TLA+. Every PlusCal program becomes an ordinary Init, a set of actions and a Spec, which you can read, and TLC checks only that. When PlusCal confuses you, read the translation.

## Recap and the next bug

**PlusCal** lets you write a worker as a program: an **algorithm** with **variables**, one **process** per worker, assignments, ifs, **await** for guards, **either** and **with** for choices, and **goto** for jumps. The **translator** turns it into TLA+: one action per **label**, a `pc` variable whose values are the labels, a Terminating step for the end, and a free **Termination** property. **Labels set atomicity**: everything between two labels is one step. `fair process` adds weak fairness for each process, and `fair+ process` adds strong fairness, a bigger promise you must make true. And the rule that would have saved Noor’s week: **one label per real interaction with shared state.**

Finance’s refused requests went back to zero the day the claim went back to one statement. Noor wrote a comment next to every label, and the next change to the data layer came with a change to the spec.

Then finance came back with a different request. When a loan is paid, the €50,000 must leave Linden’s funding account and appear on the loan ledger. Two ledgers, in two different systems. Noor writes it the honest way: a `debit` label that takes €50,000 from the funding account, then a `credit` label that adds it to the loan ledger, and an invariant that says the two together always hold €50,000. TLC breaks it in one step. Between debit and credit, the money exists nowhere.

Merging the two labels would make TLC pass. You know now what that would be. And the order doesn’t save you either: credit first, and for a moment the money exists twice. Next lesson: moving money between two ledgers so that neither ever shows it twice or not at all.

## Concept check

Write your answers down before you move on.

1. A teammate writes the end of the worker as one label, `send: transfers := transfers + 1; status := "paid"`, for code that calls `bank.transfer` and then `db.setStatus`. TLC passes with 8 states. Is the spec honest? Name one thing that could go wrong in production that this spec can never show.
2. The translator refuses `claim: status := "claimed"; transfers := transfers + 1; status := "paid"` with “Missing label”. Explain why in terms of what one step is. Where would you put labels so it translates, and does the right answer depend on the code?
3. In the connection-line desk, the line is free in half the states of the loop TLC printed. Why doesn’t weak fairness make the waiting worker send? What would have to be true of the real connection pool before you write `fair+`?
