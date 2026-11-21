export default k => {
  const { g, line, path, rect, circle, text, masked, arrow, box, step, legend, plot, axes, range } = k;

  const WORKERS = 'AB';
  const nextStates = ([status, pc, transfers]) => {
    const out = [];
    [...WORKERS].forEach((w, i) => {
      const move = to => pc.map((p, j) => (j === i ? to : p));
      if (pc[i] === 'idle' && status === 'approved') out.push([`Check(${w})`, [status, move('checked'), transfers]]);
      if (pc[i] === 'idle' && status === 'paid') out.push([`Skip(${w})`, [status, move('done'), transfers]]);
      if (pc[i] === 'checked') out.push([`Send(${w})`, [status, move('sent'), transfers + 1]]);
      if (pc[i] === 'sent') out.push([`Mark(${w})`, ['paid', move('done'), transfers]]);
    });
    return out;
  };
  const INIT = ['approved', ['idle', 'idle'], 0];
  const key = s => JSON.stringify(s);
  const noDoublePayout = s => s[2] <= 1;

  const explore = () => {
    const depth = new Map([[key(INIT), 0]]), states = new Map([[key(INIT), INIT]]), edges = [], queue = [INIT];
    while (queue.length) {
      const s = queue.shift();
      for (const [action, after] of nextStates(s)) {
        edges.push({ from: key(s), to: key(after), action });
        if (!depth.has(key(after))) { depth.set(key(after), depth.get(key(s)) + 1); states.set(key(after), after); queue.push(after); }
      }
    }
    return { depth, states, edges };
  };
  const shortestCounterexample = () => {
    const parent = new Map([[key(INIT), null]]), queue = [INIT];
    while (queue.length) {
      const s = queue.shift();
      if (!noDoublePayout(s)) {
        const trace = [];
        for (let at = key(s); at; at = parent.get(at)?.from) trace.unshift(parent.get(at)?.action ?? null);
        return trace.filter(Boolean);
      }
      for (const [action, after] of nextStates(s)) {
        if (!parent.has(key(after))) { parent.set(key(after), { from: key(s), action }); queue.push(after); }
      }
    }
    return [];
  };
  const behaviorTree = (s, action = null) => {
    const moves = nextStates(s);
    return { s, action, kids: moves.map(([a, after]) => behaviorTree(after, a)) };
  };
  const leaves = t => (t.kids.length ? t.kids.flatMap(leaves) : [t]);

  const GRAPH = explore();
  const COUNTER = shortestCounterexample();
  const TREE = behaviorTree(INIT);
  const LEAVES = leaves(TREE);
  if (GRAPH.states.size !== 17) throw new Error(`state-graph: expected 17 reachable states, found ${GRAPH.states.size}`);
  if (COUNTER.join(' ') !== 'Check(A) Send(A) Check(B) Send(B)') throw new Error(`state-graph: shortest counterexample is ${COUNTER.join(' ')}`);
  if (LEAVES.length !== 20 || LEAVES.filter(l => !noDoublePayout(l.s)).length !== 18) throw new Error('orderings: expected 20 behaviors, 18 paying twice');

  const actionCode = a => ({ Check: 'C', Send: 'S', Mark: 'M', Skip: 'K' })[a.split('(')[0]] + a[a.length - 2];
  const short = a => ({ Check: 'c', Send: 's', Mark: 'm', Skip: 'k' })[a.split('(')[0]] + a[a.length - 2];
  const euro = n => `€${n.toLocaleString('en-US')}`;
  const count = n => n.toLocaleString('en-US');

  const T0 = 0.2, HOLD = 1.1, LEN = 0.6;
  const at = (i, extra = 0) => Number((T0 + i * HOLD + extra).toFixed(2));
  const rise = (i, o = {}) => ({ k: 'rise', d: at(i, o.extra || 0), len: LEN, dx: o.dx ?? 0, dy: o.dy ?? 8 });
  const land = (i, extra = 0) => ({ k: 'land', d: at(i, extra), len: LEN, s0: 1.12 });
  const draw = (i, extra = 0) => ({ k: 'draw', d: at(i, extra), len: 0.9 });

  const label = (x, y, s, cls = 'k-label', o = {}) => masked(x, y, s, { cls, ...o });
  const msg = (slug, x1, x2, y, s, o = {}) => {
    const { tone = '', ret = false, at: lx = (x1 + x2) / 2, cls = '', textCls } = o;
    const dir = Math.sign(x2 - x1);
    const lineCls = ['k-arrow', ret ? 't1-dash' : '', cls].filter(Boolean).join(' ');
    return g({},
      arrow(slug, [[x1, y], [x2 - dir, y]], { tone, cls: lineCls }),
      label(lx, y - 9, s, textCls || (tone === 'accent' ? 'k-num-accent' : 'k-label')));
  };
  const actor = (cx, y, w, name, sub, cls = 'k-box') => box(cx - w / 2, y, w, 48, { name, sub, cls });
  const lifeline = (x, y1, y2) => line(x, y1, x, y2, { cls: 't1-life' });
  const code = (x, y, s, cls = 't1-code') => {
    const indent = s.length - s.trimStart().length;
    return text(x + indent * 7.2, y, s.trim(), { anchor: 'start', cls });
  };
  const tick = (x, y) => path(`M${x - 5} ${y}L${x - 1} ${y + 4}L${x + 6} ${y - 4}`, { cls: 't1-tick' });
  const hatchStripe = (slug, x, y, h, w = 8) => rect(x, y, w, h, { fill: `url(#${slug}-hatch)`, cls: 'k-bar-hatch' });

  const GLYPHS = {
    table: '<path d="M12 3v18"/><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/>',
    worker: '<path d="M11 10.27 7 3.34"/><path d="m11 13.73-4 6.93"/><path d="M12 22v-2"/><path d="M12 2v2"/><path d="M14 12h8"/><path d="m17 20.66-1-1.73"/><path d="m17 3.34-1 1.73"/><path d="M2 12h2"/><path d="m20.66 17-1.73-1"/><path d="m20.66 7-1.73 1"/><path d="m3.34 17 1.73-1"/><path d="m3.34 7 1.73 1"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="12" r="8"/>',
    bank: '<path d="M10 18v-7"/><path d="M11.119 2.205a2 2 0 0 1 1.762 0l7.84 3.846A.5.5 0 0 1 20.5 7h-17a.5.5 0 0 1-.22-.949z"/><path d="M14 18v-7"/><path d="M18 18v-7"/><path d="M3 22h18"/><path d="M6 18v-7"/>',
    store: '<path d="M15 21v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5"/><path d="M17.774 10.31a1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.451 0 1.12 1.12 0 0 0-1.548 0 2.5 2.5 0 0 1-3.452 0 1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.77-3.248l2.889-4.184A2 2 0 0 1 7 2h10a2 2 0 0 1 1.653.873l2.895 4.192a2.5 2.5 0 0 1-3.774 3.244"/><path d="M4 10.95V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8.05"/>',
  };
  const stackNode = (cx, top, glyph, name, role) => g({},
    rect(cx - 30, top, 60, 60, { cls: 't1-tile', rx: 12 }),
    `<g class="t1-glyph" transform="translate(${cx - 18} ${top + 12}) scale(1.5)">${GLYPHS[glyph]}</g>`,
    text(cx, top + 82, name, { cls: 'k-name t1-halo' }),
    text(cx, top + 100, role, { cls: 'k-tick t1-halo' }));
  const group = (x, y, w, h, name, cls) => g({}, rect(x, y, w, h, { cls, rx: 10 }), text(x + 12, y + 22, name, { anchor: 'start', cls: 'k-name' }));
  const edgeLabel = (x, y, s, anchor = 'middle', cls = 'k-label') => text(x, y, s, { anchor, cls: `${cls} t1-halo` });
  const grid = (slug, W, H) => [
    `<defs><pattern id="${slug}-grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" class="t1-grid"/></pattern></defs>`,
    rect(0, 0, W, H, { fill: `url(#${slug}-grid)` }),
  ];

  const desk = L => {
    const s = L.slug;
    if (L.phone) {
      return [
        grid(s, L.W, L.H),
        group(8, 12, 344, 400, 'Linden', 't1-group-you'),
        group(20, 452, 332, 212, 'bank', 't1-group'),
        path('M146 64H80V276', { cls: 't1-edge', 'marker-end': `url(#${s}-arrow)` }),
        path('M104 276V84H146', { cls: 't1-edge', 'marker-end': `url(#${s}-arrow)` }),
        path('M214 64H280V276', { cls: 't1-edge', 'marker-end': `url(#${s}-arrow)` }),
        path('M256 276V84H214', { cls: 't1-edge', 'marker-end': `url(#${s}-arrow)` }),
        edgeLabel(113, 58, 'reads'),
        edgeLabel(110, 200, 'writes', 'start'),
        edgeLabel(247, 58, 'reads'),
        edgeLabel(250, 200, 'writes', 'end'),
        path('M90 392V508', { cls: 't1-edge t1-edge-accent', 'marker-end': `url(#${s}-arrow-accent)` }),
        path('M270 392V436H124V508', { cls: 't1-edge t1-edge-accent', 'marker-end': `url(#${s}-arrow-accent)` }),
        edgeLabel(98, 420, 'transfer', 'start', 'k-num-accent'),
        edgeLabel(278, 420, 'transfer', 'start', 'k-num-accent'),
        path('M144 542H232', { cls: 't1-edge', 'marker-end': `url(#${s}-arrow)` }),
        edgeLabel(188, 534, 'pays in'),
        stackNode(180, 44, 'table', 'loans', 'approved loans'),
        stackNode(90, 280, 'worker', 'worker A', 'payOut()'),
        stackNode(270, 280, 'worker', 'worker B', 'payOut()'),
        stackNode(110, 512, 'bank', 'bank', 'transfer API'),
        stackNode(270, 512, 'store', 'bakery', 'account'),
        text(16, 690, 'reads: reads status · writes: writes paid', { anchor: 'start', cls: 'k-tick' }),
        text(16, 710, 'icons: Lucide', { anchor: 'start', cls: 'k-tick' }),
      ];
    }
    return [
      grid(s, L.W, L.H),
      group(90, 16, 540, 386, 'Linden', 't1-group-you'),
      group(210, 428, 380, 210, 'bank', 't1-group'),
      path('M326 96H170V248', { cls: 't1-edge', 'marker-end': `url(#${s}-arrow)` }),
      path('M194 248V116H326', { cls: 't1-edge', 'marker-end': `url(#${s}-arrow)` }),
      path('M394 96H550V248', { cls: 't1-edge', 'marker-end': `url(#${s}-arrow)` }),
      path('M526 248V116H394', { cls: 't1-edge', 'marker-end': `url(#${s}-arrow)` }),
      edgeLabel(250, 88, 'reads status'),
      edgeLabel(262, 134, 'writes paid'),
      edgeLabel(470, 88, 'reads status'),
      edgeLabel(458, 134, 'writes paid'),
      path('M180 364V404H290V484', { cls: 't1-edge t1-edge-accent', 'marker-end': `url(#${s}-arrow-accent)` }),
      path('M540 364V416H310V484', { cls: 't1-edge t1-edge-accent', 'marker-end': `url(#${s}-arrow-accent)` }),
      edgeLabel(188, 390, 'transfer', 'start', 'k-num-accent'),
      edgeLabel(548, 396, 'transfer', 'start', 'k-num-accent'),
      path('M334 518H466', { cls: 't1-edge', 'marker-end': `url(#${s}-arrow)` }),
      edgeLabel(400, 510, 'pays in'),
      stackNode(360, 76, 'table', 'loans', 'approved loans'),
      stackNode(180, 252, 'worker', 'worker A', 'payOut()'),
      stackNode(540, 252, 'worker', 'worker B', 'payOut()'),
      stackNode(300, 488, 'bank', 'bank', 'transfer API'),
      stackNode(500, 488, 'store', 'bakery', 'account'),
      line(16, 662, 46, 662, { cls: 't1-edge t1-edge-accent' }),
      text(54, 666, 'money moves', { anchor: 'start', cls: 'k-tick' }),
      line(176, 662, 206, 662, { cls: 't1-edge' }),
      text(214, 666, 'data moves', { anchor: 'start', cls: 'k-tick' }),
      text(704, 666, 'icons: Lucide', { anchor: 'end', cls: 'k-tick' }),
    ];
  };

  const race = L => {
    const s = L.slug, ph = L.phone;
    const X = ph ? { A: 54, T: 138, B: 222, K: 306, w: 76 } : { A: 96, T: 288, B: 480, K: 640, w: 128 };
    const bottom = 452;
    const bar = (x, y1, y2) => rect(x - 4, y1, 8, y2 - y1, { cls: 't1-act' });
    const transferLabel = ph ? euro(50000) : `transfer ${euro(50000)}`;
    const aTransferAt = ph ? (X.T + X.B) / 2 : (X.B + X.K) / 2;
    const note = ph ? { x: 224, w: 120, top: 'bakery balance' } : { x: 574, w: 132, top: "bakery's balance" };
    return [
      lifeline(X.A, 72, bottom), lifeline(X.T, 72, bottom), lifeline(X.B, 72, bottom), lifeline(X.K, 72, 396),
      actor(X.A, 24, X.w, 'worker A', 'payOut()'),
      actor(X.T, 24, X.w, 'loans', 'loan 4471'),
      actor(X.B, 24, X.w, 'worker B', 'payOut()'),
      actor(X.K, 24, X.w, 'bank', ph ? 'API' : 'transfer API'),
      step(1, 'worker A reads loan 4471 and sees approved',
        g({ anim: rise(0, { dx: -12, dy: 0 }) }, bar(X.A, 112, 316),
          msg(s, X.A + 4, X.T, 116, 'read 4471'),
          msg(s, X.T, X.A + 4, 144, 'approved', { ret: true, textCls: 'k-num' }))),
      step(2, 'worker B reads loan 4471 and also sees approved',
        g({ anim: rise(1, { dx: 12, dy: 0 }) }, bar(X.B, 192, 380),
          msg(s, X.B - 4, X.T, 196, 'read 4471'),
          msg(s, X.T, X.B - 4, 224, 'approved', { ret: true, textCls: 'k-num' }))),
      step(3, 'worker A transfers 50,000 euros to the bakery',
        g({ anim: rise(2, { dx: -12, dy: 0 }) }, msg(s, X.A + 4, X.K, 300, transferLabel, { at: aTransferAt }))),
      step(4, 'worker B transfers 50,000 euros again',
        g({ anim: rise(3, { dx: -12, dy: 0 }) }, msg(s, X.B + 4, X.K, 364, transferLabel, { tone: 'accent', cls: 't1-strong', at: (X.B + X.K) / 2 }))),
      step(5, "the bakery's balance reads 100,000 euros: paid twice",
        g({ anim: land(4, 0.5) },
          rect(note.x, 396, note.w, 48, { cls: 'k-box-accent', rx: 6 }),
          text(note.x + note.w / 2, 415, note.top, { cls: 'k-tick' }),
          text(note.x + note.w / 2, 436, euro(100000), { cls: 'k-name-accent' }))),
      step(5, 'both workers read approved before either sent money',
        g({ anim: rise(4, { extra: 0.9 }) },
          ph ? [text(16, 476, 'both read approved', { anchor: 'start', cls: 'k-note' }), text(16, 498, 'before either sent', { anchor: 'start', cls: 'k-note' })]
            : text(16, 488, 'both read approved before either sent', { anchor: 'start', cls: 'k-note' }))),
    ];
  };

  const steps = L => {
    const s = L.slug;
    const header = 'async function payOut(loanId: string) {';
    if (L.phone) {
      const band = (y, h) => g({}, rect(16, y, 328, h, { cls: 't1-gap' }), hatchStripe(s, 16, y, h),
        text(184, y + h / 2 + 6, 'the other worker can act here', { cls: 'k-note-accent' }));
      return [
        code(16, 40, header),
        box(16, 60, 92, 44, { name: 'Check' }),
        box(16, 112, 92, 44, { name: 'Skip', sub: 'if paid' }),
        ['const loan = await', '  db.getLoan(loanId);', 'if (loan.status !==', '  "approved") return;'].map((c, i) => code(124, 78 + i * 18, c)),
        band(168, 36),
        box(16, 216, 92, 44, { name: 'Send' }),
        ['await bank.transfer(', '  loan.account,', '  loan.amount);'].map((c, i) => code(124, 232 + i * 18, c)),
        band(276, 36),
        box(16, 324, 92, 44, { name: 'Mark' }),
        ['await db.setStatus(', '  loanId, "paid");'].map((c, i) => code(124, 342 + i * 18, c)),
        code(16, 392, '}'),
        text(16, 424, 'each row: these lines are one step', { anchor: 'start', cls: 'k-tick' }),
      ];
    }
    const NX = 424, NW = 120, cx = NX + NW / 2;
    const band = (y, h) => g({},
      rect(16, y, 532, h, { cls: 't1-gap' }), hatchStripe(s, 16, y, h),
      path(`M552 ${y + h / 2}H572`, { cls: 't1-leader' }),
      text(578, y + h / 2 - 2, 'the other worker', { anchor: 'start', cls: 'k-note-accent' }),
      text(578, y + h / 2 + 16, 'can act here', { anchor: 'start', cls: 'k-note-accent' }));
    const becomes = (y1, y2, ym) => g({},
      line(400, y1, 400, y2, { cls: 'k-guide' }),
      arrow(s, [[400, ym], [NX - 2, ym]]));
    return [
      text(16, 32, 'your code', { anchor: 'start', cls: 'k-name' }),
      text(NX, 32, 'its steps', { anchor: 'start', cls: 'k-name' }),
      rect(16, 52, 372, 304, { cls: 't1-code-bg', rx: 6 }),
      code(28, 76, header),
      code(28, 124, '  const loan = await db.getLoan(loanId);'),
      code(28, 144, '  if (loan.status !== "approved") return;'),
      band(162, 24),
      code(28, 220, '  await bank.transfer(loan.account, loan.amount);'),
      band(248, 24),
      code(28, 306, '  await db.setStatus(loanId, "paid");'),
      code(28, 340, '}'),
      becomes(112, 148, 130), becomes(208, 224, 216), becomes(294, 310, 302),
      arrow(s, [[cx, 154], [cx, 190]]),
      arrow(s, [[cx, 240], [cx, 276]]),
      box(NX, 106, NW, 48, { name: 'Check', sub: 'sees approved' }),
      box(NX, 192, NW, 48, { name: 'Send', sub: 'transfers +1' }),
      box(NX, 278, NW, 48, { name: 'Mark', sub: 'writes paid' }),
      text(576, 100, 'or, if paid:', { anchor: 'start', cls: 'k-tick' }),
      box(576, 106, NW, 48, { name: 'Skip', sub: 'returns early' }),
      arrow(s, [[16, 380], [44, 380]]),
      text(52, 384, 'from code: these lines become this step', { anchor: 'start', cls: 'k-tick' }),
      text(388, 384, 'between steps: the next step', { anchor: 'start', cls: 'k-tick' }),
    ];
  };

  const BAD = [
    ['start', ['approved', ['idle', 'idle'], 0]],
    ['Check(A)', ['approved', ['checked', 'idle'], 0]],
    ['Check(B)', ['approved', ['checked', 'checked'], 0]],
    ['Send(A)', ['approved', ['sent', 'checked'], 1]],
    ['Send(B)', ['approved', ['sent', 'sent'], 2]],
  ];
  const SAFE = [
    BAD[0], BAD[1],
    ['Send(A)', ['approved', ['sent', 'idle'], 1]],
    ['Mark(A)', ['paid', ['done', 'idle'], 1]],
    ['Skip(B)', ['paid', ['done', 'done'], 1]],
  ];
  const follows = seq => seq.every(([a, st], i) => i === 0 || nextStates(seq[i - 1][1]).some(([n, after]) => n === a && key(after) === key(st)));
  if (!follows(BAD) || !follows(SAFE)) throw new Error('behavior: a card does not follow from the previous one');

  const behavior = L => {
    const s = L.slug, ph = L.phone;
    const card = (x, y, w, h, [name, [status, [a, b], t]], tone) => {
      const cls = tone === 'bad' ? 'k-box-accent' : tone === 'ok' ? 'k-box-ok' : 'k-box';
      const tCls = tone === 'bad' ? 'k-num-accent' : tone === 'ok' ? 'k-num-ok' : 'k-num';
      const lines = [[status, 'k-num'], [`A ${a}`, 'k-num'], [`B ${b}`, 'k-num'], [`transfers ${t}`, tCls]];
      return g({},
        rect(x, y, w, h, { cls: 'k-mask-box', rx: 6 }), rect(x, y, w, h, { cls, rx: 6 }),
        tone === 'bad' ? hatchStripe(s, x, y + 8, h - 16, 6) : '',
        text(x + 14, y + 22, name, { anchor: 'start', cls: tone === 'bad' ? 'k-name-accent' : tone === 'ok' ? 'k-name-ok' : 'k-name' }),
        lines.map(([v, c], i) => text(x + 14, y + 42 + i * 16, v, { anchor: 'start', cls: c })),
        tone === 'ok' ? tick(x + w - 18, y + 18) : '');
    };
    if (ph) {
      const w = 156, h = 108, col = [16, 188], rows = [320, 452, 584];
      return [
        text(16, 24, 'one behavior per column, steps run down', { anchor: 'start', cls: 'k-tick' }),
        step(1, 'step 0: the start state, approved, both idle, 0 transfers',
          g({ anim: rise(0) }, card(102, 36, w, h, BAD[0]))),
        step(2, 'step 1: Check(A), A has checked',
          g({ anim: rise(1) }, arrow(s, [[180, 144], [180, 166]]), card(102, 168, w, h, BAD[1]))),
        [2, 3, 4].map(i => step(i + 1, `step ${i}: the race takes ${BAD[i][0]}, transfers ${BAD[i][1][2]}; the test's order takes ${SAFE[i][0]}, transfers ${SAFE[i][1][2]}`,
          g({ anim: rise(i + (i === 4 ? 0.4 : 0)) },
            i === 2 ? path(`M162 276V296H${col[0] + w / 2}V${rows[0] - 2}`, { cls: 'k-arrow', 'marker-end': `url(#${s}-arrow)` })
              : arrow(s, [[col[0] + w / 2, rows[i - 3] + h], [col[0] + w / 2, rows[i - 2] - 2]]),
            card(col[0], rows[i - 2], w, h, BAD[i], i === 4 ? 'bad' : '')),
          g({ anim: rise(i + (i === 4 ? 0.4 : 0), { extra: 0.25 }) },
            i === 2 ? path(`M198 276V296H${col[1] + w / 2}V${rows[0] - 2}`, { cls: 'k-arrow', 'marker-end': `url(#${s}-arrow)` })
              : arrow(s, [[col[1] + w / 2, rows[i - 3] + h], [col[1] + w / 2, rows[i - 2] - 2]]),
            card(col[1], rows[i - 2], w, h, SAFE[i], i === 4 ? 'ok' : '')))),
        text(266, 200, 'they part', { anchor: 'start', cls: 'k-note' }),
        text(266, 220, 'at step 2', { anchor: 'start', cls: 'k-note' }),
        text(col[0] + w / 2, 716, 'the race', { cls: 'k-name' }),
        text(col[0] + w / 2, 736, 'pays twice', { cls: 'k-num-accent' }),
        text(col[1] + w / 2, 716, "the test's order", { cls: 'k-name' }),
        text(col[1] + w / 2, 736, 'pays once', { cls: 'k-num-ok' }),
      ];
    }
    const w = 112, h = 104, xs = [16, 152, 296, 432, 568], rowY = [72, 256], mid = 164;
    return [
      xs.map((x, i) => text(x + w / 2, 40, `step ${i}`, { cls: 'k-tick' })),
      text(296, 64, 'the race: pays twice', { anchor: 'start', cls: 'k-name-accent' }),
      text(296, 248, "the test's order: pays once", { anchor: 'start', cls: 'k-name-ok' }),
      step(1, 'step 0: the start state, approved, both idle, 0 transfers',
        g({ anim: rise(0, { dx: -12, dy: 0 }) }, card(xs[0], mid, w, h, BAD[0]))),
      step(2, 'step 1: Check(A), A has checked',
        g({ anim: rise(1, { dx: -12, dy: 0 }) }, arrow(s, [[128, mid + 52], [150, mid + 52]]), card(xs[1], mid, w, h, BAD[1]))),
      [2, 3, 4].map(i => step(i + 1, `step ${i}: the race takes ${BAD[i][0]}, transfers ${BAD[i][1][2]}; the test's order takes ${SAFE[i][0]}, transfers ${SAFE[i][1][2]}`,
        g({ anim: rise(i + (i === 4 ? 0.4 : 0), { dx: -12, dy: 0 }) },
          i === 2 ? path(`M264 ${mid + 40}H280V${rowY[0] + 52}H294`, { cls: 'k-arrow', 'marker-end': `url(#${s}-arrow)` })
            : arrow(s, [[xs[i - 1] + w, rowY[0] + 52], [xs[i] - 2, rowY[0] + 52]]),
          card(xs[i], rowY[0], w, h, BAD[i], i === 4 ? 'bad' : '')),
        g({ anim: rise(i + (i === 4 ? 0.4 : 0), { dx: -12, dy: 0, extra: 0.25 }) },
          i === 2 ? path(`M264 ${mid + 64}H280V${rowY[1] + 52}H294`, { cls: 'k-arrow', 'marker-end': `url(#${s}-arrow)` })
            : arrow(s, [[xs[i - 1] + w, rowY[1] + 52], [xs[i] - 2, rowY[1] + 52]]),
          card(xs[i], rowY[1], w, h, SAFE[i], i === 4 ? 'ok' : '')))),
      path('M236 300H272', { cls: 't1-leader' }),
      text(228, 296, 'they part', { anchor: 'end', cls: 'k-note' }),
      text(228, 316, 'at step 2', { anchor: 'end', cls: 'k-note' }),
      arrow(s, [[16, 392], [44, 392]]),
      text(52, 396, 'one step', { anchor: 'start', cls: 'k-tick' }),
    ];
  };

  const orderings = L => {
    const s = L.slug, ph = L.phone;
    const P = ph ? { x0: 28, dx: 36, bus: 10, y0: 104, pitch: 22, chipX: 252, chipW: 96 } : { x0: 56, dx: 80, bus: 12, y0: 84, pitch: 22, chipX: 552, chipW: 152 };
    const root = ph ? { ...TREE, kids: [TREE.kids[0]] } : TREE;
    let row = 0;
    const layout = (t, d) => {
      const kids = t.kids.map(c => layout(c, d + 1));
      const y = kids.length ? kids[0].y : P.y0 + (row++) * P.pitch;
      return { ...t, d, x: P.x0 + d * P.dx, y, kids };
    };
    const tree = layout(root, 0);
    const byDepth = range(1, 6).map(() => []);
    const leafMarks = [];
    const walk = t => {
      t.kids.forEach(c => {
        const bx = t.x + P.bus;
        byDepth[c.d - 1].push(g({},
          c === t.kids[0] ? path(`M${t.x} ${t.y}H${bx}`, { cls: 't1-tree' }) : path(`M${bx} ${t.kids[0].y}V${c.y}`, { cls: 't1-tree' }),
          path(`M${bx} ${c.y}H${c.x}`, { cls: 't1-tree' }),
          label((bx + c.x) / 2, c.y - 6, short(c.action), 'k-num'),
          circle(c.x, c.y, 3, { cls: 't1-dot' })));
        walk(c);
      });
      if (!t.kids.length) leafMarks.push(t);
    };
    walk(tree);
    const chip = t => {
      const bad = !noDoublePayout(t.s), y = t.y;
      const who = t.action === 'Skip(B)' ? 'A first' : 'B first';
      return g({},
        t.x < P.chipX - 8 ? path(`M${t.x + 4} ${y}H${P.chipX - 4}`, { cls: 'k-guide' }) : '',
        rect(P.chipX, y - 8, P.chipW, 16, { cls: bad ? 't1-chip-bad' : 't1-chip-ok', rx: 3 }),
        bad ? hatchStripe(s, P.chipX, y - 8, 16, 8) : tick(P.chipX + 10, y),
        text(P.chipX + 18, y + 4, bad ? 'pays twice' : who, { anchor: 'start', cls: bad ? 'k-num-accent' : 'k-num-ok' }));
    };
    const mirror = ph ? (() => {
      const y = P.y0 + 10 * P.pitch + 12, bx = tree.x + P.bus, cx = P.x0 + P.dx;
      return g({},
        path(`M${bx} ${tree.y}V${y}`, { cls: 't1-tree' }), path(`M${bx} ${y}H${cx}`, { cls: 't1-tree' }),
        label((bx + cx) / 2, y - 6, 'cB', 'k-num'), circle(cx, y, 3, { cls: 't1-dot' }),
        text(cx + 12, y + 5, 'the mirror image: 10 more,', { anchor: 'start', cls: 'k-note' }),
        text(cx + 12, y + 25, '9 pay twice, 1 safe (B first)', { anchor: 'start', cls: 'k-note' }));
    })() : '';
    const H = L.H;
    const totals = ph ? '10 shown; all 20: 18 pay twice' : '20 behaviors: 18 pay twice, 2 safe';
    return [
      text(16, 24, ph ? 'every ordering, start to both done' : 'every ordering of the two workers, from the start until both are done', { anchor: 'start', cls: 'k-tick' }),
      text(16, 44, 'c Check · s Send · m Mark · k Skip', { anchor: 'start', cls: 'k-tick' }),
      text(P.x0, tree.y - 24, 'start', { cls: 'k-name' }),
      circle(tree.x, tree.y, 4, { cls: 't1-dot' }),
      byDepth.map((items, i) => step(i + 1, `step ${i + 1}: the tree branches into every possible next step`,
        g({ anim: rise(i, { dx: -10, dy: 0 }) }, items, i === 0 ? mirror : ''))),
      step(7, ph ? 'the outcomes: of the 10 shown, 9 pay twice and 1 is safe, A first' : 'the outcomes: 18 behaviors pay twice; 2 are safe, A first and B first',
        g({ anim: rise(6, { dx: -10, dy: 0, extra: 0.4 }) }, leafMarks.map(chip))),
      step(7, 'the total: 18 of 20 pay twice',
        g({ anim: land(6, 0.9) }, text(L.W - 16, H - 16, totals, { anchor: 'end', cls: 'k-name-accent' }))),
    ];
  };

  const stateGraph = L => {
    const s = L.slug, ph = L.phone;
    const P = ph ? { w: 76, h: 44, hgap: 8, left: 16, area: 328, top: 128, band: 26, sp: 8, drop: 14 }
      : { w: 132, h: 44, hgap: 10, left: 72, area: 558, top: 84, band: 26, sp: 12, drop: 16 };
    const progress = { idle: 0, checked: 1, sent: 2, done: 3 };
    const lean = kk => { const [, p, t] = JSON.parse(kk); return progress[p[0]] - progress[p[1]] + t / 10; };
    const rows = range(0, 6).map(d => [...GRAPH.states.keys()].filter(kk => GRAPH.depth.get(kk) === d).sort((a, b) => lean(b) - lean(a)));
    const xsOf = r => {
      const width = r.length * P.w + (r.length - 1) * P.hgap, x0 = P.left + (P.area - width) / 2;
      return new Map(r.map((kk, i) => [kk, x0 + i * (P.w + P.hgap)]));
    };
    const crossings = (upper, lower) => {
      const ux = xsOf(upper), lx = xsOf(lower);
      const es = GRAPH.edges.filter(e => ux.has(e.from) && lx.has(e.to));
      let n = 0;
      es.forEach((a, i) => es.slice(i + 1).forEach(b => { if ((ux.get(a.from) - ux.get(b.from)) * (lx.get(a.to) - lx.get(b.to)) < 0) n++; }));
      return n;
    };
    const perms = r => (r.length <= 1 ? [r] : r.flatMap((x, i) => perms([...r.slice(0, i), ...r.slice(i + 1)]).map(p => [x, ...p])));
    const cost = (d, r) => (d > 0 ? crossings(rows[d - 1], r) : 0) + (d < 6 ? crossings(r, rows[d + 1]) : 0);
    for (let sweep = 0; sweep < 3; sweep++) {
      range(1, 6).forEach(d => {
        rows[d] = perms(rows[d]).reduce((best, r) => {
          const c = cost(d, r), b = cost(d, best);
          return c < b || (c === b && r.join() === rows[d].join()) ? r : best;
        }, rows[d]);
      });
    }
    const pos = new Map();
    const rowTop = [];
    rows.forEach(r => xsOf(r).forEach((x, kk) => pos.set(kk, { x, y: 0 })));
    const gapOf = d => GRAPH.edges.filter(e => GRAPH.depth.get(e.from) === d);
    const routes = new Map();
    const placeGap = d => {
      const es = gapOf(d);
      const outs = new Map(), ins = new Map();
      es.forEach(e => { (outs.get(e.from) || outs.set(e.from, []).get(e.from)).push(e); (ins.get(e.to) || ins.set(e.to, []).get(e.to)).push(e); });
      outs.forEach((list, from) => {
        list.sort((a, b) => pos.get(a.to).x - pos.get(b.to).x);
        list.forEach((e, i) => { e.sx = pos.get(from).x + P.w * (i + 1) / (list.length + 1); e.side = list.length === 1 ? 1 : i === 0 ? -1 : 1; });
      });
      ins.forEach((list, to) => {
        list.sort((a, b) => a.sx - b.sx);
        list.forEach((e, i) => { e.tx = pos.get(to).x + P.w * (list.length === 1 ? 0.5 : i === 0 ? 0.25 : 0.75); });
      });
      es.forEach(e => {
        if (es.some(o => o !== e && Math.abs(o.sx - e.tx) < 6)) e.tx += P.w * 0.18;
      });
      const levels = [];
      es.filter(e => Math.abs(e.sx - e.tx) > 0.5).sort((a, b) => Math.min(a.sx, a.tx) - Math.min(b.sx, b.tx)).forEach(e => {
        const lo = Math.min(e.sx, e.tx), hi = Math.max(e.sx, e.tx);
        let lv = levels.findIndex(end => end + 12 < lo);
        if (lv < 0) { lv = levels.length; levels.push(hi); } else levels[lv] = hi;
        e.level = lv;
      });
      return { es, levels: levels.length };
    };
    let y = P.top;
    rows.forEach((r, d) => {
      rowTop[d] = y;
      r.forEach(kk => { pos.get(kk).y = y; });
      if (d < 6) {
        const { es, levels } = placeGap(d);
        const bottom = y + P.h;
        es.forEach(e => {
          e.y1 = bottom;
          e.cy = bottom + P.band + (e.level ?? 0) * P.sp;
        });
        y = bottom + P.band + Math.max(0, levels - 1) * P.sp + P.drop + 12;
        es.forEach(e => { e.y2 = y; });
      }
    });
    GRAPH.edges.forEach(e => {
      const pts = Math.abs(e.sx - e.tx) <= 0.5 ? [[e.sx, e.y1], [e.tx, e.y2 - 2]] : [[e.sx, e.y1], [e.sx, e.cy], [e.tx, e.cy], [e.tx, e.y2 - 2]];
      routes.set(`${e.from}>${e.to}`, pts);
    });
    const node = kk => {
      const [status, [a, b], t] = JSON.parse(kk), { x, y: ny } = pos.get(kk), bad = t > 1;
      const pcCode = { idle: 'i', checked: 'ck', sent: 's', done: 'd' };
      const l1 = ph ? `${pcCode[a]} · ${pcCode[b]}` : `${a} · ${b}`;
      const l2 = ph ? `${status === 'approved' ? 'ap' : 'pd'} · ${t}` : `${status} · ${t}`;
      return g({},
        rect(x, ny, P.w, P.h, { cls: 'k-mask-box', rx: 6 }),
        rect(x, ny, P.w, P.h, { cls: bad ? 'k-box-accent' : 't1-node', rx: 6 }),
        bad ? hatchStripe(s, x, ny + 6, P.h - 12, 6) : '',
        text(x + P.w / 2 + (bad ? 3 : 0), ny + 18, l1, { cls: 'k-num' }),
        text(x + P.w / 2 + (bad ? 3 : 0), ny + 35, l2, { cls: bad ? 'k-num-accent' : 'k-num' }));
    };
    const edgeOf = e => g({},
      arrow(s, routes.get(`${e.from}>${e.to}`), { cls: 'k-arrow' }),
      label(e.sx + (e.side < 0 ? -5 : 5), e.y1 + 15, actionCode(e.action), 'k-num', { anchor: e.side < 0 ? 'end' : 'start' }));
    const rowGroup = d => g({},
      GRAPH.edges.filter(e => GRAPH.depth.get(e.to) === d && GRAPH.depth.get(e.from) === d - 1).map(edgeOf),
      rows[d].map(node),
      ph ? '' : text(16, rowTop[d] + 27, `depth ${d}`, { anchor: 'start', cls: 'k-tick' }));
    const trailStates = [INIT];
    COUNTER.forEach(a => { const last = trailStates[trailStates.length - 1]; trailStates.push(nextStates(last).find(([n]) => n === a)[1]); });
    const trailKeys = trailStates.map(key).reverse();
    const trail = [];
    for (let i = 0; i < trailKeys.length - 1; i++) {
      const pts = routes.get(`${trailKeys[i + 1]}>${trailKeys[i]}`).slice().reverse();
      if (i > 0) {
        const [px, py] = trail[trail.length - 1], [qx, qy] = pts[0], midY = (py + qy) / 2;
        trail.push([px, midY], [qx, midY]);
      }
      trail.push(...pts);
    }
    const d = trail.map(([x, yy], i) => `${i ? 'L' : 'M'}${Math.round(x * 100) / 100} ${Math.round(yy * 100) / 100}`).join('');
    const badKey = trailKeys[0], bp = pos.get(badKey);
    const last = rowTop[6] + P.h;
    return [
      (ph ? ['each state: pc of A · pc of B,', 'then status · transfers', 'i idle, ck checked, s sent, d done', 'ap approved, pd paid', 'actions: C Check S Send M Mark K Skip']
        : ['each state: pc of A · pc of B, then status · transfers; rows are breadth-first depth', 'actions: C Check · S Send · M Mark · K Skip, then the worker'])
        .map((t, i) => text(16, 24 + i * 20, t, { anchor: 'start', cls: 'k-tick' })),
      step(6, 'the shortest counterexample, traced back from the first bad state to the start: Check(A), Send(A), Check(B), Send(B)',
        path(d, { cls: 't1-trail', pathLength: 1, anim: draw(5, 0.3) })),
      range(0, 4).map(dd => step(dd + 1, `breadth-first depth ${dd}: ${rows[dd].length} state${rows[dd].length > 1 ? 's' : ''}${dd === 4 ? ', including the first state with 2 transfers' : ''}`,
        g({ anim: rise(dd) }, rowGroup(dd)))),
      step(7, 'depth 5: 2 more states with 2 transfers', g({ anim: rise(6, { extra: 0.4 }) }, rowGroup(5))),
      step(7, 'depth 6: both done, 2 transfers; 17 reachable states in all', g({ anim: rise(6, { extra: 0.65 }) }, rowGroup(6))),
      ph ? text(16, last + 30, 'first bad state at depth 4:', { anchor: 'start', cls: 'k-note-accent' })
        : g({},
          path(`M636 ${bp.y - 10}H${bp.x + P.w + 5}V${bp.y + 22}H${bp.x + P.w + 1}`, { cls: 't1-leader' }),
          ['first', 'bad', 'state'].map((t, i) => text(642, bp.y - 4 + i * 20, t, { anchor: 'start', cls: 'k-note-accent' }))),
      ph ? text(16, last + 52, 'the trail is the shortest counterexample', { anchor: 'start', cls: 'k-note-accent' }) : '',
      line(16, last + (ph ? 76 : 36), 46, last + (ph ? 76 : 36), { cls: 't1-trail' }),
      text(54, last + (ph ? 80 : 40), ph ? 'shortest counterexample' : 'the shortest counterexample, 4 steps', { anchor: 'start', cls: 'k-tick' }),
      text(L.W - 16, last + (ph ? 104 : 40), '17 reachable states', { anchor: 'end', cls: 'k-name' }),
    ];
  };

  const growth = L => {
    const s = L.slug, ph = L.phone;
    const P = ph ? plot({ x: 56, y: 104, w: 288, h: 220, xs: [0.5, 3.5], ys: [0, 4] }) : plot({ x: 96, y: 80, w: 592, h: 224, xs: [0.5, 3.5], ys: [0, 4] });
    const bw = ph ? 34 : 64, gap = ph ? 8 : 16;
    const DATA = [[1, 1, 4], [2, 20, 17], [3, 1428, 75]];
    const bar = (x, v, hatch) => {
      const top = P.Y(Math.log10(v)), h = P.Y(0) - top;
      return g({},
        h > 0 ? rect(x, top, bw, h, hatch ? { fill: `url(#${s}-hatch)`, cls: 'k-bar-hatch' } : { cls: 'k-bar' }) : '',
        text(x + bw / 2, top - 8, count(v), { cls: hatch ? 'k-num-accent' : 'k-num' }));
    };
    return [
      ph ? legend(s, 16, 32, [['hatch', 'behaviors (orderings)'], ['bar', 'reachable states']], { cols: 1, dy: 24 })
        : legend(s, 96, 36, [['hatch', 'behaviors (complete orderings)'], ['bar', 'reachable states']], { dx: 300 }),
      axes(P, {
        grid: true,
        yTicks: [[0, '1'], [1, '10'], [2, '100'], [3, '1,000'], [4, '10,000']],
        xTicks: DATA.map(([w]) => [w, `${w} worker${w > 1 ? 's' : ''}`]),
        yTitle: 'count, log scale',
      }),
      DATA.map(([w, beh, st]) => g({}, bar(P.X(w) - bw - gap / 2, beh, true), bar(P.X(w) + gap / 2, st, false))),
      text(16, L.H - 12, ph ? '1 worker, 1 behavior: no bar on log scale' : 'with 1 worker there is one behavior, so its bar has no height on a log scale', { anchor: 'start', cls: 'k-tick' }),
    ];
  };

  const claim = L => {
    const s = L.slug, ph = L.phone;
    const naive = (ox, oy, X, w) => {
      const b = oy + 340;
      return g({},
        text(ox, oy + 28, 'check, then act', { anchor: 'start', cls: 'k-name' }),
        text(ox, oy + 46, 'two steps per worker', { anchor: 'start', cls: 'k-tick' }),
        lifeline(X.A, oy + 104, b - 40), lifeline(X.T, oy + 104, b - 40), lifeline(X.B, oy + 104, b - 40),
        actor(X.A, oy + 56, w, 'worker A', ''), actor(X.T, oy + 56, w, 'loans', ''), actor(X.B, oy + 56, w, 'worker B', ''),
        rect(X.A - 6, oy + 140, 12, 124, { cls: 't1-gap' }),
        text(X.A - 10, oy + 206, 'gap', { anchor: 'end', cls: 'k-num-accent' }),
        msg(s, X.A + 6, X.T, oy + 140, 'read'),
        msg(s, X.T, X.A + 6, oy + 164, 'approved', { ret: true }),
        msg(s, X.B, X.T, oy + 204, 'read', { tone: 'accent', cls: 't1-strong' }),
        msg(s, X.T, X.B, oy + 228, 'approved', { ret: true }),
        msg(s, X.A + 6, X.T, oy + 264, 'set claimed'),
        msg(s, X.B, X.T, oy + 288, 'set claimed'),
        text(ox, b - 12, "B's read lands in A's gap:", { anchor: 'start', cls: 'k-note' }),
        text(ox, b + 8, 'both think they own the loan', { anchor: 'start', cls: 'k-note' }));
    };
    const claimSeq = (ox, oy, X, w) => g({},
      text(ox, oy + 28, 'Claim', { anchor: 'start', cls: 'k-name' }),
      text(ox, oy + 46, 'one step: check and change together', { anchor: 'start', cls: 'k-tick' }),
      lifeline(X.K, oy + 104, oy + 252), lifeline(X.A, oy + 104, oy + 300), lifeline(X.T, oy + 104, oy + 300), lifeline(X.B, oy + 104, oy + 300),
      actor(X.K, oy + 56, w, 'bank', ''), actor(X.A, oy + 56, w, 'worker A', ''), actor(X.T, oy + 56, w, 'loans', ''), actor(X.B, oy + 56, w, 'worker B', ''),
      msg(s, X.A, X.T, oy + 140, 'UPDATE'),
      msg(s, X.B, X.T, oy + 140, 'UPDATE'),
      msg(s, X.T, X.A, oy + 176, '1 row', { ret: true, textCls: 'k-num-ok' }),
      msg(s, X.T, X.B, oy + 176, '0 rows', { ret: true, textCls: 'k-num' }),
      msg(s, X.A, X.K, oy + 220, euro(50000)),
      box(X.B - 32, oy + 204, 64, 32, { name: 'Skip', cls: 'k-box' }),
      rect(X.K - w / 2, oy + 252, w, 48, { cls: 'k-box-ok', rx: 6 }),
      text(X.K, oy + 271, 'bakery', { cls: 'k-tick' }),
      text(X.K, oy + 291, euro(50000), { cls: 'k-num-ok' }));
    const sql = (x, y, w, lines) => g({},
      rect(x, y, w, 24 + lines.length * 20, { cls: 't1-code-bg', rx: 6 }),
      lines.map(([c, cls], i) => code(x + 12, y + 22 + i * 20, c, cls)));
    if (ph) {
      return [
        naive(16, 0, { A: 60, T: 180, B: 300 }, 88),
        line(16, 364, 344, 364, { cls: 'k-grid' }),
        claimSeq(16, 372, { K: 54, A: 138, T: 222, B: 306 }, 76),
        sql(16, 692, 328, [['UPDATE loans', 't1-code'], ["SET status = 'claimed'", 't1-code'], ['WHERE id = $1', 't1-code'], ["  AND status = 'approved'", 't1-code'],
          ['1 row: you own it.', 'k-tick'], ['0 rows: someone else does.', 'k-tick']]),
      ];
    }
    return [
      naive(16, 0, { A: 56, T: 158, B: 260 }, 80),
      line(316, 16, 316, 412, { cls: 'k-grid' }),
      claimSeq(332, 0, { K: 376, A: 468, T: 564, B: 656 }, 80),
      sql(332, 324, 372, [["UPDATE loans SET status = 'claimed'", 't1-code'], ["WHERE id = $1 AND status = 'approved'", 't1-code'], ['1 row: you own it. 0 rows: someone else does.', 'k-tick']]),
    ];
  };

  const css = [
    '.k-fig .t1-life { stroke: var(--ink-soft); stroke-width: var(--line-hair); stroke-dasharray: 3 3; opacity: 0.6; }',
    '.k-fig .t1-dash { stroke-dasharray: 5 4; }',
    '.k-fig .t1-strong { stroke-width: var(--line-mark); }',
    '.k-fig .t1-act { fill: var(--paper-2); stroke: var(--ink-soft); stroke-width: var(--line-hair); }',
    '.k-fig .t1-gap { fill: var(--accent-soft); }',
    '.k-fig .t1-leader { stroke: var(--accent); stroke-width: var(--line-hair); stroke-dasharray: 4 3; fill: none; }',
    '.k-fig .t1-code-bg { fill: var(--code-bg); }',
    '.k-fig .t1-code { font-family: var(--font-mono); font-size: var(--text-fig); fill: var(--code-text); }',
    '.k-fig .t1-node { fill: var(--paper); stroke: var(--ink); stroke-width: var(--line-strong); }',
    '.k-fig .t1-dot { fill: var(--ink); }',
    '.k-fig .t1-tree { stroke: var(--ink-soft); stroke-width: var(--line-hair); fill: none; }',
    '.k-fig .t1-trail { stroke: var(--accent); stroke-width: var(--line-mark); fill: none; stroke-linecap: round; stroke-linejoin: round; opacity: 0.75; }',
    '.k-fig .t1-tick { stroke: var(--ok); stroke-width: var(--line-strong); fill: none; stroke-linecap: round; stroke-linejoin: round; }',
    '.k-fig .t1-chip-bad { fill: var(--accent-soft); stroke: var(--accent); stroke-width: var(--line-hair); }',
    '.k-fig .t1-chip-ok { fill: var(--ok-soft); stroke: var(--ok); stroke-width: var(--line-strong); }',
    '.k-fig .t1-tile { fill: var(--paper); stroke: var(--rule); stroke-width: var(--line-hair); }',
    '.k-fig .t1-glyph { fill: none; stroke: var(--ink); stroke-width: var(--line-strong); stroke-linecap: round; stroke-linejoin: round; }',
    '.k-fig .t1-group { fill: var(--paper-2); stroke: var(--rule); stroke-width: var(--line-strong); }',
    '.k-fig .t1-group-you { fill: var(--input-soft); stroke: var(--input); stroke-width: var(--line-strong); fill-opacity: 0.5; }',
    '.k-fig .t1-grid { stroke: var(--rule); stroke-width: var(--line-hair); fill: none; opacity: 0.6; }',
    '.k-fig .t1-halo { paint-order: stroke; stroke: var(--paper); stroke-width: var(--line-mark); stroke-linejoin: round; }',
    '.k-fig .t1-edge { stroke: var(--ink-soft); stroke-width: var(--line-strong); fill: none; }',
    '.k-fig .t1-edge-accent { stroke: var(--accent); }',
  ].join(' ');

  const fig = (name, wide, phone, title, desc, caption, body, stepsCount = 0) => ({
    name, w: 720, h: wide, phone: { w: 360, h: phone }, title, desc, caption, steps: stepsCount,
    eyebrow: 'Lesson 1 · one loan, paid twice', css, body: (kk, L) => body(L),
  });

  return [
    fig('desk', 680, 720, 'The payout desk',
      'The payout desk as a system: the loans table of approved loans at Linden, two identical workers A and B that each read a loan status from it and write paid back to it, and the bank, whose transfer API both workers call; the bank pays into the bakery account.',
      'The payout desk. Two copies of the same worker read from one loans table and call one bank. Nothing in the picture stops both of them from calling the bank for the same loan.',
      desk),
    fig('race', 512, 520, 'Both workers saw approved',
      'A sequence over time, top to bottom: worker A reads loan 4471 and sees approved, then worker B reads it and also sees approved; then A transfers 50,000 euros, and B transfers 50,000 euros again, so the bakery balance reads 100,000 euros.',
      'Time runs down the page. Both workers read "approved" before either sends money, so both send it: the bakery receives €100,000 for a €50,000 loan.',
      race, 5),
    fig('steps', 400, 436, 'Five lines, four steps',
      'The payOut function on the left, its lines grouped into the four steps on the right: the read and the approved test become Check, or Skip when the loan is already paid; the transfer becomes Send; the status write becomes Mark. Between Check and Send, and between Send and Mark, the other worker can act.',
      'Each step is one moment another worker can see. Between two steps, the other worker can act: that is where the bug lives.',
      steps),
    fig('behavior', 412, 752, 'Same start, two endings',
      'Two behaviors as strips of state cards from the same start state. Both begin with Check(A); at step 2 the race takes Check(B), Send(A), Send(B) and ends with transfers 2, while the order the tests use takes Send(A), Mark(A), Skip(B) and ends with transfers 1.',
      'Two behaviors of the same code. They share the start and the first step, part at step 2, and end with 2 transfers and with 1.',
      behavior, 5),
    fig('orderings', 560, 428, 'Twenty orderings, eighteen pay twice',
      'A tree of every behavior of the naive desk with two workers, from the start state until both workers are done. Each edge is one step, written c, s, m or k for Check, Send, Mark or Skip with the worker. The tree has 20 leaves: 18 behaviors pay twice; 2 are safe, A first and B first.',
      'Every ordering of the two workers, one row per behavior. 18 of the 20 pay twice; only "A finishes, then B skips" and its mirror are safe. On a phone the tree shows the half that starts with A; the other half is its mirror image.',
      orderings, 7),
    fig('state-graph', 800, 940, 'Seventeen states, breadth first',
      'The 17 reachable states of the naive desk with two workers, in rows by breadth-first depth from 0 to 6, edges labelled by action. The four states with 2 transfers are marked. The first one, at depth 4, is reached by the shortest counterexample: Check(A), Send(A), Check(B), Send(B).',
      'The model checker visits these 17 states row by row. The first bad state it meets is at depth 4, and walking its parents back to the start gives the shortest counterexample: Check(A), Send(A), Check(B), Send(B).',
      stateGraph, 7),
    fig('growth', 372, 400, 'Paths explode, states grow',
      'Grouped bars on a log scale for 1, 2 and 3 workers: behaviors are 1, 20 and 1,428; reachable states are 4, 17 and 75.',
      'Behaviors are the paths; states are the places they pass through. With 3 workers there are 1,428 paths but only 75 states, which is why a model checker counts states.',
      growth),
    fig('claim', 428, 852, 'One step instead of two',
      'Left, check then act: worker B reads approved in the gap between worker A reading and writing, and both set the loan claimed. Right, Claim: both workers send the conditional UPDATE at the same moment; the loans table answers 1 row to A and 0 rows to B; A transfers 50,000 euros once and B skips.',
      'Left: a check and the change it protects are two steps, and another worker can act in between. Right: the conditional UPDATE checks and changes in one step. Exactly one worker gets "1 row".',
      claim),
  ];
};
