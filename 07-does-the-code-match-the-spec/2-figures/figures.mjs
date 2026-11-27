export default k => {
  const { g, line, path, rect, text, masked, arrow, box, step, cross } = k;

  const INIT = ['visible', 'approved', ['idle', 'idle'], false, 0, false];
  const desk = (s, { key = true, lease = true, markFirst = false } = {}) => {
    const [queue, status, pc, keyed, transfers, crashed] = s;
    const out = [];
    const holding = markFirst ? ['claimed', 'marked', 'sent'] : ['claimed', 'sent', 'confirmed'];
    pc.forEach((p, i) => {
      const w = 'ABC'[i];
      const go = (to, o = {}) => [o.q ?? queue, o.st ?? status, pc.map((x, j) => (j === i ? to : x)), o.k ?? keyed, o.t ?? transfers, o.c ?? crashed];
      const paid = key && keyed ? transfers : transfers + 1;
      if (p === 'idle' && queue === 'visible') out.push([`Receive(${w})`, true, go('claimed', { q: 'hidden' })]);
      if (markFirst) {
        if (p === 'claimed') out.push([`Mark(${w})`, true, go('marked', { q: 'deleted', st: 'paid' })]);
        if (p === 'marked') out.push([`Send(${w})`, true, go('sent')]);
        if (p === 'sent') out.push([`Confirm(${w})`, true, go('done', { k: true, t: paid })]);
      } else {
        if (p === 'claimed') out.push([`Send(${w})`, true, go('sent')]);
        if (p === 'sent') out.push([`Confirm(${w})`, true, go('confirmed', { k: true, t: paid })]);
        if (p === 'confirmed') out.push([`Mark(${w})`, true, go('done', { q: 'deleted', st: 'paid' })]);
      }
      if (holding.includes(p) && !crashed) out.push([`Crash(${w})`, false, go('idle', { c: true })]);
    });
    if (queue === 'hidden') out.push(['Expire', lease, ['visible', ...s.slice(1)]]);
    return out;
  };
  const key = s => JSON.stringify(s);
  const atBank = s => [s[4] > 0 ? 'paid' : 'approved', s[4]];
  const atTable = s => [s[1], s[4]];
  const atSend = s => [s[2].some(p => ['sent', 'confirmed', 'done'].includes(p)) ? 'paid' : 'approved', s[4]];
  const kindOf = (a, b) => (key(a) === key(b) ? 'stutter' : a[0] === 'approved' && b[0] === 'paid' && b[1] === a[1] + 1 ? 'Pay' : 'not allowed');

  const explore = opts => {
    const seen = new Map([[key(INIT), INIT]]), todo = [INIT], kinds = { Pay: 0, stutter: 0, 'not allowed': 0 };
    while (todo.length) {
      const s = todo.pop();
      for (const [, , t] of desk(s, opts)) {
        kinds[kindOf(atBank(s), atBank(t))]++;
        if (!seen.has(key(t))) { seen.set(key(t), t); todo.push(t); }
      }
    }
    return { states: seen.size, kinds };
  };
  const follow = (acts, opts) => acts.reduce((rows, a) => {
    const hit = desk(rows[rows.length - 1].s, opts).find(([n]) => n === a);
    if (!hit) throw new Error(`trace: ${a} is not enabled after ${rows.map(r => r.act).join(', ')}`);
    return [...rows, { act: a, s: hit[2] }];
  }, [{ act: 'start', s: INIT }]);

  const FIXED = explore(), NOKEY = explore({ key: false }), PILOT = explore({ markFirst: true });
  const want = (got, exp, what) => { if (JSON.stringify(got) !== JSON.stringify(exp)) throw new Error(`${what}: expected ${JSON.stringify(exp)}, got ${JSON.stringify(got)}`); };
  want([FIXED.states, FIXED.kinds], [99, { Pay: 24, stutter: 224, 'not allowed': 0 }], 'QueueDesk under PaidAtBank');
  want([NOKEY.states, NOKEY.kinds], [122, { Pay: 24, stutter: 233, 'not allowed': 30 }], 'no key');
  want(PILOT.states, 60, 'pilot');

  const HAPPY = follow(['Receive(A)', 'Send(A)', 'Confirm(A)', 'Mark(A)']);
  const SLOW = follow(['Receive(A)', 'Expire', 'Receive(B)', 'Send(A)', 'Confirm(A)', 'Send(B)', 'Confirm(B)', 'Mark(A)', 'Mark(B)']);
  const NOKEY_TRACE = follow(['Receive(A)', 'Expire', 'Send(A)', 'Confirm(A)', 'Receive(B)', 'Send(B)', 'Confirm(B)'], { key: false });
  const LASSO = follow(['Receive(A)', 'Mark(A)', 'Crash(A)'], { markFirst: true });
  want(SLOW.map(r => r.s[4]), [0, 0, 0, 0, 0, 1, 1, 1, 1, 1], 'slow worker transfers');
  want(NOKEY_TRACE.map(r => atBank(r.s).join()), ['approved,0', 'approved,0', 'approved,0', 'approved,0', 'paid,1', 'paid,1', 'paid,1', 'paid,2'], 'no-key trace');
  want(kindOf(atBank(NOKEY_TRACE[6].s), atBank(NOKEY_TRACE[7].s)), 'not allowed', 'no-key last step');
  want(LASSO[3].s, ['deleted', 'paid', ['idle', 'idle'], false, 0, true], 'pilot lasso end');
  want(desk(LASSO[3].s, { markFirst: true }).filter(([, fair]) => fair).length, 0, 'pilot lasso end has no fair step');
  const kindsAlong = (rows, map) => rows.slice(1).map((r, i) => kindOf(map(rows[i].s), map(r.s)));
  want(kindsAlong(HAPPY, atTable), ['stutter', 'stutter', 'not allowed', 'not allowed'], 'the table');
  want(kindsAlong(HAPPY, atSend), ['stutter', 'not allowed', 'not allowed', 'stutter'], 'the send');
  want(kindsAlong(HAPPY, atBank), ['stutter', 'stutter', 'Pay', 'stutter'], 'the bank');
  const STUTTERS = ['Receive(A)', 'Expire', 'Send(A)', 'Crash(A)'];
  const insideLoop = follow(['Receive(A)', 'Expire', 'Receive(B)', 'Send(A)', 'Crash(A)']);
  STUTTERS.forEach(a => {
    const i = insideLoop.findIndex(r => r.act === a);
    want([kindOf(atBank(insideLoop[i - 1].s), atBank(insideLoop[i].s)), atBank(insideLoop[i].s).join()], ['stutter', 'approved,0'], `stutter loop ${a}`);
  });

  const CODE = { idle: 'i', claimed: 'c', sent: 's', confirmed: 'cf', done: 'd', marked: 'm' };
  const absText = ([st, t]) => `${st}, ${t}`;

  const T0 = 0.2, HOLD = 1.1, LEN = 0.6;
  const at = (i, extra = 0) => Number((T0 + i * HOLD + extra).toFixed(2));
  const rise = (i, o = {}) => ({ k: 'rise', d: at(i, o.extra || 0), len: LEN, dx: o.dx ?? 0, dy: o.dy ?? 8 });
  const land = (i, extra = 0) => ({ k: 'land', d: at(i, extra), len: LEN, s0: 1.12 });

  const okDefs = slug => `<defs><marker id="${slug}-arrow-ok" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon class="t7-head-ok" points="0 0, 8 3, 0 6"/></marker></defs>`;
  const okArrow = (slug, pts) => arrow(slug, pts, { cls: 'k-arrow t7-ok', 'marker-end': `url(#${slug}-arrow-ok)` });
  const tick = (x, y) => path(`M${x - 5} ${y}L${x - 1} ${y + 4}L${x + 6} ${y - 4}`, { cls: 't7-tick' });
  const chip = (cx, y, w, h, abs, o = {}) => {
    const { tone = '', two = false } = o;
    const cls = tone === 'bad' ? 'k-box-accent' : 't7-chip';
    const tc = tone === 'bad' ? 'k-num-accent' : 'k-num';
    return g({},
      rect(cx - w / 2, y, w, h, { cls, rx: 4 }),
      two ? [text(cx, y + h / 2 - 2, abs[0], { cls: tc }), text(cx, y + h / 2 + 13, String(abs[1]), { cls: tc })]
        : text(cx, y + h / 2 + 4, absText(abs), { cls: tc }));
  };

  const twoLevel = (L, rows, o) => {
    const s = L.slug, ph = L.phone;
    const abs = rows.map(r => atBank(r.s));
    const kinds = ['', ...kindsAlong(rows, atBank)];
    const bands = [];
    abs.forEach((a, i) => {
      const last = bands[bands.length - 1];
      if (last && key(last.abs) === key(a)) last.to = i; else bands.push({ from: i, to: i, abs: a });
    });
    const P = ph ? { top: 72, pitch: 40, ax: 200, bx: 220, bw: 92, loop: 326 } : { top: 92, pitch: 40, ax: 416, bx: 460, bw: 120, loop: 596 };
    const yc = i => P.top + i * P.pitch;
    const kindCls = kd => (kd === 'Pay' ? 'k-name' : kd === 'not allowed' ? 'k-num-accent' : 'k-tick');
    const rowWide = (r, i) => g({},
      text(16, yc(i) + 4, r.act, { anchor: 'start', cls: 'k-num' }),
      rect(112, yc(i) - 14, 300, 28, { cls: 't7-card', rx: 4 }),
      [[156, r.s[0]], [232, r.s[2][0]], [308, r.s[2][1]], [386, String(r.s[4])]].map(([x, v]) => text(x, yc(i) + 4, v, { cls: 'k-num' })),
      arrow(s, [[P.ax, yc(i)], [P.bx - 2, yc(i)]], { cls: 'k-arrow t7-map' }),
      i ? text(608, yc(i) + 4, kinds[i], { anchor: 'start', cls: kindCls(kinds[i]) }) : '');
    const rowPhone = (r, i) => {
      const kd = i ? kinds[i] : '';
      return g({},
        text(16, yc(i) - 4, r.act, { anchor: 'start', cls: 'k-num' }),
        kd ? text(16 + r.act.length * 8.4 + 6, yc(i) - 4, `· ${kd}`, { anchor: 'start', cls: kindCls(kd) }) : '',
        text(16, yc(i) + 12, `${r.s[0]} · ${CODE[r.s[2][0]]} · ${CODE[r.s[2][1]]} · ${r.s[4]}`, { anchor: 'start', cls: 'k-label' }),
        arrow(s, [[P.ax, yc(i)], [P.bx - 2, yc(i)]], { cls: 'k-arrow t7-map' }));
    };
    const row = ph ? rowPhone : rowWide;
    const band = b => {
      const y = yc(b.from) - 18, h = yc(b.to) + 18 - y, cx = P.bx + P.bw / 2, bad = o.bad && b === bands[bands.length - 1];
      const mid = (yc(b.from) + yc(b.to)) / 2;
      return g({},
        rect(P.bx, y, P.bw, h, { cls: bad ? 'k-box-accent' : 't7-band', rx: 6 }),
        b.from === b.to ? text(cx, mid + 5, absText(b.abs), { cls: bad ? 'k-name-accent' : 'k-name' })
          : [text(cx, mid - 2, b.abs[0], { cls: 'k-name' }), text(cx, mid + 16, `transfers ${b.abs[1]}`, { cls: 'k-num' })]);
    };
    const link = (b, nb) => {
      const kd = kindOf(b.abs, nb.abs), y1 = yc(b.to), y2 = yc(nb.from), right = P.bx + P.bw;
      return arrow(s, [[right, y1], [P.loop, y1], [P.loop, y2], [right + 2, y2]], kd === 'Pay' ? { cls: 'k-arrow t7-pay' } : { tone: 'accent', cls: 'k-arrow t7-pay' });
    };
    const header = ph
      ? [text(16, 24, 'the design', { anchor: 'start', cls: 'k-name' }), text(P.bx + P.bw / 2, 24, 'PayOnce sees', { cls: 'k-name' }),
        text(P.bx + P.bw / 2, 44, 'through the bank', { cls: 'k-tick' })]
      : [text(16, 36, 'the design', { anchor: 'start', cls: 'k-name' }), text(P.bx, 36, 'what PayOnce sees', { anchor: 'start', cls: 'k-name' }),
        [[16, 'step', 'start'], [156, 'queue'], [232, 'pc of A'], [308, 'pc of B'], [386, 'transfers'], [P.bx + P.bw / 2, 'through the bank'], [608, 'PayOnce step', 'start']]
          .map(([x, t, anchor = 'middle']) => text(x, 64, t, { anchor, cls: 'k-tick' }))];
    const bottom = yc(rows.length - 1) + 18;
    return { P, yc, bands, header, row, band, link, bottom, kinds };
  };

  const twoLevels = L => {
    const T = twoLevel(L, SLOW, {});
    const [b1, b2] = T.bands;
    const rowsOf = (a, b) => SLOW.slice(a, b + 1).map((r, i) => T.row(r, a + i));
    const y = T.bottom + 34;
    const keyLines = L.phone ? [text(16, T.bottom + 26, 'pc: i idle · c claimed · s sent', { anchor: 'start', cls: 'k-tick' }),
      text(16, T.bottom + 44, 'cf confirmed · d done; last: transfers', { anchor: 'start', cls: 'k-tick' })] : [];
    const tallyY = L.phone ? T.bottom + 76 : y;
    return [
      T.header, keyLines,
      step(1, 'start and the first step: the design changes, PayOnce sees approved, 0',
        g({ anim: rise(0) }, T.band(b1)), g({ anim: rise(0, { extra: 0.3 }) }, rowsOf(0, 1))),
      step(2, 'Expire, Receive(B), Send(A): three more stutters', g({ anim: rise(1) }, rowsOf(2, 4))),
      step(3, 'Confirm(A): the bank pays, and PayOnce sees its one Pay step', g({ anim: rise(2) }, rowsOf(5, 5))),
      step(4, 'PayOnce moves from approved, 0 to paid, 1', g({ anim: land(3) }, T.band(b2)), g({ anim: rise(3, { extra: 0.2 }) }, T.link(b1, b2))),
      step(5, 'Send(B), Confirm(B), Mark(A), Mark(B): four more stutters', g({ anim: rise(4) }, rowsOf(6, 9))),
      step(6, 'nine steps of the design, one step of PayOnce',
        g({ anim: rise(5) }, text(16, tallyY, L.phone ? '9 steps: 1 Pay, 8 stutters' : 'nine steps of the design: 1 Pay, 8 stutters', { anchor: 'start', cls: 'k-name-accent' }))),
    ];
  };

  const failureStep = L => {
    const T = twoLevel(L, NOKEY_TRACE, { bad: true });
    const [b1, b2, b3] = T.bands;
    const rowsOf = (a, b) => NOKEY_TRACE.slice(a, b + 1).map((r, i) => T.row(r, a + i));
    const y = T.bottom + 30;
    const notes = L.phone
      ? ['the last step is neither Pay', '(status was not approved) nor', 'a stutter (transfers changed)']
      : ['the last step is neither Pay (status was not approved)', 'nor a stutter (transfers changed)'];
    const where = L.phone ? ['TLC: PayOnce line 14, col 17 to 29', '[][Pay]_avars is violated'] : ['TLC: PayOnce line 14, col 17 to 29, [][Pay]_avars, is violated'];
    const codeY = y + notes.length * 22 + 8;
    const keyLines = L.phone ? ['pc: i idle · c claimed · s sent', 'cf confirmed; last: transfers'].map((t, i) => text(16, codeY + where.length * 20 + 30 + i * 18, t, { anchor: 'start', cls: 'k-tick' })) : [];
    return [
      T.header, keyLines,
      step(1, 'Receive(A), Expire, Send(A): PayOnce sees approved, 0 throughout', g({ anim: rise(0) }, T.band(b1)), g({ anim: rise(0, { extra: 0.3 }) }, rowsOf(0, 3))),
      step(2, 'Confirm(A) is the Pay step; Receive(B) and Send(B) stutter on paid, 1', g({ anim: rise(1) }, T.band(b2), T.link(b1, b2)), g({ anim: rise(1, { extra: 0.3 }) }, rowsOf(4, 6))),
      step(3, 'Confirm(B) without a key moves money again: transfers 2', g({ anim: rise(2) }, rowsOf(7, 7))),
      step(4, 'PayOnce would have to go from paid, 1 to paid, 2: a step it forbids', g({ anim: land(3) }, T.band(b3), T.link(b2, b3))),
      step(5, 'why the step is forbidden, and where TLC says so',
        g({ anim: rise(4) },
          notes.map((t, i) => text(16, y + i * 22, t, { anchor: 'start', cls: 'k-note' })),
          rect(16, codeY - 4, L.phone ? 328 : 560, where.length * 20 + 12, { cls: 't7-code-bg', rx: 4 }),
          where.map((t, i) => text(28, codeY + 14 + i * 20, t, { anchor: 'start', cls: 't7-code' })))),
    ];
  };

  const pilot = L => {
    const s = L.slug, ph = L.phone;
    const X = ph ? { Q: 36, W: 104, T: 172, Y: 240, K: 316, w: 60 } : { Q: 64, W: 196, T: 328, Y: 488, K: 648, w: 112 };
    const bottom = ph ? 380 : 392;
    const actor = (cx, name, sub) => box(cx - X.w / 2, 16, X.w, 48, { name, sub });
    const life = x => line(x, 64, x, bottom, { cls: 't7-life' });
    const msg = (x1, x2, y, label, o = {}) => g({},
      arrow(s, [[x1, y], [x2 - Math.sign(x2 - x1) * 2, y]], { cls: 'k-arrow' }),
      masked((x1 + x2) / 2, y - 9, label, { cls: 'k-label', ...o }));
    const Y = ph ? { r: 112, m: 160, d: 208, c: 264, e: 320 } : { r: 112, m: 160, d: 208, c: 264, e: 328 };
    const bank = ph
      ? g({}, rect(X.K - 32, 196, 64, 44, { cls: 'k-box-accent', rx: 6 }), text(X.K, 214, 'no', { cls: 'k-num-accent' }), text(X.K, 230, 'transfer', { cls: 'k-num-accent' }))
      : g({}, rect(X.K - 52, 212, 104, 40, { cls: 'k-box-accent', rx: 6 }), text(X.K, 236, 'no transfer', { cls: 'k-num-accent' }));
    return [
      life(X.Q), life(X.W), life(X.T), life(X.Y), life(X.K),
      actor(X.Q, 'queue', ph ? '' : 'loan 4471'),
      actor(X.W, ph ? 'B' : 'worker B', ph ? 'worker' : 'handle()'),
      actor(X.T, 'loans', ph ? '' : 'table'),
      actor(X.Y, 'bakery', ph ? '' : 'customer'),
      actor(X.K, 'bank', ph ? '' : 'transfer API'),
      step(1, 'worker B receives the message for loan 4471, and the queue hides it',
        g({ anim: rise(0) },
          rect(X.Q - 4, Y.r, 8, Y.d - Y.r, { cls: 't7-hidden' }),
          rect(X.W - 4, Y.r - 8, 8, Y.c - Y.r + 8, { cls: 't7-act' }),
          ph ? '' : [text(X.Q - 10, 160, 'hidden', { anchor: 'end', cls: 'k-tick' }), text(X.Q - 10, 178, '5 min', { anchor: 'end', cls: 'k-tick' })],
          msg(X.Q + 4, X.W - 4, Y.r, ph ? 'receive' : 'receive 4471'))),
      step(2, 'B writes paid in the loans table', g({ anim: rise(1) }, msg(X.W + 4, X.T, Y.m, ph ? 'paid' : 'status = paid'))),
      step(3, 'B deletes the message', g({ anim: rise(2) }, msg(X.W - 4, X.Q + 4, Y.d, 'delete'))),
      step(4, 'a deploy restarts B before it reaches the bank',
        g({ anim: land(3) }, cross(X.W, Y.c + 8), ph ? text(X.W - 14, Y.c + 13, 'restart', { anchor: 'end', cls: 'k-tick' }) : text(X.W + 14, Y.c + 13, 'deploy restart', { anchor: 'start', cls: 'k-tick' }))),
      step(5, 'the system emails the bakery that its loan has been paid out',
        g({ anim: rise(4) }, msg(X.T, X.Y, Y.e, ph ? 'email' : 'email: “paid out!”'))),
      step(6, 'the bank never hears about loan 4471: no transfer', g({ anim: land(5) }, bank)),
      ph ? [text(16, 408, 'email: “Your loan has been paid out!”', { anchor: 'start', cls: 'k-tick' }),
        text(16, 428, 'paid: B sets the status to paid', { anchor: 'start', cls: 'k-tick' })] : '',
    ];
  };

  const strip = (slug, x, y, items, o = {}) => {
    const { w = 96, h = 24 } = o;
    const out = [];
    items.forEach(({ abs, n, tone }, i) => {
      out.push(chip(x + w / 2, y, w, h, abs, { tone }));
      x += w;
      if (n) { out.push(text(x + 6, y + h / 2 + 4, n, { anchor: 'start', cls: 'k-tick' })); x += 6 + n.length * 7.5; }
      if (i < items.length - 1) { out.push(arrow(slug, [[x + 6, y + h / 2], [x + 28, y + h / 2]], { cls: 'k-arrow' })); x += 32; }
    });
    return { out, end: x };
  };
  const outside = (slug, x, y, items) => {
    const st = strip(slug, x, y, items);
    return [st.out, cross(st.end + 22, y + 12), text(st.end + 36, y + 16, 'outside', { anchor: 'start', cls: 'k-num-accent' })];
  };

  const implication = L => {
    const s = L.slug, ph = L.phone;
    const A0 = ['approved', 0], P1 = ['paid', 1];
    if (ph) {
      return [
        text(16, 28, 'Spec ⇒ Abstract!Spec', { anchor: 'start', cls: 'k-math' }),
        rect(8, 44, 344, 312, { cls: 't7-region', rx: 10 }),
        text(24, 68, 'behaviors PayOnce allows', { anchor: 'start', cls: 'k-name' }),
        text(24, 92, 'PayOnce alone: Pay at once', { anchor: 'start', cls: 'k-tick' }),
        strip(s, 24, 100, [{ abs: A0, n: '×1' }, { abs: P1, n: '×1' }]).out,
        rect(20, 140, 320, 200, { cls: 't7-region-inner', rx: 8 }),
        text(32, 164, 'behaviors of the design,', { anchor: 'start', cls: 'k-name' }),
        text(32, 184, 'translated through the mapping', { anchor: 'start', cls: 'k-name' }),
        text(32, 210, 'the happy behavior', { anchor: 'start', cls: 'k-tick' }),
        strip(s, 32, 218, [{ abs: A0, n: '×3' }, { abs: P1, n: '×2' }]).out,
        text(32, 266, 'the unlucky behavior', { anchor: 'start', cls: 'k-tick' }),
        strip(s, 32, 274, [{ abs: A0, n: '×5' }, { abs: P1, n: '×5' }]).out,
        text(32, 324, 'every step: Pay or stutter', { anchor: 'start', cls: 'k-tick' }),
        text(16, 384, 'a step PayOnce forbids', { anchor: 'start', cls: 'k-tick' }),
        outside(s, 16, 392, [{ abs: P1 }, { abs: ['paid', 2], tone: 'bad' }]),
        text(16, 444, 'the Pay never happens', { anchor: 'start', cls: 'k-tick' }),
        outside(s, 16, 452, [{ abs: A0, n: 'forever' }]),
        text(16, 504, '×3: the same state three times', { anchor: 'start', cls: 'k-tick' }),
        text(16, 522, 'in a row; each repeat is a stutter', { anchor: 'start', cls: 'k-tick' }),
      ];
    }
    return [
      text(16, 28, 'Spec ⇒ Abstract!Spec', { anchor: 'start', cls: 'k-math' }),
      rect(16, 44, 688, 244, { cls: 't7-region', rx: 10 }),
      text(32, 70, 'behaviors PayOnce allows', { anchor: 'start', cls: 'k-name' }),
      strip(s, 400, 56, [{ abs: A0, n: '×1' }, { abs: P1, n: '×1' }]).out,
      text(400, 98, 'PayOnce alone: Pay at once', { anchor: 'start', cls: 'k-tick' }),
      rect(40, 112, 640, 160, { cls: 't7-region-inner', rx: 8 }),
      text(56, 138, 'behaviors of the design, translated through the mapping', { anchor: 'start', cls: 'k-name' }),
      text(56, 172, 'the happy behavior', { anchor: 'start', cls: 'k-tick' }),
      strip(s, 232, 156, [{ abs: A0, n: '×3' }, { abs: P1, n: '×2' }]).out,
      text(56, 220, 'the unlucky behavior', { anchor: 'start', cls: 'k-tick' }),
      strip(s, 232, 204, [{ abs: A0, n: '×5' }, { abs: P1, n: '×5' }]).out,
      text(56, 256, 'every step of the design: a Pay or a stutter', { anchor: 'start', cls: 'k-tick' }),
      text(16, 330, 'a step PayOnce forbids', { anchor: 'start', cls: 'k-tick' }),
      outside(s, 232, 314, [{ abs: P1 }, { abs: ['paid', 2], tone: 'bad' }]),
      text(16, 374, 'the Pay never happens', { anchor: 'start', cls: 'k-tick' }),
      outside(s, 232, 358, [{ abs: A0, n: 'forever' }]),
      text(16, 416, '×3: the same PayOnce state three times in a row; each repeat is a stutter', { anchor: 'start', cls: 'k-tick' }),
    ];
  };

  const MAPS = [
    ['the table', 'PayOnce’s status is the table’s status', atTable],
    ['the send', 'paid as soon as a worker has sent a request', atSend],
    ['the bank', 'paid once the bank has made a transfer', atBank],
  ];
  const mappingChoices = L => {
    const s = L.slug, ph = L.phone;
    const mapRow = (map, place) => {
      const out = [];
      let broken = false;
      HAPPY.forEach((r, i) => {
        const cur = map(r.s), kd = i ? kindOf(map(HAPPY[i - 1].s), cur) : '';
        const faint = broken;
        const items = [];
        if (i) {
          const p = place.arrow(i);
          if (faint) items.push(arrow(s, p.pts, { cls: 'k-arrow' }));
          else if (kd === 'Pay') items.push(okArrow(s, p.pts), place.payWord ? text(p.wx, p.wy, 'Pay', { anchor: 'start', cls: 'k-num-ok' }) : '');
          else if (kd === 'not allowed') items.push(arrow(s, p.pts, { tone: 'accent', cls: 'k-arrow t7-pay' }), cross(p.cx, p.cy));
          else items.push(arrow(s, p.pts, { cls: 'k-arrow' }));
        }
        items.push(place.chip(i, cur, kd === 'not allowed' && !faint));
        if (i && !faint && place.kind) items.push(place.kind(i, kd));
        out.push(faint ? g({ cls: 't7-faint' }, items) : g({}, items));
        if (kd === 'not allowed') broken = true;
      });
      return out;
    };
    if (ph) {
      const cols = [170, 244, 318], yc = i => 100 + i * 64;
      return [
        okDefs(s),
        text(16, 24, 'the happy behavior', { anchor: 'start', cls: 'k-name' }),
        text(16, 56, 'step', { anchor: 'start', cls: 'k-tick' }),
        ['table', 'send', 'bank'].map((t, c) => text(cols[c], 56, t, { cls: 'k-name' })),
        HAPPY.map((r, i) => g({},
          text(16, yc(i) - 4, r.act, { anchor: 'start', cls: 'k-num' }),
          text(16, yc(i) + 14, `${r.s[0]} ${CODE[r.s[2][0]]} ${r.s[4]}`, { anchor: 'start', cls: 'k-label' }))),
        MAPS.map(([, , map], c) => mapRow(map, {
          arrow: i => ({ pts: [[cols[c], yc(i - 1) + 18], [cols[c], yc(i) - 20]], cx: cols[c] + 17, cy: (yc(i - 1) + yc(i)) / 2, wx: cols[c] + 7, wy: (yc(i - 1) + yc(i)) / 2 + 4 }),
          payWord: true,
          chip: (i, cur, bad) => chip(cols[c], yc(i) - 18, 72, 36, cur, { two: true, tone: bad ? 'bad' : '' }),
        })),
        ['state: queue · pc of A · transfers', 'pc: i idle · c claimed · s sent', 'cf confirmed · d done', 'grey arrow: stutter; green: Pay;', 'amber ×: not allowed, then faint', 'where TLC has already stopped']
          .map((t, i) => text(16, 412 + i * 19, t, { anchor: 'start', cls: 'k-tick' })),
      ];
    }
    const cx = i => 80 + i * 136;
    return [
      okDefs(s),
      text(16, 28, 'the happy behavior', { anchor: 'start', cls: 'k-name' }),
      HAPPY.map((r, i) => g({},
        text(cx(i), 52, r.act, { cls: 'k-tick' }),
        i ? arrow(s, [[cx(i - 1) + 56, 100], [cx(i) - 58, 100]], { cls: 'k-arrow' }) : '',
        rect(cx(i) - 56, 60, 112, 80, { cls: 't7-card', rx: 6 }),
        [r.s[0], `A ${r.s[2][0]}`, `B ${r.s[2][1]}`, `transfers ${r.s[4]}`].map((t, j) => text(cx(i) - 46, 80 + j * 17, t, { anchor: 'start', cls: 'k-num' })))),
      MAPS.map(([name, desc, map], r) => {
        const T = 164 + r * 84;
        return g({},
          text(16, T + 10, name, { anchor: 'start', cls: 'k-name' }),
          text(112, T + 10, desc, { anchor: 'start', cls: 'k-tick' }),
          mapRow(map, {
            arrow: i => ({ pts: [[cx(i - 1) + 48, T + 36], [cx(i) - 50, T + 36]], cx: (cx(i - 1) + cx(i)) / 2, cy: T + 52 }),
            chip: (i, cur, bad) => chip(cx(i), T + 24, 96, 24, cur, { tone: bad ? 'bad' : '' }),
            kind: (i, kd) => text(cx(i), T + 66, kd, { cls: kd === 'Pay' ? 'k-num-ok' : kd === 'not allowed' ? 'k-num-accent' : 'k-tick' }),
          }));
      }),
      text(704, 424, 'faint: after the step where TLC stops', { anchor: 'end', cls: 'k-tick' }),
    ];
  };

  const stutter = L => {
    const s = L.slug, ph = L.phone;
    if (ph) {
      const rows = [228, 276, 324, 372];
      return [
        text(16, 24, 'PayOnce’s state graph', { anchor: 'start', cls: 'k-name' }),
        line(52, 132, 8, 168, { cls: 'k-guide' }), line(100, 132, 352, 168, { cls: 'k-guide' }),
        rect(8, 168, 344, 260, { cls: 't7-region', rx: 10 }),
        arrow(s, [[136, 72], [222, 72]], { cls: 'k-arrow t7-pay' }),
        arrow(s, [[52, 96], [52, 124], [100, 124], [100, 98]], { cls: 'k-arrow' }),
        arrow(s, [[260, 96], [260, 124], [308, 124], [308, 98]], { cls: 'k-arrow' }),
        masked(179, 63, 'Pay', { cls: 'k-num' }),
        text(76, 146, 'stutter', { cls: 'k-tick' }), text(284, 146, 'stutter', { cls: 'k-tick' }),
        box(16, 48, 120, 48, { name: 'approved, 0' }),
        box(224, 48, 120, 48, { name: 'paid, 1' }),
        text(24, 192, 'inside the loop on approved, 0', { anchor: 'start', cls: 'k-name' }),
        text(24, 212, 'steps that leave avars unchanged', { anchor: 'start', cls: 'k-tick' }),
        rows.map(y => arrow(s, [[144, y + 20], [214, y + 20]], { cls: 'k-arrow t7-map' })),
        STUTTERS.map((a, i) => box(24, rows[i], 120, 40, { name: a })),
        box(216, 228, 120, 184, { name: 'approved, 0', sub: 'unchanged' }),
        text(16, 456, '224 of 248 steps are stutters', { anchor: 'start', cls: 'k-note' }),
      ];
    }
    const rows = [108, 156, 204, 252];
    return [
      text(16, 28, 'PayOnce’s state graph', { anchor: 'start', cls: 'k-name' }),
      line(208, 86, 400, 48, { cls: 'k-guide' }), line(208, 114, 400, 316, { cls: 'k-guide' }),
      rect(400, 48, 304, 268, { cls: 't7-region', rx: 10 }),
      arrow(s, [[108, 124], [108, 234]], { cls: 'k-arrow t7-pay' }),
      arrow(s, [[176, 88], [208, 88], [208, 112], [178, 112]], { cls: 'k-arrow' }),
      arrow(s, [[176, 252], [208, 252], [208, 276], [178, 276]], { cls: 'k-arrow' }),
      masked(118, 184, 'Pay', { anchor: 'start', cls: 'k-num' }),
      text(218, 104, 'stutter', { anchor: 'start', cls: 'k-tick' }),
      text(218, 268, 'stutter', { anchor: 'start', cls: 'k-tick' }),
      box(40, 72, 136, 52, { name: 'approved, 0' }),
      box(40, 236, 136, 52, { name: 'paid, 1' }),
      text(416, 74, 'inside the loop on approved, 0', { anchor: 'start', cls: 'k-name' }),
      text(416, 94, 'steps that leave avars unchanged', { anchor: 'start', cls: 'k-tick' }),
      rows.map(y => arrow(s, [[528, y + 20], [582, y + 20]], { cls: 'k-arrow t7-map' })),
      STUTTERS.map((a, i) => box(416, rows[i], 112, 40, { name: a })),
      box(584, 108, 104, 184, { name: 'approved, 0', sub: 'unchanged' }),
      text(16, 340, '224 of 248 steps are stutters', { anchor: 'start', cls: 'k-note' }),
    ];
  };

  const TABLE = [['QueueDesk', 'QueueDesk', 99, true, true], ['the pilot (mark first)', 'the pilot', 60, false, true], ['no promise the lease runs out', 'no lease fairness', 99, false, true]];
  const lamp = (x, y, pass) => (pass ? [tick(x, y - 4), text(x + 12, y, 'no error', { anchor: 'start', cls: 'k-num' })]
    : [cross(x, y - 4), text(x + 12, y, 'lasso', { anchor: 'start', cls: 'k-num-accent' })]);

  const livenessCarried = L => {
    const s = L.slug, ph = L.phone;
    const states = LASSO.map(r => r.s);
    if (ph) {
      const yc = i => 84 + i * 52, cx = 276;
      const tableTop = 432;
      return [
        text(16, 24, 'the pilot’s lasso', { anchor: 'start', cls: 'k-name' }),
        text(16, 48, 'the design', { anchor: 'start', cls: 'k-tick' }), text(cx, 48, 'PayOnce sees', { cls: 'k-tick' }),
        LASSO.map((r, i) => g({},
          text(16, yc(i) - 10, r.act, { anchor: 'start', cls: 'k-num' }),
          text(16, yc(i) + 5, `${r.s[0]} · ${r.s[1]}`, { anchor: 'start', cls: 'k-label' }),
          text(16, yc(i) + 20, `A ${CODE[r.s[2][0]]} · B ${CODE[r.s[2][1]]} · transfers ${r.s[4]}`, { anchor: 'start', cls: 'k-label' }),
          arrow(s, [[200, yc(i)], [222, yc(i)]], { cls: 'k-arrow t7-map' }),
          i ? arrow(s, [[cx, yc(i - 1) + 14], [cx, yc(i) - 16]], { cls: 'k-arrow' }) : '',
          chip(cx, yc(i) - 14, 100, 28, atBank(r.s)))),
        arrow(s, [[326, yc(3) - 6], [342, yc(3) - 6], [342, yc(3) + 6], [328, yc(3) + 6]], { cls: 'k-arrow' }),
        arrow(s, [[cx, yc(3) + 14], [cx, yc(3) + 76]], { cls: 'k-arrow t7-dash' }),
        text(cx - 10, yc(3) + 50, 'Pay enabled,', { anchor: 'end', cls: 'k-note' }),
        text(cx - 10, yc(3) + 68, 'never taken', { anchor: 'end', cls: 'k-note' }),
        g({ cls: 't7-faint' }, chip(cx, yc(3) + 78, 100, 28, ['paid', 1])),
        text(16, yc(3) + 132, 'i idle · c claimed · m marked', { anchor: 'start', cls: 'k-tick' }),
        text(16, yc(3) + 150, 'rows: queue · table, then pc', { anchor: 'start', cls: 'k-tick' }),
        text(16, yc(3) + 168, 'loop: stutters forever', { anchor: 'start', cls: 'k-tick' }),
        text(16, tableTop, 'design', { anchor: 'start', cls: 'k-tick' }),
        text(206, tableTop, 'Refines', { cls: 'k-tick' }), text(300, tableTop, 'RefinesSafety', { cls: 'k-tick' }),
        TABLE.map(([, name, , a, b], i) => g({},
          line(16, tableTop + 12 + i * 28, 344, tableTop + 12 + i * 28, { cls: 'k-grid' }),
          text(16, tableTop + 30 + i * 28, name, { anchor: 'start', cls: 'k-num' }),
          lamp(176, tableTop + 30 + i * 28, a), lamp(264, tableTop + 30 + i * 28, b))),
      ];
    }
    const x = i => 16 + i * 160;
    const tableTop = 344;
    return [
      text(16, 28, 'the pilot’s lasso, at two levels', { anchor: 'start', cls: 'k-name' }),
      LASSO.map((r, i) => g({},
        text(x(i) + 64, 56, r.act, { cls: 'k-tick' }),
        i ? arrow(s, [[x(i - 1) + 128, 114], [x(i) - 2, 114]], { cls: 'k-arrow' }) : '',
        rect(x(i), 64, 128, 100, { cls: 't7-card', rx: 6 }),
        [`queue ${r.s[0]}`, `table ${r.s[1]}`, `A ${r.s[2][0]}`, `B ${r.s[2][1]}`, `transfers ${r.s[4]}`]
          .map((t, j) => text(x(i) + 12, 84 + j * 17, t, { anchor: 'start', cls: 'k-num' })),
        arrow(s, [[x(i) + 64, 166], [x(i) + 64, 194]], { cls: 'k-arrow t7-map' }),
        i ? arrow(s, [[x(i - 1) + 120, 210], [x(i) + 6, 210]], { cls: 'k-arrow' }) : '',
        chip(x(i) + 64, 196, 112, 28, atBank(r.s)))),
      masked(88, 184, 'PaidAtBank', { anchor: 'start', cls: 'k-label' }),
      arrow(s, [[624, 100], [640, 100], [640, 128], [626, 128]], { cls: 'k-arrow' }),
      text(648, 112, 'stutter', { anchor: 'start', cls: 'k-tick' }), text(648, 130, 'forever', { anchor: 'start', cls: 'k-tick' }),
      arrow(s, [[616, 204], [632, 204], [632, 218], [618, 218]], { cls: 'k-arrow' }),
      text(640, 215, 'stutter', { anchor: 'start', cls: 'k-tick' }),
      arrow(s, [[560, 224], [560, 266]], { cls: 'k-arrow t7-dash' }),
      text(548, 250, 'Pay enabled, never taken', { anchor: 'end', cls: 'k-note' }),
      g({ cls: 't7-faint' }, chip(560, 268, 112, 28, ['paid', 1])),
      text(16, tableTop, 'design', { anchor: 'start', cls: 'k-tick' }),
      [[380, 'states'], [500, 'Refines'], [630, 'RefinesSafety']].map(([cx, t]) => text(cx, tableTop, t, { cls: 'k-tick' })),
      TABLE.map(([name, , n, a, b], i) => {
        const y = tableTop + 32 + i * 30;
        return g({},
          line(16, y - 20, 704, y - 20, { cls: 'k-grid' }),
          text(16, y, name, { anchor: 'start', cls: 'k-num' }),
          text(380, y, String(n), { cls: 'k-num' }),
          lamp(468, y, a), lamp(598, y, b));
      }),
    ];
  };
  if (LASSO.map(r => atBank(r.s).join()).some(a => a !== 'approved,0')) throw new Error('liveness: every pilot state should translate to approved, 0');

  const css = [
    '.k-fig .t7-life { stroke: var(--ink-soft); stroke-width: var(--line-hair); stroke-dasharray: 3 3; opacity: 0.6; }',
    '.k-fig .t7-act { fill: var(--paper-2); stroke: var(--ink-soft); stroke-width: var(--line-hair); }',
    '.k-fig .t7-hidden { fill: var(--paper-2); stroke: var(--ink-soft); stroke-width: var(--line-hair); stroke-dasharray: 2 2; }',
    '.k-fig .t7-card { fill: var(--paper-2); stroke: var(--rule); stroke-width: var(--line-hair); }',
    '.k-fig .t7-chip { fill: var(--paper); stroke: var(--ink-soft); stroke-width: var(--line-hair); }',
    '.k-fig .t7-band { fill: var(--paper-2); stroke: var(--ink); stroke-width: var(--line-strong); }',
    '.k-fig .t7-map { stroke-dasharray: 2 3; }',
    '.k-fig .t7-pay { stroke-width: 2.5; }',
    '.k-fig .k-arrow.t7-pay:not(.k-accent) { stroke: var(--ink); }',
    '.k-fig .t7-dash { stroke-dasharray: 5 4; }',
    '.k-fig .k-arrow.t7-ok { stroke: var(--ok); stroke-width: 2.5; }',
    '.k-fig .t7-head-ok { fill: var(--ok); }',
    '.k-fig .t7-tick { stroke: var(--ok); stroke-width: var(--line-mark); fill: none; stroke-linecap: round; stroke-linejoin: round; }',
    '.k-fig .t7-faint { opacity: 0.4; }',
    '.k-fig .t7-region { fill: var(--paper-2); stroke: var(--ink-soft); stroke-width: var(--line-strong); }',
    '.k-fig .t7-region-inner { fill: var(--paper); stroke: var(--ink-soft); stroke-width: var(--line-strong); stroke-dasharray: 6 4; }',
    '.k-fig .t7-code-bg { fill: var(--code-bg); }',
    '.k-fig .t7-code { font-family: var(--font-mono); font-size: var(--text-fig); fill: var(--code-text); }',
    '.k-fig.k-narrow text:not([class]), .k-fig.k-narrow :is(.k-label, .k-tick, .k-num, .k-num-accent, .k-num-input, .k-num-ok, .t7-code) { font-size: calc(var(--text-fig) * 1.1); }',
  ].join(' ');

  const fig = (name, wide, phone, title, desc, caption, body, stepsCount = 0) => ({
    name, w: 720, h: wide, phone: { w: 360, h: phone }, title, desc, caption, steps: stepsCount,
    eyebrow: 'Lesson 7 · does the code match the spec?', css, body: (kk, L) => body(L),
  });

  return [
    fig('pilot', 412, 444, 'Tuesday at 10:14',
      'A sequence over time: worker B receives the message for loan 4471 and the queue hides it; B writes paid in the loans table and deletes the message; a deploy restarts B; the bakery gets an email saying its loan was paid out; the bank lifeline receives nothing, no transfer.',
      'Time runs down the page. Worker B marks the loan paid and deletes its message, then a deploy restarts it before it calls the bank. The books say paid; the bank never hears about loan 4471.',
      pilot, 6),
    fig('two-levels', 516, 540, 'Nine steps, one Pay',
      'The unlucky behavior of the design, ten states from start to Mark(B), each translated through the bank into what PayOnce sees: approved, 0 for the first five states and paid, 1 for the last five. Only Confirm(A), step 5, is a Pay step; the other eight steps are stutters.',
      'Nine steps of the design, one step of PayOnce. Every design state on the left translates to a PayOnce state on the right; only Confirm(A) changes it.',
      twoLevels, 6),
    fig('implication', 432, 536, 'Every translated behavior lands inside',
      'Nested regions: the behaviors PayOnce allows contain the behaviors of the design translated through the mapping, such as the happy and unlucky behaviors. Two translated behaviors sit outside, each crossed: one with a step from paid, 1 to paid, 2, and one that stays approved, 0 forever, so the Pay never happens.',
      'Spec ⇒ Abstract!Spec: every behavior of the design, translated through the mapping, lands inside the behaviors PayOnce allows. A behavior outside it is a refinement failure.',
      implication),
    fig('mapping-choices', 436, 528, 'Three mappings, one happy behavior',
      'The happy behavior, Receive(A), Send(A), Confirm(A), Mark(A), translated three ways. Under the table, Confirm(A) goes from approved, 0 to approved, 1, not allowed. Under the send, Send(A) goes from approved, 0 to paid, 0, not allowed. Under the bank, Confirm(A) is a Pay step and the rest are stutters.',
      'The same five states, three translations. Only “the bank” puts the status change and the money in the same step, so only it turns Confirm(A) into a Pay.',
      mappingChoices),
    fig('stutter', 356, 472, 'The work happens inside a stutter',
      'Left, PayOnce’s state graph: approved, 0 and paid, 1, joined by one Pay arrow, each with a self-loop labelled stutter. Right, the loop on approved, 0 opened up: Receive(A), Expire, Send(A) and Crash(A) are design steps that all translate to the same state, approved, 0.',
      'The self-loop is where the design does its work. Receive, Expire, Send and Crash change the design but leave PayOnce’s two variables alone, so PayOnce sees a stutter.',
      stutter),
    fig('failure-step', 520, 580, 'Paid, 1 becomes paid, 2',
      'The 7-step trace of the design without keys, translated by PaidAtBank: approved, 0 for four states, paid, 1 for three, then paid, 2. The last step, Confirm(B), is neither a Pay step nor a stutter, and TLC reports PayOnce line 14, columns 17 to 29, the box [][Pay]_avars, as violated.',
      'A safety failure of refinement: the PayOnce column reads like a real PayOnce behavior until the last step, which PayOnce forbids.',
      failureStep, 5),
    fig('liveness-carried', 448, 532, 'Pay enabled, never taken',
      'The pilot’s lasso at two levels: Receive(A), Mark(A), Crash(A), then stuttering forever in a state with the message deleted, the table paid and no transfer. PayOnce sees approved, 0 in every state, with Pay enabled and never taken. A table: QueueDesk passes Refines and RefinesSafety; the pilot and the design with no promise that the lease runs out fail Refines with a lasso and pass RefinesSafety.',
      'Every step of the pilot is a stutter of PayOnce, yet the behavior breaks PayOnce’s weak fairness. Drop the fairness (RefinesSafety) and both broken designs pass.',
      livenessCarried),
  ];
};
