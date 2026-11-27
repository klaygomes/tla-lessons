---- MODULE Proof ----
EXTENDS Desk

InitHolds == Init => Inv
StepKeeps == Inv /\ Next => Inv'
InvEnough == Inv => NoDoublePayout
StepProp == [][StepKeeps]_vars
WeakKeeps == Ind1 /\ Next => Ind1'
WeakProp == [][WeakKeeps]_vars

THEOREM Safe == Spec => []NoDoublePayout
====
