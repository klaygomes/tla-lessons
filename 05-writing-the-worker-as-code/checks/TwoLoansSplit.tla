---- MODULE TwoLoansSplit ----
EXTENDS Naturals

Workers == {"A", "B"}
Loans == {4471, 4472}

(* --algorithm TwoLoansSplit {
  variables status = [l \in Loans |-> "approved"],
            transfers = [l \in Loans |-> 0];

  process (w \in Workers)
    variable mine = 0;
  {
    pick:
      with (l \in {x \in Loans : status[x] = "approved"}) {
        mine := l };
    claim:
      status[mine] := "claimed";
    send:
      transfers[mine] := transfers[mine] + 1;
    mark:
      status[mine] := "paid";
      goto pick
  }
} *)
\* BEGIN TRANSLATION (chksum(pcal) = "474eaefe" /\ chksum(tla) = "8bf7f476")
VARIABLES status, transfers, pc, mine

vars == << status, transfers, pc, mine >>

ProcSet == (Workers)

Init == (* Global variables *)
        /\ status = [l \in Loans |-> "approved"]
        /\ transfers = [l \in Loans |-> 0]
        (* Process w *)
        /\ mine = [self \in Workers |-> 0]
        /\ pc = [self \in ProcSet |-> "pick"]

pick(self) == /\ pc[self] = "pick"
              /\ \E l \in {x \in Loans : status[x] = "approved"}:
                   mine' = [mine EXCEPT ![self] = l]
              /\ pc' = [pc EXCEPT ![self] = "claim"]
              /\ UNCHANGED << status, transfers >>

claim(self) == /\ pc[self] = "claim"
               /\ status' = [status EXCEPT ![mine[self]] = "claimed"]
               /\ pc' = [pc EXCEPT ![self] = "send"]
               /\ UNCHANGED << transfers, mine >>

send(self) == /\ pc[self] = "send"
              /\ transfers' = [transfers EXCEPT ![mine[self]] = transfers[mine[self]] + 1]
              /\ pc' = [pc EXCEPT ![self] = "mark"]
              /\ UNCHANGED << status, mine >>

mark(self) == /\ pc[self] = "mark"
              /\ status' = [status EXCEPT ![mine[self]] = "paid"]
              /\ pc' = [pc EXCEPT ![self] = "pick"]
              /\ UNCHANGED << transfers, mine >>

w(self) == pick(self) \/ claim(self) \/ send(self) \/ mark(self)

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
