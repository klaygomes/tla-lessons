---- MODULE PayOnce ----
EXTENDS Naturals

VARIABLES status, transfers
avars == <<status, transfers>>

Init == /\ status = "approved"
        /\ transfers = 0

Pay == /\ status = "approved"
       /\ status' = "paid"
       /\ transfers' = transfers + 1

Spec == Init /\ [][Pay]_avars /\ WF_avars(Pay)

PaidOnce == transfers = IF status = "paid" THEN 1 ELSE 0
EventuallyPaid == <>(status = "paid")
====
