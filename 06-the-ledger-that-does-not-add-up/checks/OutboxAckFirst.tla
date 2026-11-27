---- MODULE OutboxAckFirst ----
EXTENDS Ledger

VARIABLES fund, credit, status, outbox, held, crashed
vars == <<fund, credit, status, outbox, held, crashed>>

Init == /\ fund = Pot
        /\ credit = [l \in Loans |-> 0]
        /\ status = [l \in Loans |-> "approved"]
        /\ outbox = {}
        /\ held = {}
        /\ crashed = FALSE

Pay(l) == /\ status[l] = "approved"
          /\ status' = [status EXCEPT ![l] = "paid"]
          /\ fund' = fund - Amount[l]
          /\ outbox' = outbox \union {l}
          /\ UNCHANGED <<credit, held, crashed>>

Take(l) == /\ l \in outbox
           /\ outbox' = outbox \ {l}
           /\ held' = held \union {l}
           /\ UNCHANGED <<fund, credit, status, crashed>>

Deliver(l) == /\ l \in held
              /\ credit' = [credit EXCEPT ![l] = Amount[l]]
              /\ held' = held \ {l}
              /\ UNCHANGED <<fund, status, outbox, crashed>>

CrashRelay == /\ ~crashed
              /\ held # {}
              /\ held' = {}
              /\ crashed' = TRUE
              /\ UNCHANGED <<fund, credit, status, outbox>>

Work(l) == Pay(l) \/ Take(l) \/ Deliver(l)
Next == (\E l \in Loans : Work(l)) \/ CrashRelay
Fairness == \A l \in Loans : WF_vars(Work(l))
Spec == Init /\ [][Next]_vars /\ Fairness

Credited == SumOver(Loans, credit)
InFlight == SumOver({l \in outbox : credit[l] = 0}, Amount)
InHand == SumOver(held, Amount)
ConservedMem == fund + InFlight + InHand + Credited = Pot
AllSettled ==
  <>(outbox = {} /\ \A l \in Loans : credit[l] = Amount[l])
====
