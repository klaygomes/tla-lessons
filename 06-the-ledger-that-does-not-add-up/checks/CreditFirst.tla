---- MODULE CreditFirst ----
EXTENDS Ledger

VARIABLES fund, credit, pc, crashed
vars == <<fund, credit, pc, crashed>>

Init == /\ fund = Pot
        /\ credit = [l \in Loans |-> 0]
        /\ pc = [l \in Loans |-> "todo"]
        /\ crashed = FALSE

Credit(l) ==
  /\ pc[l] = "todo"
  /\ credit' = [credit EXCEPT ![l] = credit[l] + Amount[l]]
  /\ pc' = [pc EXCEPT ![l] = "credited"]
  /\ UNCHANGED <<fund, crashed>>

CreditKey(l) == /\ pc[l] = "todo"
                /\ credit' = [credit EXCEPT ![l] = Amount[l]]
                /\ pc' = [pc EXCEPT ![l] = "credited"]
                /\ UNCHANGED <<fund, crashed>>

Debit(l) == /\ pc[l] = "credited"
            /\ fund' = fund - Amount[l]
            /\ pc' = [pc EXCEPT ![l] = "done"]
            /\ UNCHANGED <<credit, crashed>>

Crash(l) == /\ ~crashed
            /\ pc[l] = "credited"
            /\ pc' = [pc EXCEPT ![l] = "todo"]
            /\ crashed' = TRUE
            /\ UNCHANGED <<fund, credit>>

NextNoCrash == \E l \in Loans : Credit(l) \/ Debit(l)
Next == \E l \in Loans : Credit(l) \/ Debit(l) \/ Crash(l)

SpecNoCrash == Init /\ [][NextNoCrash]_vars
Spec == Init /\ [][Next]_vars

Credited == SumOver(Loans, credit)
Conserved == fund + Credited = Pot
AtRest == \A l \in Loans : pc[l] \in {"todo", "done"}
ConservedAtRest == AtRest => Conserved
AllDone == \A l \in Loans : pc[l] = "done"
ConservedWhenDone == AllDone => Conserved
====
