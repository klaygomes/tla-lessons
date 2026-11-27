#!/bin/sh
cd "$(dirname "$0")"
JAR="$HOME/.local/share/klay-learning-ladder/tla/tla2tools.jar"
run() {
  echo "===== $*"
  /opt/homebrew/opt/openjdk/bin/java -XX:+UseParallelGC -cp "$JAR" \
    tlc2.TLC -workers 1 -deadlock -cleanup "$@" 2>&1 |
    grep -E '^(Error|Model checking|State [0-9]+:|Finished computing|[0-9]+ states generated|The depth|/\\ (pc|transfers|status|owner|keys) )'
}
for n in 2 3 4 5 6 12; do run -config Desk$n.cfg Desk.tla; done
run -config Ind0.cfg Desk.tla
run -config Ind1.cfg Desk.tla
for n in 2 3 4 5; do run -config Inductive$n.cfg Desk.tla; done
run -config InvReach3.cfg Desk.tla
run -config InitHolds.cfg Proof.tla
run -config Obligations.cfg Proof.tla
run -config ObligationsWeak.cfg Proof.tla
run -config BusyReach.cfg Desk.tla
run -config Busy.cfg Desk.tla
run -config Vacuous.cfg Desk.tla
run -config LeaseInd.cfg LeaseDesk.tla
run -config LeaseReach.cfg LeaseDesk.tla
for m in Naive LeaseCrash ResumeCrash; do
  run -config "${m}1.cfg" "$m.tla"
  run -config "${m}2.cfg" "$m.tla"
done
run -config NaiveInd.cfg NaiveInd.tla
for n in 2 3; do
  run -config "Fixed$n.cfg" Fixed.tla
  run -config "FixedWeak$n.cfg" Fixed.tla
  run -config "FixedInd$n.cfg" Fixed.tla
done
rm -rf states
