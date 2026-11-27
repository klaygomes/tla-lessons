import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "_kit"))
import page

ok = page.build(
    Path(__file__).resolve().parents[1],
    working=[{"section": "the-fix-a-deadline-on-every-request", "from": "Trust any “absent”.", "through": "this one hid it at 36 hours", "unlock": "act2"}],
)
sys.exit(0 if ok else 1)
