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
    body = body.replace('<tr><td>WF_vars(A)</td><td><code>WF_vars(A)</code></td>', '<tr><td>WF_<wbr>vars(A)</td><td><code>WF_<wbr>vars(A)</code></td>')
    body = body.replace('<td>↝</td>', '<td><span class="k-squig">↝</span></td>')
    return kit_highlight(body)


page.check = check_outside_code
page.highlight.highlight = highlight_with_symbol_tables
ok = page.build(
    Path(__file__).resolve().parents[1],
    more=[
        {"section": "two-fixes-that-make-it-worse", "from": "TLC stops at the first broken invariant", "through": "The bakery gets €100,000 again.", "button": "Show the answer"},
        {"section": "two-fixes-that-make-it-worse", "from": "Thursday is rescued again", "through": "and the crash erased it.", "button": "Show the answer"},
    ],
    working=[
        {
            "section": "the-fix-let-the-bank-remember",
            "from": "In the code it is one extra argument",
            "through": "for s in states) == 1",
            "unlock": "act2",
            "note": "This part builds the fix and shows the checker passing it. It opens once you have fixed the desk in the lab below.",
            "button": "Show the fix (opens after the lab)",
            "opened": "You have fixed the desk, so this part is open to read.",
        },
        {
            "section": "recap-and-the-next-bug",
            "from": "The bakery waited",
            "through": "the network stops being polite",
            "unlock": "act2",
            "note": "The end of the story says how the desk was fixed. It opens once you have fixed it in the lab.",
            "button": "Show the ending (opens after the lab)",
            "opened": "You have fixed the desk, so the ending is open to read.",
        },
    ],
)
sys.exit(0 if ok else 1)
