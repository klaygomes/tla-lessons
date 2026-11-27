---- MODULE Outbox ----
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

Deliver(l) == /\ l \in outbox
              /\ l \notin held
              /\ credit' = [credit EXCEPT ![l] = Amount[l]]
              /\ held' = held \union {l}
              /\ UNCHANGED <<fund, status, outbox, crashed>>

DeliverNoKey(l) ==
  /\ l \in outbox
  /\ l \notin held
  /\ credit' = [credit EXCEPT ![l] = credit[l] + Amount[l]]
  /\ held' = held \union {l}
  /\ UNCHANGED <<fund, status, outbox, crashed>>

DeliverAny(l) ==
  /\ l \in outbox
  /\ credit' = [credit EXCEPT ![l] = Amount[l]]
  /\ held' = held \union {l}
  /\ UNCHANGED <<fund, status, outbox, crashed>>

DeliverAnyNoKey(l) ==
  /\ l \in outbox
  /\ credit' = [credit EXCEPT ![l] = credit[l] + Amount[l]]
  /\ held' = held \union {l}
  /\ UNCHANGED <<fund, status, outbox, crashed>>

Ack(l) == /\ l \in held
          /\ outbox' = outbox \ {l}
          /\ held' = held \ {l}
          /\ UNCHANGED <<fund, credit, status, crashed>>

CrashRelay == /\ ~crashed
              /\ held # {}
              /\ held' = {}
              /\ crashed' = TRUE
              /\ UNCHANGED <<fund, credit, status, outbox>>

Work(l) == Pay(l) \/ Deliver(l) \/ Ack(l)
Next == (\E l \in Loans : Work(l)) \/ CrashRelay
Fairness == \A l \in Loans : WF_vars(Work(l))
Spec == Init /\ [][Next]_vars /\ Fairness

Credited == SumOver(Loans, credit)
InFlight == SumOver({l \in outbox : credit[l] = 0}, Amount)
Conserved == fund + InFlight + Credited = Pot
AllSettled ==
  <>(outbox = {} /\ \A l \in Loans : credit[l] = Amount[l])
====
