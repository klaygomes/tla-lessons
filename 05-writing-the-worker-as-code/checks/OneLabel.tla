---- MODULE OneLabel ----
EXTENDS Naturals

Workers == {"A", "B"}

(* --algorithm OneLabel {
  variables status = "approved", transfers = 0;

  process (w \in Workers) {
    claim: if (status = "approved") {
             status := "claimed";
    send:    transfers := transfers + 1;
    mark:    status := "paid"
           }
  }
} *)
\* BEGIN TRANSLATION (chksum(pcal) = "3643e66d" /\ chksum(tla) = "b12d7ebf")
VARIABLES status, transfers, pc

vars == << status, transfers, pc >>

ProcSet == (Workers)

Init == (* Global variables *)
        /\ status = "approved"
        /\ transfers = 0
        /\ pc = [self \in ProcSet |-> "claim"]

claim(self) == /\ pc[self] = "claim"
               /\ IF status = "approved"
                     THEN /\ status' = "claimed"
                          /\ pc' = [pc EXCEPT ![self] = "send"]
                     ELSE /\ pc' = [pc EXCEPT ![self] = "Done"]
                          /\ UNCHANGED status
               /\ UNCHANGED transfers

send(self) == /\ pc[self] = "send"
              /\ transfers' = transfers + 1
              /\ pc' = [pc EXCEPT ![self] = "mark"]
              /\ UNCHANGED status

mark(self) == /\ pc[self] = "mark"
              /\ status' = "paid"
              /\ pc' = [pc EXCEPT ![self] = "Done"]
              /\ UNCHANGED transfers

w(self) == claim(self) \/ send(self) \/ mark(self)

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
