---- MODULE PayoutClaim ----
EXTENDS Naturals

Workers == {"A", "B", "C"}
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
           /\ status # "approved"
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

Next == \E w \in Workers :
          Claim(w) \/ Skip(w) \/ Send(w) \/ Mark(w)

Spec == Init /\ [][Next]_vars

NoDoublePayout == transfers <= 1
====