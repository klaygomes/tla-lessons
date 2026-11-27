---- MODULE FixNoRefuse ----
EXTENDS Naturals

CONSTANTS MaxTime, TTL, Window
Workers == {"A", "B"}
Loan == 4471
VARIABLES now, status, owner, deadline, pc, net, transfers,
          keys, crashed
vars == <<now, status, owner, deadline, pc, net, transfers,
          keys, crashed>>

Init == /\ now = 0
        /\ status = "approved"
        /\ owner = "nobody"
        /\ deadline = 0
        /\ pc = [w \in Workers |-> "idle"]
        /\ net = {}
        /\ transfers = 0
        /\ keys = {}
        /\ crashed = FALSE

Tick == /\ now < MaxTime
        /\ now' = now + 1
        /\ UNCHANGED <<status, owner, deadline, pc, net,
                       transfers, keys, crashed>>

Known == \E k \in keys : k[1] = Loan

Claim(w) == /\ pc[w] = "idle"
            /\ status = "approved"
            /\ status' = "claimed"
            /\ owner' = w
            /\ deadline' = now + Window
            /\ pc' = [pc EXCEPT ![w] = "claimed"]
            /\ UNCHANGED <<now, net, transfers, keys, crashed>>

Resume(w) == /\ pc[w] = "idle"
             /\ status = "claimed"
             /\ owner = w
             /\ pc' = [pc EXCEPT ![w] = "waiting"]
             /\ UNCHANGED <<now, status, owner, deadline, net,
                             transfers, keys, crashed>>

Skip(w) == /\ pc[w] = "idle"
           /\ status = "paid"
           /\ pc' = [pc EXCEPT ![w] = "done"]
           /\ UNCHANGED <<now, status, owner, deadline, net,
                           transfers, keys, crashed>>

Send(w) == /\ pc[w] = "claimed"
           /\ now <= deadline
           /\ net' = net \union
                {[kind |-> "pay", by |-> deadline]}
           /\ pc' = [pc EXCEPT ![w] = "waiting"]
           /\ UNCHANGED <<now, status, owner, deadline,
                           transfers, keys, crashed>>

Retry(w) == /\ pc[w] = "waiting"
            /\ now <= deadline
            /\ pc' = [pc EXCEPT ![w] = "claimed"]
            /\ UNCHANGED <<now, status, owner, deadline, net,
                            transfers, keys, crashed>>

AskBank(w) == /\ pc[w] \in {"claimed", "waiting", "asking"}
              /\ now > deadline
              /\ net' = net \union {[kind |-> "ask"]}
              /\ pc' = [pc EXCEPT ![w] = "asking"]
              /\ UNCHANGED <<now, status, owner, deadline,
                              transfers, keys, crashed>>

GotOk(w) == /\ owner = w
            /\ pc[w] \in {"claimed", "waiting", "asking"}
            /\ \E m \in net :
                 /\ m.kind \in {"ok", "found"}
                 /\ net' = net \ {m}
            /\ pc' = [pc EXCEPT ![w] = "sent"]
            /\ UNCHANGED <<now, status, owner, deadline,
                            transfers, keys, crashed>>

GotAbsent(w) == /\ owner = w
                /\ pc[w] = "asking"
                /\ \E m \in net :
                     /\ m.kind = "absent"
                     /\ m.at > deadline
                     /\ net' = net \ {m}
                /\ deadline' = now + Window
                /\ pc' = [pc EXCEPT ![w] = "claimed"]
                /\ UNCHANGED <<now, status, owner, transfers,
                                keys, crashed>>

Mark(w) == /\ pc[w] = "sent"
           /\ status' = "paid"
           /\ pc' = [pc EXCEPT ![w] = "done"]
           /\ UNCHANGED <<now, owner, deadline, net, transfers,
                           keys, crashed>>

Crash(w) == /\ ~crashed
            /\ pc[w] \in {"claimed", "waiting", "asking", "sent"}
            /\ pc' = [pc EXCEPT ![w] = "idle"]
            /\ crashed' = TRUE
            /\ UNCHANGED <<now, status, owner, deadline, net,
                            transfers, keys>>

Deliver(m) == /\ m.kind = "pay"
              /\ net' = (net \ {m}) \union {[kind |-> "ok"]}
              /\ IF Known
                   THEN UNCHANGED <<transfers, keys>>
                   ELSE /\ transfers' = transfers + 1
                        /\ keys' = keys \union {<<Loan, now>>}
              /\ UNCHANGED <<now, status, owner, deadline, pc,
                              crashed>>

Answer(m) == /\ m.kind = "ask"
             /\ net' = (net \ {m}) \union
                  {IF transfers > 0
                     THEN [kind |-> "found"]
                     ELSE [kind |-> "absent", at |-> now]}
             /\ UNCHANGED <<now, status, owner, deadline, pc,
                             transfers, keys, crashed>>

Drop(m) == /\ net' = net \ {m}
           /\ UNCHANGED <<now, status, owner, deadline, pc,
                           transfers, keys, crashed>>

Forget(k) == /\ now >= k[2] + TTL
             /\ keys' = keys \ {k}
             /\ UNCHANGED <<now, status, owner, deadline, pc, net,
                             transfers, crashed>>

Work(w) == \/ Claim(w) \/ Resume(w) \/ Skip(w) \/ Send(w)
           \/ Retry(w) \/ AskBank(w) \/ GotOk(w)
           \/ GotAbsent(w) \/ Mark(w)

Next == \/ Tick
        \/ \E k \in keys : Forget(k)
        \/ \E m \in net : Deliver(m) \/ Answer(m) \/ Drop(m)
        \/ \E w \in Workers : Work(w) \/ Crash(w)

Spec == Init /\ [][Next]_vars

NoDoublePayout == transfers <= 1
NoDeadEnd == \/ status = "paid"
             \/ \E w \in Workers : ENABLED Work(w)
====
