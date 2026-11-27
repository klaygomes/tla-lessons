---- MODULE Place110 ----
EXTENDS Naturals
Workers == {"A", "B"}
(* --algorithm Place110 {
  variables status = "approved", transfers = 0;
  process (w \in Workers) {
    check: if (status = "approved") {
    claim: status := "claimed";
    send: transfers := transfers + 1;
          status := "paid"
           }
  }
} *)
\* BEGIN TRANSLATION (chksum(pcal) = "6af8a06f" /\ chksum(tla) = "e1be53e7")
VARIABLES status, transfers, pc

vars == << status, transfers, pc >>

ProcSet == (Workers)

Init == (* Global variables *)
        /\ status = "approved"
        /\ transfers = 0
        /\ pc = [self \in ProcSet |-> "check"]

check(self) == /\ pc[self] = "check"
               /\ IF status = "approved"
                     THEN /\ pc' = [pc EXCEPT ![self] = "claim"]
                     ELSE /\ pc' = [pc EXCEPT ![self] = "Done"]
               /\ UNCHANGED << status, transfers >>

claim(self) == /\ pc[self] = "claim"
               /\ status' = "claimed"
               /\ pc' = [pc EXCEPT ![self] = "send"]
               /\ UNCHANGED transfers

send(self) == /\ pc[self] = "send"
              /\ transfers' = transfers + 1
              /\ status' = "paid"
              /\ pc' = [pc EXCEPT ![self] = "Done"]

w(self) == check(self) \/ claim(self) \/ send(self)

(* Allow infinite stuttering to prevent deadlock on termination. *)
Terminating == /\ \A self \in ProcSet: pc[self] = "Done"
               /\ UNCHANGED vars

Next == (\E self \in Workers: w(self))
           \/ Terminating

Spec == Init /\ [][Next]_vars

Termination == <>(\A self \in ProcSet: pc[self] = "Done")

\* END TRANSLATION 
NoDoublePayout == transfers <= 1
====
