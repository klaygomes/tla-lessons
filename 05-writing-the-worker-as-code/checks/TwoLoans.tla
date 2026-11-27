---- MODULE TwoLoans ----
EXTENDS Naturals

Workers == {"A", "B"}
Loans == {4471, 4472}

(* --algorithm TwoLoans {
  variables status = [l \in Loans |-> "approved"],
            transfers = [l \in Loans |-> 0];

  process (w \in Workers)
    variable mine = 0;
  {
    claim:
      with (l \in {x \in Loans : status[x] = "approved"}) {
        status[l] := "claimed";
        mine := l };
    send:
      transfers[mine] := transfers[mine] + 1;
    mark:
      status[mine] := "paid";
      goto claim
  }
} *)
\* BEGIN TRANSLATION (chksum(pcal) = "aa7c5042" /\ chksum(tla) = "a6863f77")
VARIABLES status, transfers, pc, mine

vars == << status, transfers, pc, mine >>

ProcSet == (Workers)

Init == (* Global variables *)
        /\ status = [l \in Loans |-> "approved"]
        /\ transfers = [l \in Loans |-> 0]
        (* Process w *)
        /\ mine = [self \in Workers |-> 0]
        /\ pc = [self \in ProcSet |-> "claim"]

claim(self) == /\ pc[self] = "claim"
               /\ \E l \in {x \in Loans : status[x] = "approved"}:
                    /\ status' = [status EXCEPT ![l] = "claimed"]
                    /\ mine' = [mine EXCEPT ![self] = l]
               /\ pc' = [pc EXCEPT ![self] = "send"]
               /\ UNCHANGED transfers

send(self) == /\ pc[self] = "send"
              /\ transfers' = [transfers EXCEPT ![mine[self]] = transfers[mine[self]] + 1]
              /\ pc' = [pc EXCEPT ![self] = "mark"]
              /\ UNCHANGED << status, mine >>

mark(self) == /\ pc[self] = "mark"
              /\ status' = [status EXCEPT ![mine[self]] = "paid"]
              /\ pc' = [pc EXCEPT ![self] = "claim"]
              /\ UNCHANGED << transfers, mine >>

w(self) == claim(self) \/ send(self) \/ mark(self)

(* Allow infinite stuttering to prevent deadlock on termination. *)
Terminating == /\ \A self \in ProcSet: pc[self] = "Done"
               /\ UNCHANGED vars

Next == (\E self \in Workers: w(self))
           \/ Terminating

Spec == Init /\ [][Next]_vars

Termination == <>(\A self \in ProcSet: pc[self] = "Done")

\* END TRANSLATION 

NoDoublePayout == \A l \in Loans : transfers[l] <= 1
====
