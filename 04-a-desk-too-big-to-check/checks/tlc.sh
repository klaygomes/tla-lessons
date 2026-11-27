#!/bin/sh
cd "$(dirname "$0")"
JAR="$HOME/.local/share/klay-learning-ladder/tla/tla2tools.jar"
run() {
  echo "===== $*"
  /opt/homebrew/opt/openjdk/bin/java -XX:+UseParallelGC $JOPTS \
    -cp "$JAR" tlc2.TLC -workers 1 -deadlock -cleanup "$@" 2>&1 |
    grep -E '^(Error|Warning|Model checking|State [0-9]+:|Back to|[0-9]+ states generated|The depth)'
}
for f in growth/*.cfg; do run -config "$f" Desk.tla; done
for f in retries/*.cfg; do run -config "$f" Desk.tla; done
run -config Small.cfg Desk.tla
run -config Live.cfg Desk.tla
run -config Sym.cfg Desk.tla
run -config SymLive.cfg Desk.tla
run -config SymWorkers.cfg Desk.tla
JOPTS="-Dtlc2.TLC.stopAfter=15" run -config Big.cfg OpenDesk.tla
run -config Constraint.cfg OpenDesk.tla
run -config ConstraintLive.cfg OpenDesk.tla
run -config NoCount.cfg NoCount.tla
run -config NoCountLive.cfg NoCount.tla
run -config NoKeyW1L1.cfg NoKey.tla
run -config NoKeyW2L2.cfg NoKey.tla
run -config NoKeyW3L3.cfg NoKey.tla
run -config NoKeyCheap.cfg NoKey.tla
run -config FloristOneVan.cfg Florist.tla
run -config Florist.cfg Florist.tla
run -config FloristBudget.cfg Florist.tla
run -config FloristSmall.cfg Florist.tla
rm -rf states
