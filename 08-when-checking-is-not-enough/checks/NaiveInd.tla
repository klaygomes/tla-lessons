---- MODULE NaiveInd ----
EXTENDS Naive

Pcs == {"idle", "checked", "sent", "done"}

TypeOK == /\ status \in {"approved", "paid"}
          /\ pc \in [Workers -> Pcs]
          /\ transfers \in 0..2
Ind0 == TypeOK /\ NoDoublePayout
====
