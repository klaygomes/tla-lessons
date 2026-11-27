#!/bin/bash
cd "$(dirname "$0")"
JAR="$HOME/.local/share/klay-learning-ladder/tla/tla2tools.jar"
JAVA=/opt/homebrew/opt/openjdk/bin/java
trans() {
  echo "===== pcal.trans $1"
  "$JAVA" -cp "$JAR" pcal.trans -nocfg "$1" 2>&1 |
    grep -vE '^(pcal.trans Version|Parsing completed|Translation completed|New file)'
  rm -f "${1%.tla}.old"
}
run() {
  echo "===== $*"
  "$JAVA" -XX:+UseParallelGC -cp "$JAR" \
    tlc2.TLC -workers 1 -deadlock -cleanup "$@" 2>&1 |
    grep -E '^(Error|Model checking|State [0-9]+:|Back to|Stuttering|[0-9]+ states generated|The depth|/\\ )'
}
count() {
  echo "===== $* (summary only)"
  out=$("$JAVA" -XX:+UseParallelGC -cp "$JAR" \
    tlc2.TLC -workers 1 -deadlock -cleanup "$@" 2>&1)
  echo "$out" | grep -E '^(Model checking|[0-9]+ states generated|The depth)'
  echo "invariant violations reported: $(echo "$out" | grep -c '^Error: Invariant')"
}
for m in OneLabel TwoLabels TwoLabelsP ReadWrite ReadWriteOne \
         Desk DeskUnfair TwoLoans TwoLoansSplit LeaseDesk \
         LeaseDeskNoKey Line LineStrong Ledger LedgerCreditFirst \
         Place000 Place001 Place010 Place100 Place101 Place110; do
  trans $m.tla
done
run OneLabel.tla
run OneLabel3.tla
run TwoLabels.tla
count -continue TwoLabels.tla
run TwoLabels3.tla
run TwoLabelsP.tla
run Place001.tla
run Place010.tla
run Place101.tla
run Place110.tla
count -continue Place101.tla
count -continue Place110.tla
run ReadWrite.tla
count -continue ReadWrite.tla
run ReadWriteOne.tla
run Desk.tla
run Desk3.tla
run DeskUnfair.tla
run TwoLoans.tla
run TwoLoans3.tla
run TwoLoansSplit.tla
count -continue TwoLoansSplit.tla
run LeaseDesk.tla
run LeaseDeskNoKey.tla
run Line.tla
run LineStrong.tla
run Ledger.tla
run LedgerCreditFirst.tla
echo "===== TwoLoans.tla without -deadlock"
"$JAVA" -XX:+UseParallelGC -cp "$JAR" tlc2.TLC -workers 1 -cleanup \
  TwoLoans.tla 2>&1 | grep -E '^(Error|Model checking|[0-9]+ states generated)'
echo "===== diff of TwoLabels and TwoLabelsP translations"
diff <(sed -n '/BEGIN TRANSLATION/,/END TRANSLATION/p' TwoLabels.tla | sed 1d) \
     <(sed -n '/BEGIN TRANSLATION/,/END TRANSLATION/p' TwoLabelsP.tla | sed 1d) \
  && echo "identical apart from the checksum line"
echo "===== fairness lines of the translations"
grep -H -E 'WF_vars|SF_vars' Desk.tla DeskUnfair.tla Line.tla LineStrong.tla
rm -rf states
