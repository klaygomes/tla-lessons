---- MODULE DebitFirst ----
EXTENDS Ledger

VARIABLES fund, credit, pc, crashed
vars == <<fund, credit, pc, crashed>>

Init == /\ fund = Pot
        /\ credit = [l \in Loans |-> 0]
        /\ pc = [l \in Loans |-> "todo"]
        /\ crashed = FALSE

Debit(l) == /\ pc[l] = "todo"
            /\ fund' = fund - Amount[l]
            /\ pc' = [pc EXCEPT ![l] = "debited"]
            /\ UNCHANGED <<credit, crashed>>

Credit(l) ==
  /\ pc[l] = "debited"
  /\ credit' = [credit EXCEPT ![l] = credit[l] + Amount[l]]
  /\ pc' = [pc EXCEPT ![l] = "done"]
  /\ UNCHANGED <<fund, crashed>>

CreditKey(l) == /\ pc[l] = "debited"
                /\ credit' = [credit EXCEPT ![l] = Amount[l]]
                /\ pc' = [pc EXCEPT ![l] = "done"]
                /\ UNCHANGED <<fund, crashed>>

Crash(l) == /\ ~crashed
            /\ pc[l] = "debited"
            /\ pc' = [pc EXCEPT ![l] = "todo"]
            /\ crashed' = TRUE
            /\ UNCHANGED <<fund, credit>>

NextNoCrash == \E l \in Loans : Debit(l) \/ Credit(l)
Next == \E l \in Loans : Debit(l) \/ Credit(l) \/ Crash(l)

SpecNoCrash == Init /\ [][NextNoCrash]_vars
Spec == Init /\ [][Next]_vars

Credited == SumOver(Loans, credit)
Conserved == fund + Credited = Pot
AtRest == \A l \in Loans : pc[l] \in {"todo", "done"}
ConservedAtRest == AtRest => Conserved
InFlightMem ==
  SumOver({l \in Loans : pc[l] = "debited"}, Amount)
ConservedMem == fund + InFlightMem + Credited = Pot
====
