"""Real-Chromium smoke check for the local card FLIP.

Runs the shared UI fixture with `?probe=flip`, which re-renders the same home
route in reverse order and records how many cards were inverted. The result is
read back from `data-bt-metrics` so the check needs no driver dependency.

Usage:
    python scripts/motion_smoke.py
    python scripts/motion_smoke.py --tag motion
"""
from __future__ import annotations

import argparse
import base64
import html
import json
import os
import re
import subprocess
import tempfile
from pathlib import Path

from ui_preview import DEFAULT_BROWSER, ROOT, build_page

EXPECTED = {
    'flip.animated > 0': lambda r: r['flip']['animated'] > 0,
    'flip.retainedNodes': lambda r: r['flip']['retainedNodes'] is True,
    'flip.clearedAfter == 0': lambda r: r['flip']['clearedAfter'] == 0,
    'flip.leftoverTransform == 0': lambda r: r['flip']['leftoverTransform'] == 0,
    'motionMode=none animates nothing': lambda r: r['motionNone']['animated'] == 0,
    'active preview animates nothing': lambda r: r['previewActive']['animated'] == 0,
    'theme reveal animates nothing': lambda r: r['themeReveal']['animated'] == 0,
    'append keeps the list and fades only new cards': lambda r: r['append']['after'] == r['append']['before'] + 4
    and r['append']['animated'] == 4,
    'subtle mode animates and is shorter': lambda r: r['subtle']['animated'] > 0
    and 0 < r['subtle']['duration'] < r['flip']['duration'],
}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--browser', default=os.environ.get('BROWSER_EXECUTABLE', DEFAULT_BROWSER))
    parser.add_argument('--tag', default='motion')
    parser.add_argument('--wait', type=int, default=6000)
    parser.add_argument('--out', default=str(ROOT / 'output' / 'ui-preview'))
    args = parser.parse_args()

    out_dir = Path(args.out) / args.tag
    out_dir.mkdir(parents=True, exist_ok=True)
    page = out_dir / 'fixture.html'
    build_page(ROOT, page)

    profile = Path(tempfile.gettempdir()) / 'bilitube-ui-preview-profile'
    profile.mkdir(parents=True, exist_ok=True)
    url = f'{page.as_uri()}?scenario=home&theme=light&probe=flip'
    command = [
        args.browser, '--headless=new', '--disable-gpu', '--no-sandbox',
        f'--user-data-dir={profile}', f'--virtual-time-budget={args.wait}', '--dump-dom', url,
    ]
    result = subprocess.run(command, capture_output=True, text=True, timeout=240)
    dom = result.stdout
    error = re.search(r'data-bt-error="([^"]*)"', dom)
    if error:
        raise SystemExit(f'page error: {html.unescape(error.group(1))[:800]}')
    encoded = re.search(r'data-bt-metrics="([^"]+)"', dom)
    if not encoded:
        raise SystemExit(f'no metrics recorded\n{dom[:1200]}')
    metrics = json.loads(base64.b64decode(html.unescape(encoded.group(1))).decode('utf-8'))
    metrics['measuredAt'] = f'{Path(args.browser).name} headless, fixture home grid (12 cards)'
    (out_dir / 'motion-metrics.json').write_text(json.dumps(metrics, indent=2, ensure_ascii=False), encoding='utf-8')

    failures = []
    for label, check in EXPECTED.items():
        try:
            ok = bool(check(metrics))
        except Exception:  # noqa: BLE001 - any structural surprise is a failure
            ok = False
        print(f'{"PASS" if ok else "FAIL"}: {label}')
        if not ok:
            failures.append(label)
    print(json.dumps(metrics, indent=2, ensure_ascii=False))
    if failures:
        raise SystemExit(f'{len(failures)} motion checks failed')


if __name__ == '__main__':
    main()
