---- MODULE Resume ----
EXTENDS Naturals

Workers == {"A", "B"}
VARIABLES status, owner, pc, transfers, crashed
vars == <<status, owner, pc, transfers, crashed>>

Init == /\ status = "approved"
        /\ owner = "nobody"
        /\ pc = [w \in Workers |-> "idle"]
        /\ transfers = 0
        /\ crashed = FALSE

Claim(w) == /\ pc[w] = "idle"
            /\ status = "approved"
            /\ status' = "claimed"
            /\ owner' = w
            /\ pc' = [pc EXCEPT ![w] = "claimed"]
            /\ UNCHANGED <<transfers, crashed>>

Resume(w) == /\ pc[w] = "idle"
             /\ status = "claimed"
             /\ owner = w
             /\ pc' = [pc EXCEPT ![w] = "claimed"]
             /\ UNCHANGED <<status, owner, transfers, crashed>>

Skip(w) == /\ pc[w] = "idle"
           /\ status = "paid"
           /\ pc' = [pc EXCEPT ![w] = "done"]
           /\ UNCHANGED <<status, owner, transfers, crashed>>

Send(w) == /\ pc[w] = "claimed"
           /\ transfers' = transfers + 1
           /\ pc' = [pc EXCEPT ![w] = "sent"]
           /\ UNCHANGED <<status, owner, crashed>>

Mark(w) == /\ pc[w] = "sent"
           /\ status' = "paid"
           /\ pc' = [pc EXCEPT ![w] = "done"]
           /\ UNCHANGED <<owner, transfers, crashed>>

Crash(w) == /\ ~crashed
            /\ pc[w] \in {"claimed", "sent"}
            /\ pc' = [pc EXCEPT ![w] = "idle"]
            /\ crashed' = TRUE
            /\ UNCHANGED <<status, owner, transfers>>

Work(w) == Claim(w) \/ Resume(w) \/ Skip(w) \/ Send(w) \/ Mark(w)

Next == \E w \in Workers : Work(w) \/ Crash(w)

Fairness == \A w \in Workers : WF_vars(Work(w))

Spec == Init /\ [][Next]_vars /\ Fairness

NoDoublePayout == transfers <= 1
EventuallyPaid == <>(status = "paid")
ClaimLeadsToPaid == (status = "claimed") ~> (status = "paid")
====
