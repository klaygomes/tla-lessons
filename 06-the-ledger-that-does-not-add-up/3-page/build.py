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
ok = page.build(
    Path(__file__).resolve().parents[1],
    more=[
        {"section": "where-is-the-money", "from": "<table", "through": "and the next write fills it.",
         "button": "Show the table (after you have answered)"},
        {"section": "two-writes-written-down", "from": "TLC says no, after one step", "through": "told us so in one line.",
         "button": "Show TLC’s answer (after you have predicted)"},
        {"section": "flip-the-order", "from": "TLC, again in two steps", "through": 'id="figure-crash-window"',
         "button": "Show TLC’s answer (after you have predicted)"},
    ],
    working=[{
        "section": "what-the-checker-says",
        "from": "Here is what TLC says.",
        "through": "TLC has a counterexample ready.",
        "unlock": "act2",
        "note": "TLC’s answers to the four runs are the same answers the lab below gives. Make your prediction, then find them yourself in “Fix the bug”.",
        "button": "Show TLC’s answers (opens after the lab)",
        "opened": "You have fixed the desk, so TLC’s answers are open to read.",
    }],
)
sys.exit(0 if ok else 1)
