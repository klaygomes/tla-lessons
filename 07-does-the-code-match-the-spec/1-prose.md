# Does the Code Match the Spec?

## The loan the books paid

Finance runs a reconciliation every Friday. One column comes from Linden’s loans table, the other from the bank’s statement, and every row should match: a loan marked paid on one side, a €50,000 transfer on the other.

This Friday, one row doesn’t match. Loan 4471, the bakery on the harbour, says “paid” in the loans table since Tuesday at 10:14. The bank statement has no transfer for it. None. The bakery had already written in, puzzled, because Linden’s system sent them a cheerful email on Tuesday: “Your loan has been paid out!”

The desk has changed again. Approved loans no longer sit in a table waiting to be claimed; each one becomes a message on a queue. A worker receives the message, and the queue hides it from everyone else for five minutes. That is lesson 2’s lease, now provided by the queue: if the worker hasn’t deleted the message when the five minutes run out, the message becomes visible again and another worker can receive it. The bank still takes an idempotency key, the loan’s id, exactly as in lesson 2: a second request with key 4471 moves no money. Lesson 3’s deadlines keep every request inside the bank’s memory of its keys, so this lesson leaves the clock and the lost messages out and keeps the design small.

The team piloting the queue wrote the handler like this:

```ts
async function handle(msg: Message) {
  await db.setStatus(msg.loanId, "paid");
  await queue.delete(msg);
  await bank.transfer(msg.account, msg.amount, {
    idempotencyKey: msg.loanId,
  });
}
```

Their reasoning was careful, and you can hear it in the order of the lines. Mark the loan paid and delete the message first, so that nobody can ever receive it again; then send the money. A second worker can’t pay what it can’t receive.

On Tuesday at 10:14, worker B received the message for loan 4471, marked the loan paid, deleted the message, and was restarted by a deploy before it reached the bank.

[[diagram:pilot]]

Here is the part that stings. The team had checked the pilot design with TLC before shipping it. They wrote it as a spec with a queue, leases, keys and a crash, and they checked the two properties you learned to care about: NoDoublePayout, and lesson 2’s promise that the loan is eventually paid. The configuration file said:

```text
SPECIFICATION Spec
INVARIANT NoDoublePayout
PROPERTY TablePaid
```

with `TablePaid == <>(status = "paid")`, which is lesson 2’s EventuallyPaid under a name that says where it looks: the diamond is “eventually”, so **TablePaid is true of a behavior when, at some state in it, the loans table says paid.** TLC explored 60 distinct states and said:

```text
Model checking completed. No error has been found.
```

Both green. And the bakery has no money.

Before you read on, decide: was TLC wrong, or did the team ask it the wrong question?

## Two green lights, one empty account

TLC was right. Look at what each property actually says.

NoDoublePayout says the bank made at most one transfer. Zero is at most one; lesson 2 taught you that the hard way. TablePaid says the loan’s status eventually reads “paid”. It does: worker B wrote it, in the first line of the handler. Both properties are about something real, and both hold in every behavior of the pilot. Neither of them is about the thing the bakery cares about, which is money arriving.

You could patch this. Add a third property, “eventually the bank has made a transfer”, and TLC would catch the pilot at once. That is a fine thing to do, and it is also exactly how the pilot got shipped: the team wrote down the properties they thought of. The question that should worry you is the next one. What is the fourth property, the one nobody has thought of yet?

The design review is chaired by Maren, who has a habit of reading design documents from the end. She read the pilot’s post-mortem, then the new design for the full rollout (a queue, claims, leases, keys, crashes, nine pages of it), and then she walked to the whiteboard and wrote one line.

> **PayOnce**: each approved loan goes to paid exactly once, in one step.

“That’s the whole desk,” she said. “Everything else in those nine pages is how. Show me that your design *is* this, and I don’t need a list of properties. Anything true of this line will be true of your design.”

This lesson is about how you show that. The idea is called **refinement**, and by the end you will have TLC checking, in one PROPERTY line, that a design which can take nine steps, two workers and a crash to pay one loan behaves exactly like a spec that does it in one step, and you will have used that check to fix the pilot.

## The whole desk in one line

Let’s write Maren’s line as a TLA+ spec. It is the smallest spec in this course. The desk has one loan, 4471, and the abstract version of it has only two variables: its status and the number of transfers.

How many states can it have? Think about it before you look: an approved loan with no transfers, and then what?

```tla
---- MODULE PayOnce ----
EXTENDS Naturals

VARIABLES status, transfers
avars == <<status, transfers>>

Init == /\ status = "approved"
        /\ transfers = 0

Pay == /\ status = "approved"
       /\ status' = "paid"
       /\ transfers' = transfers + 1

Spec == Init /\ [][Pay]_avars /\ WF_avars(Pay)
====
```

Every symbol here is one you know. avars is the tuple of both variables; the a is for “abstract”. Init is one state: approved, zero transfers. Pay is an action, so it reads line by line about a pair of states: before the step the loan is approved; after it, the loan is paid; after it, there is one more transfer than before. From the start, that is one step from approved with 0 transfers to paid with 1. **Pay is a single step in which the loan goes from approved to paid and the money moves, both at once.** That is Maren’s “in one step”: in PayOnce, there is no moment when the money has moved and the books haven’t caught up, or the other way round.

Spec is built exactly like lesson 2’s. Init holds in the first state; always, every step is a Pay step or a step that leaves avars unchanged (a stuttering step); and weak fairness of Pay, the promise from lesson 2 that an action that stays enabled eventually happens. **A behavior of PayOnce starts approved with no transfers, takes at most one Pay step, and, because Pay stays enabled until it is taken, does take it.**

Here it is in Python: one action, and lesson 1’s search over every reachable state.

```python
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
```

```text
[('approved', 0), ('paid', 1)]
```

Two states. TLC agrees: 2 distinct states, and EventuallyPaid holds. So the whole desk, as Maren sees it, is a loan that sits approved for a while and then, in one step, is paid with one transfer.

That is almost too simple to be useful. Almost. Every property you would want of the payout desk is true of these two states, and checkable by eye: no double payout, no paid loan without money, no money without a paid loan, and the money eventually arrives. If the real design behaves like PayOnce, it inherits all of them at once, including the ones nobody has thought of.

## One loan, nine steps

Now the real design. Here is the new handler from the design document, with the order the post-mortem recommended: send first, mark after.

```ts
async function handle(msg: Message) {
  await bank.transfer(msg.account, msg.amount, {
    idempotencyKey: msg.loanId,
  });
  await db.setStatus(msg.loanId, "paid");
  await queue.delete(msg);
}
```

Written as steps, in the style of lesson 1, one worker’s life with the loan has five moments:

1. **Receive**: take the message from the queue, which hides it for the length of the lease. The worker now holds the loan; its pc is “claimed”.
2. **Send**: put the transfer request on the wire; pc “sent”.
3. **Confirm**: the bank acts on the request and the worker hears back; pc “confirmed”. If the bank has already seen key 4471, it moves no money.
4. **Mark**: write “paid” on the loan and delete the message, which this spec treats as one step; pc “done”.
5. **Crash**: as in lesson 2, a worker holding the loan may be restarted, once per run, and forgets everything.

And one step that belongs to nobody: **Expire**, the lease running out, which makes a hidden message visible again.

Let’s run a happy behavior and, beside the real state, write what PayOnce would say about it. PayOnce only knows “approved” or “paid”, and a number of transfers. So in the last column, write down the bank’s side: approved while the bank has made no transfer, paid once it has.

| | step | queue | pc of A | pc of B | transfers | PayOnce sees |
|---|---|---|---|---|---|---|
| 0 | (start) | visible | idle | idle | 0 | approved, 0 |
| 1 | Receive(A) | hidden | claimed | idle | 0 | approved, 0 |
| 2 | Send(A) | hidden | sent | idle | 0 | approved, 0 |
| 3 | Confirm(A) | hidden | confirmed | idle | 1 | paid, 1 |
| 4 | Mark(A) | deleted | done | idle | 1 | paid, 1 |

Four steps of the design. In the last column, only one of them changes anything: Confirm(A), where approved with 0 becomes paid with 1. That is exactly a Pay step. The other three leave PayOnce’s column exactly as it was, so to PayOnce they are stuttering steps.

Now an unlucky behavior. Worker A receives the message and then stalls, a garbage-collection pause, long enough for the lease to run out. Before you read the table, predict: of the nine steps below, how many does PayOnce see as a Pay step, and is any of them something PayOnce forbids?

| | step | queue | pc of A | pc of B | transfers | PayOnce sees |
|---|---|---|---|---|---|---|
| 0 | (start) | visible | idle | idle | 0 | approved, 0 |
| 1 | Receive(A) | hidden | claimed | idle | 0 | approved, 0 |
| 2 | Expire | visible | claimed | idle | 0 | approved, 0 |
| 3 | Receive(B) | hidden | claimed | claimed | 0 | approved, 0 |
| 4 | Send(A) | hidden | sent | claimed | 0 | approved, 0 |
| 5 | Confirm(A) | hidden | confirmed | claimed | 1 | paid, 1 |
| 6 | Send(B) | hidden | confirmed | sent | 1 | paid, 1 |
| 7 | Confirm(B) | hidden | confirmed | confirmed | 1 | paid, 1 |
| 8 | Mark(A) | deleted | done | confirmed | 1 | paid, 1 |
| 9 | Mark(B) | deleted | done | done | 1 | paid, 1 |

One. Two workers held the loan at the same time, two transfer requests went to the bank, two workers wrote “paid”, and PayOnce saw a single Pay at step 5 and eight stuttering steps. Step 7 is the interesting one: worker B’s request reached the bank with key 4471, which the bank had already paid, so the transfers stayed at 1. The idempotency key is what keeps step 7 a stutter.

Here is the last column as code. A function turns a real state into what PayOnce sees, and a second one asks whether a pair of PayOnce states is a Pay step, a stuttering step, or neither.

```python
def paid_at_bank(transfers):
    return ("paid" if transfers > 0 else "approved", transfers)

def abstract_step(before, after):
    if before == after:
        return "stutter"
    if before[0] == "approved" and after == ("paid",
                                             before[1] + 1):
        return "Pay"
    return "not allowed"

unlucky = [0, 0, 0, 0, 0, 1, 1, 1, 1, 1]
kinds = [abstract_step(paid_at_bank(a), paid_at_bank(b))
         for a, b in zip(unlucky, unlucky[1:])]
for i, kind in enumerate(kinds, 1):
    if kind != "stutter":
        print("step", i, kind)
print(kinds.count("stutter"), "stutters")
```

```text
step 5 Pay
8 stutters
```

The list unlucky is the transfers column of the unlucky table, rows 0 to 9. Notice what the function looks at: only the transfers. The queue, the program counters, the keys and the table’s own status column are all invisible to PayOnce. They are the “how”.

[[diagram:two-levels]]

[[lab]]

## The idea, named

What we just did by hand has a name. The real design is a spec too: call it QueueDesk, with its own six variables and six kinds of step. PayOnce is the **abstract spec**: a smaller spec that says *what* the system does and leaves out *how*. A spec like QueueDesk, that does say how, is sometimes called the low-level spec; we will just call it the design.

The function that turned each state of the design into a state of PayOnce is the **refinement mapping**. It says, for each variable of the abstract spec, what that variable *means* in terms of the design’s variables. Here, PayOnce’s status means “has the bank made a transfer?”, and PayOnce’s transfers means the bank’s transfers.

And the design **refines** the abstract spec when every behavior of the design, translated state by state through the mapping, is a behavior the abstract spec allows. That is three things at once: the first state translates to a state Init allows; every step translates to a Pay step or a stuttering step; and the translated behavior keeps every promise of the abstract spec’s fairness, so the Pay step does happen.


Here is the strange bit, and it is the heart of TLA+. An abstract spec isn’t a different kind of thing from a property. Lesson 2’s EventuallyPaid was a formula that is true or false of a behavior. So is PayOnce’s Spec: it is true of a behavior exactly when that behavior is one PayOnce allows. So “the design refines PayOnce” is the claim that a formula holds of every behavior of the design, which is exactly the kind of claim TLC already checks with a PROPERTY line. Written as one formula:

```tla
THEOREM Spec => Abstract!Spec
```

THEOREM introduces a statement we claim is true; TLC doesn’t check it, so it is there for the human reader, and the configuration file is where we ask TLC. Spec is the design’s Spec. The double arrow is “implies”, from lesson 2. Abstract!Spec, read “Abstract’s Spec”, is PayOnce’s Spec seen through the mapping: Abstract will be the name under which the design imports PayOnce, and the exclamation mark reaches inside it for one of its definitions, like a dot in TypeScript. “The mapping, in TLA+” below writes Abstract down. **Every behavior the design allows is, through the mapping, a behavior PayOnce allows.**

[[diagram:implication]]

The arrow is why Maren didn’t need a list. Suppose P is any property that holds of every behavior of PayOnce: no double payout, money eventually arrives, anything. Every behavior of the design is a behavior of PayOnce through the mapping, so P holds of it too. Refinement hands you every property of the abstract spec at once, without your having to think of them.

## Choosing the mapping

The mapping in the tables above wasn’t the only choice. It wasn’t even the obvious one. PayOnce has a variable called status, and so does the design. Why not map status to status, the loans table’s own column?

Let’s try three mappings on the happy behavior, and see where each one puts the Pay step. “The table” maps PayOnce’s status to the table’s status. “The send” says paid as soon as some worker has sent a request. “The bank” is the one from the tables.

| | step | transfers | the table | the send | the bank |
|---|---|---|---|---|---|
| 0 | (start) | 0 | approved, 0 | approved, 0 | approved, 0 |
| 1 | Receive(A) | 0 | approved, 0 | approved, 0 | approved, 0 |
| 2 | Send(A) | 0 | approved, 0 | **paid, 0** | approved, 0 |
| 3 | Confirm(A) | 1 | **approved, 1** | paid, 1 | paid, 1 |
| 4 | Mark(A) | 1 | paid, 1 | paid, 1 | paid, 1 |

Under “the send”, step 2 turns the status to paid while the transfers stay at 0. Pay needs both to change together, and a stutter needs neither to change, so step 2 is not allowed. Under “the table”, step 3 is the bad one: the money moves while the table still says approved. Only “the bank” puts the status change and the money in the same step.

TLC agrees, step for step. Checked against PayOnce through “the send”, the design fails after Receive, Send; through “the table”, after Receive, Send, Confirm. Both are failures of a good design, not a bad one. Each mapping puts PayOnce’s single step somewhere, and PayOnce’s single step changes the status and the money together, so the mapping has to find the one step in the design where both change. In this design, that is the step where the bank acts. **Choosing the mapping is choosing which real step is the abstract step.** Here the question “what does paid mean?” has a sharp answer: the bank has the money.

[[diagram:mapping-choices]]

## The spec, piece by piece

Time to write QueueDesk down. Its variables are lesson 2’s, minus the owner, plus one for the queue:

```tla
VARIABLES queue, status, pc, keys, transfers, crashed
vars == <<queue, status, pc, keys, transfers, crashed>>
```

queue is the message’s condition: “visible”, “hidden” or “deleted”. Init sets it to visible, the status to approved, every pc to idle, keys to the empty set, transfers to 0 and crashed to false. The rest you have met: keys is the set of idempotency keys the bank has paid, and crashed records that the one deploy has happened.

```tla
Receive(w) == /\ pc[w] = "idle"
              /\ queue = "visible"
              /\ queue' = "hidden"
              /\ pc' = [pc EXCEPT ![w] = "claimed"]
              /\ UNCHANGED <<status, keys, transfers, crashed>>
```

Line by line: worker w is idle; the message is visible; afterwards it is hidden; w holds it; nothing else changes. **Receive(w) is a step in which an idle worker takes the visible message, and the queue hides it.** It is lesson 1’s atomic Claim, with the queue doing the conditional update.

```tla
Expire == /\ queue = "hidden"
          /\ queue' = "visible"
          /\ UNCHANGED <<status, pc, keys, transfers, crashed>>
```

**Expire is a step in which a hidden message becomes visible again, and nobody is told.** The program counters are unchanged: whoever held the message still thinks it does. That is lesson 2’s lease race, and here the idempotency key is what makes it harmless.

Send(w) moves a worker from claimed to sent and changes nothing else. Confirm is where the money is:

```tla
Confirm(w) == /\ pc[w] = "sent"
              /\ transfers' = IF Loan \in keys THEN transfers
                                               ELSE transfers + 1
              /\ keys' = keys \union {Loan}
              /\ pc' = [pc EXCEPT ![w] = "confirmed"]
              /\ UNCHANGED <<queue, status, crashed>>
```

It is lesson 2’s keyed Send, moved one step later, and Loan is 4471, as it was there. Worker w has a request on the wire; afterwards, if the bank already has key 4471, the transfers are unchanged, and otherwise there is one more; the bank now has the key; w has its answer. **Confirm(w) is the step where the bank acts on w’s request, moving money only the first time it sees the loan’s key.**

```tla
Mark(w) == /\ pc[w] = "confirmed"
           /\ status' = "paid"
           /\ queue' = "deleted"
           /\ pc' = [pc EXCEPT ![w] = "done"]
           /\ UNCHANGED <<keys, transfers, crashed>>
```

**Mark(w) is a step in which a worker with the bank’s answer writes “paid” and deletes the message.** In the code these are two calls, setStatus and delete; the spec takes them as one step, a choice we will question in the problems.

Crash(w) is lesson 2’s, for a worker that is claimed, sent or confirmed: it goes back to idle, crashed becomes true, and the queue, table and bank keep everything. A crash after Send loses the request on the wire: Confirm(w) needs w to still be waiting.

```tla
Work(w) == Receive(w) \/ Send(w) \/ Mark(w)

Next == \/ Expire
        \/ \E w \in Workers : Work(w) \/ Confirm(w) \/ Crash(w)

Fairness == /\ \A w \in Workers : WF_vars(Work(w))
            /\ \A w \in Workers : WF_vars(Confirm(w))
            /\ WF_vars(Expire)

Spec == Init /\ [][Next]_vars /\ Fairness
```

Next says a step is the lease expiring, or, for some worker, a work step, a bank step or a crash. Fairness makes three promises about the platform, in lesson 2’s sense: a worker that can keep working eventually works; the bank answers a request that stays on the wire; and a lease that stays hidden eventually runs out. Crash gets none. **The design’s behaviors start in Init, take Next steps or stutter, and never leave a worker, the bank or the lease clock able to move forever without moving.**

Here is the whole design in Python. Each step carries its name, whether fairness covers it, and the state after it. The key and the lease are switches, because we are about to break them: key=False makes every Confirm move money, and lease=False keeps Expire as a possible step but takes away its fairness, so a hidden message may stay hidden forever.

```python
def desk(s, key=True, lease=True):
    queue, status, pc, keyed, transfers, crashed = s
    for i, w in enumerate("AB"):
        def go(to, q=queue, st=status, k=keyed, t=transfers,
               c=crashed):
            return q, st, pc[:i] + (to,) + pc[i + 1:], k, t, c
        if pc[i] == "idle" and queue == "visible":
            yield f"Receive({w})", True, go("claimed", q="hidden")
        if pc[i] == "claimed":
            yield f"Send({w})", True, go("sent")
        if pc[i] == "sent":
            paid = transfers if key and keyed else transfers + 1
            yield f"Confirm({w})", True, go("confirmed", k=True,
                                            t=paid)
        if pc[i] == "confirmed":
            yield f"Mark({w})", True, go("done", q="deleted",
                                         st="paid")
        if pc[i] in ("claimed", "sent", "confirmed"):
            if not crashed:
                yield f"Crash({w})", False, go("idle", c=True)
    if queue == "hidden":
        yield "Expire", lease, ("visible",) + s[1:]
```

With one loan, the bank’s set of keys is either empty or holds 4471, so the snippet keeps it as keyed, true or false.

### The mapping, in TLA+

Now the mapping, in TLA+. Two new pieces of notation, both small, and IF, which you met in Confirm and lesson 2’s Send.

```tla
PaidAtBank == IF transfers > 0 THEN "paid" ELSE "approved"

Abstract == INSTANCE PayOnce
              WITH status <- PaidAtBank, transfers <- transfers

Refines == Abstract!Spec
```

| typeset | you type | say it | in Python |
|---|---|---|---|
| IF p THEN a ELSE b | `IF p THEN a ELSE b` | “if p then a, else b” | `a if p else b` |
| INSTANCE M WITH x ← e | `INSTANCE M WITH x <- e` | “module M, with x replaced by e” | (no equivalent) |
| A!F | `A!F` | “A’s F” | `A.F` |

PaidAtBank reads: if the bank has made any transfer, the word “paid”, otherwise “approved”. It is paid_at_bank from the snippet, minus the second half of the pair.

INSTANCE brings in the whole PayOnce module, under the name Abstract. WITH says what to put in place of each of PayOnce’s variables: everywhere PayOnce says status, read PaidAtBank; everywhere it says transfers, read the design’s transfers. The arrow typed `<-` is that substitution. Then the exclamation mark reaches inside: Abstract!Spec is PayOnce’s Spec with the substitution done. **Abstract!Spec is PayOnce’s promise, rewritten in the design’s own variables.**

It helps to see one piece rewritten. After the substitution, TLC reads Abstract!Pay as:

```text
/\ PaidAtBank = "approved"
/\ PaidAtBank' = "paid"
/\ transfers' = transfers + 1
```

The prime on PaidAtBank means “PaidAtBank computed in the state after the step”, which is the same formula with transfers primed. So this is a statement about a step of the design: before it, the bank had made no transfer; after it, the bank has made one more. Only one action of QueueDesk can make that true: Confirm, on the first request with key 4471.

The second substitution, transfers for transfers, looks pointless, and TLC would do it on its own: a variable of PayOnce with the same name as one in the design is substituted by that one when WITH doesn’t say otherwise. Writing it out costs one line and saves the reader a rule.

### Asking TLC

You might expect to put Abstract!Spec straight into the configuration file. Let’s try:

```text
SPECIFICATION Spec
PROPERTY Abstract!Spec
```

```text
Error: The property Abstract specified in the configuration file
is not defined in the specification.
```

The configuration file takes plain names, and it stopped reading at the exclamation mark. That is why the module above defines Refines, a plain name for the same formula. With PROPERTY Refines in the configuration, the same java command as every lesson so far prints:

```text
Checking temporal properties for the complete state space
  with 99 total distinct states
Model checking completed. No error has been found.
249 states generated, 99 distinct states found,
  0 states left on queue.
The depth of the complete state graph search is 13.
```

(The long lines are wrapped here.) Line by line:

1. **Checking temporal properties**: Refines contains PayOnce’s weak fairness, a liveness promise, so, as in lesson 2, TLC builds the whole graph of 99 states before it looks for lassos.
2. **No error**: every step the design can take translates to a Pay or a stutter, and no fair behavior of the design leaves PayOnce’s Pay enabled forever without taking it.
3. **249 generated, 99 distinct**: 248 steps tried from the 99 states, plus the initial state; most steps land on states already seen.
4. **Depth 13**: the state farthest from the start, by its shortest route, is 12 steps away, 13 states counting the first.

Here is the same check in Python: walk every reachable state of the design, translate both ends of every step, and count the kinds.

```python
from collections import Counter

def refines(key=True):
    init = ("visible", "approved", ("idle", "idle"), False,
            0, False)
    seen, todo, kinds = {init}, [init], Counter()
    while todo:
        s = todo.pop()
        for _, _, t in desk(s, key=key):
            a, b = paid_at_bank(s[4]), paid_at_bank(t[4])
            kinds[abstract_step(a, b)] += 1
            if t not in seen:
                seen.add(t)
                todo.append(t)
    return seen, kinds

seen, kinds = refines()
print(len(seen), "states", dict(kinds))
```

```text
99 states {'stutter': 224, 'Pay': 24}
```

The same 99 states, and all 248 steps accounted for: 24 of them are Pay steps (every one a Confirm that met an empty key set), and 224 are stutters. Not one is “not allowed”. That counts the step half of Refines; the fairness half comes in “Refinement carries liveness” below.

And Maren’s nine pages, with two workers, a crash and redelivery, behave exactly like her one line.

## Why stuttering makes this possible

Look at those numbers again: 224 of the 248 steps are stuttering steps of PayOnce. What if PayOnce didn’t allow them?

Lesson 2 introduced stuttering steps as a nuisance: they are why a spec without fairness may stop. Here they are the whole trick. PayOnce’s Spec says every step is Pay or leaves avars unchanged, and under the mapping avars is the pair of PaidAtBank and transfers. A Receive leaves both alone, so a Receive is, to PayOnce, a step where nothing happened.

Let’s see what happens without that allowance. This property, kept in `StutterFree.tla`, asks that every step that changes any of the design’s variables be a Pay step:

```tla
EveryStepPays == Abstract!Init /\ [][Abstract!Pay]_vars
```

It differs from Abstract!Spec in one subscript: vars, the design’s six variables, where PayOnce had avars. Read it: the first state satisfies Abstract’s Init, and always, every step is an Abstract!Pay step or leaves all six of the design’s variables unchanged. **Every step that changes anything in the design must move the money.** TLC:

```text
Error: Action property line 4, col 35 to line 4, col 55
  of module StutterFree is violated.
State 1: <Initial predicate>
State 2: <Receive line 16, col 15 to line 20, col 63 ...>
```

The first line names the broken property by where it sits: line 4 of StutterFree, columns 35 to 55, which is `[][Abstract!Pay]_vars`. An action property is one, like this box, that judges every step. The State lines read as in lesson 3: the action that produced each state in angle brackets, with its place in the design’s file. One step. Receive hides a message, which changes queue and pc, and it isn’t a Pay. In Python, the same property fails on every step that isn’t a Pay:

```python
print(kinds["stutter"], "of", sum(kinds.values()),
      "steps would be forbidden")
```

```text
224 of 248 steps would be forbidden
```

This is why every TLA+ spec allows stuttering, with the subscript in [Next]_vars, even when it looks like a loophole. **A spec that allows stuttering says nothing about how many smaller steps happen between its own steps,** so a one-step spec can be refined by a design that needs nine steps to do the same thing. Without stuttering, an abstract spec could only be refined by a design with exactly the same steps, and an abstract spec would be useless.

[[diagram:stutter]]

## What a refinement failure looks like

A passing check is reassuring. A failing one is where you learn things. Here are two designs that don’t refine PayOnce, and they fail in two different ways.

### A design without keys

Suppose someone on the team argues that, now that the worker sends before it marks, the idempotency key is redundant: a loan is only marked after its money moves, so nobody will send twice. Take the key out of Confirm, so every request moves money, and run the same check. Predict first: does it fail, and if so, does a worker have to crash?

```text
Error: Action property line 14, col 17 to line 14, col 29
  of module PayOnce is violated.
```

Read the location. Line 14 of PayOnce is its Spec, and columns 17 to 29 are `[][Pay]_avars`. TLC is saying: here is a step of your design that, through your mapping, is neither a Pay nor a stutter. Then the behavior, trimmed to the columns that change:

| | step | queue | pc of A | pc of B | transfers | PayOnce sees |
|---|---|---|---|---|---|---|
| 0 | (start) | visible | idle | idle | 0 | approved, 0 |
| 1 | Receive(A) | hidden | claimed | idle | 0 | approved, 0 |
| 2 | Expire | visible | claimed | idle | 0 | approved, 0 |
| 3 | Send(A) | visible | sent | idle | 0 | approved, 0 |
| 4 | Confirm(A) | visible | confirmed | idle | 1 | paid, 1 |
| 5 | Receive(B) | hidden | confirmed | claimed | 1 | paid, 1 |
| 6 | Send(B) | hidden | confirmed | sent | 1 | paid, 1 |
| 7 | Confirm(B) | hidden | confirmed | confirmed | 2 | **paid, 2** |

No crash at all. Worker A was slow, the lease expired at step 2, and worker B received the message while A was still working. Step 7 translates to “paid, 1” followed by “paid, 2”. Pay needs the status to have been approved; a stutter needs nothing to change. Neither, so TLC stops right there, with 57 distinct states found and 17 still on its queue: like an invariant, the step half of Refines can fail at a moment, so TLC doesn’t need the whole graph.

[[diagram:failure-step]]

That is the general shape. **A safety failure of refinement is a finite behavior whose last step translates to a step the abstract spec forbids.** The PayOnce column of the trace is the most useful part to read: it shows the abstract behavior your design was pretending to be, right up to the step where the pretence broke.

In Python, with the key switched off:

```python
seen, kinds = refines(key=False)
print(len(seen), "states", dict(kinds))
```

```text
122 states {'stutter': 233, 'Pay': 24, 'not allowed': 30}
```

Thirty forbidden steps among 122 states (TLC finds the same 122 when it checks no property and explores everything). In this case NoDoublePayout would have caught it too: the same trace, with an invariant in place of the property. That is no coincidence: “at most one transfer” is one of the properties refinement hands you for free.

### The pilot

The pilot, mark first and send after, is the one that matters, because its own properties passed. Its worker takes four steps: Receive as before; Mark, which writes paid, deletes the message and moves the worker’s pc to “marked”; then Send (pc “sent”) and Confirm (pc “done”). A crash may hit a worker that is claimed, marked or sent. Here is TLC checking Refines on it:

```text
Error: Temporal properties were violated.
State 1: <Initial predicate>
State 2: <Receive ...>  pc = [A |-> "claimed", B |-> "idle"]
State 3: <Mark ...>     pc = [A |-> "marked", B |-> "idle"]
State 4: <Crash ...>    pc = [A |-> "idle", B |-> "idle"]
State 5: Stuttering
```

Tuesday, at 10:14, step for step. TLC happened to pick worker A where Tuesday had B, and the two workers are interchangeable: one worker receives, marks paid and deletes the message, and crashes; then nothing happens forever. Through the mapping, every one of those steps is a stutter: the bank never acted, so PayOnce sees “approved, 0” in all five states. No step is forbidden. And yet it is a counterexample, a lasso as lesson 2 called it, and TLC printed it only after “Checking temporal properties for the complete state space with 60 total distinct states”.

What is it a counterexample to? To the third part of PayOnce’s Spec: WF_avars(Pay). Through the mapping, Pay is enabled whenever the bank has made no transfer. In this behavior Pay is enabled in state 4 and every state after it, forever, and never taken. Weak fairness forbids exactly that.

That may feel unfair: in state 4 no action of the design can pay anybody. But enabled, for the translated Pay, asks only whether some next state would make it true, transfers going from 0 to 1; it doesn’t ask whether the design has an action that gets there. PayOnce promises the Pay, and delivering it is the design’s job.

So the pilot’s green lights weren’t lying, they were looking elsewhere. TablePaid looked at the table, and the table did say paid. Refines looks at PayOnce’s status through the mapping, and the mapping says what paid *means*: the bank has the money.

## Refinement carries liveness

That pilot failure is worth slowing down on, because it is a liveness failure found by a refinement check. Lesson 2 checked liveness with a separate PROPERTY like EventuallyPaid. Here nobody wrote one. It came in with PayOnce’s fairness.

Let’s test that claim directly. Keep the step half of PayOnce and drop the fairness, with a property that ends after the box:

```tla
RefinesSafety ==
  Abstract!Init /\ [][Abstract!Pay]_Abstract!avars
```

Read it: the first state translates to PayOnce’s Init, and always, every step translates to a Pay step or a stutter, where Abstract!avars is PayOnce’s tuple of two variables, rewritten through the mapping. **RefinesSafety is Refines without the promise that Pay ever happens.** Three runs:

| design | Refines | RefinesSafety |
|---|---|---|
| QueueDesk | no error, 99 states | no error, 99 states |
| the pilot (mark first) | lasso: Receive, Mark, Crash | no error, 60 states |
| no promise the lease runs out | lasso: Receive, Crash | no error, 99 states |

The third row takes the good design and drops WF_vars(Expire), so a hidden message may stay hidden forever. TLC’s lasso: a worker receives the message and crashes, and the message never comes back. With only the step half, both broken designs pass. A design that never pays anybody never takes a forbidden step.

Here is the same in Python. A state can end a lasso when the bank has made no transfer and no step that fairness covers is enabled; as in lesson 2, the graph of this design has no loops, so stuttering in one state is the only loop a behavior can end in. Expire does make a message visible again, but every Receive uses up an idle worker, and a worker becomes idle again only through the run’s one crash.

```python
def stuck(seen, lease=True):
    return [s for s in seen if s[4] == 0 and not any(
        fair for _, fair, _ in desk(s, lease=lease))]

seen, kinds = refines()
print(len(stuck(seen)), len(stuck(seen, lease=False)))
print(stuck(seen, lease=False))
```

```text
0 1
[('hidden', 'approved', ('idle', 'idle'), False, 0, True)]
```

With the lease, no state can end a lasso. Without its fairness, one can: hidden, approved, both idle, no transfers, crashed. That is the state TLC’s lasso ends in.

[[diagram:liveness-carried]]

So **refinement carries liveness only when the abstract spec contains fairness, and the design only gets it by making fairness promises of its own.** PayOnce’s WF_avars(Pay) is what says “and the money arrives”. The design’s WF on work, Confirm and Expire are what make that true. Drop the first and refinement shrinks to safety, the zero-is-at-most-one kind. Drop one of the second and the check fails, honestly, because the design can now stall.

## The model checker as code

You have now built the whole refinement checker, in three short pieces:

- desk lists the design’s steps, with a fairness flag on each;
- refines walks every reachable state, translates both ends of every step through paid_at_bank, and counts Pay, stutter and not allowed;
- stuck finds the states where the design may stop while PayOnce still waits for its Pay.

That is the same job TLC did, with two simplifications that are safe here and not in general. The Python looks for lassos only of the stuttering kind, which is enough because this design’s graph has no other loops; TLC searches strongly connected components, the groups of states that can all reach each other, as lesson 2 described. And the Python hard-codes the mapping and PayOnce’s two actions; TLC takes any abstract module and any mapping you write.

The cost is lesson 1’s: one try per state per possible step. Here the refinement check added no states: TLC explored the same 99 with Refines as with RefinesSafety, and for each step it evaluated one more formula, the translated Pay.

**Build it.** Give desk a mark_first switch for the pilot: Receive, then Mark (status paid, message deleted, pc “marked”), then Send (pc “sent”), then Confirm (pc “done”). A crash may hit a worker that is claimed, marked or sent. Pass the switch through refines and stuck. Then:

```python
seen, kinds = refines(mark_first=True)
assert len(seen) == 60 and "not allowed" not in kinds
assert len(stuck(seen, mark_first=True)) == 1
```

Sixty states, like TLC; no forbidden step; and exactly one state where the pilot may stop unpaid.

## Fix the bug

In the lab below you get the pilot design, mark first and send after, with the key and the lease in place. The mapping is fixed: PayOnce’s status means the bank has the money. The crash is on, because the deploy happens whether you model it or not.

Your panel: the order of Mark and Send, the idempotency key, the lease running out, and two or three workers. Press “Check refinement” to translate every step of every behavior through the mapping. The lab shows the two halves of PayOnce as two lamps: one for “every step is a Pay or a stutter”, one for “the Pay happens”. A failure on the first draws the forbidden step with its PayOnce column; a failure on the second draws the lasso.

You have already read every piece of the fix in this lesson, so treat the lab as a check of what you read: put the pieces together yourself and let the checker confirm them. The desk is fixed when both lamps are green with two workers, and stay green with three.

[[lab-act2]]

With three workers, the fixed design has 431 distinct states, and TLC says no error. The design without a key fails in the same seven steps, with worker C idle throughout.

## What people get wrong

**“Refinement is one more invariant.”** It is a whole spec’s worth of properties at once, safety and liveness, including the ones you didn’t write. The pilot passed NoDoublePayout and TablePaid in all 60 of its states and still failed Refines.

**“The mapping is a detail.”** The mapping is half of the claim. Here is a mapping that tells PayOnce the books are the truth:

```tla
BooksSay == IF status = "paid" THEN 1 ELSE 0
Liar == INSTANCE PayOnce WITH transfers <- BooksSay
```

With no WITH clause for status, the design’s status stands in for PayOnce’s status, as with transfers before. And transfers is replaced by BooksSay: one if the table says paid, otherwise zero. **Liar claims that the bank has made a transfer exactly when the table says so.** Check the pilot against Liar!Spec and TLC says no error, in 60 states. The broken pilot “refines” PayOnce, because the mapping says money moved when it didn’t:

```python
def books_say(status):
    return (status, 1 if status == "paid" else 0)

tuesday = ["approved", "approved", "paid", "paid"]
bank = [0, 0, 0, 0]
print(books_say(tuesday[-1]), "but the bank made", bank[-1])
```

```text
('paid', 1) but the bank made 0
```

A mapping must translate each abstract variable into the design variable that really *means* the same thing. Review the mapping as hard as the design.

**“The design refines PayOnce, so the service is correct.”** The check covers QueueDesk, a spec of the design, not the TypeScript. Whether the handler really sends before it marks is a question about the code, one level further down, and the same trick applies there: the worker written as code, as in lesson 5, is one more spec, and it can be checked against QueueDesk the way QueueDesk was checked against PayOnce. And the check ran with two and three workers, not three hundred.

## Recap and the next bug

An **abstract spec** says what a system does and leaves out how; PayOnce says the whole desk in one step. A **refinement mapping** says what each abstract variable means in the design’s variables, and choosing it is choosing which real step is the abstract step. A design **refines** an abstract spec when every behavior of the design, translated through the mapping, is a behavior the abstract spec allows; in TLA+ that is one implication, Spec ⇒ Abstract!Spec, and in TLC it is one PROPERTY line, written with INSTANCE … WITH and a plain name. Stuttering is what lets a design take nine steps where the abstract spec takes one. A refinement failure is a forbidden step, with the abstract behavior beside it, or a lasso, when the abstract spec’s fairness is broken. And refinement carries liveness only when the abstract spec has fairness to carry.

The pilot marked before it sent, and its own properties looked at the books. Checked against Maren’s one line, through a mapping that pins “paid” to the bank, it failed in three steps and a stutter, and only the order send, confirm, mark, with the key and a lease that really runs out, passes.

Maren signs off on the design. Then she turns the page to the rollout plan, and reads the line about capacity. “Three hundred workers at peak,” she says. “And you checked two. Then three.” You tell her the numbers: 99 states with two workers, 431 with three, 1,923 with four, every one of them checked against PayOnce. She does the multiplication in her head, more than four times as many states with each worker you add, and asks the question you were hoping she wouldn’t.

“The checker passed on three workers. How do you know it holds for three hundred?”

## Concept check

Write your answers down before you move on.

1. In the unlucky behavior, worker B’s Confirm at step 7 and its Mark at step 9 both happen after the loan is already paid. Through PaidAtBank, what kind of PayOnce step is each one, and what would step 7 be if the bank had no idempotency key?
2. Drop WF_avars(Pay) from PayOnce’s Spec and rerun four checks: three that failed in this lesson (the design without keys, the pilot, the lease that never runs out) and a new one, the good design through a mapping that always says “approved, 0”. Which still fail? Why?
3. Lesson 2’s fixed desk has no queue: Claim, Resume, a keyed Send that moves money at the bank, Mark, a crash and weak fairness. Write a refinement mapping from it to PayOnce, and say whether you expect it to refine PayOnce, step half and fairness half.
