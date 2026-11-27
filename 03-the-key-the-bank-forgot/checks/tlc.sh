#!/bin/sh
cd "$(dirname "$0")"
JAR="$HOME/.local/share/klay-learning-ladder/tla/tla2tools.jar"
JAVA=/opt/homebrew/opt/openjdk/bin/java
run() {
  echo "===== $*"
  "$JAVA" -XX:+UseParallelGC -cp "$JAR" \
    tlc2.TLC -workers 1 -deadlock -cleanup "$@" 2>&1 |
    grep -E '^(Error: [A-Z]|Model checking|State [0-9]+:|Back to|[0-9]+ states generated|The depth|/\\ (now|status|pc|transfers|keys|net|deadline) )'
}
count() {
  echo "===== -continue $*"
  "$JAVA" -XX:+UseParallelGC -cp "$JAR" \
    tlc2.TLC -workers 1 -deadlock -cleanup -continue "$@" 2>&1 |
    grep -E '^(Error: [A-Z][a-z]+ [A-Za-z]+ is violated|Model checking|[0-9]+ states generated)' |
    sort -u
}
run ForgetKey.tla
run Clock.tla
count Clock.tla
run -config ClockShort.cfg Clock.tla
run -config ClockTTL6.cfg Clock.tla
run -config ClockTTL6Long.cfg Clock.tla
run ClockAsk.tla
run -config ClockAsk6.cfg ClockAsk.tla
run -config LossyKeep.cfg Lossy.tla
run Lossy.tla
count Lossy.tla
run Ask.tla
count Ask.tla
run DeadlineOnly.tla
run Fix.tla
run -config growth/Fix3.cfg Fix.tla
run Fix3.tla
run -config FixLongWindow.cfg Fix.tla
run -config FixTTL3Window2.cfg Fix.tla
run -config FixTTL3Window3.cfg Fix.tla
run FixNoRefuse.tla
run -config FixStale3.cfg FixStale.tla
run FixStale.tla
count FixStale.tla
for m in 0 1 2 3 4 5 6; do count -config growth/Clock$m.cfg Clock.tla; done
run -config growth/Fix5.cfg Fix.tla
rmdir states 2>/dev/null
exit 0
