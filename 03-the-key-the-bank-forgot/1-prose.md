# The Key the Bank Forgot

## Paid twice, after the weekend

Monday, 09:40. Finance runs the weekly reconciliation and two lines refuse to match. Two transfers of €50,000 to the bakery on the harbour, both with reference 4471. One left on Friday at 17:00. The other left on Monday at 09:12.

You know this desk. In lesson 2 you made it survive a deploy: a restarted worker resumes the loans claimed in its own name, and every transfer carries the loan’s id as its idempotency key, so the bank pays a repeated request only once. The checker passed with two workers and with three. So what happened?

Worker A’s log tells it in four lines. Friday, 17:00: “claimed loan 4471”, then “sent transfer 4471”. Then nothing, because the machine’s disk died before A could mark the loan paid, and nobody replaced it until Monday morning. Monday, 09:12: “resumed claim 4471”, then “sent transfer 4471”. Worker A did exactly what lesson 2 taught it. It found its own claim and sent again, with key 4471, trusting the bank to recognise it.

The bank didn’t. Its documentation says so in small print: “Idempotency keys are kept for 24 hours.” By Monday the key was 64 hours old. To the bank, the second request was a brand new transfer, and it paid.

[[diagram:weekend]]

Lesson 2 ended on this scene, and on the one step that causes it: a step in which the bank forgets every key it holds. Written down, it is:

```tla
Forget == /\ keys # {}
          /\ keys' = {}
          /\ UNCHANGED <<status, owner, pc, transfers, crashed>>
```

≠ (typed `#`) is “not equal”, and {} is the empty set. Before the step, the bank holds at least one key; after it, the bank holds none; everything else stays as it was. From the keys {4471} it leads to {}, and from {} it can’t happen at all. **Forget is a step in which the bank drops every key it holds, at any moment it holds one.**

```python
def forget(keys):
    if keys != set():
        yield set()

print(list(forget({4471})), list(forget(set())))
```

```text
[set()] []
```

TLC found the double payout in six steps. But look at the words “at any moment”. This Forget may happen one second after the transfer. Against a bank like that, no resend is ever safe, and the honest conclusion would be that idempotency keys are useless. That isn’t the bank you have. Your bank forgets *after 24 hours*, and a desk that knows when the bank forgets can plan around it.

The spec can’t say “after 24 hours”. It has no time in it at all. This lesson puts time in, and then, because time brings a new kind of trouble with it, lets the network lose messages. By the end you will have a worker that sends the money at most once even on Monday, and the checker will agree.

## Where is Saturday?

Here is a question to sit with before reading on. Lesson 2’s spec describes Thursday’s deploy as a behavior, a table of states, one row per step. In a table like that, which row is Saturday?

None of them. A state assigns a value to every variable, and no variable says what time it is. A step says what changed, and nothing about how long it took. Two steps in a row could be a microsecond apart or a weekend apart, and the spec can’t tell the difference. That was a feature in lesson 2: EventuallyPaid had no deadline, so it needed no clock.

The bank’s rule, though, is all about time. So we add time the only way a spec ever adds anything: as a variable.

The new variable is called now, and it holds the current time as a whole number of **ticks**. We choose what a tick means. Here, one tick is 12 hours: Friday 17:00 is tick 0, Saturday 05:00 is tick 1, Saturday 17:00 is tick 2. A new kind of step, **Tick**, adds one to now and changes nothing else. Every other step leaves now alone. So time passes only by Tick steps, and any number of other steps can happen between two ticks.

The bank changes too. When it pays, it stores the key together with the time it paid, as a pair: (4471, 0) means “key 4471, stored at tick 0”. And it may forget a key only once the key has been kept for 24 hours, which is two ticks. We call that length TTL, short for “time to live”, the usual name for how long a cache keeps an entry.

### The weekend, by hand

Let’s replay Friday with a clock column. Before you look at rows 4 to 6, decide: could the bank forget the key at row 4?

| | step | now | when | pc of A | keys | transfers |
|---|---|---|---|---|---|---|
| 0 | (start) | 0 | Fri 17:00 | idle | {} | 0 |
| 1 | Claim(A) | 0 | Fri 17:00 | claimed | {} | 0 |
| 2 | Send(A) | 0 | Fri 17:00 | sent | {(4471, 0)} | 1 |
| 3 | Crash(A) | 0 | Fri 17:00 | idle | {(4471, 0)} | 1 |
| 4 | Tick | 1 | Sat 05:00 | idle | {(4471, 0)} | 1 |
| 5 | Tick | 2 | Sat 17:00 | idle | {(4471, 0)} | 1 |
| 6 | Forget | 2 | Sat 17:00 | idle | {} | 1 |
| 7 | Resume(A) | 2 | Sat 17:00 | claimed | {} | 1 |
| 8 | Send(A) | 2 | Sat 17:00 | sent | {(4471, 2)} | 2 |

No, it couldn’t. At row 4 the key is 12 hours old, and the bank keeps keys for 24. Forget becomes possible only at row 5, when now reaches 0 + 2. Try the other order too: if worker A had resumed before the two ticks, the key would still be there, the second Send would land on it, and the bank would pay nothing. The bug needs the clock to pass the key’s 24 hours between the two sends. That is the weekend, and the model doesn’t care whether it was 24 hours or 64: any gap of at least two ticks is a weekend to this bank.

Here is the same replay in Python, with the bank forgetting as soon as it is allowed to:

```python
TTL = 2
now, keys, transfers = 0, set(), 0

def send():
    global keys, transfers
    if not any(loan == 4471 for loan, _ in keys):
        transfers += 1
        keys = keys | {(4471, now)}

def forget():
    global keys
    keys = {k for k in keys if now < k[1] + TTL}

send()
for _ in range(2):
    now += 1
    forget()
    print(now, keys, transfers)
send()
print(now, keys, transfers)
```

```text
1 {(4471, 0)} 1
2 set() 1
2 {(4471, 2)} 2
```

At tick 1 the key survives. At tick 2 it is gone, and the next send pays a second time, with a fresh key stamped at tick 2.

[[lab]]

## Time is just a variable

You have just seen the whole trick, so let’s name it before writing it down: **real time is modelled as an ordinary variable, and the passing of time as an ordinary action.** Nothing about TLA+ changes. The clock is one more column in the table, and Tick is one more kind of step.

[[diagram:clock]]

Two new words first. A **constant** is a name the spec leaves open, to be filled in by the configuration file when TLC runs it. We need two. TTL is the bank’s memory, in ticks. MaxTime is the last tick the clock may reach, and we will see in a moment why the clock needs a last tick at all.

```tla
CONSTANTS MaxTime, TTL
VARIABLES now, status, owner, pc, transfers, keys, crashed
```

The keyword CONSTANTS declares the constants, just as VARIABLES declares the variables; the spec uses MaxTime and TTL by name and never says what they are. The variables are lesson 2’s fixed desk (status, owner, pc, transfers, keys, crashed) plus now. Init adds now = 0. Here is the clock’s step:

```tla
Tick == /\ now < MaxTime
        /\ now' = now + 1
        /\ UNCHANGED <<status, owner, pc, transfers, keys,
                       crashed>>
```

Remember that a column of ∧ signs means every line must hold, and that a primed variable is its value after the step. Line by line: before the step, now is less than MaxTime; after it, now is one more than before; every other variable stays as it was. With MaxTime 3, from tick 2 the one Tick goes to tick 3, and from tick 3 there is none. **Tick is a step in which the clock moves forward one tick, as long as it hasn’t reached MaxTime, and nothing else changes.**

```python
MAX_TIME = 3

def tick(now):
    if now < MAX_TIME:
        yield now + 1

now, seen = 0, [0]
while steps := list(tick(now)):
    now = steps[0]
    seen.append(now)
print(seen)
```

```text
[0, 1, 2, 3]
```

Why stop at MaxTime? Because TLC visits every reachable state, and a clock that can always tick once more makes infinitely many of them. So we give the model a finite clock, and after MaxTime the model simply stops ticking. That is a small lie about the world, and later in this lesson it will cost us something real.

Three things follow from making time an action, and they are worth saying out loud.

First, nothing forces Tick to happen, and nothing forces it to wait. Worker A can take five steps inside one tick, or the clock can race through a whole weekend while every worker sits still. Both happen in production: a fast machine, a dead machine.

Second, the clock is **discrete**: it jumps from tick to tick, with nothing in between. We can’t say 17:00:03, only tick 0. That is enough whenever the only question is which side of a line a step falls on, and here it is: was the second send more or less than 24 hours after the first? Make ticks as coarse as your rules allow. Every extra tick is extra states.

Third, now is time as an outside observer would read it, not any machine’s clock. Nobody reads it unless an action mentions it, and the first action to mention it is the bank’s.

### A timeout is a guard

The bank’s keys are now pairs, and the spec reads them like this:

```tla
Known == \E k \in keys : k[1] = Loan

Forget(k) == /\ now >= k[2] + TTL
             /\ keys' = keys \ {k}
             /\ UNCHANGED <<now, status, owner, pc, transfers,
                             crashed>>
```

Loan is 4471, as in lesson 2. A pair is a tuple, and k[1] is its first element, k[2] its second: TLA+ counts from 1. The ∃ reads “there is”, so Known says: there is a key in keys whose loan part is 4471. The backslash between two sets is set difference, “keys without k”. And ≥ is “at least”. Forget(k) line by line: before the step, now is at least the key’s stored time plus TTL; after it, the bank’s keys are the old ones without k; nothing else changes. **Known is true when the bank holds a key for loan 4471, and Forget(k) is a step in which the bank drops key k once it is at least TTL ticks old.**

```python
TTL = 2

def known(keys):
    return any(k[0] == 4471 for k in keys)

def forget(now, keys):
    for k in keys:
        if now >= k[1] + TTL:
            yield keys - {k}

keys = frozenset({(4471, 0)})
for now in range(4):
    after = [set(a) for a in forget(now, keys)]
    print(now, known(keys), after)
```

```text
0 True []
1 True []
2 True [set()]
3 True [set()]
```

Python counts from 0, so its k[1] is the time; TLA+’s k[2] is the same element.

This is what a **timeout** looks like in a spec: a guard on now. Before the time, the action isn’t enabled. From then on, it is. And “enabled” is all it is, exactly as in lesson 2: Forget may happen at tick 2, or tick 3, or never. That models “keys are kept for at least 24 hours”, which is all the bank’s documentation promises, and the weaker promise is the safer one to build on. A desk that is safe against every moment the bank might forget is safe against the moment it actually does.

[[diagram:timeout-guard]]

Send stamps the key with the time:

```tla
Send(w) == /\ pc[w] = "claimed"
           /\ IF Known
                THEN UNCHANGED <<transfers, keys>>
                ELSE /\ transfers' = transfers + 1
                     /\ keys' = keys \union {<<Loan, now>>}
           /\ pc' = [pc EXCEPT ![w] = "sent"]
           /\ UNCHANGED <<now, status, owner, crashed>>
```

This is lesson 2’s Send with one change: the key it adds is the pair ⟨4471, now⟩, typed `<<Loan, now>>`, instead of plain 4471. The IF here doesn’t pick a value, as it did in lesson 2; it picks which of two lists of conditions the step must meet, the THEN list or the ELSE list. The ELSE list is a column of ∧ of its own, indented under ELSE: indentation is how TLA+ shows which lines belong together, and both of those lines belong to the ELSE. Read it: worker w holds the loan; if the bank knows the key, transfers and keys stay as they were, and otherwise there is one more transfer and the bank stores the key with the current time; w has sent; the clock, status, owner and crash flag stay. **A Send pays only when the bank holds no key for the loan, and when it pays, the bank remembers the key along with the moment it paid.**

```python
def send(now, transfers, keys):
    if any(k[0] == 4471 for k in keys):
        return transfers, set(keys)
    return transfers + 1, keys | {(4471, now)}

print(send(0, 0, set()))
print(send(1, 1, {(4471, 0)}))
print(send(2, 1, set()))
```

```text
(1, {(4471, 0)})
(1, {(4471, 0)})
(2, {(4471, 2)})
```

The last line is Saturday evening: no key, so a second transfer. Then the clock and the bank join the desk’s next-state relation:

```tla
Next == \/ Tick
        \/ \E k \in keys : Forget(k)
        \/ \E w \in Workers : Work(w) \/ Crash(w)
```

Lesson 1 read a column of ∧ signs as a bulleted list where every line must hold. A column of ∨ signs, typed `\/`, is the same kind of list where at least one line must hold. So a step of Next is a Tick, or a Forget, or a worker’s step, and any one is enough. Work(w) is lesson 2’s list of a worker’s ordinary steps: Claim, Resume, Skip, Send, Mark. **A step of the desk is a tick of the clock, or the bank forgetting one of its keys, or some worker working or crashing.**

```python
def clock_and_bank(now, keys, max_time=3, ttl=2):
    steps = ["Tick"] if now < max_time else []
    for k in sorted(keys):
        if now >= k[1] + ttl:
            steps.append(f"Forget({k})")
    return steps

for now in range(4):
    print(now, clock_and_bank(now, {(4471, 0)}))
```

```text
0 ['Tick']
1 ['Tick']
2 ['Tick', 'Forget((4471, 0))']
3 ['Forget((4471, 0))']
```

At tick 3 the clock has reached MaxTime and Tick is no longer enabled. This lesson checks only safety properties, NoDoublePayout now and one more later, so Spec is Init and always-Next, without lesson 2’s Fairness. We will come back to liveness near the end.

## TLC finds the weekend

The configuration file now fills in the constants, one CONSTANTS line per value, before the SPECIFICATION and INVARIANT lines you know from lesson 1:

```text
CONSTANTS MaxTime = 3
CONSTANTS TTL = 2
SPECIFICATION Spec
INVARIANT NoDoublePayout
```

And TLC, trimmed, with now and transfers pulled up beside each step:

```text
Error: Invariant NoDoublePayout is violated.
State 1: <Initial predicate>   now = 0   transfers = 0
State 2: <Claim ...>           now = 0   transfers = 0
State 3: <Send ...>            now = 0   transfers = 1
State 4: <Tick ...>            now = 1   transfers = 1
State 5: <Tick ...>            now = 2   transfers = 1
State 6: <Next ...>            now = 2   transfers = 1
State 7: <Crash ...>           now = 2   transfers = 1
State 8: <Resume ...>          now = 2   transfers = 1
State 9: <Send ...>            now = 2   transfers = 2
332 states generated, 201 distinct states found, ...
```

Read it from the top. Each State line numbers a state of the counterexample and names, in angle brackets, the action whose step produced it (TLC also prints where that action is in the file, trimmed here to “...”). State 1 has no step before it, so it says <Initial predicate>: it is a start state that Init allows. Nine states, so eight steps, the same eight as our table. Two details differ. The crash comes after the ticks instead of before them, which changes nothing, because a crash doesn’t touch the clock. And State 6 is labelled “Next” instead of “Forget”: this version of TLC named the line of Next that holds “there is a k in keys with Forget(k)”, and it does the same for the network’s steps later on. When a label doesn’t say which step it was, read the variables. Here the keys go from {⟨4471, 0⟩} to {}, and only Forget does that.

The last line counts two things. “Generated” is every successor state TLC computed, repeats included; “distinct” is how many different states those were, the number that matters. TLC stopped at the first bad state, after 201 distinct states. Run it with the `-continue` flag and it explores everything: 238 reachable states.

### A clock that stops too early

Now set MaxTime to 1 and run it again. Predict first: what changes?

```text
Model checking completed. No error has been found.
86 states generated, 62 distinct states found, ...
```

No error. The weekend needs the clock to reach tick 2, and this model’s clock stops on Saturday morning. Every state in it is truly safe; the model just doesn’t contain Saturday evening. **TLC can only find a bug that fits inside the clock you gave it.**

Here is how the state count grows as the clock gets longer, with TTL fixed at 2:

| MaxTime | 0 | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|---|
| states | 23 | 62 | 139 | 238 | 365 | 514 | 685 |
| paid twice? | no | no | yes | yes | yes | yes | yes |

[[diagram:clock-bound]]

Look at the first column. With MaxTime 0 the clock never moves, the bank never forgets, and the model is exactly lesson 2’s fixed desk: 23 states, the same 23 TLC reported there. A frozen clock is a world without time. The bug appears as soon as the clock can reach TTL, and from then on every longer clock finds it too. So here is a working habit: once a spec passes, run it again with a longer clock, and see whether the verdict changes.

## Ask before you resend

Who knows for certain whether the bakery was paid? Not worker A. Not the loans table. The bank, and it knows for longer than 24 hours: it forgets idempotency keys, but it never forgets a payment. Every transfer it ever made is on its statement, and it lets you look one up by reference.

So change what a resumed worker does. Instead of sending again, it looks first. Resume now puts the worker in a new pc value, “looking”, and one new step reads the bank’s answer:

```tla
Lookup(w) == /\ pc[w] = "looking"
             /\ pc' = [pc EXCEPT ![w] =
                    IF transfers > 0 THEN "sent" ELSE "claimed"]
             /\ UNCHANGED <<now, status, owner, transfers,
                             keys, crashed>>
```

This IF is the kind from lesson 2: it sits where a value goes, on the right of `=`, so it picks a value, “sent” or “claimed”, and that value becomes w’s new pc. Worker w is looking; afterwards, if the bank has made a transfer, w goes to “sent”, ready to mark the loan paid, and otherwise back to “claimed”, ready to send; nothing else changes. **Lookup(w) is a step in which a resumed worker asks the bank whether the money moved, and skips the send if it did.**

```python
def lookup(transfers):
    return "sent" if transfers > 0 else "claimed"

print(lookup(1), lookup(0))
```

```text
sent claimed
```

TLC, MaxTime 3: no error, 228 distinct states. With MaxTime 6: no error, 591. The weekend is fixed, however long the clock runs.

Now look hard at Lookup and ask what it assumes. In one atomic step, the worker reads the bank’s ledger and decides. Lesson 1 taught you to be suspicious of exactly this kind of step. A real worker can’t read the bank’s memory; it sends a question over the network, and an answer comes back later. Or doesn’t.

## Messages get lost

So far a Send went straight into the bank’s ledger. Real systems don’t work that way. Worker A puts a request on the network, and some time later the bank receives it. A **message** is a value one party puts in the network for another party to take out later. While it is out there, it is **in flight**, and the network may deliver it late or never. A message the network never delivers is **lost**.

### Two worlds that look the same

Here is the second worked example, and it is the heart of the lesson. Friday, 17:00. Worker A sends the transfer request and waits for the bank’s reply, “ok”. Nothing comes back. Two very different things could have happened.

| | world 1: the request is lost | world 2: the reply is lost |
|---|---|---|
| 1 | Claim(A) | Claim(A) |
| 2 | Send(A): request in flight | Send(A): request in flight |
| 3 | the network loses the request | the bank pays and replies “ok” |
| 4 | (nothing) | the network loses the “ok” |
| what A sees | waiting, no reply | waiting, no reply |
| transfers | 0 | 1 |

Before reading on, put yourself in A’s place. Should you send again?

In world 1, you must, or the bakery is never paid. In world 2, sending again is a second transfer, harmless only while the bank still holds key 4471. And from inside A, the two worlds are identical:

```python
lost_request = {"pc of A": "waiting", "replies": set(),
                "transfers": 0}
lost_reply = {"pc of A": "waiting", "replies": set(),
              "transfers": 1}

def seen_by_a(world):
    return world["pc of A"], world["replies"]

print(seen_by_a(lost_request) == seen_by_a(lost_reply))
print(lost_request["transfers"], lost_reply["transfers"])
```

```text
True
0 1
```

No amount of cleverness inside worker A can tell these apart, because the difference lives in the bank. That is the first thing message loss teaches: **a worker that hears nothing doesn’t know whether its request arrived.**

[[diagram:two-worlds]]

### The network in the spec

The spec gets a new variable, net: the set of messages in flight, empty at the start. A message is a **record**, a value with named fields, like a small object. `[kind |-> "pay", sent |-> 0]` is a message whose kind is “pay”, sent at tick 0: each `|->`, typeset as the arrow ↦, pairs a field’s name with its value. And m.kind reads the kind field of a message m, like a property in TypeScript. Here is the new Send:

```tla
Send(w) == /\ pc[w] = "claimed"
           /\ net' = net \union {[kind |-> "pay", sent |-> now]}
           /\ pc' = [pc EXCEPT ![w] = "waiting"]
           /\ UNCHANGED <<now, status, owner, transfers, keys,
                           crashed>>
```

Worker w holds the loan; afterwards, the network holds one more message, a payment request stamped with the current time; w is waiting; nothing else changes, and in particular no money moves. **Send(w) puts a payment request in flight and leaves the worker waiting for a reply.**

```python
def send(now, net):
    return net | {("pay", now)}, "waiting"

print(send(0, set()))
```

```text
({('pay', 0)}, 'waiting')
```

The money moves when the bank takes the request out of the network:

```tla
Deliver(m) == /\ m.kind = "pay"
              /\ net' = (net \ {m}) \union {[kind |-> "ok"]}
              /\ IF Known
                   THEN UNCHANGED <<transfers, keys>>
                   ELSE /\ transfers' = transfers + 1
                        /\ keys' = keys \union {<<Loan, now>>}
              /\ UNCHANGED <<now, status, owner, pc, crashed>>
```

Where does m come from? It is a message in the network, chosen by a “there is” in Next, just as Forget(k) gets its k: Next will gain a line reading `\E m \in net : Deliver(m) \/ Drop(m)`, “there is a message m in flight that the bank delivers or the network drops”. Drop comes next. Read Deliver(m) line by line: message m is a payment request; afterwards, m has left the network and an “ok” reply has joined it; the bank pays and stores the key unless it already knows the key, exactly as Send did before; no worker’s pc changes, because the workers haven’t heard anything yet. **Deliver(m) is the bank receiving a payment request, paying it if the key is new, and putting a reply in flight.**

```python
def deliver(m, now, net, transfers, keys):
    net = (net - {m}) | {("ok",)}
    if any(k[0] == 4471 for k in keys):
        return net, transfers, keys
    return net, transfers + 1, keys | {(4471, now)}

m = ("pay", 0)
print(deliver(m, 0, {m}, 0, set()))
print(deliver(m, 0, {m}, 1, {(4471, 0)}))
```

```text
({('ok',)}, 1, {(4471, 0)})
({('ok',)}, 1, {(4471, 0)})
```

The second line is a repeat request landing on a known key: a reply, and no money. Two more actions finish the network:

```tla
Drop(m) == /\ net' = net \ {m}
           /\ UNCHANGED <<now, status, owner, pc, transfers, keys,
                           crashed>>

Retry(w) == /\ pc[w] = "waiting"
            /\ pc' = [pc EXCEPT ![w] = "claimed"]
            /\ UNCHANGED <<now, status, owner, net, transfers,
                            keys, crashed>>
```

Drop(m): afterwards, m is gone from the network, and nothing else changed; nobody receives it, nobody is told. Retry(w): w is waiting; afterwards it is back at “claimed”, ready to send again. **Drop(m) is the network losing a message, and Retry(w) is a worker giving up on its reply and getting ready to resend.**

```python
def drop(net):
    for m in sorted(net):
        yield net - {m}

def retry(pc):
    if pc == "waiting":
        yield "claimed"

print(list(drop({("pay", 0), ("ok",)})))
print(list(retry("waiting")), list(retry("sent")))
```

```text
[{('pay', 0)}, {('ok',)}]
['claimed'] []
```

Notice that Retry has no guard on now. The worker’s timeout fires after some wait, five seconds or five hours, and the spec allows any of them. The last piece, GotOk(w), lets the owner of the loan take an “ok” from the network and move to “sent”, after which Mark works as before.

### A retry with a key

First, a bank that never forgets within the model: TTL 9, MaxTime 3. TLC: no error, 4,496 distinct states. Lost requests, lost replies, retries in any order, and the key absorbs every duplicate. Lesson 2’s fix was right for as long as the bank remembers.

Now TTL 2. Predict: will the counterexample need a lost message?

In the net column below, pay@0 is a payment request sent at tick 0, and ok is the bank’s reply.

| | step | now | pc of A | net | keys | transfers |
|---|---|---|---|---|---|---|
| 0 | (start) | 0 | idle | {} | {} | 0 |
| 1 | Claim(A) | 0 | claimed | {} | {} | 0 |
| 2 | Send(A) | 0 | waiting | {pay@0} | {} | 0 |
| 3 | Deliver | 0 | waiting | {ok} | {(4471, 0)} | 1 |
| 4 | Tick | 1 | waiting | {ok} | {(4471, 0)} | 1 |
| 5 | Tick | 2 | waiting | {ok} | {(4471, 0)} | 1 |
| 6 | Forget | 2 | waiting | {ok} | {} | 1 |
| 7 | Retry(A) | 2 | claimed | {ok} | {} | 1 |
| 8 | Send(A) | 2 | waiting | {ok, pay@2} | {} | 1 |
| 9 | Deliver | 2 | waiting | {ok} | {(4471, 2)} | 2 |

It doesn’t. There is no Drop anywhere in it. The “ok” sat in the network for a whole day while worker A timed out, retried, and resent to a bank that had forgotten. Nothing was lost. It was only late. (In row 9, the second “ok” merges with the first: net is a set, and two equal messages in a set are one.) TLC finds this behavior in 9 steps; the whole model has 7,252 states.

That is the second thing message loss teaches, and it is the one people resist: **a timeout doesn’t mean the request failed. It means you stopped waiting.** From inside the worker, late and lost look the same.

## Ask over the network

So bring back the idea that fixed the weekend: don’t resend blindly, ask the bank. But ask the way a real worker asks, with messages. A waiting worker no longer retries. Instead, AskBank(w) puts a question in flight, `[kind |-> "ask"]`, and moves w to a new pc value, “asking”. The bank answers the question:

```tla
Answer(m) == /\ m.kind = "ask"
             /\ net' = (net \ {m}) \union
                  {IF transfers > 0 THEN [kind |-> "found"]
                                    ELSE [kind |-> "absent"]}
             /\ UNCHANGED <<now, status, owner, pc, transfers,
                             keys, crashed>>
```

As with Deliver, m is a message in flight, picked by a “there is” in Next. The IF here sits inside the set braces, where a value goes, so it picks a value: the one reply that goes into the network. Message m is a question; afterwards, the question has left the network, and a reply has joined it: “found” if the bank has made a transfer, “absent” if it hasn’t; nothing else changes. **Answer(m) is the bank looking up loan 4471 in its ledger and putting the result in flight.**

```python
def answer(net, transfers):
    reply = ("found",) if transfers > 0 else ("absent",)
    return (net - {("ask",)}) | {reply}

print(sorted(answer({("ask",), ("pay", 0)}, 0)))
print(sorted(answer({("ask",), ("ok",)}, 1)))
```

```text
[('absent',), ('pay', 0)]
[('found',), ('ok',)]
```

Look at the first line before going further. The bank says “absent”, and it is telling the truth, while a payment request sits in the same network, not yet delivered.

On the worker’s side, GotOk(w) now accepts “found” as well as “ok”, and a new step, GotAbsent(w), lets an asking worker take an “absent” and go back to “claimed”, to send again. Asking can repeat: a worker still waiting for its answer may ask again, in case the question was lost.

Predict: is this safe?

TLC says no, in 11 steps: Claim(A), Send(A), AskBank(A), Answer, Deliver, Tick, Tick, Forget, GotAbsent(A), Send(A), Deliver. In words: A sends, and asks almost at once. The bank answers the question before the payment request arrives: absent. Then the request arrives and the bank pays. A whole day goes by, and the key goes with it. Then A reads the answer, absent, and sends again. (The bank’s “ok” for the first request is in the network too, but the network delivers in any order, and A happens to read the “absent” first.)

[[diagram:stale-answer]]

**The answer was true when the bank wrote it and false when worker A read it.** An answer describes the bank at the moment it was written, and a request in flight can change the bank after that moment. “Absent” really means “not yet”. It can only mean “never” if nothing that could still pay is in flight.

And here is the hard part: worker A can’t pull its request back out of the network. Once it’s sent, it is out of A’s hands. Only the receiver can make a request expire.

## The fix: a deadline on every request

Here is the fix, in three rules. Each one shuts a door you have seen opened.

1. **A window for resending.** When worker A claims the loan, it sets a **deadline**: now plus a constant Window, which is one tick here, 12 hours. Until the deadline, A may send and resend freely, every request carrying the loan’s key. The window must be shorter than the bank’s memory.
2. **Requests that expire.** Every payment request carries its deadline, and the bank refuses a request that arrives after it: no money, no reply. (Our fictional bank’s API accepts a “valid until” time on a transfer. If yours doesn’t, this rule is the thing to ask your bank for.)
3. **Reconcile after the deadline.** Once the deadline has passed, A never resends blindly. It asks the bank, and it believes “absent” only from an answer written after the deadline. Then it starts a new window, with a new deadline, and sends again.

Why does that work? Take the story’s numbers. A claims at tick 0, so the deadline is tick 1. Rule 2 means every payment of this window lands at tick 1 or earlier. The key it stores is stamped no earlier than tick 0, the claim, so the bank can’t forget it before tick 2. Every request of the window that reaches the bank in time finds the key, so at most one of them pays. After tick 1, no request of the window can pay at all, so an “absent” written after tick 1 is final: rule 3 can trust it.

```python
TTL = 2

for window in (1, 2):
    claimed_at = 0
    last_payment = claimed_at + window
    first_forget = claimed_at + TTL
    print(window, last_payment, first_forget,
          last_payment < first_forget)
```

```text
1 1 2 True
2 2 2 False
```

With a window of two ticks, the last moment a request may still pay is the first moment the bank may forget. Same tick, either order. Keep that second line in mind; TLC will turn it into a counterexample shortly.

[[diagram:deadline]]

### The spec

The desk gains one variable, deadline, set when a worker claims the loan:

```tla
Claim(w) == /\ pc[w] = "idle"
            /\ status = "approved"
            /\ status' = "claimed"
            /\ owner' = w
            /\ deadline' = now + Window
            /\ pc' = [pc EXCEPT ![w] = "claimed"]
            /\ UNCHANGED <<now, net, transfers, keys, crashed>>

Send(w) == /\ pc[w] = "claimed"
           /\ now <= deadline
           /\ net' = net \union
                {[kind |-> "pay", by |-> deadline]}
           /\ pc' = [pc EXCEPT ![w] = "waiting"]
           /\ UNCHANGED <<now, status, owner, deadline,
                           transfers, keys, crashed>>
```

Claim is lesson 2’s claim, which also records the owner, with one more line: afterwards, the deadline is now plus Window. Send has a new guard, now ≤ deadline, “now is at most the deadline”, and its request carries a field by, the deadline. **Claim(w) starts a window that ends Window ticks from now, and Send(w) may put a request in flight only inside the window, stamped with the moment it expires.** Retry comes back, since rule 1 allows resending inside the window, and gets the same guard, now ≤ deadline. A **deadline** is a guard on now that switches an action off, where a timeout switched one on.

```python
WINDOW = 1

def claim(now):
    return now + WINDOW

def send(now, deadline, net):
    if now <= deadline:
        yield net | {("pay", deadline)}

deadline = claim(0)
for now in range(3):
    print(now, list(send(now, deadline, set())))
```

```text
0 [{('pay', 1)}]
1 [{('pay', 1)}]
2 []
```

The bank enforces rule 2:

```tla
Deliver(m) == /\ m.kind = "pay"
              /\ IF now > m.by
                   THEN /\ net' = net \ {m}
                        /\ UNCHANGED <<transfers, keys>>
                   ELSE /\ net' = (net \ {m}) \union
                                {[kind |-> "ok"]}
                        /\ IF Known
                             THEN UNCHANGED <<transfers, keys>>
                             ELSE /\ transfers' = transfers + 1
                                  /\ keys' = keys \union
                                               {<<Loan, now>>}
              /\ UNCHANGED <<now, status, owner, deadline, pc,
                              crashed>>
```

Message m is a payment request. If now is past its by field, the request leaves the network and nothing else happens: no money, no key, no reply. Otherwise, it is the Deliver you already know. **Deliver(m) refuses a request that arrives after its deadline, and treats one that arrives in time exactly as before.**

```python
def deliver(m, now, net, transfers, keys):
    net = net - {m}
    if now > m[1]:
        return net, transfers, keys
    net = net | {("ok",)}
    if any(k[0] == 4471 for k in keys):
        return net, transfers, keys
    return net, transfers + 1, keys | {(4471, now)}

m = ("pay", 1)
print(deliver(m, 1, {m}, 0, set()))
print(deliver(m, 2, {m}, 0, set()))
```

```text
({('ok',)}, 1, {(4471, 1)})
(set(), 0, set())
```

Rule 3 has two halves. AskBank(w) is now enabled only when now > deadline, so a worker asks only after its window, and it is enabled from “claimed” as well as from “waiting”, for a worker whose window closed before it sent. Resume(w) now puts a restarted worker in “waiting”, as if it had just sent, so once its window has closed its only move is to ask. And the bank stamps every “absent” with the time it wrote it, a field at, which the worker checks:

```tla
GotAbsent(w) == /\ owner = w
                /\ pc[w] = "asking"
                /\ \E m \in net :
                     /\ m.kind = "absent"
                     /\ m.at > deadline
                     /\ net' = net \ {m}
                /\ deadline' = now + Window
                /\ pc' = [pc EXCEPT ![w] = "claimed"]
                /\ UNCHANGED <<now, status, owner, transfers,
                                keys, crashed>>
```

Worker w owns the loan and is asking; there is an “absent” in the network that was written after w’s deadline, and w takes it out; afterwards, a new window starts, and w is ready to send again. **GotAbsent(w) believes “absent” only from an answer written after the window closed, and then opens a new window.**

```python
WINDOW = 1

def got_absent(now, deadline, net):
    for m in sorted(net):
        if m[0] == "absent" and m[1] > deadline:
            yield net - {m}, now + WINDOW

net = {("absent", 2), ("absent", 4)}
print(list(got_absent(4, 3, net)))
```

```text
[({('absent', 2)}, 5)]
```

The worker’s deadline is tick 3. Of the two answers in flight, it accepts only the one written at tick 4, opens a window that ends at tick 5, and leaves the tick-2 answer where it is. GotOk(w) has no such check: “found” and “ok” are never wrong, because a payment, once made, stays made.

### Checking that the desk can always move

A worker that may only ask after its deadline, and only believe certain answers, might talk itself into a corner where it can do nothing at all. Without fairness, we can’t ask TLC whether the loan is eventually paid, but we can ask a safety question that catches the corner:

```tla
NoDeadEnd == \/ status = "paid"
             \/ \E w \in Workers : ENABLED Work(w)
```

Remember from lesson 2 that ENABLED in front of an action means “a step of this action can be taken in this state”. So: either the loan is paid, or there is a worker that has some work it can do. **In every reachable state, the loan is paid or some worker can still take a step of work.**

```python
def no_dead_end(status, enabled_work):
    return status == "paid" or any(enabled_work.values())

print(no_dead_end("claimed", {"A": False, "B": False}))
print(no_dead_end("claimed", {"A": True, "B": False}))
print(no_dead_end("paid", {"A": False, "B": False}))
```

```text
False
True
True
```

It is weaker than EventuallyPaid: it says the desk is never stuck, not that it gets anywhere. Proving that it gets somewhere would also need promises about the network, such as “a request sent again and again is eventually delivered”, and we keep those for later.

### What TLC says

The configuration: MaxTime 4, TTL 2, Window 1, both invariants. The clock now runs for 48 hours.

```text
Model checking completed. No error has been found.
163549 states generated, 28021 distinct states found, ...
```

No double payout and no dead end, in any of 28,021 reachable states. With three workers, 54,305 states, no error. Friday’s crash, the lost reply, the late reply, the weekend: all in there, all safe.

Replay Friday on the fixed desk. Worker A claims at tick 0, so its window closes at tick 1, Saturday 05:00. It sends, the bank pays, and A crashes before it can mark the loan paid. On Monday, A resumes into “waiting”, and its window closed two days ago. It may not resend. It asks. The bank, which has long forgotten the key but never the payment, answers “found”, and A marks the loan paid. One transfer.

Now break it, to see each rule earn its place.

**Window 2.** That is the second line of the window arithmetic. TLC: double payout in 9 steps. A sends, the bank pays at tick 0, two ticks pass, the bank forgets, A’s timeout fires at tick 2 (still inside its window), it resends, and the request lands at tick 2, on time and on an empty key set. The window must be strictly shorter than the bank’s memory.

**No refusal at the bank.** Keep the window, but let Deliver pay late requests. TLC: double payout in 9 steps. A sends and the bank pays at tick 0. At tick 1, still inside its window, A retries and resends. That second request sits in the network until tick 2, after the key is forgotten, and the bank pays it. Worker A obeyed its deadline perfectly; its request didn’t. This is why rule 2 belongs to the receiver.

**Deadline, but never ask.** Drop AskBank, so a worker past its deadline can only wait. TLC: NoDeadEnd is violated in 3 steps. A claims, and two ticks pass before it sends anything: a slow worker. Its window has closed, so it may not send, and it has no other move. Neither does B, which leaves claimed loans alone. A lost reply ends in the same place a little later. Safe, and stuck: lesson 2’s stranded loan, back again.

**Trust any “absent”.** Remove the line m.at > deadline; call this desk FixStale. Predict: what does TLC say?

With MaxTime 3, no error, 8,288 states: exactly the 8,288 the real fix has with MaxTime 3, so at 36 hours the missing check makes no difference at all. With MaxTime 4, a double payout in 17 steps:

| ticks | what happens |
|---|---|
| 0 | A claims; its window ends at tick 1 |
| 2 | A asks; the bank answers “absent”, written at tick 2 |
| 2 | A asks again; then it takes the first “absent” and starts a new window, ending at tick 3 |
| 2 | the bank answers the second question: another “absent”, written at tick 2, now in flight |
| 2 | A sends; the bank pays and stores key 4471 at tick 2 |
| 4 | the window has closed, the key is forgotten; A asks again |
| 4 | A takes the old tick-2 “absent”, believes it, and sends; the bank pays |

[[diagram:fresh-answer]]

That old answer was written during the second window, while a request of that window could still pay. The rule “after the deadline” means the deadline of the window you are in, and the check m.at > deadline is how the worker knows. It took a clock of 48 hours to show it, because the story needs two windows and a forgotten key. **A clock that stops too early can hide a bug, and this one hid it at 36 hours.**

## Build it

Build the clock desk in Python, the way you built lesson 2’s desk. A state is a tuple (now, status, owner, pc, transfers, keys, crashed), with keys a frozenset of pairs (4471, time). Write next_steps(state, max_time, lookup=False) with Tick, Forget, Claim, Resume, Skip, Send, Mark and Crash as in this lesson’s spec, TTL 2 and one crash per run. With lookup=True, Resume goes to “looking” and a Lookup step follows. Then write reachable(init, max_time, lookup=False). With the start state below, these must pass:

```python
init = (0, "approved", "nobody", ("idle", "idle"), 0,
        frozenset(), False)
short = reachable(init, 1)
weekend = reachable(init, 3)
looked = reachable(init, 3, lookup=True)
assert len(short) == 62 and max(s[4] for s in short) == 1
assert len(weekend) == 238 and max(s[4] for s in weekend) == 2
assert len(looked) == 228 and max(s[4] for s in looked) == 1
```

The three numbers are TLC’s: a clock too short to see the weekend, the weekend itself, and the lookup that fixes it on a perfect network.

## Fix the bug

In the lab below, the network loses and delays messages, the clock runs, and the bank forgets keys after 24 hours. Your panel: what a waiting worker does (resend on timeout, or ask the bank), a deadline with a window of 12 or 24 hours (the bank refuses requests that arrive after it), whether the worker trusts only answers written after its deadline, how long the clock runs (12, 36 or 48 hours), and two or three workers. Run the checker after each change. It shows two lamps, NoDoublePayout and NoDeadEnd, and draws the first bad behavior it finds as a timeline.

The desk is fixed when both lamps are green with the clock at 48 hours, with two workers and with three. A shorter clock is not an answer: the bank’s weekend happens whether your model runs long enough or not.

[[lab-act2]]

## What people get wrong

**“The spec’s clock is the server’s clock.”** The spec’s now is true time, read by an observer who sees everything. A real worker checks its deadline against its own clock, and the bank counts its 24 hours on another. Our model assumes the two agree. In production they drift, so leave a wide margin: a window of minutes against a memory of a day, not 12 hours against 24.

**“A timeout means the request failed.”** It means the worker stopped waiting. In the lossy desk’s counterexample, nothing was lost at all: the reply was late. Code that treats a timeout as a failure and resends is betting that late and lost are the same thing.

**“It passed, so it’s right.”** It passed for the clock you gave it. FixStale (the fixed desk without the m.at > deadline check, so its worker trusts any “absent”) passes with a 36-hour clock and pays twice with a 48-hour one. Rerun with a longer clock, and with another worker, until the verdict stops changing. Lesson 8 asks how far that habit can carry you.

## Recap and the next bug

Time in a spec is an ordinary variable, **now**, counting **ticks**, and the passing of time is an ordinary action, **Tick**. A **timeout** is a guard on now that switches an action on (the bank may forget a key once it is TTL ticks old), and a **deadline** is one that switches an action off (a worker may send only inside its window). A **constant** such as MaxTime or TTL is filled in by the configuration file, and **MaxTime** keeps the clock finite so TLC can finish, at the price of hiding any bug that needs more time. A **message** is in flight until it is delivered or **lost**, and a worker that hears nothing can’t tell a lost request from a lost or late reply. The fix makes uncertainty harmless with three rules: resend only inside a window shorter than the bank’s memory, let the bank refuse requests that arrive after their deadline, and after the deadline ask the bank, believing only an answer written after it.

The bakery was paid twice because worker A’s outage outlasted the bank’s 24 hours by 40. Now it can’t be: every request either lands while the key is remembered or is refused.

But look at the numbers. The clock desk had 238 states. The fixed desk with a 48-hour clock has 28,021, and with three workers, 54,305. Give the clock one more tick, 60 hours, and TLC generates 601,694 states to find 89,734 distinct ones. Finance has asked for the florist’s loan to go through the same desk, and for workers that retry more than once. Each worker, each loan, each tick and each message in flight multiplies the states. Next lesson: how do you keep the checker finishing when workers, loans and retries multiply?

## Concept check

Write your answers down before you move on.

1. The bank changes its policy: keys are now kept for 72 hours (TTL 6 ticks). The clock desk from “Time is just a variable”, with MaxTime 3, passes. Is the weekend bug gone? What MaxTime would you check with, and why?
2. Lookup fixed the weekend in all 228 states. Name the one assumption hidden in Lookup that a real network breaks, and say which counterexample in this lesson shows it breaking.
3. In the fixed desk, GotOk(w) accepts any “found” or “ok”, whenever it was written, while GotAbsent(w) accepts only an “absent” written after the deadline. Why the difference?
