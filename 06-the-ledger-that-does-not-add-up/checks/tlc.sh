#!/bin/sh
cd "$(dirname "$0")"
JAR="$HOME/.local/share/klay-learning-ladder/tla/tla2tools.jar"
JAVA=/opt/homebrew/opt/openjdk/bin/java
tlc() {
  "$JAVA" -XX:+UseParallelGC -cp "$JAR" \
    tlc2.TLC -workers 1 -deadlock -cleanup "$@" 2>&1
}
run() {
  echo "===== $*"
  tlc "$@" |
    grep -E '^(Error|Model checking|State [0-9]+:|Back to|[0-9]+ states generated|The depth|/\\ (fund|credit|pc|outbox|held) )'
}
count() {
  echo "===== -continue $* (summary only)"
  tlc -continue "$@" |
    grep -E '^(Model checking|[0-9]+ states generated|The depth)|is violated' |
    sort | uniq -c
}
run Atomic.tla
run -config DebitFirstSum.cfg DebitFirst.tla
run -config DebitFirstNoCrash.cfg DebitFirst.tla
run DebitFirst.tla
count DebitFirst.tla
run -config DebitFirstMem.cfg DebitFirst.tla
run -config DebitFirstKey.cfg DebitFirst.tla
count -config DebitFirstKey.cfg DebitFirst.tla
run -config CreditFirstSum.cfg CreditFirst.tla
run -config CreditFirstNoCrash.cfg CreditFirst.tla
run CreditFirst.tla
count CreditFirst.tla
run -config CreditFirstKey.cfg CreditFirst.tla
count -config CreditFirstKey.cfg CreditFirst.tla
run Outbox.tla
run -config OutboxNoKey.cfg Outbox.tla
count -config OutboxNoKey.cfg Outbox.tla
run Outbox3.tla
run OutboxTwoTxn.tla
count -config OutboxTwoTxn.cfg OutboxTwoTxn.tla
run -config OutboxTwoTxnLive.cfg OutboxTwoTxn.tla
run -config OutboxAny.cfg Outbox.tla
run -config OutboxAnyNoKey.cfg Outbox.tla
run -config CreditFirstKeyDone.cfg CreditFirst.tla
run -config CreditFirstDone.cfg CreditFirst.tla
run OutboxAckFirst.tla
count OutboxAckFirst.tla
run -config OutboxAckFirstLive.cfg OutboxAckFirst.tla
rm -r states 2>/dev/null || true
