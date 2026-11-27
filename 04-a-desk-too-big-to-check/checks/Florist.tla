---- MODULE Florist ----
EXTENDS Desk

CONSTANTS FloristLoans, Florist

Account(l) == IF l \in FloristLoans THEN Florist ELSE l

BankByAccount(l) ==
    /\ transfers' = IF Account(l) \in keys THEN transfers
                    ELSE [transfers EXCEPT ![l] = @ + 1]
    /\ keys' = keys \union {Account(l)}

PaidMeansMoney ==
    \A l \in Loans : status[l] = "paid" => transfers[l] = 1
Budget == TLCGet("level") < 4
====
