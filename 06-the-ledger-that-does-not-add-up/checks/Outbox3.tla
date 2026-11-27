---- MODULE Outbox3 ----
EXTENDS Outbox

Loans3 == {4471, 4472, 4473}
Amount3 == [l \in Loans3 |->
              IF l = 4471 THEN 50000
              ELSE IF l = 4472 THEN 30000 ELSE 20000]
====
