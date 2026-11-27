---- MODULE OutboxTwoTxn ----
EXTENDS Ledger

VARIABLES fund, credit, status, outbox, held, crashed, pc
vars == <<fund, credit, status, outbox, held, crashed, pc>>

Init == /\ fund = Pot
        /\ credit = [l \in Loans |-> 0]
        /\ status = [l \in Loans |-> "approved"]
        /\ outbox = {}
        /\ held = {}
        /\ crashed = FALSE
        /\ pc = [l \in Loans |-> "idle"]

Debit(l) == /\ status[l] = "approved"
            /\ pc[l] = "idle"
            /\ status' = [status EXCEPT ![l] = "paid"]
            /\ fund' = fund - Amount[l]
            /\ pc' = [pc EXCEPT ![l] = "debited"]
            /\ UNCHANGED <<credit, outbox, held, crashed>>

Enqueue(l) == /\ pc[l] = "debited"
              /\ outbox' = outbox \union {l}
              /\ pc' = [pc EXCEPT ![l] = "idle"]
              /\ UNCHANGED <<fund, credit, status, held, crashed>>

CrashWorker(l) == /\ ~crashed
                  /\ pc[l] = "debited"
                  /\ pc' = [pc EXCEPT ![l] = "idle"]
                  /\ crashed' = TRUE
                  /\ UNCHANGED <<fund, credit, status, outbox, held>>

Deliver(l) == /\ l \in outbox
              /\ l \notin held
              /\ credit' = [credit EXCEPT ![l] = Amount[l]]
              /\ held' = held \union {l}
              /\ UNCHANGED <<fund, status, outbox, crashed, pc>>

Ack(l) == /\ l \in held
          /\ outbox' = outbox \ {l}
          /\ held' = held \ {l}
          /\ UNCHANGED <<fund, credit, status, crashed, pc>>

CrashRelay == /\ ~crashed
              /\ held # {}
              /\ held' = {}
              /\ crashed' = TRUE
              /\ UNCHANGED <<fund, credit, status, outbox, pc>>

Work(l) == Debit(l) \/ Enqueue(l) \/ Deliver(l) \/ Ack(l)
Next == (\E l \in Loans : Work(l) \/ CrashWorker(l)) \/ CrashRelay
Fairness == \A l \in Loans : WF_vars(Work(l))
Spec == Init /\ [][Next]_vars /\ Fairness

Credited == SumOver(Loans, credit)
InFlight == SumOver({l \in outbox : credit[l] = 0}, Amount)
Conserved == fund + InFlight + Credited = Pot
AtRest == \A l \in Loans : pc[l] = "idle"
ConservedAtRest == AtRest => Conserved
AllSettled ==
  <>(outbox = {} /\ \A l \in Loans : credit[l] = Amount[l])
====
