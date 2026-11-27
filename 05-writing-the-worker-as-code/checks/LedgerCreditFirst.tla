---- MODULE LedgerCreditFirst ----
EXTENDS Naturals

(* --algorithm LedgerCreditFirst {
  variables funding = 50000, loanbook = 0;

  process (w = "A") {
    credit: loanbook := loanbook + 50000;
    debit:  funding := funding - 50000
  }
} *)
\* BEGIN TRANSLATION (chksum(pcal) = "aba0ba86" /\ chksum(tla) = "4a5536f0")
VARIABLES funding, loanbook, pc

vars == << funding, loanbook, pc >>

ProcSet == {"A"}

Init == (* Global variables *)
        /\ funding = 50000
        /\ loanbook = 0
        /\ pc = [self \in ProcSet |-> "credit"]

credit == /\ pc["A"] = "credit"
          /\ loanbook' = loanbook + 50000
          /\ pc' = [pc EXCEPT !["A"] = "debit"]
          /\ UNCHANGED funding

debit == /\ pc["A"] = "debit"
         /\ funding' = funding - 50000
         /\ pc' = [pc EXCEPT !["A"] = "Done"]
         /\ UNCHANGED loanbook

w == credit \/ debit

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
