---- MODULE ClockAsk ----
EXTENDS Naturals

CONSTANTS MaxTime, TTL
Workers == {"A", "B"}
Loan == 4471
VARIABLES now, status, owner, pc, transfers, keys, crashed
vars == <<now, status, owner, pc, transfers, keys, crashed>>

Init == /\ now = 0
        /\ status = "approved"
        /\ owner = "nobody"
        /\ pc = [w \in Workers |-> "idle"]
        /\ transfers = 0
        /\ keys = {}
        /\ crashed = FALSE

Tick == /\ now < MaxTime
        /\ now' = now + 1
        /\ UNCHANGED <<status, owner, pc, transfers, keys,
                       crashed>>

Known == \E k \in keys : k[1] = Loan

Claim(w) == /\ pc[w] = "idle"
            /\ status = "approved"
            /\ status' = "claimed"
            /\ owner' = w
            /\ pc' = [pc EXCEPT ![w] = "claimed"]
            /\ UNCHANGED <<now, transfers, keys, crashed>>

Resume(w) == /\ pc[w] = "idle"
             /\ status = "claimed"
             /\ owner = w
             /\ pc' = [pc EXCEPT ![w] = "looking"]
             /\ UNCHANGED <<now, status, owner, transfers,
                             keys, crashed>>

Skip(w) == /\ pc[w] = "idle"
           /\ status = "paid"
           /\ pc' = [pc EXCEPT ![w] = "done"]
           /\ UNCHANGED <<now, status, owner, transfers,
                           keys, crashed>>

Send(w) == /\ pc[w] = "claimed"
           /\ IF Known
                THEN UNCHANGED <<transfers, keys>>
                ELSE /\ transfers' = transfers + 1
                     /\ keys' = keys \union {<<Loan, now>>}
           /\ pc' = [pc EXCEPT ![w] = "sent"]
           /\ UNCHANGED <<now, status, owner, crashed>>

Lookup(w) == /\ pc[w] = "looking"
             /\ pc' = [pc EXCEPT ![w] =
                    IF transfers > 0 THEN "sent" ELSE "claimed"]
             /\ UNCHANGED <<now, status, owner, transfers,
                             keys, crashed>>

Mark(w) == /\ pc[w] = "sent"
           /\ status' = "paid"
           /\ pc' = [pc EXCEPT ![w] = "done"]
           /\ UNCHANGED <<now, owner, transfers, keys, crashed>>

Crash(w) == /\ ~crashed
            /\ pc[w] \in {"claimed", "looking", "sent"}
            /\ pc' = [pc EXCEPT ![w] = "idle"]
            /\ crashed' = TRUE
            /\ UNCHANGED <<now, status, owner, transfers, keys>>

Forget(k) == /\ now >= k[2] + TTL
             /\ keys' = keys \ {k}
             /\ UNCHANGED <<now, status, owner, pc, transfers,
                             crashed>>

Work(w) == \/ Claim(w) \/ Resume(w) \/ Skip(w) \/ Send(w)
           \/ Lookup(w) \/ Mark(w)

Next == \/ Tick
        \/ \E k \in keys : Forget(k)
        \/ \E w \in Workers : Work(w) \/ Crash(w)

Spec == Init /\ [][Next]_vars

NoDoublePayout == transfers <= 1
====
