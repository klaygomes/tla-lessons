import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "_kit"))
import page

ok = page.build(
    Path(__file__).resolve().parents[1],
    more=[{
        "section": "a-state-nobody-reaches",
        "from": '<pre class="code" data-lang="text"><code>(&#x27;approved&#x27;, (&#x27;idle&#x27;, &#x27;claimed&#x27;)',
        "through": "after Send(B)",
        "button": "Show the state the search finds",
    }],
    working=[{
        "section": "why-this-holds-for-three-hundred",
        "from": '<th scope="col">step</th>',
        "through": "one-worker",
        "unlock": "act2",
        "note": "The table here answers the last question of the lab in “Fix the bug”: why each step keeps the candidate. Work the four reasons out there first; this part opens once you have.",
        "button": "Show the per-action argument (opens after the lab in “Fix the bug”)",
        "opened": "You have given the four reasons, so the per-action argument is open to read.",
    }],
)
sys.exit(0 if ok else 1)
