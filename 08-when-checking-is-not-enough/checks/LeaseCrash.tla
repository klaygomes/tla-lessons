---- MODULE LeaseCrash ----
EXTENDS Naturals

CONSTANT Workers
VARIABLES status, pc, transfers, crashed
vars == <<status, pc, transfers, crashed>>

Init == /\ status = "approved"
        /\ pc = [w \in Workers |-> "idle"]
        /\ transfers = 0
        /\ crashed = FALSE

Claim(w) == /\ pc[w] = "idle"
            /\ status = "approved"
            /\ status' = "claimed"
            /\ pc' = [pc EXCEPT ![w] = "claimed"]
            /\ UNCHANGED <<transfers, crashed>>

Skip(w) == /\ pc[w] = "idle"
           /\ status = "paid"
           /\ pc' = [pc EXCEPT ![w] = "done"]
           /\ UNCHANGED <<status, transfers, crashed>>

Send(w) == /\ pc[w] = "claimed"
           /\ transfers' = transfers + 1
           /\ pc' = [pc EXCEPT ![w] = "sent"]
           /\ UNCHANGED <<status, crashed>>

Mark(w) == /\ pc[w] = "sent"
           /\ status' = "paid"
           /\ pc' = [pc EXCEPT ![w] = "done"]
           /\ UNCHANGED <<transfers, crashed>>

Crash(w) == /\ ~crashed
            /\ pc[w] \in {"claimed", "sent"}
            /\ pc' = [pc EXCEPT ![w] = "idle"]
            /\ crashed' = TRUE
            /\ UNCHANGED <<status, transfers>>

Expire == /\ status = "claimed"
          /\ status' = "approved"
          /\ UNCHANGED <<pc, transfers, crashed>>

Work(w) == Claim(w) \/ Skip(w) \/ Send(w) \/ Mark(w)

Next == Expire \/ \E w \in Workers : Work(w) \/ Crash(w)

Fairness == /\ \A w \in Workers : WF_vars(Work(w))
            /\ WF_vars(Expire)

Spec == Init /\ [][Next]_vars /\ Fairness

NoDoublePayout == transfers <= 1
EventuallyPaid == <>(status = "paid")
ClaimLeadsToPaid == (status = "claimed") ~> (status = "paid")
====
