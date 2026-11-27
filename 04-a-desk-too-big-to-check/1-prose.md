# A Desk Too Big to Check

## A model that never finishes

Finance has started to trust the checker. After lesson 2, the desk resumes its own claims and sends every transfer with the loan’s id as the idempotency key, and TLC said so in 23 states. After lesson 3, it survives the weekend too: a worker resends only inside a window shorter than the bank’s memory, the bank refuses a request that arrives after its deadline, and once the window has closed the worker asks the bank instead of resending. And everyone now knows that a reply can be lost on its way back, or simply arrive late. So on Friday the head of finance came to your desk with a request that sounded entirely reasonable.

“Check the real desk,” she said. “Three workers, like production. Not one loan: the bakery’s 4471, and the florist, who has a van loan with us already and has just been approved for a second van. And the bank times out, so the workers retry. Check all of that.”

You wrote it down. Three workers, A, B and C. Three loans, 4471 for the bakery, 4472 and 4473 for the florist’s two vans. And a new action for the retry: a worker sends the transfer, the bank pays, the reply is lost on its way back, and the worker, hearing nothing, will send again. Finance wanted to know how many retries had happened, so you added a counter, retries, that goes up by one each time a reply is lost. Every lost reply means one retry, so in this lesson “retries”, “lost replies” and, later, the bound MaxRetries all count the same thing. You started TLC on Friday at six and went home.

On Monday the progress line was still moving. Millions of distinct states, and the line that matters most, “states left on queue”, never reached zero.

Will it ever finish? Think about it before you read on. If you let it run all week, does the number of states stop growing?

We ran finance’s model ourselves, with one change: we told TLC to stop after 15 seconds. Here is the end of one such run, trimmed:

```text
Model checking completed. No error has been found.
9852697 states generated, 2724825 distinct states found,
4983 states left on queue.
The depth of the complete state graph search is 554.
```

Read the first line and you might ship. Don’t. “Completed” here only means TLC stopped because we asked it to. You know the first two numbers from lesson 3: every state TLC computed, repeats included, and how many different ones it found. The number to read is the third. TLC is lesson 1’s breadth-first search, and the queue is that search’s queue: about 5,000 states that TLC has found and not yet explored. The last line, the **depth**, says how far from the start the search had reached: the number of states on the longest path it had followed, which is one more than that path’s steps. Here it is about 550. Treat all four numbers as approximate: a run stopped by the clock stops wherever the machine’s speed left it, and each run of this model prints different ones. A finished run always ends with “0 states left on queue”. This one never will, however long you wait, and by the end of this lesson you will see exactly why, and how to turn finance’s request into a model that finishes in seconds and still means something.

## Counting one loan by hand

Before we blame the size, let’s count a small desk by hand. One worker, A, one loan, 4471, and no lost replies at all. The worker can crash once, as in lesson 2. One thing differs from lesson 2’s worker: on a desk with many loans, a worker that has marked a loan paid goes back to idle, ready for the next one, so there is no “done” and no Skip.

Start with no crash. The loan is approved and A is idle. A claims it. A sends, and the bank pays. A marks it paid. That is four states, one after another:

| | status | pc of A | transfers | crashed |
|---|---|---|---|---|
| 1 | approved | idle | 0 | no |
| 2 | claimed | claimed | 0 | no |
| 3 | claimed | sent | 1 | no |
| 4 | paid | idle | 1 | no |

Now let the crash land. It can hit in state 2 or in state 3, the two states where A holds the loan. Ask yourself how many new states each crash opens up before you look.

A crash in state 2 gives a state where the loan is claimed, A is idle and no money has moved. From there A resumes its own claim (claimed again, now with the crash behind it), sends, and marks. That is four new states, because “crashed” is now yes in every one of them. A crash in state 3 gives a state with the money already sent, and a resume from there gives one more. Then A sends again, and the bank recognises the key and pays nothing, so the state after that Send is the same as one we already have from the first crash. Two more new states.

So 4 + 4 + 2 = 10 states. TLC agrees: 10 distinct states for one worker, one loan, no lost replies.

Now let the bank lose one reply per run. In the no-crash run, A is at claimed in state 2; instead of hearing the bank’s answer, it may lose it: the bank pays, A stays at claimed, and the retry counter reads 1. That state is new, and so is everything after it: the same send, mark and crash as before, now each with one lost reply behind it. Here is the count, with lesson 2’s search and the state cut down to status, A’s pc, whether money has moved, the crash, and lost replies. The first rule is Claim when the loan is approved and Resume when it is claimed:

```python
def steps(s, max_lost):
    status, pc, sent, crashed, lost = s
    if pc == "idle" and status != "paid":
        yield "claimed", "claimed", sent, crashed, lost
    if pc == "claimed":
        yield status, "sent", 1, crashed, lost
        if lost < max_lost:
            yield status, pc, 1, crashed, lost + 1
    if pc == "sent":
        yield "paid", "idle", sent, crashed, lost
    if pc != "idle" and not crashed:
        yield status, "idle", sent, True, lost

for max_lost in (0, 1):
    seen, todo = set(), [("approved", "idle", 0, False, 0)]
    while todo:
        s = todo.pop()
        if s not in seen:
            seen.add(s)
            todo.extend(steps(s, max_lost))
    print(max_lost, len(seen))
```

```text
0 10
1 17
```

Ten without lost replies, as we counted, and 17 with one: seven new states, the lost reply itself and the six that can follow it: send and mark, or crash, resume, send and mark. (A crash after that send lands on a state already counted.) TLC agrees on both.

## Adding loans and workers

Now grow it. Here is TLC on the same desk with at most one lost reply per run, as the workers and loans grow. Every cell is a real run, and each run finished with an empty queue.

| | 1 loan | 2 loans | 3 loans | 4 loans |
|---|---|---|---|---|
| 1 worker | 17 | 85 | 314 | 997 |
| 2 workers | 33 | 327 | 2,379 | 14,325 |
| 3 workers | 49 | 727 | 8,218 | 77,845 |
| 4 workers | 65 | 1,285 | 19,853 | 261,673 |

Before you read the bottom right, cover it and look at the row for 3 workers. From 727 to 8,218 is about eleven times. If you add a fourth loan, what do you expect?

It is 77,845, nine and a half times more. Each loan multiplies the count, it doesn’t add to it. And the multiplier itself grows with the workers: one worker multiplies by about 3 to 5 per loan, three workers by about 9 to 15.

Why multiply? Because a state is a combination. Loan 4471 can be approved, claimed or paid, with or without its key at the bank; loan 4472 can be any of those too, independently; and each worker can be idle, or holding any loan, claimed or sent. The number of combinations is the product of the choices, and the checker has to visit every combination the desk can actually reach. Not all combinations are reachable (an idle worker never holds a loan, two workers never hold the same one), which is why the factor isn’t a clean power. But the shape is a power: add one more independent thing, and the count multiplies.

[[lab]]

This is called **state explosion**: the number of reachable states grows exponentially, multiplying by some factor with every worker, loan or value you add. It is the main thing that stops a model checker. TLC itself is fast: on our machine it reported 7 seconds for the 261,673 states of four workers and four loans, against 5 seconds for the 17 states of the smallest desk, so most of a small run is start-up. The trouble is the factors: at three workers each loan you add costs about ten times more, and a few of those turn seconds into days.

[[diagram:explosion]]

Yet state explosion is *not* why finance’s model never finished. Three workers and three loans with one lost reply is 8,218 states, a few seconds of work. Something else is going on.

## The counter that never stops

Look at the retry again. A worker holds loan 4471, sends, and the reply is lost. The bank has paid, the key is stored, and the worker is still at claimed, so it will send again. What changed? Only retries, from 0 to 1.

Now let the reply be lost again. The bank recognises the key and pays nothing. The worker is still at claimed. What changed? retries, from 1 to 2.

Here is that loop in Python, with the state cut down to the three things that matter: the worker’s pc, the transfers, and retries. A model checker’s whole defence against infinity is its set of seen states, so we keep one.

```python
seen = set()
state = ("claimed", 1, 0)
for step in range(5):
    print(step, state, "seen before" if state in seen else "new")
    seen.add(state)
    pc, transfers, retries = state
    state = (pc, transfers, retries + 1)
```

```text
0 ('claimed', 1, 0) new
1 ('claimed', 1, 1) new
2 ('claimed', 1, 2) new
3 ('claimed', 1, 3) new
4 ('claimed', 1, 4) new
```

Every state is new. Nothing about the desk changed, nobody was paid, no money moved, and yet the checker can never say “I have been here before”, because the counter makes every lap of the loop a different state. A variable that can keep growing without limit, like this one, is called an **unbounded counter**, and a spec with one has infinitely many reachable states. TLC explores them breadth first, as in lesson 1, so it never runs out of new ones.

That explains both numbers from the stopped run. The queue sat at about 5,000 because each level of the search holds roughly the same desk positions with one more retry. The depth, about 550, is simply where the clock stopped the search; it climbs for as long as you let it run, and the queue never drains.

[[diagram:counter]]

So finance’s model has two separate problems. The counter makes it infinite, which is why it never finishes. The explosion makes it large, which is why the finite version still grows fast. They need different tools, and we will use both. First, though, the spec itself, because finance’s request is mostly about its *constants*.

## The desk, piece by piece

Lesson 2’s spec had one loan, 4471, written into it, and two workers named in a definition. Finance wants different sizes, and you will want to run the same spec at many sizes. So the sizes come out of the spec and into the configuration file.

```tla
CONSTANTS Workers, Loans, MaxRetries, Nobody, NoLoan
```

You met **constants** in lesson 3, where MaxTime and TTL were declared this way: names whose value never changes during a behavior and is chosen from outside, in the configuration file. Read the line aloud: there are five constants; Workers is the set of workers, Loans the set of loans, MaxRetries the most replies the bank may lose in one run, and Nobody and NoLoan are placeholders: Nobody is the owner of a loan nobody has claimed, and NoLoan is what a worker holds when it holds no loan. **The spec talks about any set of workers and any set of loans, and the configuration file says which.**

```python
workers = ["A", "B", "C"]
loans = ["L4471", "L4472", "L4473"]
status = {l: "approved" for l in loans}
pc = {w: "idle" for w in workers}
print(status)
print(pc)
```

```text
{'L4471': 'approved', 'L4472': 'approved', 'L4473': 'approved'}
{'A': 'idle', 'B': 'idle', 'C': 'idle'}
```

That Python already shows the start state, so here it is in TLA+. Every per-loan variable is now a function over Loans:

```tla
Init == /\ status = [l \in Loans |-> "approved"]
        /\ owner = [l \in Loans |-> Nobody]
        /\ pc = [w \in Workers |-> "idle"]
        /\ held = [w \in Workers |-> NoLoan]
        /\ transfers = [l \in Loans |-> 0]
        /\ keys = {}
        /\ crashed = FALSE
        /\ retries = 0
```

You met the square brackets in lesson 1’s pc: `[w \in Workers |-> "idle"]` is the function that maps every worker to idle, like the dict comprehension above. Read each line: every loan starts approved; every loan has owner Nobody; every worker is idle; every worker holds NoLoan; every loan has had zero transfers; the bank has no keys; nobody has crashed; no reply has been lost. **At the start, every loan waits and every worker is free.** Two variables are new since lesson 2. held records which loan each worker is working on, because a worker now has a choice. retries counts lost replies. Lesson 3’s clock stays out of this spec, and the bank keeps its keys forever, as in lesson 2: a clock is a counter too, and this lesson is about what counters do to a checker. Lesson 3’s network stays out as well. Instead of messages in flight, a lost reply here is one step, Lost, which you will meet below.

### The configuration file

Here is the configuration that runs the spec with two workers and two loans:

```text
CONSTANTS
  Workers = {A, B}
  Loans = {L4471, L4472}
  MaxRetries = 1
  Nobody = Nobody
  NoLoan = NoLoan
SPECIFICATION Spec
INVARIANT NoDoublePayout
PROPERTY ClaimLeadsToPaid
```

Lesson 3 wrote one CONSTANTS line per value. Here one CONSTANTS heading lists all five, one per line, indented under it; the meaning is the same. Workers = {A, B} sets Workers to a set of two members, written in braces as in the spec.

What are A, B and L4471 here? Not strings: they have no quotes. They are **model values**: names TLC invents for the run, each equal only to itself and different from everything else. You can’t add one to a number or compare it with a string; you can only ask whether two of them are the same. That is all a worker’s name or a loan’s id is good for in this spec, and the restriction pays off in a moment. `Nobody = Nobody` reads oddly, but it just says: make Nobody a model value too, so it can never be mistaken for a real worker.

### One action, many loans

Claim now names the loan it claims:

```tla
Claim(w, l) == /\ pc[w] = "idle"
               /\ status[l] = "approved"
               /\ status' = [status EXCEPT ![l] = "claimed"]
               /\ owner' = [owner EXCEPT ![l] = w]
               /\ pc' = [pc EXCEPT ![w] = "claimed"]
               /\ held' = [held EXCEPT ![w] = l]
               /\ UNCHANGED <<transfers, keys, crashed, retries>>
```

Line by line: worker w is idle; loan l is approved; afterwards loan l is claimed; its owner is w; w has claimed; w holds l; nothing else changes. **Claim(w, l) is lesson 1’s atomic claim, for one particular worker and one particular loan.** Resume takes a loan the same way, Mark marks the loan in held[w] instead of the one loan there used to be, and Crash empties held[w].

The next-state relation then has to choose a loan as well as a worker:

```tla
Work(w) == \/ \E l \in Loans : Claim(w, l) \/ Resume(w, l)
           \/ Send(w) \/ Lost(w) \/ Mark(w)

Next == \E w \in Workers : Work(w) \/ Crash(w)
```

The backwards E is lesson 1’s “there exists”, and it reaches to the end of its bullet, so “some loan l” covers both Claim and Resume. **A step of worker w claims or resumes some loan, or sends, loses a reply, or marks; a step of the desk is some worker’s work or some worker’s crash.** From the start state with three workers and three loans, how many different Claim steps are there?

```python
workers, loans = "ABC", ["L4471", "L4472", "L4473"]
status = {l: "approved" for l in loans}
pc = {w: "idle" for w in workers}
claims = [(w, l) for w in workers for l in loans
          if pc[w] == "idle" and status[l] == "approved"]
print(len(claims), claims[:2])
```

```text
9 [('A', 'L4471'), ('A', 'L4472')]
```

Nine first steps, where lesson 1’s desk had two. That fan-out at every level is the explosion, seen from one state.

### The retry

The bank’s side of a request is lesson 2’s idempotency key, now one key per loan:

```tla
Bank(l) == /\ transfers' = IF l \in keys THEN transfers
                           ELSE [transfers EXCEPT ![l] = @ + 1]
           /\ keys' = keys \union {l}
```

One new piece of notation: inside EXCEPT, the at sign `@` means “the old value at that place”, so @ + 1 is one more than before. Read it aloud: if the bank already has loan l’s key, the transfers stay as they are; otherwise loan l gets one more transfer; either way the bank now has l’s key. **The bank pays loan l only the first time it sees l’s key.**

```python
def bank(transfers, keys, l):
    if l in keys:
        return transfers, keys
    return {**transfers, l: transfers[l] + 1}, keys | {l}

t, k = {"L4471": 0, "L4472": 0}, set()
for l in ["L4471", "L4471", "L4472"]:
    t, k = bank(t, k, l)
    print(l, t, sorted(k))
```

```text
L4471 {'L4471': 1, 'L4472': 0} ['L4471']
L4471 {'L4471': 1, 'L4472': 0} ['L4471']
L4472 {'L4471': 1, 'L4472': 1} ['L4471', 'L4472']
```

Send is lesson 2’s, calling Bank(held[w]). The lost reply is new:

```tla
Lost(w) == /\ pc[w] = "claimed"
           /\ retries < MaxRetries
           /\ Bank(held[w])
           /\ retries' = retries + 1
           /\ UNCHANGED <<status, owner, pc, held, crashed>>
```

Line by line: w holds a claimed loan and is about to send; fewer than MaxRetries replies have been lost so far; the bank handles the request; one more reply has been lost; w’s pc is unchanged, so it is still at claimed and will send again. **Lost(w) is a request the bank handles whose reply never comes back, allowed only while the run’s budget of lost replies lasts.** Hold on to the second line. It is the whole difference between finance’s model and one that finishes.

```python
def lost(state, max_retries):
    pc, transfers, retries = state
    if pc != "claimed" or retries >= max_retries:
        return None
    return (pc, 1, retries + 1)

state = ("claimed", 0, 0)
for _ in range(3):
    print(state)
    state = lost(state, 2)
print(state)
```

```text
('claimed', 0, 0)
('claimed', 1, 1)
('claimed', 1, 2)
None
```

With MaxRetries at 2, the third lost reply is not allowed, and the loop stops.

### The promises, for every loan

NoDoublePayout now covers every loan, and lesson 2’s leads-to gets a for-every in front, as its “What people get wrong” section asked:

```tla
NoDoublePayout == \A l \in Loans : transfers[l] <= 1

ClaimLeadsToPaid ==
    \A l \in Loans :
        (status[l] = "claimed") ~> (status[l] = "paid")
```

The upside-down A is “for every”, and the squiggly arrow is lesson 2’s “leads to”. **No loan ever gets two transfers; and for every loan, whenever it is claimed, it is paid then or later.**

```python
transfers = {"L4471": 1, "L4472": 0, "L4473": 2}
ok = all(t <= 1 for t in transfers.values())
bad = [l for l, t in transfers.items() if t > 1]
print(ok, bad)
```

```text
False ['L4473']
```

And leads-to, with lesson 2’s cheat of treating a behavior as a finite list:

```python
trace = ["approved", "claimed", "claimed", "paid", "paid"]
def leads_to(trace, p, q):
    return all(any(q(t) for t in trace[i:])
               for i, s in enumerate(trace) if p(s))
print(leads_to(trace, lambda s: s == "claimed",
               lambda s: s == "paid"))
print(leads_to(trace[:3], lambda s: s == "claimed",
               lambda s: s == "paid"))
```

```text
True
False
```

Fairness is lesson 2’s, word for word: weak fairness for each worker’s Work, none for Crash. With the configuration above, TLC explores 327 states, finds no double payout, and both promises hold for both loans. With three workers and three loans: 8,218 states, both promises hold.

## Workers with no names: symmetry

Look at two states of the two-worker desk. In the first, A has claimed 4471 and B is idle. In the second, B has claimed 4471 and A is idle. Are they different?

To TLC, yes: different values of pc. To the desk, no. Swap the names A and B everywhere, and the first state becomes the second, and so does everything that can happen next: every behavior from one is a behavior from the other with the names swapped. Whatever the checker learns from one, it would learn again from the other.

How many states are hiding in that kind of duplication? Take three workers, each idle, claimed or sent, and ignore everything else:

```python
from itertools import product

shapes = ["idle", "claimed", "sent"]
states = list(product(shapes, repeat=3))
groups = {tuple(sorted(s)) for s in states}
print(len(states), "states,", len(groups), "up to renaming")
```

```text
27 states, 10 up to renaming
```

Sorting the tuple throws away who is who and keeps only how many workers are in each place. 27 states collapse into 10 groups. For the whole desk, renaming loans works the same way, as long as loans too are just names.

A **permutation** of a set is a way of renaming its members among themselves: for workers A, B, C, one permutation maps A to B, B to C and C to A. **Symmetry reduction** is telling the model checker that renaming the members of a set never changes what can happen, so it may keep one state per group of renamings and skip the rest. In TLC you name the permutations in the spec and point the configuration at them:

```tla
Perms == Permutations(Workers) \union Permutations(Loans)
```

Permutations comes from TLC, a standard module of helpers for the model checker. A spec brings in a standard module with EXTENDS on its first line after the module’s name, the way lesson 1’s spec brought in Naturals for its numbers, so this spec starts with EXTENDS Naturals, TLC. Permutations(S) is the set of all permutations of S: for three workers, 3 × 2 × 1 = 6 of them. The cup is lesson 2’s “union”, so with three workers and three loans Perms has 6 + 6 = 12 members. **Perms is every renaming of the workers and every renaming of the loans.** One line in the configuration file turns it on:

```text
SYMMETRY Perms
```

To decide which state stands for its group, the checker needs a rule that every member of the group agrees on. A simple one is: try every renaming and keep the smallest result.

```python
from itertools import permutations

pc = {"A": "claimed", "B": "idle", "C": "sent"}
names = sorted(pc)
twins = set()
for p in permutations(names):
    renamed = {p[i]: pc[w] for i, w in enumerate(names)}
    twins.add(tuple(renamed[w] for w in names))
print(len(twins), "renamings")
print("representative:", min(twins))
```

```text
6 renamings
representative: ('claimed', 'idle', 'sent')
```

Six renamings, one representative. Here is what TLC finds with SYMMETRY Perms, beside the runs without it:

| workers × loans | without symmetry | with symmetry |
|---|---|---|
| 2 × 2 | 327 | 90 |
| 3 × 3 | 8,218 | 323 |
| 3 × 4 | 77,845 | 823 |
| 4 × 4 | 261,673 | 968 |

[[diagram:symmetry]]

The biggest desk shrank 270 times. With four workers and four loans there are 4 × 3 × 2 × 1 = 24 ways to rename the workers and 24 for the loans, so at most 576 states per group, and most groups are smaller than that because many states look the same under several renamings.

This is where model values earn their keep. Symmetry is only sound if the spec really never tells the members apart. A model value can’t be compared, sorted or added, so a spec written with model values for workers and loans has no way to treat A differently from B by accident. If Loans were the numbers 4471, 4472 and 4473, a line like “claim the smallest approved loan first” would make them different, and gluing their states together would be a lie.

### Symmetry and liveness

Turn on symmetry with the PROPERTY line in place, and TLC says this before it starts:

> “Warning: Declaring symmetry during liveness checking is dangerous. It might cause TLC to miss violations of the stated liveness properties. Please check liveness without symmetry defined.”

Why would safety be fine and liveness not? An invariant is about one state at a time, and every state in a group passes or fails it together, so one representative is enough. A liveness counterexample is a lasso: a path into a loop, a chain of particular steps between particular states. When the checker keeps one state per group, the steps between groups are no longer steps between real states. A loop in the glued graph need not be a loop the desk can really run, and a real loop can be hidden inside the gluing. TLC can’t be sure the lassos it finds, or fails to find, are real, and it tells you so.

So the rule is simple. **Check safety with symmetry on the big model. Check liveness without symmetry, on a model small enough to finish.** On the desk: NoDoublePayout with symmetry at 3 × 4 in 823 states, and ClaimLeadsToPaid without symmetry at 3 × 3 in 8,218.

## Making a counter finite

Back to the counter, the real reason finance’s model never ended. There are three ways to make an unbounded counter finite, and each one quietly changes what you checked. Let’s run all three on the two-worker, two-loan desk.

### Bound it in the spec

That is what `retries < MaxRetries` in Lost does. The spec now says: the bank loses at most MaxRetries replies per run. That is an assumption about the world, written down in the spec where everyone can read it, exactly like lesson 2’s “one crash per run”. Here is what it costs:

| MaxRetries | 0 | 1 | 2 | 3 | 4 |
|---|---|---|---|---|---|
| states (2 × 2) | 157 | 327 | 499 | 671 | 843 |

Each extra lost reply adds about 170 states: steady growth, not explosion, because each value one global counter can take adds roughly one more copy of the desk, rather than multiplying it by a new combination per loan. And you can ask the useful question directly: does anything new go wrong at 2, 3 or 4? Here, no. Every run passes both properties.

### Delete it

Who reads retries? Not NoDoublePayout, which reads transfers. Not ClaimLeadsToPaid, which reads status. Only the guard in Lost does, and only to cap the loop. So try a spec with no retries variable at all, where Lost just hands the request to the bank and leaves the worker at claimed:

```tla
Lost(w) == /\ pc[w] = "claimed"
           /\ Bank(held[w])
           /\ UNCHANGED <<status, owner, pc, held, crashed>>
```

**Lost(w) is a request the bank handles whose reply never comes back, as often as you like, with nothing counting.** Now look at the second lost reply for the same loan:

```python
def lost(state):
    pc, transfers, keys = state
    return pc, 1, keys | {"L4471"}

first = lost(("claimed", 0, frozenset()))
second = lost(first)
print(first == second)
```

```text
True
```

The state after the second lost reply is the state before it. The loop that never ended is now a step that changes nothing, a stuttering step, and the checker has seen that state already. TLC: 197 states at 2 × 2, 5,167 at 3 × 3, finished, both properties hold.

But notice what you just assumed. In lesson 2, weak fairness only counts steps that change something; a stuttering step never counts as doing Work. So once the key is stored, an endless run of lost replies is just stuttering, and fairness forbids a worker that could send from stuttering forever. Without the counter, the spec says “replies get lost, but not forever”. That might be true of your bank. It is still an assumption, and this time you didn’t write it down: it slipped in when the counter left.

### Cut it with a constraint

The third way leaves the spec alone and tells TLC where to stop looking. A **state constraint** is a formula about one state, named on a CONSTRAINT line in the configuration file. TLC still generates a state that breaks it, and still checks the invariant on it, but never takes a step from it. Finance’s unbounded spec, with one line added:

```tla
Bounds == retries <= MaxRetries
```

The less-than-or-equal sign is “at most”. **Bounds is true of a state when at most MaxRetries replies have been lost.** With MaxRetries at 1, a state with retries 1 passes and one with retries 2 doesn’t. Here is the breadth-first search on the retry loop alone, cut by Bounds, with a state reduced to its retries:

```python
kept, cut, queue = [], [], [0]
while queue:
    retries = queue.pop(0)
    if retries > 1:
        cut.append(retries)
        continue
    kept.append(retries)
    queue.append(retries + 1)
print("steps taken from retries", kept)
print("generated, no step taken:", cut)
```

```text
steps taken from retries [0, 1]
generated, no step taken: [2]
```

The state with two lost replies is generated and checked, and the search stops there. The endless loop of lost replies is cut after its second lap.

With CONSTRAINT Bounds and MaxRetries 1, finance’s 3 × 3 model finishes: 8,218 distinct states, exactly the bounded spec’s number. Look at the other number, though: 28,090 states generated against the bounded spec’s 23,752. The difference is the states TLC built with retries at 2, checked against the invariant, and threw away. The output doesn’t tell you what they were. It doesn’t tell you what lay behind them, either.

[[diagram:constraint]]

Add the PROPERTY line, and TLC warns again, before it starts: “Declaring state or action constraints during liveness checking is dangerous”. (An action constraint is the same kind of cut, written about a step instead of a state.) Here, you can see why. In finance’s spec, the bank may lose every reply forever, and each lost reply changes retries, so it counts as Work: a worker can be fair and still never send. That behavior never pays the loan. It is a real liveness violation of the unbounded spec. With the constraint, the checker takes no step after the second lost reply, so it never sees that endless behavior, and the run says “No error has been found.”

Three ways, one lesson. **Making a counter finite always adds an assumption. A bound in the spec writes it down; deleting the counter can hide it inside fairness; a constraint hides it in the configuration file, where only the generated count hints that anything was cut.**

## How small is small enough?

Finance’s next question is the right one. “Fine, it finishes for three workers. We run thirty. Does a check on three mean anything?”

Let’s gather evidence. Take the desk without the idempotency key, the bug from lesson 2, and check it at three sizes:

| workers × loans | shortest counterexample | states explored |
|---|---|---|
| 1 × 1 | Claim, Lost, Send | 8 |
| 2 × 2 | Claim, Lost, Send | 23 |
| 3 × 3 | Claim, Lost, Send | 62 |

The same three steps every time. A bigger desk didn’t find a different bug; it found the same one after exploring more states. And every bug in this course so far fits in a small desk: lesson 1’s double payout needed two workers and one loan, and lesson 2’s stranded claim needed one crash.

That pattern has a name. The **small-scope hypothesis** says that most bugs in a design show up in some small instance of it: a few processes, a few items, a few steps. It comes from people who checked many real designs and kept seeing it. It is an observation, not a theorem. Nothing in it promises that *your* bug is small, and lesson 8 will come back to what a check on three workers can and can’t tell you about thirty.

It has a second half that people skip: the small instance still has to contain the bug’s shape. Here is a bug to make that concrete. Suppose a teammate “simplifies” the idempotency key to one key per customer account instead of one per loan. The florist’s two van loans share an account; the bakery has its own.

```tla
Account(l) == IF l \in FloristLoans THEN Florist ELSE l

BankByAccount(l) ==
    /\ transfers' = IF Account(l) \in keys THEN transfers
                    ELSE [transfers EXCEPT ![l] = @ + 1]
    /\ keys' = keys \union {Account(l)}
```

FloristLoans and Florist are two more constants: the florist’s loans, and a model value for the florist’s account. Read it aloud: a loan’s account is the florist’s if it is one of the florist’s loans, and the loan itself otherwise; the bank pays loan l only if it has no key for l’s account yet, and stores that account’s key either way. **The bank now pays at most once per customer, not once per loan.**

```python
florist = {"L4472", "L4473"}
def account(l):
    return "florist" if l in florist else l

keys, transfers = set(), {}
for l in ["L4471", "L4472", "L4473"]:
    new = account(l) not in keys
    transfers[l] = 1 if new else 0
    keys.add(account(l))
print(transfers)
```

```text
{'L4471': 1, 'L4472': 1, 'L4473': 0}
```

The second van is never paid. To catch it you need one more invariant, because NoDoublePayout is perfectly happy with zero:

```tla
PaidMeansMoney ==
    \A l \in Loans : status[l] = "paid" => transfers[l] = 1
```

The double arrow is “implies”. **Every loan marked paid has had exactly one transfer.**

```python
status = {"L4471": "paid", "L4472": "paid", "L4473": "paid"}
transfers = {"L4471": 1, "L4472": 1, "L4473": 0}
ok = all(status[l] != "paid" or transfers[l] == 1
         for l in status)
print(ok)
```

```text
False
```

Now predict. With three workers, the bakery’s loan and only one florist loan, does TLC find the bug?

It doesn’t: 727 states, no error. With the second van added, it fails in five steps: Claim, Send, Claim, Send, Mark. The scope was small in both runs. Only the second contained the bug’s shape, two loans on one account. That is why finance was right to ask for the florist’s second van, and why “small” means “small, but with every kind of thing that can collide”.

### A budget that hides the bug

One more trap, because it is the first thing people reach for when a model won’t finish: a limit on depth. TLC can tell a constraint how many steps a state is from the start, through TLCGet with the argument “level”:

```tla
Budget == TLCGet("level") < 4
```

TLCGet is another operator from the TLC module, and with “level” it gives the current state’s distance from the start in steps. **Budget is true of a state fewer than four steps from the start.** As a CONSTRAINT, it lets TLC take steps only from states up to three steps deep:

```python
steps = ["Claim", "Send", "Claim", "Send", "Mark"]
budget = 4
explored = [s for level, s in enumerate(steps, 1)
            if level <= budget]
print(explored)
print("bug needs", len(steps), "steps")
```

```text
['Claim', 'Send', 'Claim', 'Send']
bug needs 5 steps
```

TLC with the budget, on the florist desk with both vans: 232 states, “No error has been found”, 0 states left on queue. TLC reports a depth of 4: the states up to three steps from the start. The states its fourth step reaches are generated and checked against the invariant, then cut, so they are not among the 232. The fifth step, the one that breaks PaidMeansMoney, is never taken. The bug is one step past the edge. The run looks exactly like a passing run, because, as far as TLC is concerned, it is one.

[[diagram:small-scope]]

**Build it.** In a reduced desk, each of three workers is idle, or has claimed or sent one of two loans, L4471 or L4472: five shapes per worker: idle with no loan, and claimed or sent with either loan, written as (pc, loan) pairs. Generate every combination for three workers. Then write `canon(state, loans_too)` that returns one representative per group: sort the workers, and when loans_too is true, also try both renamings of the two loans and keep the smallest. Your counts should pass:

```python
assert len(states) == 125
assert len(workers_only) == 35
assert len(both) == 19
```

## Fix the bug

The bug in this lesson isn’t in the desk. It is in finance’s model, which never finishes, and in a team that is about to believe a run that stopped.

In the lab below, you get finance’s desk: workers, loans, and lost replies that the counter turns into an endless queue. Your panel: workers and loans, how the counter is handled (left unbounded, bounded in the spec with MaxRetries, deleted, or cut by a CONSTRAINT), SYMMETRY on or off, and which promise you check, NoDoublePayout or ClaimLeadsToPaid. Each run reports its states, its queue and any warning TLC would print.

The model counts as fixed when you have two runs that you would sign: NoDoublePayout at finance’s full size, three workers and three loans, finishing with an empty queue; and ClaimLeadsToPaid on a desk of at least two workers and two loans, finishing, with no symmetry. Both runs must finish because the spec is finite, not because TLC was told where to stop looking.

[[lab-act2]]

## What people get wrong

**“No error has been found means it passed.”** Read the queue line first. A run stopped by a time limit prints the same sentence with states still waiting. And a run cut by a constraint prints it with an empty queue, having never looked past the cut.

**“Bigger models are safer models.”** The 3 × 3 desk without the key failed in the same three steps as 1 × 1. Past the size where every kind of collision fits, a bigger model mostly costs time. Spend the time on shapes instead: the second loan on the same account, the crash at each point, the lost reply.

**“Symmetry is a free speed-up.”** It is free only when the members really are interchangeable, which model values help guarantee, and only for safety. Use it to check invariants on the big model, and check liveness without it.

**“A constraint is a cheaper way to write a bound.”** It gives the same count of distinct states, and it hides different things: a guard in the spec changes what the system may do and says so; a constraint leaves the spec claiming behaviors the checker never looked at.

## Recap and the next bug

Finance’s model never finished for two reasons. **State explosion**: every loan or worker multiplies the reachable states, from 8,218 at three workers and three loans to 77,845 with a fourth loan. And an **unbounded counter**: retries made every lost reply a new state, so the queue could never empty. **Constants**, met in lesson 3, move the sizes into the configuration file, and **model values** make workers and loans plain names, which is what lets **symmetry reduction** keep one state per group of renamings: 77,845 down to 823, safe for invariants, never for liveness. A counter becomes finite by a bound in the spec, which writes the assumption down; by deleting it, which may hide the assumption in fairness; or by a **state constraint**, which hides it in the configuration file. And the **small-scope hypothesis** says most bugs fit in a small model, as long as the model holds the bug’s shape.

Finance has its two runs, and signs off. Now look at what the spec has become. Every action is a block of lines joined by “and”, and every one ends with a list of the variables it does not touch. The worker’s pc is spelled out by hand. Lost does a whole request in one atomic step, because we chose it that way.

The TypeScript worker is nothing like that. It reads top to bottom, and every await in it, on the database or on the bank, is a place where another worker can run or a deploy can kill the process. Which of its lines is one of the spec’s steps? Nobody wrote that down. The spec’s steps were chosen by hand, action by action; the code’s steps are wherever an await happens to be.

Next lesson, a new engineer finds the specs too hard to read and rewrites the worker as a program. The checker passes, and production disagrees. You will write the worker as code too, and learn how to say exactly which lines count as one step.

## Concept check

Write your answers down before you move on.

1. Start from the spec with the retries counter deleted. A teammate adds a variable, attempts, a function from loans to the number of lost replies for that loan, “for the dashboard”. Nothing reads it. Is the spec still finite? If not, which of the three ways would you use to fix it, and what assumption does that way add? Does ClaimLeadsToPaid still hold?
2. Finance checks NoDoublePayout with SYMMETRY Perms at three workers and four loans and gets 823 states. Then they add an invariant, “loan L4471 is paid before loan L4472 is claimed”. Can they keep the symmetry? Why or why not?
3. A run ends with “Model checking completed. No error has been found.” and “0 states left on queue”. Name two ways the bug could still be in the spec, using only what this lesson showed.
