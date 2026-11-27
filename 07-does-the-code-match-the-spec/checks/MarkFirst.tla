---- MODULE MarkFirst ----
EXTENDS Naturals

Workers == {"A", "B"}
Loan == 4471
VARIABLES queue, status, pc, keys, transfers, crashed
vars == <<queue, status, pc, keys, transfers, crashed>>

Init == /\ queue = "visible"
        /\ status = "approved"
        /\ pc = [w \in Workers |-> "idle"]
        /\ keys = {}
        /\ transfers = 0
        /\ crashed = FALSE

Receive(w) == /\ pc[w] = "idle"
              /\ queue = "visible"
              /\ queue' = "hidden"
              /\ pc' = [pc EXCEPT ![w] = "claimed"]
              /\ UNCHANGED <<status, keys, transfers, crashed>>

Expire == /\ queue = "hidden"
          /\ queue' = "visible"
          /\ UNCHANGED <<status, pc, keys, transfers, crashed>>

Send(w) == /\ pc[w] = "marked"
           /\ pc' = [pc EXCEPT ![w] = "sent"]
           /\ UNCHANGED <<queue, status, keys,
                           transfers, crashed>>

Confirm(w) == /\ pc[w] = "sent"
              /\ transfers' = IF Loan \in keys THEN transfers
                                               ELSE transfers + 1
              /\ keys' = keys \union {Loan}
              /\ pc' = [pc EXCEPT ![w] = "done"]
              /\ UNCHANGED <<queue, status, crashed>>

Mark(w) == /\ pc[w] = "claimed"
           /\ status' = "paid"
           /\ queue' = "deleted"
           /\ pc' = [pc EXCEPT ![w] = "marked"]
           /\ UNCHANGED <<keys, transfers, crashed>>

Crash(w) == /\ ~crashed
            /\ pc[w] \in {"claimed", "marked", "sent"}
            /\ pc' = [pc EXCEPT ![w] = "idle"]
            /\ crashed' = TRUE
            /\ UNCHANGED <<queue, status, keys, transfers>>

Work(w) == Receive(w) \/ Send(w) \/ Mark(w)

Next == \/ Expire
        \/ \E w \in Workers : Work(w) \/ Confirm(w) \/ Crash(w)

Fairness == /\ \A w \in Workers : WF_vars(Work(w))
            /\ \A w \in Workers : WF_vars(Confirm(w))
            /\ WF_vars(Expire)

Spec == Init /\ [][Next]_vars /\ Fairness

PaidAtBank == IF transfers > 0 THEN "paid" ELSE "approved"

Abstract == INSTANCE PayOnce
              WITH status <- PaidAtBank, transfers <- transfers

PaidAtSend ==
  IF \E w \in Workers : pc[w] \in {"sent", "confirmed", "done"}
  THEN "paid" ELSE "approved"

AtSend == INSTANCE PayOnce
            WITH status <- PaidAtSend, transfers <- transfers

AtTable == INSTANCE PayOnce

Trivial == INSTANCE PayOnce
             WITH status <- "approved", transfers <- 0

Refines == Abstract!Spec
RefinesAtSend == AtSend!Spec
RefinesAtTable == AtTable!Spec
RefinesTrivial == Trivial!Spec
RefinesSafety == Abstract!Init /\ [][Abstract!Pay]_Abstract!avars
NoDoublePayout == transfers <= 1
TablePaid == <>(status = "paid")
BooksSay == IF status = "paid" THEN 1 ELSE 0
Liar == INSTANCE PayOnce WITH transfers <- BooksSay
RefinesLiar == Liar!Spec
====
