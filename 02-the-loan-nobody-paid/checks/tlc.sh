#!/bin/sh
cd "$(dirname "$0")"
JAR="$HOME/.local/share/klay-learning-ladder/tla/tla2tools.jar"
run() {
  echo "===== $*"
  /opt/homebrew/opt/openjdk/bin/java -XX:+UseParallelGC -cp "$JAR" \
    tlc2.TLC -deadlock -cleanup "$@" 2>&1 |
    grep -E '^(Error|Model checking|State [0-9]+:|Back to|[0-9]+ states generated|/\\ (pc|transfers|status) )'
}
run Live.tla
run LiveFair.tla
run Crash.tla
run Lease.tla
run -config LivenessOnly.cfg Lease.tla
run Resume.tla
run -config LivenessOnly.cfg Resume.tla
run IdemKey.tla
run IdemKey3.tla
run LeaseKey.tla
run ForgetKey.tla
run -config MoneyOnly.cfg Crash.tla
run -config MoneyOnly.cfg IdemKey.tla
