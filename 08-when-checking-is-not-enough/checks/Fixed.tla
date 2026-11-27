---- MODULE Fixed ----
EXTENDS Naturals

CONSTANT Workers
Loan == 4471
VARIABLES status, owner, pc, transfers, keys
vars == <<status, owner, pc, transfers, keys>>

Init == /\ status = "approved"
        /\ owner = "nobody"
        /\ pc = [w \in Workers |-> "idle"]
        /\ transfers = 0
        /\ keys = {}

Claim(w) == /\ pc[w] = "idle"
            /\ status = "approved"
            /\ status' = "claimed"
            /\ owner' = w
            /\ pc' = [pc EXCEPT ![w] = "claimed"]
            /\ UNCHANGED <<transfers, keys>>

Resume(w) == /\ pc[w] = "idle"
             /\ status = "claimed"
             /\ owner = w
             /\ pc' = [pc EXCEPT ![w] = "claimed"]
             /\ UNCHANGED <<status, owner, transfers, keys>>

Skip(w) == /\ pc[w] = "idle"
           /\ status = "paid"
           /\ pc' = [pc EXCEPT ![w] = "done"]
           /\ UNCHANGED <<status, owner, transfers, keys>>

Send(w) == /\ pc[w] = "claimed"
           /\ transfers' = IF Loan \in keys THEN transfers
                                            ELSE transfers + 1
           /\ keys' = keys \union {Loan}
           /\ pc' = [pc EXCEPT ![w] = "sent"]
           /\ UNCHANGED <<status, owner>>

Mark(w) == /\ pc[w] = "sent"
           /\ status' = "paid"
           /\ pc' = [pc EXCEPT ![w] = "done"]
           /\ UNCHANGED <<owner, transfers, keys>>

Crash(w) == /\ pc[w] \in {"claimed", "sent"}
            /\ pc' = [pc EXCEPT ![w] = "idle"]
            /\ UNCHANGED <<status, owner, transfers, keys>>

Next == \E w \in Workers :
          \/ Claim(w) \/ Resume(w) \/ Skip(w)
          \/ Send(w) \/ Mark(w) \/ Crash(w)

Spec == Init /\ [][Next]_vars

Pcs == {"idle", "claimed", "sent", "done"}

TypeOK == /\ status \in {"approved", "claimed", "paid"}
          /\ owner \in Workers \union {"nobody"}
          /\ pc \in [Workers -> Pcs]
          /\ transfers \in 0..2
          /\ keys \in SUBSET {Loan}

NoDoublePayout == transfers <= 1
MoneyMatchesKeys == transfers = IF Loan \in keys THEN 1 ELSE 0
P1Weak == TypeOK /\ NoDoublePayout
P1Inv == TypeOK /\ MoneyMatchesKeys
====
