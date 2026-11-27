---- MODULE LiveFair ----
EXTENDS Naturals

Workers == {"A", "B"}
VARIABLES status, pc, transfers
vars == <<status, pc, transfers>>

Init == /\ status = "approved"
        /\ pc = [w \in Workers |-> "idle"]
        /\ transfers = 0

Claim(w) == /\ pc[w] = "idle"
            /\ status = "approved"
            /\ status' = "claimed"
            /\ pc' = [pc EXCEPT ![w] = "claimed"]
            /\ UNCHANGED transfers

Skip(w) == /\ pc[w] = "idle"
           /\ status = "paid"
           /\ pc' = [pc EXCEPT ![w] = "done"]
           /\ UNCHANGED <<status, transfers>>

Send(w) == /\ pc[w] = "claimed"
           /\ transfers' = transfers + 1
           /\ pc' = [pc EXCEPT ![w] = "sent"]
           /\ UNCHANGED status

Mark(w) == /\ pc[w] = "sent"
           /\ status' = "paid"
           /\ pc' = [pc EXCEPT ![w] = "done"]
           /\ UNCHANGED transfers

Work(w) == Claim(w) \/ Skip(w) \/ Send(w) \/ Mark(w)

Next == \E w \in Workers : Work(w)

Fairness == \A w \in Workers : WF_vars(Work(w))

Spec == Init /\ [][Next]_vars /\ Fairness

NoDoublePayout == transfers <= 1
EventuallyPaid == <>(status = "paid")
ClaimLeadsToPaid == (status = "claimed") ~> (status = "paid")
====
