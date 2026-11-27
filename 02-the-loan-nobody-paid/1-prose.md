# The Loan Nobody Paid

## A loan stuck at “claimed”

The bakery sent back the extra €50,000. Finance reversed the payout, and loan 4471 went back into the queue as approved, to be paid properly this time by the desk you fixed in lesson 1. Workers now claim a loan with one atomic conditional update, and the checker found no double payout in any reachable state.

Thursday, at 14:02, worker A claimed loan 4471. A few seconds later, a routine deploy restarted the machine worker A runs on.

On Monday the bakery called again. Not about too much money this time. About none.

You open the loans table. Loan 4471 says “claimed”, and it has said so since Thursday. Worker A’s log ends with “claimed loan 4471”, and then the deploy. When worker A came back up, it started fresh, the way every process does after a restart: it asked the table for approved loans and got on with them. The claim lived in the table, but the memory of *why* lived in a process that no longer exists. Worker B saw “claimed” and politely left it alone, which is exactly what you taught it to do.

[[diagram:stranded]]

Here is the part that should bother you. Lesson 1 ended on this exact scene. It sketched one more action, Crash, for a worker restarted between claiming and sending, and told you the checker would still pass. We never wrote Crash down. This lesson does, and the checker really does pass: no state breaks NoDoublePayout, because the bakery has received at most one transfer in every reachable state.

It has received zero. Zero is at most one.

So the checker is right, and the desk is broken. This lesson lives in the gap between those two sentences. By the end you will be able to say “and the money eventually arrives” in TLA+, watch the checker reject a desk that can stall, break two tempting fixes with it, and build one that survives the deploy.

## A behavior that never does anything wrong

Let’s replay Thursday as a behavior, the way we did in lesson 1. Writing Crash down costs the desk one new variable, crashed, which records whether the deploy has happened. We allow one crash per run: one deploy, one restart. A worker that could crash again after every restart, forever, could never promise anything, and that isn’t the question we are asking.

One small change from lesson 1 first. There, a worker that found the loan taken would Skip it and finish. A real worker keeps polling the table instead. So from now on a worker skips only a loan that is paid, and leaves a claimed loan alone for now.

Here is Thursday. Before you look at the last rows, ask yourself: after the crash, which step can happen next?

| | step | status | pc of A | pc of B | transfers | crashed |
|---|---|---|---|---|---|---|
| 0 | (start) | approved | idle | idle | 0 | no |
| 1 | Claim(A) | claimed | claimed | idle | 0 | no |
| 2 | Crash(A) | claimed | idle | idle | 0 | yes |
| 3 | (nothing) | claimed | idle | idle | 0 | yes |
| 4 | (nothing) | claimed | idle | idle | 0 | yes |
| … | (nothing, forever) | claimed | idle | idle | 0 | yes |

None. Claim needs an approved loan, and it is claimed. Skip needs a paid one. Send and Mark need a worker holding the loan, and neither worker remembers holding it. The desk has nothing left to do, so it does nothing, forever.

Now check every row against NoDoublePayout. Zero transfers, zero, zero, zero. Every state is fine. Can you point at one row and say “there, that’s the bug”?

Try row 2: claimed, both workers idle. Is that state bad? Imagine a desk where a restarted worker looks for loans it had claimed and carries on with them. That desk passes through exactly this row on its way to paying the bakery. The row isn’t the problem. The problem is that row 2 is followed by row 3, and row 4, and so on without end. The bug lives in the word “forever”, and no single state can contain that word.

## The desk that just stops

Here is a stranger case. Take the crash out. Go back to lesson 1’s fixed desk, with the new Skip: Claim, Send, Mark and Skip, two workers, nothing else. Surely every behavior of *that* desk pays the bakery?

Decide what you expect before you read on. Here is a behavior the spec allows:

| | step | status | pc of A | pc of B | transfers |
|---|---|---|---|---|---|
| 0 | (start) | approved | idle | idle | 0 |
| 1 | Claim(B) | claimed | idle | claimed | 0 |
| 2 | Send(B) | claimed | idle | sent | 1 |
| 3 | (nothing) | claimed | idle | sent | 1 |
| … | (nothing, forever) | claimed | idle | sent | 1 |

Worker B has sent the money and is one step from marking the loan paid. Mark is right there, allowed, waiting. And B never takes it.

Why is that allowed? Look back at the last line of lesson 1’s spec: every step is either a Next step or a step where nothing changes. Those do-nothing steps are **stuttering steps**: a stuttering step leaves every variable exactly as it was. Lesson 1 asked you to ignore them. Now they matter. In TLA+ every behavior goes on forever, and a desk that has stopped is a desk taking stuttering steps forever. Nothing in lesson 1’s spec says the stuttering has to end.

[[diagram:stuttering]]

TLA+ isn’t being sloppy here. It’s being literal. The spec said which steps *may* happen and never that any of them *must*. A machine that is allowed to stop is allowed to stop before paying, and a machine that stops never pays twice.

[[lab]]

## Two kinds of promises

You have now felt the difference between two kinds of property, so let’s name them.

A **safety property** says that nothing bad ever happens. NoDoublePayout is one: the bad thing is a second transfer. When a safety property fails, it fails at a moment, and the model checker can show you a finite behavior leading to that moment. In lesson 1 that was four steps. Every invariant is a safety property.

A **liveness property** says that something good eventually happens. “The bakery is eventually paid” is one. No finite behavior can break it, because whatever has happened so far, the payment might still come in the next step. Only a behavior that goes on forever without the good thing breaks it: Thursday, or the desk that just stops.

[[diagram:safety-liveness]]

A quick test for any requirement: if it is violated, can you point at the moment it went wrong? If yes, it’s safety. If the only honest answer is “it never happened, and it never will”, it’s liveness. You need both, because each is easy to satisfy alone. A desk that does nothing is perfectly safe. A desk that pays every loan as often as it likes is perfectly live.

### Always, eventually, leads to

To write a liveness property, TLA+ has words about whole behaviors, not single states. You have met one already.

**Always**: “always P” is true of a behavior when P is true in every state of it, from now on. Lesson 1’s spec used it, written as a box.

**Eventually**: “eventually P” is true of a behavior when P is true in some state of it, now or later. It is written as a diamond.

**Leads to**: “P leads to Q” is true of a behavior when, every time P is true, Q is true then or at some later state. It means “always, if P then eventually Q”, so it is built from the other two. It is written as a squiggly arrow.

Here are those, plus two more symbols coming up later in this lesson, with what you type, how you say it, and the closest Python. The Python column cheats a little: it treats a behavior as a list of states, and a real behavior never ends. Read those cells as a way to think, not as code you could run.

| typeset | you type | say it | in Python |
|---|---|---|---|
| □ | `[]` | “always” | `all` over the rest of the list |
| ◇ | `<>` | “eventually” | `any` over the rest of the list |
| ↝ | `~>` | “leads to” | (no equivalent) |
| ∀ x ∈ S : | `\A x \in S :` | “for every x in S” | `all(... for x in S)` |
| WF_vars(A) | `WF_vars(A)` | “weak fairness of A” | (no equivalent) |

Here is the bakery’s promise:

```tla
EventuallyPaid == <>(status = "paid")
```

The diamond is “eventually”, and the inside is a plain statement about one state. **EventuallyPaid is true of a behavior when, at some state in it, the loan’s status is paid.** Try it on Thursday: approved, claimed, then claimed forever. No state says paid, so Thursday breaks EventuallyPaid. The desk that just stops breaks it too.

On a real desk, loans keep arriving, and you want a promise about every one of them. That is what leads to is for:

```tla
ClaimLeadsToPaid == (status = "claimed") ~> (status = "paid")
```

On the left, a statement about one state: the loan is claimed. On the right, another: it is paid. The squiggly arrow between them is “leads to”. **Whenever the loan is claimed, it is paid then or at some later state.** That is Thursday’s bug in one line: a claim that leads nowhere. For our single loan the two properties fail and pass together, and every TLC run below checks both.

### The shape of a liveness counterexample

When a safety property fails, the counterexample is a path that ends in a bad state. When a liveness property fails, the counterexample has to show something infinite, and a program can only print something finite. How?

It prints a path and a loop. The behavior goes from the start to some state and then repeats a cycle of states forever, never reaching the good thing. Drawn on paper it looks like a rope with a noose at the end, so it is called a **lasso**. On the payout desk the loop is the smallest possible one: a single state, repeated by stuttering, which TLC prints as one line, “Stuttering”. On a system with real cycles, TLC prints “Back to state” and the number where the loop starts.

[[diagram:lasso]]

Here is TLC on lesson 1’s fixed desk, with the new Skip and EventuallyPaid added, trimmed, with each state’s pc pulled up beside its step:

```text
Error: Temporal properties were violated.
State 1: <Initial predicate>
State 2: <Claim ...>   pc = [A |-> "idle", B |-> "claimed"]
State 3: <Send ...>    pc = [A |-> "idle", B |-> "sent"]
State 4: Stuttering
```

This is the first TLC output in the course, so let’s learn to read it. Each `State N:` line numbers one state of the counterexample, from 1. The label in angle brackets says how TLC got there. `<Initial predicate>` marks a start state: one that Init allows (TLC calls Init the initial predicate). Every later label names the action whose step produced the state. In full it reads `<Claim line ..., col ... of module ...>`, with numbers and the module’s name where the dots are: the action’s name, then where its definition sits in the file, by line and column, so you can jump straight to it. We trimmed that tail to `...`. And `Stuttering`, as you saw above, is the loop: from here on, nothing changes, forever.

That is the table from “The desk that just stops”, row for row. TLC explored all 8 reachable states, found this lasso, and printed it.

Eight is small enough to count by hand. There is the start. The loan can be claimed by A or by B: two states. Whoever claimed it can send: two more. Whoever sent can mark it paid while the other worker is still idle: two more. Then the idle worker skips the paid loan, and both paths land in the same final state, paid with both workers done: one. That makes 1 + 2 + 2 + 2 + 1 = 8.

### Fairness: the promise that the desk keeps moving

So the spec needs one more ingredient: a way to say that a worker who can work, does. First a word. An action is **enabled** in a state when some step of that action can be taken from that state. In row 2 of the stopped desk, Mark(B) is enabled: B has sent, and nothing prevents it from marking. Enabled is not the same as taken. A state can have several enabled steps, and the behavior takes at most one of them next; the rest stay enabled, not taken.

[[diagram:enabled]]

**Weak fairness** of an action is the promise that if the action stays enabled, it eventually happens. Not “right away”: it may wait as long as it likes, just not forever. If it is enabled from some point on, forever, then a step of it happens. In the stuttering loop above, Mark(B) is enabled in every state and never taken, so weak fairness forbids that behavior.

[[diagram:fairness]]

TLC knows weak fairness already, so you never type its definition. But the definition uses only the words you just learned, and reading it once is worth it:

```tla
WF_vars(A) == <>[](ENABLED <<A>>_vars) => []<><<A>>_vars
```

ENABLED in front of an action means “the action can happen in this state”. Then ⟨A⟩_vars, typed `<<A>>_vars`: A inside angle brackets with vars as a subscript. It means “an A step that changes vars”. Lesson 1’s [Next]_vars used square brackets, which also let vars stay the same; angle brackets rule that out, so a stuttering step never counts as doing A. A diamond then a box reads “eventually always”: from some point on, forever. A box then a diamond reads “always eventually”: again and again, without end. The double arrow is “implies”. **If, from some point on, A is enabled forever, then A steps keep happening.** You will rarely need the definition. You will often need that sentence.

The two pairs, eventually-always and always-eventually, are easy to mix up, so here they are as strips of states, each lit where P holds:

[[diagram:eventually-always]]

Eventually-always is a strip that may flicker for a while and then stays lit for good. Always-eventually is a strip that never stays dark for good: it may blink on and off forever, as long as it keeps coming back. The first is the stronger one: a strip that stays lit from some point on certainly keeps coming back.

Why “weak”? Picture an action that flickers: enabled, then disabled, then enabled again, forever. Is it ever enabled from some point on, forever? No, it keeps switching off. So weak fairness makes no promise about it, and the scheduler may skip it every single time. **Strong fairness** is the bigger promise: if an action is enabled again and again, even with gaps, it eventually happens.

[[diagram:weak-strong]]

The payout desk doesn’t need strong fairness. Every fix later in this lesson that rescues Thursday does it with weak fairness alone, as TLC will confirm.

Here is the part people miss. **Fairness is not a fix you write in code. It is an assumption about the world, and you must make it true.** Weak fairness for a worker says: its process keeps getting scheduled, its poll loop keeps running, and if the machine dies, something restarts it. If your platform doesn’t do that, the spec describes a system you don’t run. So we promise fairness for the work a worker does, and never for crashes. A crash is allowed to happen; nobody waits for one.

## The spec, piece by piece

Here is the desk from lesson 1 with the crash added and the promise written down. The variables are lesson 1’s three, plus crashed:

```tla
VARIABLES status, pc, transfers, crashed
vars == <<status, pc, transfers, crashed>>
```

Init also sets crashed to FALSE. TLA+ has exactly two boolean values, written TRUE and FALSE, the same two as Python’s True and False; crashed is always one of them. Claim, Send and Mark are lesson 1’s, with crashed listed as unchanged, and Skip now asks for a paid loan. The new action is the crash:

```tla
Crash(w) == /\ ~crashed
            /\ pc[w] \in {"claimed", "sent"}
            /\ pc' = [pc EXCEPT ![w] = "idle"]
            /\ crashed' = TRUE
            /\ UNCHANGED <<status, transfers>>
```

Line by line, with ¬ (typed ~) read as “not”: before the step, there has been no crash yet; worker w holds the loan, claimed or already sent; after the step, w is idle, as if it had just started; the deploy has happened; the status and the transfers stay as they were. **Crash(w) is a step in which a worker holding the loan forgets everything about it, while the table and the bank remember.** That asymmetry is the whole bug: the process forgets, the world doesn’t.

```tla
Work(w) == Claim(w) \/ Skip(w) \/ Send(w) \/ Mark(w)

Next == \E w \in Workers : Work(w) \/ Crash(w)
```

**Work(w) is any ordinary step of worker w, and a step of the desk is some worker’s work or some worker’s crash.** Splitting them lets us promise fairness for the first and not the second.

```tla
Fairness == \A w \in Workers : WF_vars(Work(w))

Spec == Init /\ [][Next]_vars /\ Fairness
```

The upside-down A is “for every”. **For every worker, if that worker can keep doing some work, it eventually does.** Spec is lesson 1’s two pieces with Fairness joined on by one more “and”: **a behavior is allowed when it starts in Init, every step is a Next step or a stuttering step, and no worker stays able to work forever without working.**

The configuration file gains a PROPERTY line, which asks TLC to check properties of whole behaviors:

```text
SPECIFICATION Spec
INVARIANT NoDoublePayout
PROPERTY EventuallyPaid ClaimLeadsToPaid
```

Three runs, with the same command as lesson 1:

1. Lesson 1’s fixed desk, no crash, no fairness: the lasso you saw above, out of 8 states.
2. The same desk with Fairness: no error. All 8 states, and every fair behavior pays.
3. With Crash and Fairness: the invariant holds in all 10 reachable states, and EventuallyPaid fails.

Here is the third counterexample, as TLC prints it:

| | step | status | pc of A | pc of B | transfers | crashed |
|---|---|---|---|---|---|---|
| 0 | (start) | approved | idle | idle | 0 | no |
| 1 | Claim(A) | claimed | claimed | idle | 0 | no |
| 2 | Send(A) | claimed | sent | idle | 1 | no |
| 3 | Crash(A) | claimed | idle | idle | 1 | yes |
| 4 | Stuttering | claimed | idle | idle | 1 | yes |

Wait, that isn’t quite Thursday. Worker A crashed *after* sending. The bakery has its money, and the books say “claimed” forever: Thursday has a quieter twin, and the checker found it first. TLC prints one counterexample, not all of them. Thursday itself, the crash before Send, is another lasso, and the next section finds both.

Side by side, the twins differ in one step: where the crash lands.

[[diagram:quiet-twin]]

Thursday crashes between Claim and Send, so the bank never hears a thing and the bakery calls on Monday. The twin crashes between Send and Mark, so the bakery is happy and nobody calls, while finance stares at a loan marked claimed with €50,000 gone out against it. One is loud and one is quiet, and they are the same bug: a claim nobody will ever finish.

Notice why fairness can’t save either one: after the crash, no worker has any work enabled. Weak fairness only pushes actions that are enabled. A desk with nothing it is allowed to do is, as far as fairness cares, finished.

## The model checker as code

How does a checker find a lasso? In lesson 1 it looked at one state at a time and asked whether it was bad. A lasso isn’t one state; it is a path into a reachable loop. So the question becomes: is there a reachable state from which the desk may loop forever without paying?

On the payout desk every step moves forward. Claims, sends and marks never undo themselves, and the one crash happens at most once. So the only loop a behavior can end in is stuttering in a single state, and the question shrinks: find a reachable state where the loan isn’t paid and the desk may stutter forever. Without fairness, it may stutter anywhere. With fairness, only where no worker has any work enabled.

First the crash desk in Python. It is lesson 1’s next_states with four changes: the state carries crashed, Check has become the atomic Claim, each step is tagged “work” or “crash” instead of named, and the last rule is new. To keep every rule on one line, move now builds the whole state after the step and takes keyword arguments for whatever else changes.

```python
WORKERS = "AB"

def next_steps(state):
    status, pc, transfers, crashed = state
    for i, w in enumerate(WORKERS):
        def move(to, s=status, t=transfers, c=crashed):
            return s, pc[:i] + (to,) + pc[i + 1:], t, c
        if pc[i] == "idle" and status == "approved":
            yield "work", move("claimed", s="claimed")
        if pc[i] == "idle" and status == "paid":
            yield "work", move("done")
        if pc[i] == "claimed":
            yield "work", move("sent", t=transfers + 1)
        if pc[i] == "sent":
            yield "work", move("done", s="paid")
        if pc[i] in ("claimed", "sent") and not crashed:
            yield "crash", move("idle", c=True)
```

Then the search: collect every reachable state, and keep the unpaid ones where the desk may stop.

```python
def reachable(init):
    seen, todo = {init}, [init]
    while todo:
        for _, after in next_steps(todo.pop()):
            if after not in seen:
                seen.add(after)
                todo.append(after)
    return seen

def may_stop(state, fair):
    kinds = {kind for kind, _ in next_steps(state)}
    return not (fair and "work" in kinds)

init = ("approved", ("idle", "idle"), 0, False)
states = reachable(init)
for fair in (False, True):
    stuck = [s for s in sorted(states)
             if s[0] != "paid" and may_stop(s, fair)]
    print(f"fair={fair}: {len(stuck)} of {len(states)} states")
print(*stuck, sep="\n")
```

```text
fair=False: 7 of 10 states
fair=True: 2 of 10 states
('claimed', ('idle', 'idle'), 0, True)
('claimed', ('idle', 'idle'), 1, True)
```

Ten reachable states, the same 10 TLC reports. Without fairness, all 7 unpaid states can end a lasso. Fairness removes the five where some worker could still move. It can’t remove the last two, because after the crash nobody can. The first, with no transfer, is Thursday. The second, with one, is the quiet twin TLC printed.

TLC handles loops of any size. It takes the graph of reachable states and cuts it into **strongly connected components**: groups in which every state can reach every other state of the group and get back. Say a light switch has two states, on and off, with a step each way. On and off form one component, because you can go round and round between them. Add a third state, broken, that you can enter but never leave: broken is a component of its own, with only its stuttering loop. A behavior that goes on forever must, from some point on, circle inside one component, because once it leaves a component it can never come back. So TLC asks of each component: is the good thing missing from every state in it, and does fairness allow a behavior to circle there forever? On our desk every component is one state and its stuttering loop, so the little search above gives the same answer. It also explains why, in every run in this lesson, TLC checks temporal properties only once it has the complete state space: it needs the graph before it can look for loops.

## Two fixes that make it worse

The loan is stranded because nobody will ever pick it up again. There are two obvious ways to hand it back to somebody. Both are used in real systems, and both are wrong on their own.

### Fix one: a lease

Put a time limit on every claim. If the worker hasn’t marked the loan paid within, say, five minutes, the claim expires and any worker may claim the loan again. A claim with a time limit is called a lease, and a dead worker’s lease frees itself.

The spec has no clock, as lesson 1 showed, so five minutes is just “at some point”. The expiry is a step that may happen whenever the loan is claimed:

```tla
Expire == /\ status = "claimed"
          /\ status' = "approved"
          /\ UNCHANGED <<pc, transfers, crashed>>
```

**Expire is a step in which a claimed loan goes back to approved, and nothing else changes.** It belongs to no worker; the lease runs out on the table’s clock. Look at what stays unchanged: the program counters. Whoever held the loan still holds it, as far as that worker knows. Expire joins Next and gets weak fairness too, because time does pass.

Predict before reading on: will both properties hold?

TLC stops at the first broken invariant, so a run that trips NoDoublePayout never gets as far as the liveness check. To ask the two questions separately, keep a second configuration file that drops the INVARIANT line and keeps only PROPERTY EventuallyPaid ClaimLeadsToPaid. With that file, TLC explores all 76 reachable states and both liveness properties hold: Thursday is rescued. But with the full configuration, NoDoublePayout fails after 27 states:

| | step | status | pc of A | pc of B | transfers |
|---|---|---|---|---|---|
| 0 | (start) | approved | idle | idle | 0 |
| 1 | Claim(A) | claimed | claimed | idle | 0 |
| 2 | Expire | approved | claimed | idle | 0 |
| 3 | Send(A) | approved | sent | idle | 1 |
| 4 | Claim(B) | claimed | sent | claimed | 1 |
| 5 | Send(B) | claimed | sent | sent | 2 |

[[diagram:lease-race]]

Worker A didn’t crash. It was slow: a garbage-collection pause, a slow network call, anything that held it past the lease. The lease expired under A, B took the loan, and A carried on, still believing the claim was its own. From the outside, a slow worker and a dead one look the same. **An expired lease lets someone else in. It does not stop the old holder.** The bakery gets €100,000 again.

### Fix two: resume your own claims

So never take a loan away from anyone. Record who claimed it, and make a restarted worker look for its own claims and finish them. Nobody else touches a claimed loan, so nobody else can pay it twice.

The spec gains a variable, owner, which Claim sets to the claiming worker, and one action:

```tla
Resume(w) == /\ pc[w] = "idle"
             /\ status = "claimed"
             /\ owner = w
             /\ pc' = [pc EXCEPT ![w] = "claimed"]
             /\ UNCHANGED <<status, owner, transfers, crashed>>
```

**Resume(w) is a step in which an idle worker finds a loan claimed in its own name and picks it up again, as if it had just claimed it.** Resume is part of Work(w), so fairness covers it: a restarted worker will get to it.

Predict again. Is this one safe?

Thursday is rescued again: with the liveness-only configuration, both liveness properties hold in all 29 reachable states. And with the full one, NoDoublePayout fails after 20:

| | step | status | pc of A | pc of B | transfers | crashed |
|---|---|---|---|---|---|---|
| 0 | (start) | approved | idle | idle | 0 | no |
| 1 | Claim(A) | claimed | claimed | idle | 0 | no |
| 2 | Send(A) | claimed | sent | idle | 1 | no |
| 3 | Crash(A) | claimed | idle | idle | 1 | yes |
| 4 | Resume(A) | claimed | claimed | idle | 1 | yes |
| 5 | Send(A) | claimed | sent | idle | 2 | yes |

[[diagram:resend]]

That is the quiet twin from the crash desk, woken up. Worker A sent the money, crashed before it could write “paid”, came back, saw its own claim, and did the one thing a claim tells it to do: send. The fact “I already sent this” lived in A’s memory, and the crash erased it.

Both failures come down to one sentence. **The worker is the wrong place to remember whether money moved, because the worker is exactly the thing that crashes.**

## The fix: let the bank remember

Who knows for certain whether the transfer for loan 4471 happened? Not the worker. Not the loans table, which is written only after the transfer returns. The bank does. So let the bank answer.

Most payment APIs accept an **idempotency key** with a request: a value that names the request, so that the receiver performs it at most once. When a second request arrives with a key the bank has already paid, the bank moves no money and answers as it did the first time. Use the loan’s id as the key, and “pay loan 4471” becomes a request you can repeat as often as crashes force you to.

In the code it is one extra argument, plus the restart path from fix two:

```ts
async function payOut(loan: Loan) {
  await bank.transfer(loan.account, loan.amount, {
    idempotencyKey: loan.id,
  });
  await db.setStatus(loan.id, "paid");
}

async function onStart(me: WorkerName) {
  for (const loan of await db.claimedBy(me)) await payOut(loan);
}
```

One requirement hides in onStart: the worker’s name must survive the restart. A name each new process invents for itself would never find the old claims, and Thursday would be back.

In the spec, the bank gets a variable: keys, the set of idempotency keys it has paid, empty at the start. Send becomes:

```tla
Send(w) == /\ pc[w] = "claimed"
           /\ transfers' = IF Loan \in keys THEN transfers
                                            ELSE transfers + 1
           /\ keys' = keys \union {Loan}
           /\ pc' = [pc EXCEPT ![w] = "sent"]
           /\ UNCHANGED <<status, owner, crashed>>
```

Loan is defined as 4471. One new piece of syntax first. `IF c THEN a ELSE b` is an expression: it picks one of two values, a when c is true and b when it is false, like Python’s `a if c else b`. Didn’t lesson 1 say there is no “if” in TLA+? It said a condition for a *step* is just one more line of the “and”, and that is still true: the first line here is such a condition. IF does a different job. It doesn’t decide whether the step happens; it picks a value inside a formula, here the new value of transfers. In Python:

```python
keys, transfers = {4471}, 1
print(transfers if 4471 in keys else transfers + 1)
```

```text
1
```

Line by line: worker w holds the loan; afterwards, if the bank already has key 4471, the transfers are unchanged, and otherwise there is one more; afterwards the bank has key 4471, whether or not it had it before (the union adds it to the set, and adding a key twice changes nothing); w has sent; nothing else changes. **A Send moves money only the first time the bank sees the loan’s key; every later Send for that loan is a request the bank answers without paying.**

NoDoublePayout keeps its formula, transfers at most one, and now it means exactly what the bakery cares about: the bakery received at most one transfer, however many requests the workers sent.

The desk is now lesson 1’s atomic Claim, plus Resume, plus the key, with Crash in and Fairness on. Before you look, ask which of the two counterexamples above could still happen.

```text
Model checking completed. No error has been found.
25 states generated, 23 distinct states found, ...
```

The second line is TLC’s bookkeeping. States generated counts every successor state TLC computed, repeats included: whenever two paths lead to the same state, it is generated twice. Distinct states counts the different ones, and that is the number that matters, the size of the state space. We trimmed the end of the line, which reads “0 states left on queue”: the states TLC has found but not yet explored. Zero means the search finished.

All 23 reachable states have at most one transfer, and every fair behavior pays the loan, Thursday’s included. With three workers: 46 states, no error. The resend from fix two still happens, step for step. It just costs nothing now, because the second Send lands on a key the bank already has.

[[diagram:idempotency-key]]

Notice who did what. Resume gave us liveness: a stranded claim always gets picked up. The key gave us safety: picking it up twice is harmless. You have seen each half fail alone.

**Build it.** Extend next_steps with an owner and a set of keys in the state, a step for Resume, and the key check in Send. Start from approved, owner “nobody”, both idle, zero transfers, no keys, no crash. With stuck as the list of unpaid states that may stop under fairness, and transfers at position 3 of your state:

```python
assert len(states) == 23 and not stuck
assert max(s[3] for s in states) == 1
```

## Fix the bug

In the lab below, the desk has Crash in it, and the deploy will happen. Your panel: fairness on or off, a lease, workers that resume their own claims, and the loan id as an idempotency key. Run the checker after each change. It shows two lamps, one for NoDoublePayout and one for EventuallyPaid, labelled “Loan marked paid?” as in the first lab, and draws whatever counterexample it finds: a path for the first, a lasso for the second.

The desk is fixed when both lamps are green with two workers, and stay green with three. Turning the crash off is not an answer: Thursday’s deploy happens whether you model it or not.

[[lab-act2]]

## What people get wrong

**“Eventually means soon.”** EventuallyPaid is satisfied if the bakery is paid next year. Eventually has no deadline, which is why it can be checked without a clock. If finance needs the money within an hour, that is a different property, and it needs time in the spec.

**“One eventually covers every loan.”** On a desk with many loans, “eventually some loan is paid” comes true the moment any loan is paid, the florist’s, say, and says nothing about the bakery’s. A promise about every loan needs leads to, or a for-every in front, so that each claim on its own must end in paid.

**“Fairness is free, so add plenty.”** Every fairness condition is a promise about your platform. Promise more than the platform delivers, say fairness for a worker your autoscaler might remove for good, and the checker will happily prove things about a system you don’t run.

## Recap and the next bug

A **safety property** says nothing bad ever happens; a violation is a finite behavior ending in a bad state. A **liveness property** says something good eventually happens; a violation goes on forever without it. **Eventually**, **always** and **leads to** let you say that about whole behaviors. **Stuttering steps** change nothing, and every spec allows them, so without fairness a desk may stop at any moment. **Weak fairness** promises that an action that stays **enabled** eventually happens. A liveness counterexample is a **lasso**: a path into a loop that repeats forever. And an **idempotency key** lets the bank, the one party that cannot forget, turn a repeated transfer into a harmless one.

The bakery waited because a claim outlived the memory of the worker that made it. You fixed it in two halves: workers resume their own claims, so every claim gets finished, and every transfer carries the loan’s id as its key, so finishing twice costs nothing.

Now read the bank’s documentation once more. Near the bottom, in small print: “Idempotency keys are kept for 24 hours.”

Friday, 17:00. Worker A sends the transfer for loan 4471 and crashes before marking the loan paid. Its machine doesn’t come back until Monday morning. Worker A starts, finds its claim, and sends again, with key 4471, to a bank that forgot the key on Saturday. Add one step to the spec in which the bank forgets its keys, and the checker finds the double payout again, in six steps.

The spec has no way to say “24 hours”, or “down for the weekend”. It needs something it has never had: time. And once time is in, a request can be slow enough to look lost, and a reply can vanish on its way back, so a worker can’t even tell whether the bank heard it. Next lesson, the network stops being polite.

## Concept check

Write your answers down before you move on.

1. Sort these into safety and liveness: (a) no loan is ever paid twice; (b) every approved loan is eventually paid; (c) every claimed loan is paid within one hour of being claimed. For each, say what a violation looks like.
2. The lasso search found two states where the crash desk can stop without paying, and in one of them transfers is 1. Write a property in TLA+ that says only “the bakery eventually receives a transfer”. Does the crash desk, without Resume or the key, satisfy it? Which state decides?
3. Keep the idempotency key, and swap Resume for the lease from fix one. Does the checker pass both properties? Whatever it says, give one reason you might still prefer Resume, and one reason you might prefer the lease.
