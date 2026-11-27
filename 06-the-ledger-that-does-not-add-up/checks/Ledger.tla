---- MODULE Ledger ----
EXTENDS Naturals

Loans == {4471, 4472}
Amount == [l \in Loans |-> IF l = 4471 THEN 50000 ELSE 30000]
Pot == 200000

RECURSIVE SumOver(_, _)
SumOver(S, f) ==
  IF S = {} THEN 0
  ELSE LET x == CHOOSE y \in S : TRUE
       IN  f[x] + SumOver(S \ {x}, f)
====
