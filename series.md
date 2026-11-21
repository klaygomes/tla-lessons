# The payout desk: lessons in TLA+

Source: none on file; an original course on TLA+ and the TLC model checker, written from general knowledge. Every number a lesson states is computed by a checker script kept in that lesson's `checks/` folder.
Audience: experienced software engineers (TypeScript, AWS, SQL) with no formal methods background.
Language: English.
Rungs: prose, figures, page

## The world

You run the payout desk at Linden, a small (fictional) lender that funds small businesses: bakeries, repair shops, a florist who needs a second van. When a loan is approved, your service sends the money through the bank and marks the loan paid. Workers run in parallel, machines restart during deploys, the bank's API times out and sometimes answers twice. Every lesson opens on a bug a customer or the finance team notices, and ends when you fix it yourself in a lab.

## Lessons

Lesson pages are an original course. Each lesson assumes only the lessons before it.

| # | Lesson | Bug | Fix | New terms | Page | Status |
|---|---|---|---|---|---|---|
| 1 | One loan, paid twice | two workers both read loan 4471 as approved and both transfer €50,000 | make check and claim one atomic step (a conditional update), checked with 2 and 3 workers | variable, state, step, action, behavior, initial condition, next-state relation, reachable state, invariant, model checker, counterexample, atomic | | 01-one-loan-paid-twice/3-page/3-page.html | page built, waiting on review |

## Course plan

| # | Title | Question |
|---|---|---|
| 1 | One loan, paid twice | Why does a five-line payout pay the bakery twice when every test passes? |
| 2 | The loan nobody paid | The fix never pays twice, so why does a loan sit claimed forever after a deploy? |
| 3 | The bank that answered twice | When the bank times out and you retry, how do you send the money exactly once? |
| 4 | A desk too big to check | How do you keep the checker finishing when workers, loans and retries multiply? |
| 5 | Writing the worker as code | How do you write the worker as a program and still decide what counts as one step? |
| 6 | The ledger that does not add up | How do you move money between two ledgers so that neither ever shows it twice or not at all? |
| 7 | Does the code match the spec? | How do you show the real queue-and-claim design does what the one-line spec promises? |
| 8 | When checking is not enough | The checker passed on three workers, so how do you know it holds for three hundred? |

## Conventions every lesson keeps

- The state of the payout desk: `status` of each loan (approved, claimed, paid), `pc` of each worker (idle, checked or claimed, sent, done), `transfers` the bank has made.
- Workers are named A, B, C. The running example is loan 4471, €50,000, to the bakery on the harbour.
- TLA+ in ```tla fences, kept at 66 characters per line; Python mirrors in ```python fences that print the number the prose states.
- Every formula is read aloud after it appears: each symbol in words, then the whole as one bold sentence.

## Glossary

- variable: one named piece of the system's state (lesson 1)
- state: an assignment of values to every variable (lesson 1)
- step: a change from one state to the next, with nothing else happening during it (lesson 1)
- action: a formula about a pair of states, unprimed for before and primed for after, describing a kind of step (lesson 1)
- behavior: a sequence of states, each following from the one before by one step (lesson 1)
- initial condition: the formula `Init`, saying which states a behavior may start in (lesson 1)
- next-state relation: the formula `Next`, the "or" of the actions, saying which steps are allowed (lesson 1)
- reachable state: a state some behavior reaches (lesson 1)
- invariant: a property of a single state that must hold in every reachable state (lesson 1)
- model checker: a program that visits every reachable state and checks the invariant; TLC for TLA+ (lesson 1)
- counterexample: a behavior from an initial state to a state that breaks the invariant (lesson 1)
- atomic: describes an action that happens in one step, with no other worker acting in the middle (lesson 1)

## Next bug

After the atomic Claim, add `Crash(w)`: a worker restarts after claiming and before sending. NoDoublePayout still holds, and loan 4471 stays claimed forever. Nobody is paid twice; nobody is paid at all.
