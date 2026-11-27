You are a fresh reader and editor for lesson {N} of "The payout desk", a course on TLA+ and the TLC model checker. You have no other context, on purpose. Read only these files, in /Users/cleiton.loiola/personal/lessons/tla-plus/:

- the lesson: {FOLDER}/1-prose.md
- the course conventions and glossary: series.md
- for terms the lesson recaps from earlier lessons, you may open an earlier lesson's 1-prose.md (01-one-loan-paid-twice, 02-the-loan-nobody-paid, and later folders below {N}) to check what it taught, but judge this lesson as its reader meets it.

Do not read the teacher's sheet (1-sheet.md), TASKS.md, checks/ or any other notes before your first full read: you must see only what the learner sees.

**Who reads it.** An experienced software engineer (TypeScript, AWS, SQL), new to formal methods, who understands best through small Python mirrors, has done every earlier lesson, and reads this one top to bottom, once.

**Pass 1, judge.** List, with line numbers:

1. Every term, symbol, operator or TLC message used before it is explained, even inline, even once (concept before symbol). A recap counts only if it says what the term means.
2. Every TLA+ formula or PlusCal block not followed by a read-aloud: each operator in words, the whole as one bold sentence, a number from the story pushed through it, and a Python mirror with its real output (reusing an earlier snippet is fine when the prose links them).
3. Every step of a counterexample walkthrough or argument where you had to stop and work something out the prose did not say.
4. Every place where a definition arrives before its intuition.
5. Anything wrong: a number that disagrees with its snippet's output, a snippet that fails to run (other than the build-it asserts, which fail by design, and fences that continue an earlier snippet), a claim that does not follow.
6. Continuity: every recap or mention of an earlier lesson that does not match what that lesson's 1-prose.md actually taught (names, terms, numbers, the fix).

**Pass 2, improve.** Fix every item yourself in 1-prose.md: idea first in words with a number, then the formula, then the read-aloud; add missing mirrors (standard library, about 15 lines, every line at most 66 characters, no comments; run with `python3 -I` and paste the real output); fill gaps in walkthroughs. Never change a number that comes from TLC (the sheet's Assumptions and checks/tlc-results.txt are the source; you may read checks/tlc-results.txt only after pass 1 to confirm a number). Keep the story, the voice (a natural teacher: no robotic short sentences, no em dashes, curly quotes), headings, slots (`[[diagram:...]]`, `[[lab]]`, `[[lab-act2]]`) and the build-it asserts. Do not bloat; move text rather than repeat it.

**Check.** Run `python3 -I _kit/check_prose.py {FOLDER}` from the series root. Done when lines>66 is 0, em dashes 0, and only the fences that fail by design fail.

**Limits.** No agent-voice, no subagents, no browsers, no TLC runs. Scratch files in /private/tmp/claude-502/-Users-cleiton-loiola/d131b4dc-daa3-4c97-93ed-7f5697c114d1/scratchpad/review{N}/. Edit only {FOLDER}/1-prose.md. Do not commit.

**Final report**, under 150 words: findings per kind (1 to 6) and the three worst; what you changed; new snippets and outputs; the checker line; verdict (ready, or what is open), and any change the sheet now needs.
