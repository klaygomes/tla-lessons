---- MODULE Place100 ----
EXTENDS Naturals
Workers == {"A", "B"}
(* --algorithm Place100 {
  variables status = "approved", transfers = 0;
  process (w \in Workers) {
    check: if (status = "approved") {
    claim: status := "claimed";
          transfers := transfers + 1;
          status := "paid"
           }
  }
} *)
NoDoublePayout == transfers <= 1
====
