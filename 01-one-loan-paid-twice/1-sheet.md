# One Loan, Paid Twice

Objective: after this, you can model a small concurrent system as a state machine (variables, an initial condition, actions joined into a next-state relation), write it as a TLA+ spec with primed variables and `EXCEPT`, state a safety property as an invariant, explain how a model checker explores every reachable state breadth first and returns the shortest counterexample, and fix a check-then-act race by changing the grain of a step (an atomic conditional update).

Source: none on file. Original course written from general knowledge of TLA+ (Lamport's TLA+, the TLC model checker). Every number below was computed by a Python breadth-first checker that mirrors the spec (`checks/check.py` in this lesson folder).

Bug: two payout workers both read loan 4471 as approved and both transfer €50,000; the bakery receives €100,000. Tests pass 10,000 times.
Fix: act 2 of the lab: replace Check with an atomic Claim (conditional update), with 2 workers and then 3, and the checker finds no state that breaks NoDoublePayout.

Key words: step (not "transition", "tick"), action (not "operation", "event"), state (not "snapshot", "configuration"), behavior (not "trace", "execution", "run", "history" except once as a gloss), counterexample (not "error trace"), worker (not "thread", "process", "consumer"), loan, transfer (not "payment" for the bank operation), payout desk (the system), invariant (not "assertion", "property" alone), reachable state, model checker, TLC, atomic (not "indivisible" after its definition), claim / Claim.

Terms:
- variable: one named piece of the system's state (`status`, `pc`, `transfers`).
- state: an assignment of values to every variable.
- step: a change from one state to the next; nothing else happens during it.
- action: a formula about a pair of states (unprimed: before, primed: after) describing a kind of step.
- behavior: a sequence of states, each following from the previous by one step.
- initial condition (`Init`): which states a behavior may start in.
- next-state relation (`Next`): which pairs of states are allowed steps; the "or" of the actions.
- reachable state: a state some behavior reaches.
- invariant: a property of a single state that must hold in every reachable state.
- model checker: a program that visits every reachable state and checks the invariant; TLC is the TLA+ one.
- counterexample: a behavior from an initial state to a state that breaks the invariant.
- atomic: describes an action that happens in one step, with no other worker acting in the middle.
- stuttering step: a step that leaves `vars` unchanged (named only; deferred to lesson 2).

Misconception: "the tests pass, so the code is correct." Why wrong: tests run one ordering (each worker finishes first), which is one of the only 2 safe behaviors of 20.
Second misconception: "check again before acting" or "add jitter". Why wrong: a check is its own step and the gap after it stays open; a spec has no clock, so a delay removes no ordering.
"What people get wrong" on the page: "a model is just the code again"; "a lock around payOut makes it atomic" (a mutex is per process, workers run on separate machines, the shared point is the row); "the checker passed, so the service is correct" (it covers the spec at 2 and 3 workers, not the code or 300 workers; lessons 7 and 8).

Worked examples (all from `check.py`):
1. Naive desk, 2 workers. Behavior Check(A), Check(B), Send(A), Send(B) ends with transfers 2. Safe behavior Check(A), Send(A), Mark(A), Skip(B) ends with 1. Counts: 17 reachable states, 20 complete behaviors, 18 pay twice; the 2 safe ones are "A finishes, B skips" and its mirror. Breadth-first shortest counterexample: Check(A), Send(A), Check(B), Send(B) (4 steps, 5 states). 3 workers: 75 states, 1,428 behaviors, 1,422 pay twice, shortest counterexample still 4 steps. Under a scheduler choosing uniformly among enabled steps, the chance of paying twice is 3/4 with 2 workers, 8/9 with 3 (not in the prose; for questions).
2. Recheck desk (Check, Recheck, Send, Mark; Recheck gives up when paid), 2 workers: 26 states, 70 behaviors, 60 pay twice, shortest counterexample 6 steps: Check(A), Recheck(A), Send(A), Check(B), Recheck(B), Send(B). 3 workers: 139 states, 27,294 behaviors, 27,120 pay twice.
3. Claim desk (Claim, Send, Mark; Skip when status is not approved; status in {approved, claimed, paid}): 2 workers 12 states, 6 behaviors, 0 pay twice; 3 workers 32 states, 36 behaviors, 0 pay twice. 1 worker: 4 states.

Figures (stage 2):
- [[diagram:desk]] (in "The loan that was paid twice", after the second worker starts): the payout desk as a system, drawn with stack-diagram: the approved-loans table, two identical workers A and B reading from it, the bank's transfer API, the bakery's account. Arrows: "reads status", "writes paid", "transfer". Still. stack-diagram, fonts and colours swapped for the series tokens.
- [[diagram:race]] (in "The loan that was paid twice"): two horizontal swim lanes, worker A and worker B, over one shared loan card in the middle and the bakery's account on the right. Both lanes reach "read: approved" before either reaches "transfer", then two €50,000 coins drop into the account and its balance reads €100,000 in --accent. Animated (lanes advance, coins drop), plays once with Replay; still frame shows the final state with both reads marked. diagram-design, custom timeline on its primitives.
- [[diagram:orderings]] (after the "20 behaviors, 18 pay twice" output): a waffle of 20 tiles, one per complete behavior, 18 in --accent labelled "pays twice", 2 in --ok labelled "A first" and "B first"; each tile carries its order as a tiny string of step initials (e.g. "cA cB sA sB"). Animated: tiles flip from grey to their colour one by one. Placed after the question and its answer, never above.
- [[diagram:growth]] (in "The model checker as code"): grouped bar chart on a log scale, workers 1, 2, 3 on the x axis, two bars each: behaviors (1, 20, 1,428) and reachable states (4, 17, 75); bars distinguished by fill and by hatching, values printed on the bars. Still. diagram-design bar chart.
- [[diagram:steps]]: the five TypeScript lines on the left, the four steps (Check, Send, Mark, Skip) on the right, with the gaps between steps marked as "the other worker can act here". diagram-design, a flow/annotated-code figure. Still.
- [[diagram:behavior]]: two behaviors as horizontal strips of state cards (the bad one and the test's safe one), same start state, diverging at step 2; the transfers counter highlighted in --accent where it reaches 2, --ok where the safe one ends at 1. Animated: cards slide in one step at a time; still under reduced motion.
- [[diagram:state-graph]]: the 17 reachable states as a layered graph (depth 0 to 6), edges labelled by action, the bad states (transfers 2) in --accent. Animated: breadth-first frontier lights up layer by layer and stops at the first bad state, then the counterexample path is drawn back to the start. Must not appear above the question in "How many orderings are there?" (it is placed after "The idea, named").
- [[diagram:claim]]: before/after: check-then-act as two steps with a gap where B's arrow enters, versus Claim as one step with no gap; the conditional UPDATE beside it. diagram-design comparison. Still.

Lab (stage 3), iwrzwr study to adapt: `Causal Relay` or `Coupled Nodes` (cause and effect, state; confirm by name in the catalog at page time).
- [[lab]] act 1, explore. Prediction first: "Of all the orderings of the two workers, from start to both done, how many pay the bakery twice?" Options: 1, 2, 10, 18 (of 20). Then the learner is the scheduler: two lanes (A, B), each showing its enabled steps as buttons; the state card (status, pc of A, pc of B, transfers) updates per click, the behavior grows as a strip. A "Run the checker" button animates breadth-first exploration of the 17 states and draws the shortest counterexample. A counter shows "behaviors you have tried: n of 20, paid twice: k".
- [[lab-act2]] act 2, fix the bug. Change panel: add Recheck; add random delay; workers 1/2/3; replace Check with atomic Claim. "Run the checker" shows states explored and either the counterexample or "no state breaks NoDoublePayout". Success requires: Claim on, workers ≥ 2, and a passing run at 3 workers. Feedback without giving the answer:
  - Recheck: "Still pays twice: the shortest counterexample is now 6 steps. A check is its own step." 
  - Delay: "Same 17 states, same counterexample. The spec has no clock."
  - 1 worker: "No double payout, and no second worker. The queue needs at least two."
  - Claim, 2 workers only: "Holds with 2. Try 3 before you ship."
  - Success: 12 states (2 workers), 32 states (3 workers), the bakery gets one transfer.

Concept check, answers (never shown to the learner):
1. Yes. B needs only to have checked before A marks: Check(A), Send(A), Check(B), Mark(A), Send(B) pays twice with A already marked; 3 of the 20 behaviors have Mark(A) before Send(B) and still pay twice. Look for the reason: Send(B) only requires pc of B = checked, not status = approved; the status was read once, at Check. The window is Check to Mark, not Check to Send.
2. Same length (4 steps). The shortest counterexample needs only two workers; the third can stay idle. A model checker can't find a shorter one because two Checks and two Sends are each necessary (each transfer needs its own Send, each Send needs its own Check). More workers make more states (75), not shorter bugs.
3. Yes, but later and weaker. The state after Check(A), Check(B), Send(A), Send(B) has transfers 2 and status approved, so the teammate's invariant holds there; it first fails after a Mark, shortest 5 steps (status paid, transfers 2). It would miss a double payout where neither worker reaches Mark (a crash, lesson 2's world). The lesson: state the invariant about what you actually care about (transfers), not about a proxy (status).

Next bug: with Claim and a Crash(w) action (a worker that has claimed restarts before sending), NoDoublePayout still holds, and the loan stays claimed forever. Safety is satisfied by doing nothing. Lesson 2: liveness, temporal formulas (eventually, leads-to), stuttering and fairness, and a lease that lets another worker retake a stale claim.

Assumptions:
- Confirmed in TLC 2.19 (tla2tools v1.7.4, 2026-11-21), specs in `checks/Payout.tla` and `checks/PayoutClaim.tla`: Payout violates NoDoublePayout with the counterexample Check(A), Send(A), Check(B), Send(B) (5 states), after 13 distinct states; with `-continue`, 17 distinct states and 4 violating states; PayoutClaim with 3 workers: no error, 32 distinct states. `-deadlock` and the two-line .cfg work as written.
- The conditional UPDATE being atomic under concurrent workers assumes a database where a single-row UPDATE re-evaluates its WHERE clause after waiting for a concurrent writer (true of PostgreSQL under its default isolation). Stated in the prose as a database guarantee, without naming a product.
- Python snippets 2 and 3 continue from snippet 1 (they use `next_states` and `init`); run them concatenated. The build-it assert needs `WORKERS = "ABC"` and the 3-worker `init`.
- Linden, the bakery and loan 4471 are fictional.
