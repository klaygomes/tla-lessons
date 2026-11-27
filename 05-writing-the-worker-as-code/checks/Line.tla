---- MODULE Line ----
EXTENDS Naturals

Workers == {"A", "B"}

(* --algorithm Line {
  variables status = "approved", transfers = 0, line = "free";

  fair process (w \in Workers) {
    claim: await status = "approved";
           status := "claimed";
    send:  await line = "free";
           transfers := transfers + 1;
    mark:  status := "paid"
  }

  fair process (r = "recon") {
    take: while (TRUE) {
            await line = "free";
            line := "busy";
    give:   line := "free"
          }
  }
} *)
\* BEGIN TRANSLATION (chksum(pcal) = "9fadeffa" /\ chksum(tla) = "9b47504c")
VARIABLES status, transfers, line, pc

vars == << status, transfers, line, pc >>

ProcSet == (Workers) \cup {"recon"}

Init == (* Global variables *)
        /\ status = "approved"
        /\ transfers = 0
        /\ line = "free"
        /\ pc = [self \in ProcSet |-> CASE self \in Workers -> "claim"
                                        [] self = "recon" -> "take"]

claim(self) == /\ pc[self] = "claim"
               /\ status = "approved"
               /\ status' = "claimed"
               /\ pc' = [pc EXCEPT ![self] = "send"]
               /\ UNCHANGED << transfers, line >>

send(self) == /\ pc[self] = "send"
              /\ line = "free"
              /\ transfers' = transfers + 1
              /\ pc' = [pc EXCEPT ![self] = "mark"]
              /\ UNCHANGED << status, line >>

mark(self) == /\ pc[self] = "mark"
              /\ status' = "paid"
              /\ pc' = [pc EXCEPT ![self] = "Done"]
              /\ UNCHANGED << transfers, line >>

w(self) == claim(self) \/ send(self) \/ mark(self)

take == /\ pc["recon"] = "take"
        /\ line = "free"
        /\ line' = "busy"
        /\ pc' = [pc EXCEPT !["recon"] = "give"]
        /\ UNCHANGED << status, transfers >>

give == /\ pc["recon"] = "give"
        /\ line' = "free"
        /\ pc' = [pc EXCEPT !["recon"] = "take"]
        /\ UNCHANGED << status, transfers >>

r == take \/ give

Next == r
           \/ (\E self \in Workers: w(self))

Spec == /\ Init /\ [][Next]_vars
        /\ \A self \in Workers : WF_vars(w(self))
        /\ WF_vars(r)

\* END TRANSLATION 

NoDoublePayout == transfers <= 1
EventuallyPaid == <>(status = "paid")
====
