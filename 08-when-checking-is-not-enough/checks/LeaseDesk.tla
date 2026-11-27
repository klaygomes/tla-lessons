---- MODULE LeaseDesk ----
EXTENDS Desk

Expire == /\ status = "claimed"
          /\ status' = "approved"
          /\ UNCHANGED <<pc, transfers>>

LeaseNext == Next \/ Expire
====
