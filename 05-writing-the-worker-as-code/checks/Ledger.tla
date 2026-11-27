---- MODULE Ledger ----
EXTENDS Naturals

(* --algorithm Ledger {
  variables funding = 50000, loanbook = 0;

  process (w = "A") {
    debit:  funding := funding - 50000;
    credit: loanbook := loanbook + 50000
  }
} *)
\* BEGIN TRANSLATION (chksum(pcal) = "8c710360" /\ chksum(tla) = "28301806")
VARIABLES funding, loanbook, pc

vars == << funding, loanbook, pc >>

ProcSet == {"A"}

Init == (* Global variables *)
        /\ funding = 50000
        /\ loanbook = 0
        /\ pc = [self \in ProcSet |-> "debit"]

debit == /\ pc["A"] = "debit"
         /\ funding' = funding - 50000
         /\ pc' = [pc EXCEPT !["A"] = "credit"]
         /\ UNCHANGED loanbook

credit == /\ pc["A"] = "credit"
          /\ loanbook' = loanbook + 50000
          /\ pc' = [pc EXCEPT !["A"] = "Done"]
          /\ UNCHANGED funding

w == debit \/ credit

(* Allow infinite stuttering to prevent deadlock on termination. *)
Terminating == /\ \A self \in ProcSet: pc[self] = "Done"
               /\ UNCHANGED vars

Next == w
           \/ Terminating

Spec == Init /\ [][Next]_vars

Termination == <>(\A self \in ProcSet: pc[self] = "Done")

\* END TRANSLATION 

MoneyKept == funding + loanbook = 50000
====
