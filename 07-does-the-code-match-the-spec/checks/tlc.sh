#!/bin/sh
cd "$(dirname "$0")"
JAR="$HOME/.local/share/klay-learning-ladder/tla/tla2tools.jar"
run() {
  echo "===== $*"
  /opt/homebrew/opt/openjdk/bin/java -XX:+UseParallelGC -cp "$JAR" \
    tlc2.TLC -workers 1 -deadlock -cleanup "$@" 2>&1 |
    grep -E '^(Error|is not defined|Model checking|Checking temporal|State [0-9]+:|Back to|[0-9]+ states generated|The depth|/\\ (pc|transfers|status|queue|keys|crashed) )'
}
run PayOnce.tla
run QueueDesk.tla
run -config AtSend.cfg QueueDesk.tla
run -config AtTable.cfg QueueDesk.tla
run -config Trivial.cfg QueueDesk.tla
run -config TrivialSafety.cfg QueueDesk.tla
run -config SafetyOnly.cfg QueueDesk.tla
run -config Bang.cfg QueueDesk.tla
run StutterFree.tla
run NoKey.tla
run -config NoKeyInv.cfg NoKey.tla
run -config NoKeyAll.cfg NoKey.tla
run NoLease.tla
run -config SafetyOnly.cfg NoLease.tla
run QueueDesk3.tla
run QueueDesk4.tla
run NoKey3.tla
run MarkFirst.tla
run -config MarkFirstOwn.cfg MarkFirst.tla
run -config SafetyOnly.cfg MarkFirst.tla
run MarkFirst3.tla
run -config Liar.cfg MarkFirst.tla
run -config Liar.cfg QueueDesk.tla
run SplitMark.tla
run BooksQueue.tla
run BooksPilot.tla
run IdemKeyRefines.tla
if [ -d states ]; then rmdir states; fi
