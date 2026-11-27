---- MODULE ReadWriteOne ----
EXTENDS Naturals

Workers == {"A", "B"}

(* --algorithm ReadWriteOne {
  variables status = "approved", transfers = 0;

  process (w \in Workers)
    variable seen = "nothing";
  {
    claim: seen := status;
           if (seen = "approved") {
             status := "claimed";
    send:    transfers := transfers + 1;
    mark:    status := "paid"
           }
  }
} *)
\* BEGIN TRANSLATION (chksum(pcal) = "25af7dbd" /\ chksum(tla) = "159860bb")
VARIABLES status, transfers, pc, seen

vars == << status, transfers, pc, seen >>

ProcSet == (Workers)

Init == (* Global variables *)
        /\ status = "approved"
        /\ transfers = 0
        (* Process w *)
        /\ seen = [self \in Workers |-> "nothing"]
        /\ pc = [self \in ProcSet |-> "claim"]

claim(self) == /\ pc[self] = "claim"
               /\ seen' = [seen EXCEPT ![self] = status]
               /\ IF seen'[self] = "approved"
                     THEN /\ status' = "claimed"
                          /\ pc' = [pc EXCEPT ![self] = "send"]
                     ELSE /\ pc' = [pc EXCEPT ![self] = "Done"]
                          /\ UNCHANGED status
               /\ UNCHANGED transfers

send(self) == /\ pc[self] = "send"
              /\ transfers' = transfers + 1
              /\ pc' = [pc EXCEPT ![self] = "mark"]
              /\ UNCHANGED << status, seen >>

mark(self) == /\ pc[self] = "mark"
              /\ status' = "paid"
              /\ pc' = [pc EXCEPT ![self] = "Done"]
              /\ UNCHANGED << transfers, seen >>

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
