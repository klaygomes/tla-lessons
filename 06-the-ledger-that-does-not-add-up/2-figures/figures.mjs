export default k => {
  const { g, line, path, rect, circle, text, masked, arrow, step, range } = k;

  const POT = 200000;
  const AMOUNT = { 4471: 50000, 4472: 30000 };
  const START = { fund: POT, credit: { 4471: 0, 4472: 0 } };
  const debit = (s, l) => ({ fund: s.fund - AMOUNT[l], credit: s.credit });
  const credit = (s, l) => ({ fund: s.fund, credit: { ...s.credit, [l]: s.credit[l] + AMOUNT[l] } });
  const crash = s => s;
  const total = s => s.fund + s.credit[4471] + s.credit[4472];
  const run = moves => moves.reduce((rows, [name, f, l]) => [...rows, { ...f(rows[rows.length - 1], l), name, l }], [{ name: 'start', ...START }]);

  const CLEAN = run([['debit', debit, 4471], ['credit', credit, 4471], ['debit', debit, 4472], ['credit', credit, 4472]]);
  const CRASHED = run([['debit', debit, 4471], ['crash', crash], ['debit', debit, 4471], ['credit', credit, 4471]]);
  const DEBIT_FIRST = run([['Debit', debit, 4471], ['Crash', crash], ['Debit', debit, 4471], ['Credit', credit, 4471]]);
  const CREDIT_FIRST = run([['Credit', credit, 4471], ['Crash', crash], ['Credit', credit, 4471], ['Debit', debit, 4471]]);
  const expect = (rows, totals, what) => {
    const got = rows.map(total).join(' ');
    if (got !== totals.join(' ')) throw new Error(`${what}: totals ${got}, expected ${totals.join(' ')}`);
  };
  expect(CLEAN, [200000, 150000, 200000, 170000, 200000], 'clean table');
  expect(CRASHED, [200000, 150000, 150000, 100000, 150000], 'crash table');
  expect(DEBIT_FIRST, [200000, 150000, 150000, 100000, 150000], 'debit first');
  expect(CREDIT_FIRST, [200000, 250000, 250000, 300000, 250000], 'credit first');
  if (CREDIT_FIRST[4].credit[4471] !== 100000 || CREDIT_FIRST[4].fund !== 150000) throw new Error('credit first: final state');

  const sumOver = (S, f) => (S.length ? f[Math.min(...S)] + sumOver(S.filter(x => x !== Math.min(...S)), f) : 0);
  const SUM_CREDIT = { 4471: 50000, 4472: 30000 };
  if (sumOver([4472], SUM_CREDIT) !== 30000 || sumOver([4471, 4472], SUM_CREDIT) !== 80000) throw new Error('sum-over: totals');

  const plainAgain = 50000 + 50000;
  const keyedAgain = 50000;

  const euro = n => `${n < 0 ? '−' : ''}€${Math.abs(n).toLocaleString('en-US')}`;
  const num = n => n.toLocaleString('en-US');
  const signed = n => `${n < 0 ? '−' : '+'}€${Math.abs(n).toLocaleString('en-US')}`;

  const T0 = 0.2, HOLD = 1.1, LEN = 0.6;
  const at = (i, extra = 0) => Number((T0 + i * HOLD + extra).toFixed(2));
  const rise = (i, o = {}) => ({ k: 'rise', d: at(i, o.extra || 0), len: LEN, dx: o.dx ?? 0, dy: o.dy ?? 8 });
  const land = (i, extra = 0) => ({ k: 'land', d: at(i, extra), len: LEN, s0: 1.12 });

  const label = (x, y, s, cls = 'k-label', o = {}) => masked(x, y, s, { cls, ...o });
  const msg = (slug, x1, x2, y, s, o = {}) => {
    const { tone = '', ret = false, at: lx = (x1 + x2) / 2, cls = '', textCls } = o;
    const dir = Math.sign(x2 - x1);
    const lineCls = ['k-arrow', ret ? 't6-dash' : '', cls].filter(Boolean).join(' ');
    return g({},
      arrow(slug, [[x1, y], [x2 - dir, y]], { tone, cls: lineCls }),
      label(lx, y - 9, s, textCls || (tone === 'accent' ? 'k-num-accent' : 'k-label')));
  };
  const actor = (cx, y, w, name, sub) => g({},
    rect(cx - w / 2, y, w, 48, { cls: 'k-mask-box', rx: 6 }),
    rect(cx - w / 2, y, w, 48, { cls: 'k-box', rx: 6 }),
    text(cx, y + (sub ? 20 : 29), name, { cls: 'k-name' }),
    sub ? text(cx, y + 38, sub, { cls: 'k-tick' }) : '');
  const lifeline = (x, y1, y2) => line(x, y1, x, y2, { cls: 't6-life' });
  const act = (x, y1, y2) => rect(x - 4, y1, 8, y2 - y1, { cls: 't6-act' });
  const crashMark = (x, y) => path(`M${x - 8} ${y - 8}L${x + 8} ${y + 8}M${x + 8} ${y - 8}L${x - 8} ${y + 8}`, { cls: 'k-mark-bad' });
  const tick = (x, y) => path(`M${x - 5} ${y}L${x - 1} ${y + 4}L${x + 6} ${y - 4}`, { cls: 't6-tick' });
  const hatch = (slug, x, y, w, h) => rect(x, y, w, h, { fill: `url(#${slug}-hatch)`, cls: 'k-bar-hatch' });
  const lock = (x, y) => g({},
    path(`M${x - 4} ${y - 4}V${y - 7}A4 4 0 0 1 ${x + 4} ${y - 7}V${y - 4}`, { cls: 't6-lock-arc' }),
    rect(x - 6, y - 4, 12, 10, { cls: 't6-lock', rx: 2 }));
  const valueCard = (x, y, w, top, value, tone) => g({},
    rect(x, y, w, 48, { cls: 'k-mask-box', rx: 6 }),
    rect(x, y, w, 48, { cls: tone === 'bad' ? 'k-box-accent' : tone === 'ok' ? 'k-box-ok' : 'k-box', rx: 6 }),
    text(x + w / 2, y + 19, top, { cls: 'k-tick' }),
    text(x + w / 2, y + 39, value, { cls: tone === 'bad' ? 'k-num-accent' : tone === 'ok' ? 'k-num-ok' : 'k-num' }));

  const twoLedgers = L => {
    const s = L.slug, ph = L.phone;
    const X = ph ? { W: 60, T: 180, C: 300, w: 104 } : { W: 120, T: 360, C: 600, w: 168 };
    const bottom = 304;
    return [
      lifeline(X.W, 72, 196), lifeline(X.T, 72, bottom), lifeline(X.C, 72, bottom),
      actor(X.W, 24, X.w, 'worker', 'book(loan)'),
      actor(X.T, 24, X.w, ph ? 'treasury' : 'treasury ledger', ph ? 'our database' : 'payout database'),
      actor(X.C, 24, X.w, 'loan ledger', ph ? 'loans team' : 'loans team service'),
      step(1, 'the worker debits the treasury ledger 50,000 euros for loan 4471, and the debit is written',
        g({ anim: rise(0, { dx: -12, dy: 0 }) }, act(X.W, 104, 176),
          msg(s, X.W + 4, X.T, 116, ph ? 'debit €50,000' : 'debit 4471, €50,000'),
          msg(s, X.T, X.W + 4, 148, 'written', { ret: true, textCls: 'k-num' }))),
      step(2, 'a deploy crashes the worker between the two writes',
        g({ anim: land(1) }, crashMark(X.W, 184),
          text(X.W + 16, 190, 'deploy', { anchor: 'start', cls: 'k-note-accent' }))),
      step(3, 'the credit to the loan ledger is never sent',
        g({ anim: rise(2, { dx: -12, dy: 0 }) },
          arrow(s, [[X.W + 4, 236], [X.C - 1, 236]], { cls: 'k-arrow t6-ghost' }),
          label((X.W + X.C) / 2 + (ph ? 20 : 0), 227, ph ? 'credit: never sent' : 'credit 4471: never sent', 'k-label'))),
      step(4, 'at month-end the treasury is down 50,000 euros, loan 4471 shows 0, and 50,000 euros are in no ledger',
        g({ anim: land(3) },
          text(16, 340, 'month-end', { anchor: 'start', cls: 'k-name' }),
          valueCard(X.T - (ph ? 52 : 72), 356, ph ? 104 : 144, ph ? 'treasury' : 'treasury ledger', euro(-50000)),
          valueCard(X.C - (ph ? 52 : 72), 356, ph ? 104 : 144, 'loan 4471', euro(0)),
          ph ? [text(16, 438, '€50,000 in no ledger', { anchor: 'start', cls: 'k-name-accent' })]
            : text(16, 438, '€50,000 in no ledger', { anchor: 'start', cls: 'k-name-accent' }))),
      ph ? text(16, 470, 'dashed: a reply, or never sent', { anchor: 'start', cls: 'k-tick' })
        : text(704, 438, 'dashed: a reply, or never sent', { anchor: 'end', cls: 'k-tick' }),
    ];
  };

  const sumOverFig = L => {
    const s = L.slug, ph = L.phone;
    const P = ph ? { x: 16, w: 228, callX: 56, retX: 208 } : { x: 40, w: 320, callX: 100, retX: 300 };
    const rows = [
      { y: 64, call: 'SumOver({4471, 4472})', body: '50,000 + SumOver({4472})' },
      { y: 168, call: 'SumOver({4472})', body: '30,000 + SumOver({})' },
      { y: 272, call: 'SumOver({})', body: 'S is empty: 0' },
    ];
    const h = 56;
    const node = r => g({},
      rect(P.x, r.y, P.w, h, { cls: 'k-mask-box', rx: 6 }),
      rect(P.x, r.y, P.w, h, { cls: 'k-box', rx: 6 }),
      text(P.x + 14, r.y + 24, r.call, { anchor: 'start', cls: 't6-call' }),
      text(P.x + 14, r.y + 44, r.body, { anchor: 'start', cls: 'k-num' }));
    const call = i => g({},
      arrow(s, [[P.callX, rows[i].y + h], [P.callX, rows[i + 1].y - 2]]),
      label(P.callX + 12, rows[i].y + h + 28, 'calls', 'k-label', { anchor: 'start' }));
    const ret = (i, v) => g({},
      arrow(s, [[P.retX, rows[i + 1].y], [P.retX, rows[i].y + h + 2]], { cls: 'k-arrow t6-dash' }),
      label(P.retX + 12, rows[i].y + h + 28, `returns ${num(v)}`, 'k-num', { anchor: 'start' }));
    const res = ph ? { x: 268, w: 76 } : { x: 480, w: 160 };
    return [
      text(P.x, 40, 'CHOOSE picks 4471 (any fixed choice)', { anchor: 'start', cls: 'k-note' }),
      step(1, 'the first call: SumOver of 4471 and 4472 picks 4471 and needs 50,000 plus SumOver of 4472',
        g({ anim: rise(0) }, node(rows[0]))),
      step(2, 'it calls SumOver of 4472, which needs 30,000 plus SumOver of the empty set',
        g({ anim: rise(1) }, call(0), node(rows[1]))),
      step(3, 'it calls SumOver of the empty set, which is 0',
        g({ anim: rise(2) }, call(1), node(rows[2]))),
      step(4, 'the empty set returns 0', g({ anim: rise(3, { dy: -8 }) }, ret(1, 0))),
      step(5, 'SumOver of 4472 returns 30,000 plus 0, which is 30,000', g({ anim: rise(4, { dy: -8 }) }, ret(0, 30000))),
      step(6, 'the first call returns 50,000 plus 30,000, which is 80,000',
        g({ anim: land(5) },
          arrow(s, [[P.x + P.w, rows[0].y + h / 2], [res.x - 2, rows[0].y + h / 2]], { cls: 'k-arrow t6-dash' }),
          rect(res.x, rows[0].y + 4, res.w, 48, { cls: 'k-mask-box', rx: 6 }),
          rect(res.x, rows[0].y + 4, res.w, 48, { cls: 'k-box-accent', rx: 6 }),
          text(res.x + res.w / 2, rows[0].y + 34, num(80000), { cls: 'k-name-accent' }))),
      ph ? [text(16, 360, 'solid: a call', { anchor: 'start', cls: 'k-tick' }), text(16, 380, 'dashed: the sum it returns', { anchor: 'start', cls: 'k-tick' })]
        : text(16, 368, 'solid: a call · dashed: the sum it returns', { anchor: 'start', cls: 'k-tick' }),
    ];
  };

  const conservation = L => {
    const s = L.slug, ph = L.phone;
    const scale = v => v / 1000;
    const panel = (rows, x0, base, title, crashed) => {
      const pitch = ph ? 58 : 62, bw = 32;
      const yOf = v => base - scale(v);
      const out = [text(x0 - 8, base - scale(POT) - 40, title, { anchor: 'start', cls: 'k-name' })];
      out.push(line(x0 - 8, base, x0 + 5 * pitch - 8, base, { cls: 'k-axis' }), line(x0 - 8, yOf(POT), x0 + 5 * pitch - 8, yOf(POT), { cls: 't6-pot' }));
      rows.forEach((r, i) => {
        const cx = x0 + 22 + i * pitch, x = cx - bw / 2;
        let y = base;
        const seg = (v, cls) => { if (!v) return ''; y -= scale(v); return rect(x, y, bw, scale(v), { cls }); };
        out.push(seg(r.fund, 't6-seg-t'), seg(r.credit[4471], 't6-seg-a'), seg(r.credit[4472], 't6-seg-b'));
        const gap = POT - total(r);
        const lost = crashed && i >= 2 ? 50000 : 0;
        const hands = gap - lost;
        if (hands > 0) { out.push(rect(x, y - scale(hands), bw, scale(hands), { cls: 't6-hands' })); y -= scale(hands); }
        if (lost > 0) { out.push(hatch(s, x, y - scale(lost), bw, scale(lost))); y -= scale(lost); }
        out.push(text(cx, yOf(POT) - 10, num(total(r)), { cls: total(r) !== POT ? (lost ? 'k-num-accent' : 'k-num') : 'k-num' }));
        out.push(text(cx, base + 18, String(i), { cls: 'k-tick' }));
        out.push(text(cx, base + 36, r.name, { cls: 'k-tick' }));
      });
      return g({}, out);
    };
    const yAxis = (x, base) => g({},
      [[0, '0'], [100000, '100,000'], [200000, '200,000']].map(([v, t]) => text(x, base - scale(v) + 4, t, { anchor: 'end', cls: 'k-tick' })));
    const legendRow = (x, y, items, dx) => g({}, items.map(([mark, t], i) => {
      const lx = ph ? x : x + i * dx, ly = ph ? y + i * 24 : y;
      return g({}, mark(lx, ly), text(lx + 24, ly + 4, t, { anchor: 'start', cls: 'k-label' }));
    }));
    const sw = cls => (x, y) => rect(x, y - 7, 16, 14, { cls });
    const items = [
      [sw('t6-seg-t'), 'treasury'],
      [sw('t6-seg-a'), 'loan 4471'],
      [sw('t6-seg-b'), 'loan 4472'],
      [sw('t6-hands'), "in the worker's hands"],
      [(x, y) => hatch(s, x, y - 7, 16, 14), 'nobody will fill this'],
      [(x, y) => line(x, y, x + 16, y, { cls: 't6-pot' }), 'the pot, €200,000'],
    ];
    if (ph) {
      return [
        yAxis(60, 300), panel(CLEAN, 76, 300, 'clean run', false),
        yAxis(60, 620), panel(CRASHED, 76, 620, 'crash run: deploy at row 2', true),
        legendRow(16, 696, items, 0),
        text(16, 852, 'bars: the three ledgers, rows of the tables', { anchor: 'start', cls: 'k-tick' }),
      ];
    }
    return [
      yAxis(68, 320), panel(CLEAN, 84, 320, 'clean run', false),
      panel(CRASHED, 408, 320, 'crash run: deploy at row 2', true),
      legendRow(16, 400, items.slice(0, 3), 160),
      legendRow(16, 428, items.slice(3), 230),
    ];
  };

  const crashWindow = L => {
    const s = L.slug, ph = L.phone;
    const card = (x, y, w, r, i, gutter) => {
      const restBad = i === 2, last = i === 4;
      const off = total(r) - POT;
      const cls = restBad ? 'k-box-accent' : 'k-box';
      const lines = [['treasury', num(r.fund), 'k-num'], ['4471', num(r.credit[4471]), 'k-num'], ['total', num(total(r)), (restBad || last) && off ? 'k-num-accent' : 'k-num']];
      const name = i === 3 ? `retry ${r.name}` : r.name;
      return g({},
        rect(x, y, w, 112, { cls: 'k-mask-box', rx: 6 }),
        rect(x, y, w, 112, { cls, rx: 6 }),
        text(x + 10, y + 22, name, { anchor: 'start', cls: restBad ? 'k-name-accent' : 'k-name' }),
        !gutter && restBad ? text(x + w - 10, y + 22, signed(off), { anchor: 'end', cls: 'k-num-accent' }) : '',
        lines.map(([a, b, c], j) => g({},
          gutter ? '' : text(x + 10, y + 46 + j * 20, a, { anchor: 'start', cls: 'k-tick' }),
          text(x + w - 10, y + 46 + j * 20, b, { anchor: 'end', cls: c }))),
        gutter && (restBad || last) ? text(x + w - 10, y + 104, signed(off), { anchor: 'end', cls: 'k-num-accent' }) : '',
        !gutter && restBad ? text(x + 10, y + 104, 'at rest', { anchor: 'start', cls: 'k-tick' }) : '',
        !gutter && last ? text(x + 10, y + 104, 'final', { anchor: 'start', cls: 'k-tick' }) : '',
        !gutter && last && off ? text(x + w - 10, y + 104, signed(off), { anchor: 'end', cls: 'k-num-accent' }) : '');
    };
    if (ph) {
      const w = 160, col = [16, 184], top = 92, pitch = 128;
      return [
        rect(8, top + 2 * pitch - 8, 344, 128, { cls: 't6-window' }),
        text(16, 40, 'debit first', { anchor: 'start', cls: 'k-name' }),
        text(184, 40, 'credit first', { anchor: 'start', cls: 'k-name' }),
        text(16, 66, 'rows: steps 0 to 4', { anchor: 'start', cls: 'k-tick' }),
        DEBIT_FIRST.map((r, i) => card(col[0], top + i * pitch, w, r, i, false)),
        CREDIT_FIRST.map((r, i) => card(col[1], top + i * pitch, w, r, i, false)),
        text(16, top + 5 * pitch + 8, 'band: the gap between two writes', { anchor: 'start', cls: 'k-tick' }),
        text(16, top + 5 * pitch + 36, 'the order picks the sign of the error,', { anchor: 'start', cls: 'k-note' }),
        text(16, top + 5 * pitch + 58, 'not its absence', { anchor: 'start', cls: 'k-note' }),
      ];
    }
    const w = 112, xs = range(0, 4).map(i => 104 + i * 122), rows = [80, 244];
    const gutter = y => ['treasury', '4471', 'total', 'off at rest'].map((t, j) => text(16, y + 46 + (j === 3 ? 58 : j * 20), t, { anchor: 'start', cls: 'k-tick' }));
    return [
      rect(xs[2] - 6, 40, w + 12, 324, { cls: 't6-window' }),
      text(xs[2] + w / 2, 30, 'the gap between two writes', { cls: 'k-tick' }),
      text(16, 66, 'debit first', { anchor: 'start', cls: 'k-name' }),
      text(16, 230, 'credit first', { anchor: 'start', cls: 'k-name' }),
      gutter(rows[0]), gutter(rows[1]),
      DEBIT_FIRST.map((r, i) => card(xs[i], rows[0], w, r, i, true)),
      CREDIT_FIRST.map((r, i) => card(xs[i], rows[1], w, r, i, true)),
      text(16, 400, 'the order picks the sign of the error, not its absence', { anchor: 'start', cls: 'k-note' }),
      text(704, 400, '4472 stays 0', { anchor: 'end', cls: 'k-tick' }),
    ];
  };

  const twoPhase = L => {
    const s = L.slug, ph = L.phone;
    const X = ph ? { C: 60, T: 180, L: 300, w: 104 } : { C: 120, T: 360, L: 600, w: 168 };
    const bottom = 408;
    const blocked = x => g({}, rect(x - 6, 272, 12, 120, { cls: 'k-mask-box' }), hatch(s, x - 6, 272, 12, 120));
    return [
      lifeline(X.C, 72, 256), lifeline(X.T, 72, bottom), lifeline(X.L, 72, bottom),
      actor(X.C, 24, X.w, 'coordinator', ''),
      actor(X.T, 24, X.w, 'treasury', ph ? 'our DB' : 'payout database'),
      actor(X.L, 24, X.w, 'loan ledger', ph ? 'hypothetical' : 'hypothetical lane'),
      step(1, 'the coordinator asks the treasury and the loan ledger to prepare',
        g({ anim: rise(0, { dx: -12, dy: 0 }) },
          msg(s, X.C, X.T, 112, 'prepare'),
          msg(s, X.C, X.L, 136, 'prepare', { at: (X.T + X.L) / 2 }))),
      step(2, 'both answer yes and hold their locks',
        g({ anim: rise(1, { dx: 12, dy: 0 }) },
          msg(s, X.T, X.C, 164, 'yes', { ret: true, textCls: 'k-num' }),
          msg(s, X.L, X.C, 188, 'yes', { ret: true, textCls: 'k-num', at: (X.T + X.L) / 2 }),
          lock(X.T + 20, 168), lock(X.L + 20, 192))),
      step(3, 'the coordinator crashes before it sends commit',
        g({ anim: land(2) }, crashMark(X.C, 216),
          text(X.C + 16, 222, 'crash', { anchor: 'start', cls: 'k-note-accent' }),
          arrow(s, [[X.C, 248], [X.T - 1, 248]], { cls: 'k-arrow t6-ghost' }),
          label((X.C + X.T) / 2, 239, ph ? 'no commit' : 'commit: never sent'))),
      step(4, 'both participants wait, blocked, with their locks held',
        g({ anim: rise(3, { dy: -12 }) }, blocked(X.T), blocked(X.L),
          text(X.T + 14, 352, 'blocked,', { anchor: 'start', cls: 'k-note-accent' }),
          text(X.T + 14, 372, 'locks held', { anchor: 'start', cls: 'k-note-accent' }))),
      ph ? [text(16, 440, 'loan ledger lane: hypothetical,', { anchor: 'start', cls: 'k-note' }), text(16, 462, 'its API does not speak the protocol', { anchor: 'start', cls: 'k-note' }),
        text(16, 490, 'dashed: a reply, or never sent', { anchor: 'start', cls: 'k-tick' })]
        : [text(16, 440, 'loan ledger lane is hypothetical: its HTTP API does not speak the protocol', { anchor: 'start', cls: 'k-note' }),
          text(16, 468, 'dashed: a reply, or never sent', { anchor: 'start', cls: 'k-tick' })],
    ];
  };

  const outbox = L => {
    const s = L.slug, ph = L.phone;
    const table = (x, y, w, name, sub, tone) => g({},
      rect(x, y, w, 56, { cls: 'k-mask-box', rx: 6 }),
      rect(x, y, w, 56, { cls: tone === 'focus' ? 't6-outbox' : 'k-box', rx: 6 }),
      text(x + 14, y + 24, name, { anchor: 'start', cls: 'k-name' }),
      text(x + 14, y + 44, sub, { anchor: 'start', cls: 'k-tick' }));
    const proc = (x, y, w, h, name, sub) => g({},
      rect(x, y, w, h, { cls: 'k-mask-box', rx: 6 }),
      rect(x, y, w, h, { cls: 't6-proc', rx: 6 }),
      text(x + w / 2, y + h / 2 - 2, name, { cls: 'k-name' }),
      text(x + w / 2, y + h / 2 + 16, sub, { cls: 'k-tick' }));
    const badge = (x, y, n) => g({}, circle(x, y, 10, { cls: 't6-badge' }), text(x, y + 4, String(n), { cls: 't6-badge-n' }));
    const ledger = (x, y, w) => g({},
      rect(x, y, w, 120, { cls: 'k-mask-box', rx: 6 }),
      rect(x, y, w, 120, { cls: 'k-box', rx: 6 }),
      text(x + 14, y + 24, 'loan ledger', { anchor: 'start', cls: 'k-name' }),
      text(x + 14, y + 44, 'loans team service', { anchor: 'start', cls: 'k-tick' }),
      text(x + 14, y + 72, 'credits: one row per loan_id', { anchor: 'start', cls: 'k-num' }),
      text(x + 14, y + 96, 'ON CONFLICT DO NOTHING', { anchor: 'start', cls: 't6-code' }));
    if (ph) {
      return [
        arrow(s, [[180, 72], [180, 110]]),
        label(192, 96, 'Pay', 'k-label', { anchor: 'start' }),
        arrow(s, [[100, 362], [100, 454]]),
        arrow(s, [[160, 456], [160, 364]], { cls: 'k-arrow t6-dash' }),
        arrow(s, [[120, 512], [120, 566]]),
        label(88, 424, 'read', 'k-label', { anchor: 'end' }), badge(40, 420, 1),
        label(132, 546, 'credit', 'k-label', { anchor: 'start' }), badge(190, 542, 2),
        label(172, 424, 'delete', 'k-label', { anchor: 'start' }), badge(232, 420, 3),
        proc(120, 16, 120, 56, 'worker', 'Pay(loan)'),
        rect(16, 112, 328, 280, { cls: 't6-txn', rx: 8 }),
        text(32, 136, 'payout database', { anchor: 'start', cls: 'k-name' }),
        text(328, 136, 'one transaction', { anchor: 'end', cls: 'k-num-input' }),
        table(40, 152, 280, 'loans', 'status: paid'),
        table(40, 228, 280, 'treasury ledger', 'debit €50,000'),
        table(40, 304, 280, 'outbox', 'row 4471, €50,000', 'focus'),
        proc(40, 456, 160, 56, 'relay', 'own process'),
        ledger(40, 568, 280),
        text(16, 716, 'dashed border: one local transaction', { anchor: 'start', cls: 'k-tick' }),
        text(16, 736, 'badges: the relay’s order; dashed: delete', { anchor: 'start', cls: 'k-tick' }),
      ];
    }
    return [
      arrow(s, [[148, 216], [198, 216]]),
      label(172, 207, 'Pay', 'k-label'),
      arrow(s, [[420, 300], [526, 300]]),
      arrow(s, [[528, 332], [422, 332]], { cls: 'k-arrow t6-dash' }),
      arrow(s, [[588, 284], [588, 206]]),
      label(474, 291, 'read', 'k-label'), badge(474, 270, 1),
      label(600, 250, 'credit', 'k-label', { anchor: 'start' }), badge(660, 246, 2),
      label(474, 352, 'delete', 'k-label'), badge(474, 374, 3),
      proc(32, 184, 116, 64, 'worker', 'Pay(loan)'),
      rect(200, 40, 240, 352, { cls: 't6-txn', rx: 8 }),
      text(216, 66, 'payout database', { anchor: 'start', cls: 'k-name' }),
      text(216, 86, 'one transaction', { anchor: 'start', cls: 'k-num-input' }),
      table(220, 112, 200, 'loans', 'status: paid'),
      table(220, 196, 200, 'treasury ledger', 'debit €50,000'),
      table(220, 288, 200, 'outbox', 'row 4471, €50,000', 'focus'),
      proc(528, 284, 120, 64, 'relay', 'own process'),
      ledger(480, 84, 224),
      text(16, 428, 'dashed border: one local transaction · badges: the relay’s order · dashed arrow: delete', { anchor: 'start', cls: 'k-tick' }),
    ];
  };

  const atLeastOnce = L => {
    const s = L.slug, ph = L.phone;
    const panel = (ox, oy, keyed) => {
      const X = { R: ox + 56, O: ox + 172, C: ox + 288 }, w = 96;
      const again = keyed ? keyedAgain : plainAgain;
      return {
        head: g({},
          text(ox, oy + 20, keyed ? 'keyed credit' : 'plain credit', { anchor: 'start', cls: 'k-name' }),
          lifeline(X.R, oy + 88, oy + 216), lifeline(X.R, oy + 240, oy + 400),
          lifeline(X.O, oy + 88, oy + 400), lifeline(X.C, oy + 88, oy + 360),
          actor(X.R, oy + 36, w, 'relay', ''), actor(X.O, oy + 36, w, 'outbox', ''), actor(X.C, oy + 36, w, 'loan ledger', '')),
        first: g({},
          msg(s, X.R, X.O, oy + 120, 'read 4471'),
          msg(s, X.R, X.C, oy + 152, 'credit €50,000', { at: (X.O + X.C) / 2 }),
          msg(s, X.C, X.R, oy + 184, '4471: €50,000', { ret: true, textCls: 'k-num', at: (X.O + X.C) / 2 })),
        crashed: g({}, crashMark(X.R, oy + 228),
          text(X.R + 14, oy + 234, 'crash, row kept', { anchor: 'start', cls: 'k-note-accent' })),
        reread: msg(s, X.R, X.O, oy + 272, 'read 4471 again'),
        second: g({},
          msg(s, X.R, X.C, oy + 304, 'credit €50,000', { at: (X.O + X.C) / 2 }),
          msg(s, X.C, X.R, oy + 336, keyed ? '4471 exists, nothing changed' : `4471: ${euro(again)}`,
            { ret: true, textCls: keyed ? 'k-num-ok' : 'k-num-accent', at: keyed ? (X.R + X.C) / 2 : (X.O + X.C) / 2 })),
        result: valueCard(X.C - 52, oy + 360, 104, 'loan 4471', euro(again), keyed ? 'ok' : 'bad'),
        del: msg(s, X.R, X.O, oy + 392, 'delete 4471', { at: (X.R + X.O) / 2 }),
      };
    };
    const [a, b] = ph ? [panel(16, 0, false), panel(16, 436, true)] : [panel(16, 0, false), panel(376, 0, true)];
    return [
      a.head, b.head,
      ph ? line(16, 424, 344, 424, { cls: 'k-grid' }) : line(364, 16, 364, 420, { cls: 'k-grid' }),
      step(1, 'the relay reads row 4471 and credits it: the loan ledger shows 50,000 euros',
        g({ anim: rise(0, { dx: -12, dy: 0 }) }, a.first), g({ anim: rise(0, { dx: -12, dy: 0 }) }, b.first)),
      step(2, 'the relay crashes before it deletes the row', g({ anim: land(1) }, a.crashed), g({ anim: land(1) }, b.crashed)),
      step(3, 'the restarted relay reads row 4471 again', g({ anim: rise(2, { dx: -12, dy: 0 }) }, a.reread), g({ anim: rise(2, { dx: -12, dy: 0 }) }, b.reread)),
      step(4, 'it credits again: the plain ledger shows 100,000 euros; the keyed ledger says 4471 exists and nothing changes',
        g({ anim: rise(3, { dx: -12, dy: 0 }) }, a.second), g({ anim: rise(3, { dx: 16, dy: 0 }) }, b.second)),
      step(5, 'loan 4471 holds 100,000 euros with the plain credit and 50,000 euros with the keyed credit',
        g({ anim: land(4) }, a.result), g({ anim: land(4) }, b.result)),
      step(6, 'the relay deletes the row', g({ anim: rise(5, { dx: -12, dy: 0 }) }, a.del), g({ anim: rise(5, { dx: -12, dy: 0 }) }, b.del)),
      ph ? text(16, 860, 'dashed arrow: a reply', { anchor: 'start', cls: 'k-tick' })
        : text(16, 440, 'dashed arrow: a reply · same steps, same crash, one change: the key', { anchor: 'start', cls: 'k-tick' }),
    ];
  };

  const css = [
    '.k-fig .t6-life { stroke: var(--ink-soft); stroke-width: var(--line-hair); stroke-dasharray: 3 3; opacity: 0.6; }',
    '.k-fig .t6-dash { stroke-dasharray: 5 4; }',
    '.k-fig .t6-ghost { stroke-dasharray: 5 4; opacity: 0.45; }',
    '.k-fig .t6-act { fill: var(--paper-2); stroke: var(--ink-soft); stroke-width: var(--line-hair); }',
    '.k-fig .t6-tick { stroke: var(--ok); stroke-width: var(--line-strong); fill: none; stroke-linecap: round; stroke-linejoin: round; }',
    '.k-fig .t6-lock { fill: var(--paper-2); stroke: var(--ink); stroke-width: var(--line-strong); }',
    '.k-fig .t6-lock-arc { fill: none; stroke: var(--ink); stroke-width: var(--line-strong); }',
    '.k-fig .t6-call { font-family: var(--font-mono); font-size: var(--text-fig-name); fill: var(--ink); font-weight: var(--weight-medium); }',
    '.k-fig .t6-code { font-family: var(--font-mono); font-size: var(--text-fig); fill: var(--code-text); }',
    '.k-fig .t6-pot { stroke: var(--ink); stroke-width: var(--line-strong); stroke-dasharray: 6 4; }',
    '.k-fig .t6-seg-t { fill: var(--ink-soft); fill-opacity: 0.35; stroke: var(--ink-soft); stroke-width: var(--line-hair); }',
    '.k-fig .t6-seg-a { fill: var(--ink); stroke: var(--ink); stroke-width: var(--line-hair); }',
    '.k-fig .t6-seg-b { fill: var(--paper); stroke: var(--ink); stroke-width: var(--line-strong); }',
    '.k-fig .t6-hands { fill: none; stroke: var(--ink-soft); stroke-width: var(--line-strong); stroke-dasharray: 3 3; }',
    '.k-fig .t6-window { fill: var(--accent-soft); fill-opacity: 0.45; }',
    '.k-fig .t6-txn { fill: var(--input-soft); fill-opacity: 0.35; stroke: var(--input); stroke-width: var(--line-strong); stroke-dasharray: 6 4; }',
    '.k-fig .t6-outbox { fill: var(--paper-2); stroke: var(--ink); stroke-width: var(--line-mark); }',
    '.k-fig .t6-proc { fill: var(--paper); stroke: var(--ink); stroke-width: var(--line-strong); }',
    '.k-fig .t6-badge { fill: var(--ink); }',
    '.k-fig .t6-badge-n { font-family: var(--font-ui); font-size: var(--text-fig); font-weight: var(--weight-bold); fill: var(--paper); }',
  ].join(' ');

  const fig = (name, wide, phone, title, desc, caption, body, stepsCount = 0) => ({
    name, w: 720, h: wide, phone: { w: 360, h: phone }, title, desc, caption, steps: stepsCount,
    eyebrow: 'Lesson 6 · the ledger that does not add up', css, body: (kk, L) => body(L),
  });

  return [
    fig('two-ledgers', 456, 488, 'A debit with no credit',
      'A sequence over time across the worker, the treasury ledger in the payout database and the loan ledger of the loans team: the worker debits 50,000 euros for loan 4471, a deploy crashes it, and the credit is never sent; at month-end the treasury is down 50,000 euros, loan 4471 shows 0, and 50,000 euros are in no ledger.',
      'Time runs down the page. The debit was written; the deploy landed before the credit, so €50,000 left the treasury ledger and reached no other.',
      twoLedgers, 4),
    fig('sum-over', 384, 400, 'SumOver, unwound',
      'The recursion of SumOver over the loans 4471 and 4472 as a chain of calls: the first call picks 4471 and needs 50,000 plus SumOver of 4472, which needs 30,000 plus SumOver of the empty set, which is 0; the sums return upward as 0, 30,000 and 80,000.',
      'Each call takes one loan out and calls itself on the rest, until the set is empty. Then the sums come back up: 0, then 30,000, then 80,000.',
      sumOverFig, 6),
    fig('conservation', 448, 868, 'Where the money is, row by row',
      'Stacked bars for each row of the two tables, treasury, loan 4471 and loan 4472, against a line at the pot of 200,000 euros. In the clean run, rows 1 and 3 dip by the loan in the worker’s hands and the next write fills the dip. In the crash run, from row 2 on, 50,000 euros are missing that nobody will fill, and the run ends at 150,000.',
      'The same two tables as bars. A dip that the next write fills is normal; after the crash, €50,000 stays missing in every row, and the run ends €50,000 short.',
      conservation),
    fig('crash-window', 416, 820, 'Two orders, two wrong totals',
      'Two behaviors of loan 4471 on shared columns. Debit first: Debit, Crash at rest with 150,000 euros, a retried Debit and a Credit end at 150,000. Credit first: Credit, Crash at rest with 250,000 euros, a retried Credit and a Debit end at 250,000 with loan 4471 at 100,000.',
      'The crash lands in the gap between two writes either way. Debit first leaves the books €50,000 short; credit first leaves them €50,000 over, and the bakery’s account at €100,000.',
      crashWindow),
    fig('two-phase', 480, 504, 'Prepared, then stranded',
      'A sequence across a coordinator, the treasury and the loan ledger: the coordinator sends prepare to both, both answer yes and hold their locks, the coordinator crashes before sending commit, and both participants stay blocked with their locks held. The loan ledger lane is hypothetical: its HTTP API does not speak the protocol.',
      'Two-phase commit, if the loan ledger could take part (it cannot: its HTTP API does not speak the protocol). After both say yes, neither may decide alone. If the coordinator crashes before commit, both wait with their locks held.',
      twoPhase, 4),
    fig('outbox', 444, 752, 'The debit and the debt, together',
      'The worker’s Pay writes three tables of the payout database in one local transaction: the loan status, the treasury ledger debit and an outbox row for loan 4471. A separate relay reads the outbox row, credits the loan ledger service, whose credits table keeps one row per loan id with ON CONFLICT DO NOTHING, and then deletes the row.',
      'One transaction writes the debit and the outbox row together. The relay then does three things in order: read the row, credit the loan ledger, delete the row.',
      outbox),
    fig('at-least-once', 456, 876, 'Delivered twice, credited once',
      'Two sequences of the relay, the outbox and the loan ledger. In both, the relay reads row 4471, credits 50,000 euros, crashes before deleting the row, reads the row again and credits again. With the plain credit, loan 4471 ends at 100,000 euros; with the keyed credit, the loan ledger answers that 4471 exists and nothing changed, and loan 4471 stays at 50,000 euros. Then the relay deletes the row.',
      'The same steps and the same crash, twice. The relay delivers row 4471 twice either way; only the key decides whether the bakery’s account shows it twice.',
      atLeastOnce, 6),
  ];
};
