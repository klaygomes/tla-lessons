---- MODULE ReadWrite ----
EXTENDS Naturals

Workers == {"A", "B"}

(* --algorithm ReadWrite {
  variables status = "approved", transfers = 0;

  process (w \in Workers)
    variable seen = "nothing";
  {
    read:  seen := status;
    claim: if (seen = "approved") {
             status := "claimed";
    send:    transfers := transfers + 1;
    mark:    status := "paid"
           }
  }
} *)
\* BEGIN TRANSLATION (chksum(pcal) = "b01bd79c" /\ chksum(tla) = "96bf99ac")
VARIABLES status, transfers, pc, seen

vars == << status, transfers, pc, seen >>

ProcSet == (Workers)

Init == (* Global variables *)
        /\ status = "approved"
        /\ transfers = 0
        (* Process w *)
        /\ seen = [self \in Workers |-> "nothing"]
        /\ pc = [self \in ProcSet |-> "read"]

read(self) == /\ pc[self] = "read"
              /\ seen' = [seen EXCEPT ![self] = status]
              /\ pc' = [pc EXCEPT ![self] = "claim"]
              /\ UNCHANGED << status, transfers >>

claim(self) == /\ pc[self] = "claim"
               /\ IF seen[self] = "approved"
                     THEN /\ status' = "claimed"
                          /\ pc' = [pc EXCEPT ![self] = "send"]
                     ELSE /\ pc' = [pc EXCEPT ![self] = "Done"]
                          /\ UNCHANGED status
               /\ UNCHANGED << transfers, seen >>

send(self) == /\ pc[self] = "send"
              /\ transfers' = transfers + 1
              /\ pc' = [pc EXCEPT ![self] = "mark"]
              /\ UNCHANGED << status, seen >>

mark(self) == /\ pc[self] = "mark"
              /\ status' = "paid"
              /\ pc' = [pc EXCEPT ![self] = "Done"]
              /\ UNCHANGED << transfers, seen >>

w(self) == read(self) \/ claim(self) \/ send(self) \/ mark(self)

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
