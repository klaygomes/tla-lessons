---- MODULE BooksPilot ----
EXTENDS MarkFirst

Books == INSTANCE PayRecord
RefinesBooks == Books!Spec
====
