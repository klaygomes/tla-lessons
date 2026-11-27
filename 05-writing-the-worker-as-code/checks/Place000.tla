---- MODULE Place000 ----
EXTENDS Naturals
Workers == {"A", "B"}
(* --algorithm Place000 {
  variables status = "approved", transfers = 0;
  process (w \in Workers) {
    claim: if (status = "approved") {
          status := "claimed";
          transfers := transfers + 1;
          status := "paid"
           }
  }
} *)
NoDoublePayout == transfers <= 1
====
