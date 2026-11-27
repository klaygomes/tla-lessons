---- MODULE LeaseDeskNoKey ----
EXTENDS Naturals

Workers == {"A", "B"}
Loan == 4471

(* --algorithm LeaseDeskNoKey {
  variables status = "approved", owner = "nobody",
            transfers = 0, keys = {}, crashed = FALSE;

  fair process (w \in Workers) {
    poll:
      either { await status = "approved";
               status := "claimed";
               owner := self }
      or     { await status = "claimed" /\ owner = self }
      or     { await status = "paid";
               goto Done };
    send:
      either { transfers := transfers + 1;
               keys := keys \union {Loan} }
      or     { await ~crashed;
               crashed := TRUE;
               goto poll };
    mark:
      either { status := "paid" }
      or     { await ~crashed;
               crashed := TRUE;
               goto poll }
  }

  fair process (clock = "lease") {
    expire:
      while (TRUE) {
        await status = "claimed";
        status := "approved" }
  }
} *)
\* BEGIN TRANSLATION (chksum(pcal) = "e17e4447" /\ chksum(tla) = "729897e1")
VARIABLES status, owner, transfers, keys, crashed, pc

vars == << status, owner, transfers, keys, crashed, pc >>

ProcSet == (Workers) \cup {"lease"}

Init == (* Global variables *)
        /\ status = "approved"
        /\ owner = "nobody"
        /\ transfers = 0
        /\ keys = {}
        /\ crashed = FALSE
        /\ pc = [self \in ProcSet |-> CASE self \in Workers -> "poll"
                                        [] self = "lease" -> "expire"]

poll(self) == /\ pc[self] = "poll"
              /\ \/ /\ status = "approved"
                    /\ status' = "claimed"
                    /\ owner' = self
                    /\ pc' = [pc EXCEPT ![self] = "send"]
                 \/ /\ status = "claimed" /\ owner = self
                    /\ pc' = [pc EXCEPT ![self] = "send"]
                    /\ UNCHANGED <<status, owner>>
                 \/ /\ status = "paid"
                    /\ pc' = [pc EXCEPT ![self] = "Done"]
                    /\ UNCHANGED <<status, owner>>
              /\ UNCHANGED << transfers, keys, crashed >>

send(self) == /\ pc[self] = "send"
              /\ \/ /\ transfers' = transfers + 1
                    /\ keys' = (keys \union {Loan})
                    /\ pc' = [pc EXCEPT ![self] = "mark"]
                    /\ UNCHANGED crashed
                 \/ /\ ~crashed
                    /\ crashed' = TRUE
                    /\ pc' = [pc EXCEPT ![self] = "poll"]
                    /\ UNCHANGED <<transfers, keys>>
              /\ UNCHANGED << status, owner >>

mark(self) == /\ pc[self] = "mark"
              /\ \/ /\ status' = "paid"
                    /\ pc' = [pc EXCEPT ![self] = "Done"]
                    /\ UNCHANGED crashed
                 \/ /\ ~crashed
                    /\ crashed' = TRUE
                    /\ pc' = [pc EXCEPT ![self] = "poll"]
                    /\ UNCHANGED status
              /\ UNCHANGED << owner, transfers, keys >>

w(self) == poll(self) \/ send(self) \/ mark(self)

expire == /\ pc["lease"] = "expire"
          /\ status = "claimed"
          /\ status' = "approved"
          /\ pc' = [pc EXCEPT !["lease"] = "expire"]
          /\ UNCHANGED << owner, transfers, keys, crashed >>

clock == expire

(* Allow infinite stuttering to prevent deadlock on termination. *)
Terminating == /\ \A self \in ProcSet: pc[self] = "Done"
               /\ UNCHANGED vars

Next == clock
           \/ (\E self \in Workers: w(self))
           \/ Terminating

Spec == /\ Init /\ [][Next]_vars
        /\ \A self \in Workers : WF_vars(w(self))
        /\ WF_vars(clock)

Termination == <>(\A self \in ProcSet: pc[self] = "Done")

\* END TRANSLATION 

NoDoublePayout == transfers <= 1
EventuallyPaid == <>(status = "paid")
ClaimLeadsToPaid == (status = "claimed") ~> (status = "paid")
====
