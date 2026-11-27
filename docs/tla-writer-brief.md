You are drafting lesson {N}, "{TITLE}", of "The payout desk", a story-driven course on TLA+ and the TLC model checker. Write the prose and the teacher's sheet only (no figures, no page).

Read first, in /Users/cleiton.loiola/personal/lessons/tla-plus/: TASKS.md ("Source rule", "The learner's rules"), series.md (world, conventions, glossary, course plan; reuse terms exactly), ~/.claude/skills/klay-learning-ladder/references/writing.md (voice, shape, sheet format), lesson 1 (01-one-loan-paid-twice/1-prose.md, 1-sheet.md) as the style and depth reference, and lesson 2 (02-the-loan-nobody-paid/1-prose.md, 1-sheet.md) for terms, story continuity and its "Next bug". Other agents are drafting lessons 3 to 8 in parallel; assume the reader has lessons 1 to {PREV} and recap in a line where needed.

A previous session started this lesson and was interrupted: {FOLDER}/checks/ already holds specs, configs and possibly tlc.sh, check.py and tlc-results.txt. Read them first and reuse what is sound; fix or extend what is not. Delete any `checks/states/` folders TLC left behind (TLC run with -cleanup should not leave them).

The lesson's question (from the course plan): {QUESTION}
Story seed: {STORY}

Rules (all mandatory):
- Source rule: no book. Every claim about TLA+ syntax, PlusCal, TLC or TLAPS behaviour is run for real or listed in the sheet's Assumptions as unconfirmed. Every number about a spec (states generated and distinct, depth, counterexample length and steps) comes from a real TLC run in checks/ and is mirrored by checks/check.py (a small Python breadth-first checker) where feasible. Keep checks/tlc.sh regenerating checks/tlc-results.txt.
- TLC: `/opt/homebrew/opt/openjdk/bin/java -XX:+UseParallelGC -cp ~/.local/share/klay-learning-ladder/tla/tla2tools.jar tlc2.TLC -workers 1 -deadlock -cleanup <Spec>.tla` from checks/. Always `-workers 1` (the machine is shared); keep models small (seconds, not minutes). PlusCal: `pcal.trans` from the same jar.
- Natural teacher voice with a storyteller's playfulness; no em dashes; curly quotes in prose. Define every term before use; concept before symbol: show the idea with a number from the story before its formula.
- After every TLA+ formula, read it aloud: each operator in words, then the whole as one bold sentence, then mirror it in a short Python snippet (standard library, every line at most 66 characters, no comments) whose real output you paste (run with python3 -I). TLA+ in ```tla fences, at most 66 characters per line.
- Conventions from series.md: loan 4471, €50,000, the bakery on the harbour; workers A, B, C; variables status, pc, transfers (plus the lesson's own).
- Shape like lessons 1 and 2: open on the bug a customer or finance notices, prediction prompts, two worked examples, the spec piece by piece, TLC output read line by line, the fix, a build-it challenge with asserts you ran, a concept check of 2 or 3 questions (answers only in the sheet), and 2 or 3 problems with hint ladders in the sheet.
- Figure slots `[[diagram:NAME]]` (one per new concept) with a spec in the sheet naming the diagram-design type and whether it animates; `[[lab]]` and `[[lab-act2]]` slots specified in the sheet like lesson 2's, naming an iwrzwr study from ~/.local/share/klay-learning-ladder/iwrzwr-visual-archive/catalog.json (confirm the name exists). Act 2's success must require the real fix, not luck.
- The sheet ends with "Next bug" leading into lesson {NEXT}'s question ({NEXT_QUESTION}) and "Assumptions" listing every TLC run with its result.
- Run `python3 -I _kit/check_prose.py {FOLDER}` from the series root and fix what it flags.
- Save CPU: no agent-voice, no subagents, no browsers. Scratch files go in /private/tmp/claude-502/-Users-cleiton-loiola/d131b4dc-daa3-4c97-93ed-7f5697c114d1/scratchpad/lesson{N}/.

Write only inside {FOLDER}/ (1-prose.md, 1-sheet.md, checks/). Do not edit series.md, TASKS.md, other lesson folders or _kit/. Do not commit. Final report under 200 words: files, word count, TLC runs and their key numbers, check_prose result, anything left unconfirmed.
