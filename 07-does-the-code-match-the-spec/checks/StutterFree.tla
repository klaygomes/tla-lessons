---- MODULE StutterFree ----
EXTENDS QueueDesk

EveryStepPays == Abstract!Init /\ [][Abstract!Pay]_vars
====
