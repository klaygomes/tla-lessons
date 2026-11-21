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
ok = page.build(Path(__file__).resolve().parents[1])
sys.exit(0 if ok else 1)
