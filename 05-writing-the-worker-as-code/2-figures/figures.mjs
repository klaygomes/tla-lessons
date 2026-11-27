export default k => {
  const { g, line, path, rect, circle, text, masked, arrow, box, step, cross } = k;

  const label = (x, y, s, cls = 'k-label', o = {}) => masked(x, y, s, { cls, ...o });
  const code = (x, y, s, cls = 't5-code') => {
    const indent = s.length - s.trimStart().length;
    return text(x + indent * 7.2, y, s.trim(), { anchor: 'start', cls });
  };
  const okMarker = slug => `<defs><marker id="${slug}-arrow-ok" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon class="t5-head-ok" points="0 0, 8 3, 0 6"/></marker></defs>`;
  const okArrow = (slug, pts) => path(pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(''), { cls: 't5-arrow-ok', 'marker-end': `url(#${slug}-arrow-ok)` });
  const cell = (x, y, w, h, name, subs = [], cls = 't5-cell', nameCls = 't5-code') => g({},
    rect(x, y, w, h, { cls: 'k-mask-box', rx: 6 }), rect(x, y, w, h, { cls, rx: 6 }),
    text(x + 12, y + (subs.length ? 20 : h / 2 + 4), name, { anchor: 'start', cls: nameCls }),
    subs.map((t, i) => text(x + 12, y + 38 + i * 17, t, { anchor: 'start', cls: 'k-tick' })));

  const T0 = 0.2, HOLD = 1.0, LEN = 0.6;
  const at = (i, extra = 0) => Number((T0 + i * HOLD + extra).toFixed(2));
  const rise = (i, o = {}) => ({ k: 'rise', d: at(i, o.extra || 0), len: LEN, dx: o.dx ?? 0, dy: o.dy ?? 8 });
  const land = (i, extra = 0) => ({ k: 'land', d: at(i, extra), len: LEN, s0: 1.2 });

  const msg = (slug, x1, x2, y, s, o = {}) => {
    const { tone = '', ret = false, at: lx = (x1 + x2) / 2, textCls } = o;
    const dir = Math.sign(x2 - x1);
    return g({},
      arrow(slug, [[x1, y], [x2 - dir, y]], { tone, cls: ['k-arrow', ret ? 't5-dash' : ''].filter(Boolean).join(' ') }),
      label(lx, y - 9, s, textCls || (tone === 'accent' ? 'k-num-accent' : 'k-label')));
  };
  const actor = (cx, y, w, name, sub) => box(cx - w / 2, y, w, 48, { name, sub });
  const lifeline = (x, y1, y2) => line(x, y1, x, y2, { cls: 't5-life' });
  const bar = (x, y1, y2) => rect(x - 4, y1, 8, y2 - y1, { cls: 't5-act' });
  const bracket = (x, y1, y2, cls = 't5-bracket') => path(`M${x + 6} ${y1}H${x}V${y2}H${x + 6}`, { cls });

  const twoCalls = L => {
    const s = L.slug, ph = L.phone;
    const X = ph ? { A: 54, T: 138, B: 222, K: 306, w: 76 } : { A: 220, T: 360, B: 500, K: 656, w: 104 };
    const Y = { fA: 112, rA: 136, fB: 168, rB: 192, sA: 228, sB: 264, tA: 340, pA: 364, tB: 396, rfB: 420 };
    const end = 432;
    const tAt = (X.B + X.K) / 2;
    const out = [
      lifeline(X.A, 72, end), lifeline(X.T, 72, end), lifeline(X.B, 72, end), lifeline(X.K, 72, end),
      actor(X.A, 24, X.w, 'worker A', ph ? '' : 'find, save'),
      actor(X.T, 24, X.w, 'loans', ph ? '' : 'loan 4471'),
      actor(X.B, 24, X.w, 'worker B', ph ? '' : 'find, save'),
      actor(X.K, 24, X.w, 'bank', ph ? '' : 'transfer API'),
      step(1, 'worker A finds loan 4471 and sees approved',
        g({ anim: rise(0, { dx: -10, dy: 0 }) }, bar(X.A, Y.fA - 4, Y.tA + 28),
          msg(s, X.A + 4, X.T, Y.fA, 'find'),
          msg(s, X.T, X.A + 4, Y.rA, 'approved', { ret: true, textCls: 'k-num' }))),
      step(2, 'worker B finds loan 4471 and also sees approved',
        g({ anim: rise(1, { dx: 10, dy: 0 }) }, bar(X.B, Y.fB - 4, Y.rfB + 4),
          msg(s, X.B - 4, X.T, Y.fB, 'find'),
          msg(s, X.T, X.B - 4, Y.rB, 'approved', { ret: true, textCls: 'k-num' }))),
      step(3, 'worker A saves the loan as claimed',
        g({ anim: rise(2, { dx: -10, dy: 0 }) }, msg(s, X.A + 4, X.T, Y.sA, ph ? 'save' : 'save claimed'))),
      step(4, 'worker B saves claimed too, over a row that already says claimed',
        g({ anim: rise(3, { dx: 10, dy: 0 }) }, msg(s, X.B - 4, X.T, Y.sB, ph ? 'save' : 'save claimed'))),
      ph ? '' : step(4, 'the save does not complain',
        g({ anim: rise(3, { extra: 0.4 }) },
          text(X.B + 10, Y.sB + 22, 'overwrites,', { anchor: 'start', cls: 'k-note t5-halo' }),
          text(X.B + 10, Y.sB + 40, 'no complaint', { anchor: 'start', cls: 'k-note t5-halo' }))),
      step(5, 'worker A transfers with key 4471 and the bank pays',
        g({ anim: rise(4, { dx: -10, dy: 0 }) },
          msg(s, X.A + 4, X.K, Y.tA, ph ? 'transfer' : 'transfer, key 4471', { at: tAt }),
          msg(s, X.K, X.A + 4, Y.pA, 'paid', { ret: true, textCls: 'k-num', at: tAt }))),
      step(6, 'worker B transfers with the same key and the bank refuses it',
        g({ anim: rise(5, { dx: 10, dy: 0 }) },
          msg(s, X.B + 4, X.K, Y.tB, ph ? 'transfer' : 'transfer, key 4471'),
          msg(s, X.K, X.B + 4, Y.rfB, 'refused', { ret: true, tone: 'accent' }))),
      step(6, 'refused because the key was already paid: only the key stood here',
        g({ anim: land(5, 0.4) },
          ph ? [text(16, 460, 'refused: key already paid', { anchor: 'start', cls: 'k-note-accent' }),
            text(16, 482, 'only the key stood here', { anchor: 'start', cls: 'k-note-accent' })]
            : [text(L.W - 16, 460, 'refused: key already paid', { anchor: 'end', cls: 'k-note-accent' }),
              text(L.W - 16, 482, 'only the key stood here', { anchor: 'end', cls: 'k-note-accent' })])),
    ];
    if (ph) {
      const y = 516;
      out.push(
        step(7, "the code: find and save are two calls, with a gap where worker B's find lands",
          g({ anim: rise(6) },
            text(16, y + 24, 'the code', { anchor: 'start', cls: 'k-name' }),
            rect(100, y, 92, 36, { cls: 't5-cell', rx: 6 }), text(146, y + 23, 'find', { cls: 't5-code' }),
            rect(196, y + 4, 52, 28, { cls: 't5-gap' }), rect(196, y + 4, 52, 28, { fill: `url(#${s}-hatch)`, cls: 'k-bar-hatch' }),
            rect(252, y, 92, 36, { cls: 't5-cell', rx: 6 }), text(298, y + 23, 'save', { cls: 't5-code' }),
            text(16, y + 58, 'two calls; B acts in the gap', { anchor: 'start', cls: 'k-tick' }))),
        step(7, 'the spec: one claim step spanning both calls',
          g({ anim: rise(6, { extra: 0.4 }) },
            text(16, y + 104, 'the spec', { anchor: 'start', cls: 'k-name' }),
            rect(100, y + 80, 244, 36, { cls: 't5-cell', rx: 6 }), text(222, y + 103, 'one step', { cls: 't5-code' }),
            text(16, y + 138, 'one step, no gap', { anchor: 'start', cls: 'k-tick' }))),
      );
    } else {
      out.push(
        text(96, 96, 'spec', { cls: 'k-tick' }),
        text(176, 96, 'code', { cls: 'k-tick' }),
        step(7, 'the code: find and save are two calls',
          g({ anim: rise(6, { dx: -10, dy: 0 }) },
            bracket(176, Y.fA - 6, Y.rA + 6), bracket(176, Y.sA - 6, Y.sA + 6),
            text(168, Y.fA + 16, 'find', { anchor: 'end', cls: 't5-code' }),
            text(168, Y.sA + 4, 'save', { anchor: 'end', cls: 't5-code' }),
            text(16, 300, 'the code: two calls', { anchor: 'start', cls: 'k-note-accent' }))),
        step(7, 'the spec: one claim step spanning both',
          g({ anim: rise(6, { dx: -10, dy: 0, extra: 0.4 }) },
            bracket(96, Y.fA - 6, Y.sA + 6, 't5-bracket t5-bracket-strong'),
            text(88, 164, 'claim', { anchor: 'end', cls: 't5-code' }),
            text(16, 278, 'the spec: one step', { anchor: 'start', cls: 'k-note' }))),
      );
    }
    return out;
  };

  const labelsFig = L => {
    const s = L.slug, ph = L.phone;
    const lines = [
      [76, 'process (w \\in Workers) {'],
      [120, '  claim: if (status = "approved") {'],
      [142, '           status := "claimed";'],
      [184, '  send:    transfers := transfers + 1;'],
      [226, '  mark:    status := "paid"'],
      [266, '         }'],
      [288, '}'],
    ];
    const cuts = [96, 160, 202, 244];
    const bands = [[96, 160], [160, 202], [202, 244]];
    const right = ph ? 304 : 468;
    const bx = ph ? 344 : 640;
    const cx = ph ? 24 : 28;
    const out = [
      text(16, 28, "Noor's process", { anchor: 'start', cls: 'k-name' }),
      rect(16, 52, right - 16, 252, { cls: 't5-code-bg', rx: 6 }),
      bands.map(([a, b], i) => rect(16, a, right - 16, b - a, { cls: i % 2 ? 't5-band-alt' : 't5-band' })),
      lines.map(([y, t]) => code(cx, y, t)),
      cuts.map(y => line(16, y, right + 8, y, { cls: 't5-cut' })),
      text(right - 8, 262, 'Done', { anchor: 'end', cls: 'k-num' }),
    ];
    if (!ph) out.push(bands.map(([a, b]) => text(right - 8, (a + b) / 2 + 10, 'one step', { anchor: 'end', cls: 'k-tick' })));
    if (ph) {
      out.push(
        text(L.W - 16, 28, 'worker B', { anchor: 'end', cls: 'k-name' }),
        lifeline(bx, 40, 256),
        cuts.map(y => arrow(s, [[bx, y], [right + 10, y]])),
        arrow(s, [[bx, 128], [right + 2, 128]], { tone: 'accent', cls: 'k-arrow t5-dash' }),
        cross(330, 128),
        line(16, 340, 46, 340, { cls: 't5-cut' }),
        text(54, 344, 'cut line: B may act here', { anchor: 'start', cls: 'k-tick' }),
        cross(30, 368),
        text(54, 372, 'never inside a step', { anchor: 'start', cls: 'k-tick' }),
        text(16, 404, 'between two cut lines: one step,', { anchor: 'start', cls: 'k-note' }),
        text(16, 426, 'no other worker acts inside', { anchor: 'start', cls: 'k-note' }),
      );
    } else {
      out.push(
        actor(bx, 24, 104, 'worker B', 'another copy'),
        lifeline(bx, 72, 272),
        cuts.map(y => arrow(s, [[bx, y], [right + 10, y]])),
        arrow(s, [[bx, 128], [right + 2, 128]], { tone: 'accent', cls: 'k-arrow t5-dash' }),
        cross(520, 128),
        label(560, 119, 'not inside a step', 'k-num-accent'),
        line(16, 340, 46, 340, { cls: 't5-cut' }),
        text(54, 344, 'cut line (a label begins a step): worker B may act here', { anchor: 'start', cls: 'k-tick' }),
        text(16, 372, 'between two cut lines: one step, no other worker acts inside', { anchor: 'start', cls: 'k-note' }),
      );
    }
    return out;
  };

  const translation = L => {
    const s = L.slug, ph = L.phone;
    const P = ph ? { lx: 16, lw: 136, rx: 196, rw: 148 } : { lx: 16, lw: 288, rx: 416, rw: 288 };
    const rows = ph ? [
      ['process', ['one per worker'], 'w(self), Next', ['any worker']],
      ['claim:', [], 'claim(self)', []],
      ['send:', [], 'send(self)', []],
      ['mark:', [], 'mark(self)', []],
      ['end of code', [], 'Done', ['Terminating,', 'Termination']],
    ] : [
      ['process (w \\in Workers)', ['one copy per worker'], 'Next == \\E self: w(self)', ['w(self) == claim \\/ send \\/ mark']],
      ['claim: if (status = "approved")', ['label 1'], 'claim(self) ==', ['guard: pc[self] = "claim"']],
      ['send: transfers := transfers + 1', ['label 2'], 'send(self) ==', ['guard: pc[self] = "send"']],
      ['mark: status := "paid"', ['label 3'], 'mark(self) ==', ['guard: pc[self] = "mark"']],
      ['end of code', ['nothing left to run'], 'pc[self] = "Done"', ['Terminating: not a deadlock', 'Termination: eventually all Done']],
    ];
    const H = r => (r[3].length > 1 || r[1].length > 1 ? 68 : r[1].length || r[3].length ? 52 : 44);
    let y = ph ? 72 : 64;
    const out = [
      text(P.lx, 28, 'PlusCal', { anchor: 'start', cls: 'k-name' }),
      text(P.lx, 46, 'you write', { anchor: 'start', cls: 'k-tick' }),
      text(P.rx, 28, 'TLA+', { anchor: 'start', cls: 'k-name' }),
      text(P.rx, 46, ph ? 'translated' : 'the translator writes', { anchor: 'start', cls: 'k-tick' }),
    ];
    const arrows = [], cells = [];
    rows.forEach(r => {
      const h = H(r);
      arrows.push(arrow(s, [[P.lx + P.lw, y + 22], [P.rx - 2, y + 22]]));
      cells.push(cell(P.lx, y, P.lw, h, r[0], r[1]), cell(P.rx, y, P.rw, h, r[2], r[3]));
      y += h + 16;
    });
    out.push(arrows, cells);
    const cy = y + 8;
    out.push(
      rect(16, cy, L.W - 32, ph ? 68 : 52, { cls: 't5-callout', rx: 6 }),
      text(28, cy + 22, ph ? 'pc: written for you;' : 'pc: written for you, one entry per process', { anchor: 'start', cls: 't5-code' }),
      text(28, cy + 42, ph ? 'its values are the labels:' : 'its values are the labels: claim, send, mark, Done', { anchor: 'start', cls: 'k-tick' }),
      ph ? text(28, cy + 60, 'claim, send, mark, Done', { anchor: 'start', cls: 'k-tick' }) : '',
      arrow(s, [[16, cy + (ph ? 100 : 84)], [44, cy + (ph ? 100 : 84)]]),
      text(52, cy + (ph ? 104 : 88), 'becomes, in the translation', { anchor: 'start', cls: 'k-tick' }),
    );
    return out;
  };

  const interactions = L => {
    const s = L.slug, ph = L.phone;
    const P = ph ? { cx: 16, cw: 192, lx: 264, lw: 80 } : { cx: 16, cw: 256, lx: 416, lw: 112 };
    const call = (y, t) => cell(P.cx, y, P.cw, 40, t);
    const lab = (y, h, t, cls) => cell(P.lx, y, P.lw, h, t, [], cls);
    const top = ph ? 44 : 52;
    const r = i => top + i * 48;
    const noor = ph ? ['loans.find(loanId)', 'loans.save(loan)', 'bank.transfer(...)', 'db.setStatus("paid")']
      : ['await loans.find(loanId)', 'await loans.save(loan)', 'await bank.transfer(...)', 'await db.setStatus("paid")'];
    const b0 = ph ? 316 : 300;
    const rb = i => b0 + i * 48;
    const one = ph ? ['UPDATE ... approved', 'bank.transfer(...)', 'db.setStatus("paid")']
      : ["UPDATE ... status = 'approved'", 'await bank.transfer(...)', 'await db.setStatus("paid")'];
    const x1 = P.cx + P.cw, x2 = P.lx - 2;
    return [
      okMarker(s),
      text(16, 28, "Noor's TypeScript", { anchor: 'start', cls: 'k-name' }),
      text(P.lx, 28, 'labels', { anchor: 'start', cls: 'k-name' }),
      arrow(s, [[x1, r(0) + 20], [x2, r(0) + 20]], { tone: 'accent' }),
      arrow(s, [[x1, r(1) + 20], [x2, r(1) + 20]], { tone: 'accent' }),
      arrow(s, [[x1, r(2) + 20], [x2, r(2) + 20]]),
      arrow(s, [[x1, r(3) + 20], [x2, r(3) + 20]]),
      noor.map((t, i) => call(r(i), t)),
      lab(r(0), 88, 'claim:', 'k-box-accent'),
      lab(r(2), 40, 'send:'),
      lab(r(3), 40, 'mark:'),
      ph ? text(16, r(4) + 18, 'two calls, one label: a hidden gap', { anchor: 'start', cls: 'k-note-accent' })
        : [['two calls,', 0], ['one label:', 1], ['a hidden gap', 2]].map(([t, i]) => text(552, r(0) + 30 + i * 22, t, { anchor: 'start', cls: 'k-note-accent' })),
      text(16, b0 - 16, "lesson 1's code", { anchor: 'start', cls: 'k-name' }),
      [0, 1, 2].map(i => okArrow(s, [[x1, rb(i) + 20], [x2, rb(i) + 20]])),
      one.map((t, i) => call(rb(i), t)),
      ['claim:', 'send:', 'mark:'].map((t, i) => lab(rb(i), 40, t, 'k-box-ok')),
      ph ? text(16, rb(3) + 18, 'one call, one label', { anchor: 'start', cls: 't5-note-ok' })
        : [['one call,', 0], ['one label', 1]].map(([t, i]) => text(552, rb(0) + 30 + i * 22, t, { anchor: 'start', cls: 't5-note-ok' })),
    ].flat(Infinity);
  };

  const poll = L => {
    const s = L.slug, ph = L.phone;
    const P = ph ? { px: 16, pw: 56, gx: 88, gw: 184, tx: 292, tw: 52 } : { px: 16, pw: 104, gx: 152, gw: 320, tx: 528, tw: 112 };
    const gy = [48, 112, 176];
    const gates = ph
      ? [['status = "approved"', 'claim it'], ['claimed, owner = self', 'resume it'], ['status = "paid"', 'finish']]
      : [['await status = "approved"', 'claim it'], ['await status = "claimed" /\\ owner = self', 'resume it'], ['await status = "paid"', 'finish']];
    const states = [
      ['A, loan approved', 'approved, owner nobody', [1, 0, 0]],
      ['A, claimed by A', 'claimed, owner A', [0, 1, 0]],
      ['B, claimed by A', 'claimed, owner A', [0, 0, 0]],
    ];
    const names = ['claim', 'resume', 'finish'];
    const dot = (x, y, on) => circle(x, y, 5, { cls: on ? 't5-on' : 't5-off' });
    const card = (x, y, w, h, [title, st, lit], i) => g({},
      rect(x, y, w, h, { cls: 'k-mask-box', rx: 6 }), rect(x, y, w, h, { cls: i === 2 ? 'k-box-accent' : 't5-cell', rx: 6 }),
      text(x + 12, y + 22, title, { anchor: 'start', cls: i === 2 ? 'k-name-accent' : 'k-name' }),
      text(x + 12, y + 42, st, { anchor: 'start', cls: 'k-num' }),
      ph ? names.map((n, j) => g({}, dot(x + 18 + j * 100, y + 66, lit[j]), text(x + 28 + j * 100, y + 70, n, { anchor: 'start', cls: lit[j] ? 'k-num' : 'k-tick' })))
        : names.map((n, j) => g({}, dot(x + 18, y + 66 + j * 20, lit[j]), text(x + 30, y + 70 + j * 20, n, { anchor: 'start', cls: lit[j] ? 'k-num' : 'k-tick' }))));
    const out = [
      text(16, 28, ph ? 'poll: one label, three branches' : 'poll: one label, three branches, each behind an await', { anchor: 'start', cls: 'k-tick' }),
      gy.map(y => arrow(s, [[P.px + P.pw, y + 24], [P.gx - 2, y + 24]])),
      gy.map(y => arrow(s, [[P.gx + P.gw, y + 24], [P.tx - 2, y + 24]])),
      box(P.px, 48, P.pw, 176, { name: 'poll', sub: ph ? '' : 'label' }),
      gates.map(([c, sub], i) => cell(P.gx, gy[i], P.gw, 48, c, [sub], 't5-gate')),
      box(P.tx, 48, P.tw, 112, { name: 'send', sub: ph ? '' : 'next label' }),
      box(P.tx, 176, P.tw, 48, { name: 'Done' }),
    ];
    if (ph) {
      const cy = [276, 380, 484];
      out.push(
        text(16, 260, 'three states, as one worker sees them', { anchor: 'start', cls: 'k-tick' }),
        states.map((st, i) => card(16, cy[i], 328, 88, st, i)),
        text(16, 600, 'no branch enabled: B waits', { anchor: 'start', cls: 'k-note-accent' }),
        dot(22, 628, true), text(34, 632, 'await true: enabled', { anchor: 'start', cls: 'k-tick' }),
        dot(198, 628, false), text(210, 632, 'await false', { anchor: 'start', cls: 'k-tick' }),
      );
    } else {
      out.push(
        text(16, 268, 'three states, as one worker sees them', { anchor: 'start', cls: 'k-tick' }),
        states.map((st, i) => card(16 + i * 232, 280, 224, 132, st, i)),
        text(480, 440, 'no branch enabled: B waits', { anchor: 'start', cls: 'k-note-accent' }),
        dot(22, 472, true), text(34, 476, 'await true: branch enabled', { anchor: 'start', cls: 'k-tick' }),
        dot(262, 472, false), text(274, 476, 'await false: branch blocked', { anchor: 'start', cls: 'k-tick' }),
      );
    }
    return out;
  };

  const flicker = L => {
    const ph = L.phone;
    const n = ph ? 6 : 8;
    const x0 = ph ? 16 : 176, sw = ph ? 52 : 62;
    const xe = x0 + n * sw;
    const free = i => i % 2 === 0;
    const sx = i => x0 + i * sw;
    const R = ph
      ? { st: 76, stT: 44, stN: 104, wk: 160, wkT: 132, wkN: 188, en: 240, enT: 214, ln: 310, lnT: 284, bd: 346, ax: 370 }
      : { st: 84, stT: 80, stN: 112, wk: 160, wkT: 156, wkN: 188, en: 216, enT: 220, ln: 280, lnT: 278, bd: 328, ax: 356 };
    const slotD = i => Number((0.2 + i * 0.35).toFixed(2));
    const title = (y, main, sub) => ph
      ? text(16, y, `${main}${sub ? `: ${sub}` : ''}`, { anchor: 'start', cls: 'k-label' })
      : g({}, text(16, y, main, { anchor: 'start', cls: 't5-code' }), sub ? text(16, y + 18, sub, { anchor: 'start', cls: 'k-tick' }) : '');
    const tickAt = sx(2) + sw / 2;
    const tail = (y) => text(xe + 6, y + 5, '...', { anchor: 'start', cls: 'k-tick' });
    return [
      title(R.stT, 'fair+ process', 'strong'),
      line(x0, R.st, xe, R.st, { cls: 't5-track' }), tail(R.st),
      title(R.wkT, 'fair process', 'weak'),
      line(x0, R.wk, xe, R.wk, { cls: 't5-track' }), tail(R.wk),
      title(R.enT, "A's send enabled", ''),
      title(R.lnT, 'the line', ph ? 'recon takes, gives' : 'recon: take, give'),
      step(1, 'the line flips between free and busy forever, and A\'s send is enabled exactly when the line is free',
        g({},
          Array.from({ length: n }, (_, i) => g({ anim: { k: 'in', d: slotD(i), len: 0.3 } },
            rect(sx(i) + 2, R.ln - 14, sw - 4, 28, { cls: free(i) ? 't5-free' : 't5-busy', rx: 3 }),
            text(sx(i) + sw / 2, R.ln + 4, free(i) ? 'free' : 'busy', { cls: free(i) ? 'k-num' : 't5-busy-text' }),
            rect(sx(i) + 2, R.en - 14, sw - 4, 28, { cls: free(i) ? 't5-lit' : 't5-dark', rx: 3 }),
            text(sx(i) + sw / 2, R.en + 4, free(i) ? 'yes' : 'no', { cls: free(i) ? 'k-num' : 'k-tick' }))),
          Array.from({ length: n - 1 }, (_, i) => text(sx(i + 1), R.bd, free(i) ? 'take' : 'give', { cls: 'k-tick' })),
          tail(R.ln), tail(R.en))),
      step(2, 'weak fairness: A never sends, because send is never enabled forever',
        g({ anim: rise(3) },
          text(ph ? 16 : x0, R.wkN, ph ? 'never enabled forever: no promise' : 'never enabled forever, so no promise', { anchor: 'start', cls: 'k-note-accent' }))),
      step(3, 'strong fairness: A sends in a free slot, because send is enabled again and again',
        g({ anim: land(4, 0.2) },
          circle(tickAt, R.st, 7, { cls: 't5-send' }),
          text(tickAt, R.st - 14, 'A sends', { cls: 'k-num-ok' })),
        g({ anim: rise(4, { extra: 0.5 }) },
          text(ph ? 16 : x0, R.stN, ph ? 'enabled again and again: must happen' : 'enabled again and again, so it must happen', { anchor: 'start', cls: 't5-note-ok' }))),
      k.arrow(L.slug, [[x0, R.ax], [xe + 24, R.ax]]),
      text(x0, R.ax + 20, 'time; the loop repeats forever', { anchor: 'start', cls: 'k-tick' }),
    ];
  };

  const css = [
    '.k-fig .t5-life { stroke: var(--ink-soft); stroke-width: var(--line-hair); stroke-dasharray: 3 3; opacity: 0.6; }',
    '.k-fig .t5-dash { stroke-dasharray: 5 4; }',
    '.k-fig .t5-act { fill: var(--paper-2); stroke: var(--ink-soft); stroke-width: var(--line-hair); }',
    '.k-fig .t5-code { font-family: var(--font-mono); font-size: var(--text-fig); fill: var(--code-text); white-space: pre; }',
    '.k-fig .t5-code-bg { fill: var(--code-bg); }',
    '.k-fig .t5-halo { paint-order: stroke; stroke: var(--paper); stroke-width: var(--line-mark); stroke-linejoin: round; }',
    '.k-fig .t5-bracket { stroke: var(--ink); stroke-width: var(--line-strong); fill: none; }',
    '.k-fig .t5-bracket-strong { stroke-width: var(--line-mark); }',
    '.k-fig .t5-gap { fill: var(--accent-soft); }',
    '.k-fig .t5-cell { fill: var(--paper); stroke: var(--ink); stroke-width: var(--line-strong); }',
    '.k-fig .t5-gate { fill: var(--paper); stroke: var(--ink); stroke-width: var(--line-strong); stroke-dasharray: 6 3; }',
    '.k-fig .t5-callout { fill: var(--paper-2); stroke: var(--rule); stroke-width: var(--line-hair); }',
    '.k-fig .t5-band { fill: var(--paper); fill-opacity: 0.55; }',
    '.k-fig .t5-band-alt { fill: var(--paper-2); }',
    '.k-fig .t5-cut { stroke: var(--ink); stroke-width: var(--line-mark); }',
    '.k-fig .t5-arrow-ok { stroke: var(--ok); stroke-width: var(--line-strong); fill: none; }',
    '.k-fig .t5-head-ok { fill: var(--ok); }',
    '.k-fig .t5-note-ok { font-family: var(--font-body); font-style: italic; font-size: var(--text-fig-note); fill: var(--ok); }',
    '.k-fig .t5-on { fill: var(--ink); }',
    '.k-fig .t5-off { fill: var(--paper); stroke: var(--ink-soft); stroke-width: var(--line-strong); }',
    '.k-fig .t5-track { stroke: var(--ink-soft); stroke-width: var(--line-hair); stroke-dasharray: 4 4; }',
    '.k-fig .t5-free { fill: var(--paper); stroke: var(--ink-soft); stroke-width: var(--line-hair); }',
    '.k-fig .t5-busy { fill: var(--ink-soft); }',
    '.k-fig .t5-busy-text { font-family: var(--font-mono); font-size: var(--text-fig); fill: var(--paper); }',
    '.k-fig .t5-lit { fill: var(--paper-2); stroke: var(--ink); stroke-width: var(--line-strong); }',
    '.k-fig .t5-dark { fill: none; stroke: var(--rule); stroke-width: var(--line-hair); stroke-dasharray: 3 3; }',
    '.k-fig .t5-send { fill: var(--ok); }',
  ].join(' ');

  const fig = (name, wide, phone, title, desc, caption, body, stepsCount = 0) => ({
    name, w: 720, h: wide, phone: { w: 360, h: phone }, title, desc, caption, steps: stepsCount,
    eyebrow: 'Lesson 5 · writing the worker as code', css, body: (kk, L) => body(L),
  });

  return [
    fig('two-calls', 500, 668, 'Two calls, one step',
      'A sequence over time: worker A finds loan 4471 and sees approved, worker B finds it and also sees approved, both save it as claimed, A transfers with key 4471 and is paid, B transfers with the same key and the bank refuses it. Beside it, the spec covers find and save with one claim step, while the code makes two calls.',
      'Time runs down the page. Both workers find the loan approved before either saves it, so both send money; only the bank\'s idempotency key refuses the second transfer. The spec calls find and save one step; the code makes them two.',
      twoCalls, 7),
    fig('labels', 396, 444, 'A label begins a step',
      "Noor's PlusCal process with a cut line at each label, claim, send and mark, and one at the end where the worker is Done. Each band between two cut lines is one step. Worker B's arrows may enter only at a cut line, never inside a band.",
      'Each cut line is a label. Everything between two cut lines runs as one step, so the other worker can act only at a cut line.',
      labelsFig),
    fig('translation', 520, 552, 'What the translator writes',
      'PlusCal on the left, its TLA+ translation on the right: the process header becomes w(self) and Next, each label claim, send and mark becomes an action of the same name, the end of the code becomes Done, Terminating and Termination, and a pc variable whose values are the labels is written for you.',
      'One action per label, named after it. The translator also writes pc, the end of the desk and the Termination property; where the labels go is still up to you.',
      translation),
    fig('interactions', 456, 504, 'One label per real interaction',
      "Top: Noor's TypeScript makes four calls, find, save, transfer and set paid, but her spec has three labels, so find and save both map to claim, a hidden gap. Bottom: lesson 1's code makes three calls, the conditional UPDATE, transfer and set paid, one to one with the labels claim, send and mark.",
      'Draw a line from each call to its label. Two calls landing on one label hide a gap the spec can never show.',
      interactions),
    fig('poll', 492, 644, 'Three branches, three awaits',
      'The poll label with three branches, each behind an await: status approved leads to claim it and go to send; claimed with owner self leads to resume and go to send; paid leads to Done. Below, three states: worker A on an approved loan can claim, worker A on a loan claimed by A can resume, and worker B on a loan claimed by A has no branch enabled and waits.',
      'Each branch of poll runs only when its await is true. For worker B, looking at a loan claimed by A, all three are false: no step is possible, so B waits.',
      poll),
    fig('flicker', 384, 400, 'Enabled again and again',
      "One time line. The connection line alternates free and busy forever as the reconciliation job takes and gives it; worker A's send is enabled exactly when the line is free. Under weak fairness A never sends; under strong fairness A sends in a free slot.",
      "A's send flickers on and off with the line. Weak fairness promises nothing for a step that keeps switching off; strong fairness promises it happens, because it is enabled again and again.",
      flicker, 3),
  ];
};
