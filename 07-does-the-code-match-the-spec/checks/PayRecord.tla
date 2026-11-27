---- MODULE PayRecord ----
EXTENDS Naturals

VARIABLES status, transfers
avars == <<status, transfers>>

Init == /\ status = "approved"
        /\ transfers = 0

Pay == /\ transfers = 0
       /\ transfers' = 1
       /\ UNCHANGED status

Record == /\ transfers = 1
          /\ status = "approved"
          /\ status' = "paid"
          /\ UNCHANGED transfers

Spec == /\ Init /\ [][Pay \/ Record]_avars
        /\ WF_avars(Pay) /\ WF_avars(Record)
====
