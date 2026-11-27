import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "_kit"))
import page

LOCK = {
    "unlock": "act2",
    "note": "This part gives away how to fix finance’s model. It opens once both runs in the lab are signed.",
    "button": "Read this after the lab (opens when finance signs)",
    "opened": "Finance has signed, so this part is open to read.",
}

ok = page.build(
    Path(__file__).resolve().parents[1],
    more=[{"section": "how-small-is-small-enough", "from": "It doesn’t: 727 states, no error.", "through": "It doesn’t: 727 states, no error.", "button": "Show what TLC found"}],
    working=[
        {"section": "what-people-get-wrong", "from": "No error has been found means it passed.", "through": "A constraint is a cheaper way to write a bound.", **LOCK},
        {"section": "recap-and-the-next-bug", "from": "Finance’s model never finished for two reasons.", "through": "Next lesson, a new engineer finds the specs too hard to read", **LOCK},
    ],
)
sys.exit(0 if ok else 1)
