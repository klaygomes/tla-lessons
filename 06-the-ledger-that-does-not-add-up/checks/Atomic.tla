---- MODULE Atomic ----
EXTENDS Ledger

VARIABLES fund, credit, pc
vars == <<fund, credit, pc>>

Init == /\ fund = Pot
        /\ credit = [l \in Loans |-> 0]
        /\ pc = [l \in Loans |-> "todo"]

Transfer(l) == /\ pc[l] = "todo"
               /\ fund' = fund - Amount[l]
               /\ credit' = [credit EXCEPT ![l] = Amount[l]]
               /\ pc' = [pc EXCEPT ![l] = "done"]

Spec == Init /\ [][\E l \in Loans : Transfer(l)]_vars

Conserved == fund + SumOver(Loans, credit) = Pot
====
