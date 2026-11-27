---- MODULE Desk ----
EXTENDS Naturals, TLC

CONSTANTS Workers, Loans, MaxRetries, Nobody, NoLoan

VARIABLES status, owner, pc, held, transfers, keys,
          crashed, retries
vars == <<status, owner, pc, held, transfers, keys,
          crashed, retries>>

Init == /\ status = [l \in Loans |-> "approved"]
        /\ owner = [l \in Loans |-> Nobody]
        /\ pc = [w \in Workers |-> "idle"]
        /\ held = [w \in Workers |-> NoLoan]
        /\ transfers = [l \in Loans |-> 0]
        /\ keys = {}
        /\ crashed = FALSE
        /\ retries = 0

Claim(w, l) == /\ pc[w] = "idle"
               /\ status[l] = "approved"
               /\ status' = [status EXCEPT ![l] = "claimed"]
               /\ owner' = [owner EXCEPT ![l] = w]
               /\ pc' = [pc EXCEPT ![w] = "claimed"]
               /\ held' = [held EXCEPT ![w] = l]
               /\ UNCHANGED <<transfers, keys, crashed, retries>>

Resume(w, l) == /\ pc[w] = "idle"
                /\ status[l] = "claimed"
                /\ owner[l] = w
                /\ pc' = [pc EXCEPT ![w] = "claimed"]
                /\ held' = [held EXCEPT ![w] = l]
                /\ UNCHANGED <<status, owner, transfers, keys,
                               crashed, retries>>

Bank(l) == /\ transfers' = IF l \in keys THEN transfers
                           ELSE [transfers EXCEPT ![l] = @ + 1]
           /\ keys' = keys \union {l}

Send(w) == /\ pc[w] = "claimed"
           /\ Bank(held[w])
           /\ pc' = [pc EXCEPT ![w] = "sent"]
           /\ UNCHANGED <<status, owner, held, crashed, retries>>

Lost(w) == /\ pc[w] = "claimed"
           /\ retries < MaxRetries
           /\ Bank(held[w])
           /\ retries' = retries + 1
           /\ UNCHANGED <<status, owner, pc, held, crashed>>

Mark(w) == /\ pc[w] = "sent"
           /\ status' = [status EXCEPT ![held[w]] = "paid"]
           /\ pc' = [pc EXCEPT ![w] = "idle"]
           /\ held' = [held EXCEPT ![w] = NoLoan]
           /\ UNCHANGED <<owner, transfers, keys, crashed, retries>>

Crash(w) == /\ ~crashed
            /\ pc[w] # "idle"
            /\ pc' = [pc EXCEPT ![w] = "idle"]
            /\ held' = [held EXCEPT ![w] = NoLoan]
            /\ crashed' = TRUE
            /\ UNCHANGED <<status, owner, transfers, keys, retries>>

Work(w) == \/ \E l \in Loans : Claim(w, l) \/ Resume(w, l)
           \/ Send(w) \/ Lost(w) \/ Mark(w)

Next == \E w \in Workers : Work(w) \/ Crash(w)

Fairness == \A w \in Workers : WF_vars(Work(w))

Spec == Init /\ [][Next]_vars /\ Fairness

NoDoublePayout == \A l \in Loans : transfers[l] <= 1

ClaimLeadsToPaid ==
    \A l \in Loans : (status[l] = "claimed") ~> (status[l] = "paid")

Perms == Permutations(Workers) \union Permutations(Loans)

WorkerPerms == Permutations(Workers)
====
