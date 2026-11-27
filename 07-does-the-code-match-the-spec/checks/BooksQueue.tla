---- MODULE BooksQueue ----
EXTENDS QueueDesk

Books == INSTANCE PayRecord
RefinesBooks == Books!Spec
====
