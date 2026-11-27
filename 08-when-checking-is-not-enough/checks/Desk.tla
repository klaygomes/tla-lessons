---- MODULE Desk ----
EXTENDS Naturals, FiniteSets

CONSTANT Workers
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

Send(w) == /\ pc[w] = "claimed"
           /\ transfers' = transfers + 1
           /\ pc' = [pc EXCEPT ![w] = "sent"]
           /\ UNCHANGED status

Mark(w) == /\ pc[w] = "sent"
           /\ status' = "paid"
           /\ pc' = [pc EXCEPT ![w] = "done"]
           /\ UNCHANGED transfers

Skip(w) == /\ pc[w] = "idle"
           /\ status = "paid"
           /\ pc' = [pc EXCEPT ![w] = "done"]
           /\ UNCHANGED <<status, transfers>>

Next == \E w \in Workers :
          Claim(w) \/ Send(w) \/ Mark(w) \/ Skip(w)

Spec == Init /\ [][Next]_vars

Pcs == {"idle", "claimed", "sent", "done"}

TypeOK == /\ status \in {"approved", "claimed", "paid"}
          /\ pc \in [Workers -> Pcs]
          /\ transfers \in 0..2

NoDoublePayout == transfers <= 1

Claimed == {w \in Workers : pc[w] = "claimed"}

Owed == transfers + Cardinality(Claimed) <= 1

Unclaimed == status = "approved" =>
               /\ transfers = 0
               /\ \A w \in Workers : pc[w] = "idle"

Inv == TypeOK /\ Owed /\ Unclaimed

OnlyOneBusy == Cardinality({w \in Workers : pc[w] # "idle"}) <= 1

Ind0 == TypeOK /\ NoDoublePayout
Ind1 == TypeOK /\ Owed
Ind3 == Inv /\ OnlyOneBusy
Vacuous == TypeOK /\ FALSE
====
