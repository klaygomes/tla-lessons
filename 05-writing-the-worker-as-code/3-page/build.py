import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "_kit"))
import page

LESSON = Path(__file__).resolve().parents[1]
kit_check = page.check


def check_outside_code(html):
    problems = kit_check(html)
    prose_only = re.sub(r"<pre\b.*?</pre>", "", html, flags=re.S)
    if not re.search(r"\[\[[\w:-]+\]\]", prose_only):
        problems = [p for p in problems if p != "unfilled [[slot]]"]
    return problems


kit_highlight = page.highlight.highlight


def repair(body):
    body = body.replace("<code>(<em></code> and <code></em>)</code>", "<code>(*</code> and <code>*)</code>")
    body = body.replace('<table class="alt worked"><thead><tr><th scope="col">labels (cut lines)', '<table class="alt worked k-cuts"><thead><tr><th scope="col">labels (cut lines)')
    return kit_highlight(body)


page.check = check_outside_code
page.highlight.highlight = repair
rule_from = 'id="figure-interactions"' if (LESSON / "2-figures" / "interactions.html").exists() else "A rough guide for TypeScript"
ok = page.build(
    LESSON,
    more=[
        {"section": "one-behavior-label-by-label", "from": "pc of A", "through": "No such row can exist.",
         "button": "Show the steps (after you have predicted)"},
    ],
    working=[
        {"section": "the-rule-one-label-per-real-interaction", "from": "Here is what the lab shows", "through": "Only the code knows that.",
         "unlock": "act1", "button": "Show the table (opens after you try all eight placements in the lab)",
         "note": "This part lists every placement's result. It opens once you have tried all eight in the lab above.",
         "opened": "You have tried every placement, so the table is open to compare with."},
        {"section": "the-rule-one-label-per-real-interaction", "from": rule_from, "through": "Noor labels hiding a gap",
         "unlock": "act2", "button": "Show the worked count (opens after you fix the bug)",
         "opened": "You have fixed the desk, so the worked count is open to read."},
        {"section": "recap-and-the-next-bug", "from": "refused requests went back to zero", "through": "refused requests went back to zero",
         "unlock": "act2", "button": "Show how the story ends (opens after you fix the bug)",
         "opened": "You have fixed the desk, so the ending is open to read."},
    ],
)
sys.exit(0 if ok else 1)
