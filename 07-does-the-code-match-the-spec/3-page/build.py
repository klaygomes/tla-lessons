import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "_kit"))
import page

kit_check = page.check
kit_highlight = page.highlight.highlight


def check_outside_code(html):
    problems = kit_check(html)
    prose_only = re.sub(r"<pre\b.*?</pre>", "", html, flags=re.S)
    if not re.search(r"\[\[[\w:-]+\]\]", prose_only):
        problems = [p for p in problems if p != "unfilled [[slot]]"]
    return problems


def highlight_with_symbol_tables(body):
    body = re.sub(r'<table class="alt worked">(?=<thead><tr><th scope="col">typeset</th>)', '<table class="alt worked k-symbols">', body)
    return kit_highlight(body)


page.check = check_outside_code
page.highlight.highlight = highlight_with_symbol_tables
lesson = Path(__file__).resolve().parents[1]
two_levels = 'id="figure-two-levels"' if (lesson / "2-figures" / "figures.mjs").exists() else "[pending: diagram:two-levels]"
ok = page.build(
    lesson,
    working=[
        {
            "section": "one-loan-nine-steps",
            "from": "<td>Expire</td>",
            "through": two_levels,
            "unlock": "act1",
            "auto": True,
            "note": 'The unlucky table and its count answer the question at the top of the <a href="#lab">lab below</a>. Predict there, and this part opens.',
        },
        {
            "section": "fix-the-bug",
            "from": "With three workers, the fixed design",
            "through": "With three workers, the fixed design",
            "unlock": "act2",
        },
        {
            "section": "recap-and-the-next-bug",
            "from": "The pilot marked before it sent",
            "through": "The pilot marked before it sent",
            "unlock": "act2",
            "note": "This paragraph names the fix from the lab. It opens once you have fixed the pilot.",
        },
    ],
)
sys.exit(0 if ok else 1)
