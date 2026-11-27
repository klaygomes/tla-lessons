---- MODULE NoKey ----
EXTENDS Desk

BankNoKey(l) == /\ transfers' = [transfers EXCEPT ![l] = @ + 1]
                /\ UNCHANGED keys

Cheap == \A l \in Loans : transfers[l] <= 1
====
