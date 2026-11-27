export default k => {
  const { g, line, path, rect, circle, text, masked, arrow, step } = k;

  const PCS = ['idle', 'claimed', 'sent', 'done'];
  const STATUSES = ['approved', 'claimed', 'paid'];
  const NAMES = 'ABCDEFGHIJKL';
  const next = ([status, pc, t]) => {
    const out = [];
    pc.forEach((p, w) => {
      const put = v => pc.map((q, j) => (j === w ? v : q));
      const who = NAMES[w];
      if (p === 'idle' && status === 'approved') out.push([`Claim(${who})`, ['claimed', put('claimed'), t]]);
      if (p === 'claimed') out.push([`Send(${who})`, [status, put('sent'), t + 1]]);
      if (p === 'sent') out.push([`Mark(${who})`, ['paid', put('done'), t]]);
      if (p === 'idle' && status === 'paid') out.push([`Skip(${who})`, [status, put('done'), t]]);
    });
    return out;
  };
  const product = n => (n === 0 ? [[]] : PCS.flatMap(p => product(n - 1).map(r => [p, ...r])));
  const typeOk = n => STATUSES.flatMap(s => product(n).flatMap(pc => [0, 1, 2].map(t => [s, pc, t])));
  const key = s => JSON.stringify(s);
  const noDouble = s => s[2] <= 1;
  const owed = s => s[2] + s[1].filter(p => p === 'claimed').length <= 1;
  const unclaimed = ([status, pc, t]) => status !== 'approved' || (t === 0 && pc.every(p => p === 'idle'));
  const inv = s => owed(s) && unclaimed(s);
  const firstCti = (c, n) => {
    for (const s of typeOk(n)) for (const [a, after] of next(s)) if (c(s) && !c(after)) return [s, a, after];
    return null;
  };
  const ctiCount = (c, n) => typeOk(n).filter(s => c(s) && next(s).some(([, x]) => !c(x))).length;
  const reachable = n => {
    const init = ['approved', Array(n).fill('idle'), 0];
    const seen = new Map([[key(init), init]]), queue = [init];
    while (queue.length) {
      for (const [, after] of next(queue.shift())) if (!seen.has(key(after))) { seen.set(key(after), after); queue.push(after); }
    }
    return [...seen.values()];
  };

  const GROWTH = [2, 3, 4, 5, 6, 12].map(n => [n, reachable(n).length]);
  const REACH2 = reachable(2);
  const COUNT = { type: typeOk(2).length, nd: typeOk(2).filter(noDouble).length, owed: typeOk(2).filter(owed).length, inv: typeOk(2).filter(inv).length };
  const CTI0 = firstCti(noDouble, 2), CTI1 = firstCti(owed, 2);
  const DIGITS = String(2n * 300n + 2n ** 300n).length;
  const fail = m => { throw new Error(`lesson 8 figures: ${m}`); };
  if (GROWTH.map(([, v]) => v).join() !== '8,14,24,42,76,4120') fail(`growth ${GROWTH}`);
  if (GROWTH.some(([n, v]) => v !== 2 * n + 2 ** n)) fail('growth does not match 2N + 2^N');
  if (DIGITS !== 91) fail(`300 workers gives ${DIGITS} digits`);
  if (key(COUNT) !== key({ type: 144, nd: 96, owed: 72, inv: 49 })) fail(`region sizes ${key(COUNT)}`);
  if (REACH2.length !== 8 || !REACH2.every(inv)) fail('reachable states with 2 workers');
  if (key(CTI0) !== key([['approved', ['idle', 'claimed'], 1], 'Send(B)', ['approved', ['idle', 'sent'], 2]])) fail(`first CTI ${key(CTI0)}`);
  if (key(CTI1) !== key([['approved', ['idle', 'idle'], 1], 'Claim(A)', ['claimed', ['claimed', 'idle'], 1]])) fail(`Owed CTI ${key(CTI1)}`);
  if (ctiCount(noDouble, 2) !== 21 || ctiCount(owed, 2) !== 7 || ctiCount(inv, 2) !== 0 || ctiCount(inv, 3) !== 0) fail('CTI counts');
  if ([CTI0[0], CTI1[0]].some(s => REACH2.some(r => key(r) === key(s)))) fail('a CTI state is reachable');

  const count = n => n.toLocaleString('en-US');
  const T0 = 0.2, HOLD = 1.1, LEN = 0.6;
  const at = (i, extra = 0) => Number((T0 + i * HOLD + extra).toFixed(2));
  const rise = (i, o = {}) => ({ k: 'rise', d: at(i, o.extra || 0), len: LEN, dx: o.dx ?? 0, dy: o.dy ?? 8 });
  const land = (i, extra = 0) => ({ k: 'land', d: at(i, extra), len: LEN, s0: 1.12 });
  const topple = (i, extra = 0) => ({ k: 'topple', d: at(i, extra), len: 0.8 });
  const fadeIn = (i, extra = 0) => ({ k: 'in', d: at(i, extra), len: LEN });

  const tick = (x, y) => path(`M${x - 5} ${y}L${x - 1} ${y + 4}L${x + 6} ${y - 4}`, { cls: 't8-tick' });
  const rowsOf = (x, y, rows, o = {}) => {
    const { anchor = 'start', dy = 18 } = o;
    return rows.map(([s, cls], i) => text(x, y + i * dy, s, { anchor, cls })).join('');
  };
  const stateCard = (x, y, w, [status, [a, b], t], tone = '') => {
    const bad = tone === 'bad';
    return g({},
      rect(x, y, w, 72, { cls: 'k-mask-box', rx: 6 }),
      rect(x, y, w, 72, { cls: bad ? 'k-box-accent' : 't8-card', rx: 6 }),
      rowsOf(x + 12, y + 22, [[status, 'k-num'], [`A ${a} · B ${b}`, 'k-num'], [`transfers ${t}`, bad ? 'k-num-accent' : 'k-num']]));
  };
  const legendLine = (x, y, cls, label, marker) => g({},
    line(x, y - 4, x + 28, y - 4, { cls, 'marker-end': marker }),
    text(x + 40, y, label, { anchor: 'start', cls: 'k-tick' }));

  const growth = L => {
    const s = L.slug, ph = L.phone;
    const P = ph ? { x0: 64, w: 280, top: 104, h: 232, bw: 22 } : { x0: 96, w: 600, top: 96, h: 232, bw: 40 };
    const slot = P.w / 8, X = i => P.x0 + slot * (i + 0.5), base = P.top + P.h;
    const Y = v => base - Math.log10(v) / 4 * P.h;
    const brk = X(6), ghost = X(7);
    const decades = [[1, '1'], [10, '10'], [100, '100'], [1000, '1,000'], [10000, '10,000']];
    return [
      text(16, 28, ph ? 'reachable states, log scale' : 'reachable states, log scale (TLC)', { anchor: 'start', cls: 'k-name' }),
      text(16, 48, ph ? 'each bar is 2N + 2^N' : 'each bar is 2N + 2^N for N workers', { anchor: 'start', cls: 'k-tick' }),
      decades.map(([v]) => line(P.x0, Y(v), brk - 12, Y(v), { cls: 'k-grid' })),
      decades.map(([v, lab]) => text(P.x0 - 8, Y(v) + 4, lab, { anchor: 'end', cls: 'k-tick' })),
      line(P.x0, base, brk - 8, base, { cls: 'k-axis' }),
      line(brk + 8, base, P.x0 + P.w, base, { cls: 'k-axis' }),
      path(`M${brk - 10} ${base + 6}L${brk - 4} ${base - 6}M${brk + 4} ${base + 6}L${brk + 10} ${base - 6}`, { cls: 't8-break' }),
      GROWTH.map(([n, v], i) => g({},
        rect(X(i) - P.bw / 2, Y(v), P.bw, base - Y(v), { cls: 'k-bar' }),
        text(X(i), Y(v) - 8, count(v), { cls: 'k-num' }),
        text(X(i), base + 20, String(n), { cls: 'k-tick' }))),
      rect(ghost - P.bw / 2, 0, P.bw, base, { fill: `url(#${s}-hatch)`, cls: 't8-ghost' }),
      text(ghost, base + 20, '300', { cls: 'k-num-accent' }),
      text(ghost - P.bw / 2 - 8, ph ? 84 : 76, '300 workers:', { anchor: 'end', cls: 'k-num-accent' }),
      text(ghost - P.bw / 2 - 8, ph ? 100 : 92, `${DIGITS} digits`, { anchor: 'end', cls: 'k-name-accent' }),
      text(P.x0 + P.w, base + 44, 'workers', { anchor: 'end', cls: 'k-tick' }),
    ];
  };

  const dominoes = L => {
    const s = L.slug, ph = L.phone;
    const D = ph
      ? { ground: 168, h: 40, w: 10, xs: [48, 96, 176, 224, 308], dots: [136, 268], names: 188, ticks: 232 }
      : { ground: 160, h: 64, w: 16, xs: [120, 200, 360, 440, 600], dots: [300, 540], names: 184, ticks: 212 };
    const names = ph ? [['Init'], ['state', '2'], ['state', 'k'], ['state', 'k+1'], ['state', 'n']] : [['Init'], ['state 2'], ['state k'], ['state k+1'], ['state n']];
    const domino = (cx, i) => rect(cx - D.w / 2, D.ground - D.h, D.w, D.h, { cls: 't8-domino', rx: 2, anim: topple(i, i === 0 ? 0.4 : 0.3) });
    const fade = cx => [0, 1, 2].map(j => circle(cx - 12 + j * 12, D.ground - (ph ? 36 : 24), 2.5, { cls: `t8-dot t8-dot-${j}` }));
    const push = ph
      ? arrow(s, [[16, 72], [16, D.ground - 16], [D.xs[0] - D.w / 2 - 4, D.ground - 16]])
      : arrow(s, [[24, D.ground - 32], [D.xs[0] - D.w / 2 - 4, D.ground - 32]]);
    const c2 = ph ? { y: 112, text: 64 } : { y: 80, text: 24 };
    const bx0 = D.xs[2] - (ph ? 16 : 24), bx1 = D.xs[3] + (ph ? 16 : 24);
    const c1Rows = ph ? [['condition 1', 'k-name'], ['Init satisfies Inv', 'k-tick']] : [['condition 1', 'k-name'], ['Init satisfies Inv', 'k-tick']];
    const c2Rows = ph ? [['condition 2', 'k-name'], ['any state with Inv', 'k-tick'], ['knocks over the next', 'k-tick']]
      : [['condition 2', 'k-name'], ['any state that satisfies Inv', 'k-tick'], ['knocks the next one over', 'k-tick']];
    const c3Rows = ph ? [['condition 3', 'k-name'], ['every state with Inv', 'k-tick'], ['satisfies NoDoublePayout', 'k-tick']]
      : [['condition 3', 'k-name'], ['every state that satisfies Inv also satisfies NoDoublePayout', 'k-tick']];
    const c3y = ph ? 264 : 256;
    return [
      step(1, 'condition 1: the first state, Init, satisfies Inv, and falls',
        g({ anim: rise(0, { dx: -10, dy: 0 }) }, push, rowsOf(16, ph ? 28 : 48, c1Rows)),
        domino(D.xs[0], 0)),
      step(2, 'the second state falls', domino(D.xs[1], 1)),
      step(3, 'many states later, state k falls', g({ anim: fadeIn(2) }, fade(D.dots[0])), domino(D.xs[2], 2)),
      step(4, 'condition 2: any state that satisfies Inv knocks the next one over, so state k+1 falls',
        domino(D.xs[3], 3),
        g({ anim: rise(3, { extra: 0.3 }) },
          path(`M${bx0} ${c2.y + 8}V${c2.y}H${bx1}V${c2.y + 8}`, { cls: 't8-bracket' }),
          rowsOf((bx0 + bx1) / 2, c2.text, c2Rows, { anchor: 'middle' }))),
      step(5, 'the row continues to state n, however far, which falls too', g({ anim: fadeIn(4) }, fade(D.dots[1])), domino(D.xs[4], 4)),
      step(6, 'condition 3: every fallen state satisfies NoDoublePayout',
        g({ anim: rise(5, { extra: 0.4 }) }, D.xs.map(x => tick(x, D.ticks)), rowsOf(16, c3y, c3Rows))),
      line(D.xs[0] - 24, D.ground, L.W - 16, D.ground, { cls: 'k-axis' }),
      D.xs.map((x, i) => rowsOf(x, D.names, names[i].map(n => [n, 'k-label']), { anchor: 'middle', dy: 16 })),
      text(16, L.H - 12, 'a fallen domino: a state that satisfies Inv', { anchor: 'start', cls: 'k-tick' }),
    ];
  };

  const cti = L => {
    const s = L.slug, ph = L.phone;
    const [before, action, after] = CTI0;
    const sendLabel = action;
    if (ph) {
      return [
        rect(8, 40, 344, 560, { cls: 't8-type', rx: 10 }),
        rowsOf(24, 64, [['sensible values', 'k-name'], ['all sensible states, 2 workers', 'k-tick']]),
        rect(16, 104, 328, 328, { cls: 't8-nd', rx: 8 }),
        rowsOf(32, 128, [['NoDoublePayout', 'k-name'], [`${COUNT.nd} states`, 'k-tick']]),
        rect(28, 168, 136, 160, { cls: 't8-reach', rx: 6 }),
        rowsOf(40, 192, [['reachable', 'k-name'], [`${REACH2.length} states`, 'k-tick']]),
        arrow(s, [[60, 236], [132, 236]], { cls: 'k-arrow t8-dash' }),
        circle(56, 236, 4, { cls: 't8-state' }), circle(140, 236, 4, { cls: 't8-state' }),
        rowsOf(40, 272, [['steps from here', 'k-tick'], ['stay inside', 'k-tick']]),
        arrow(s, [[258, 248], [258, 486]], { tone: 'accent', cls: 'k-arrow t8-strong' }),
        g({ cls: 't8-on2' }, masked(268, 380, sendLabel, { anchor: 'start', cls: 'k-num-accent', size: 12 })),
        rowsOf(36, 364, [['CTI: one step', 'k-num-accent'], ['from inside', 'k-num-accent'], ['to outside', 'k-num-accent']]),
        stateCard(184, 176, 148, before),
        stateCard(184, 488, 148, after, 'bad'),
        rowsOf(24, 472, [['outside', 'k-tick'], ['NoDoublePayout', 'k-tick']]),
        legendLine(16, 628, 'k-arrow k-accent t8-strong', 'a step that leaves', `url(#${s}-arrow-accent)`),
        legendLine(16, 652, 'k-arrow t8-dash', 'a step between reachable states', `url(#${s}-arrow)`),
      ];
    }
    return [
      rect(16, 40, 688, 336, { cls: 't8-type', rx: 10 }),
      rowsOf(32, 64, [['sensible values', 'k-name'], ['all sensible states, 2 workers', 'k-tick']]),
      rect(32, 104, 416, 256, { cls: 't8-nd', rx: 8 }),
      rowsOf(48, 128, [['NoDoublePayout', 'k-name'], [`${COUNT.nd} states`, 'k-tick']]),
      rect(48, 168, 176, 176, { cls: 't8-reach', rx: 6 }),
      rowsOf(64, 192, [['reachable', 'k-name'], [`${REACH2.length} states`, 'k-tick']]),
      arrow(s, [[84, 240], [180, 240]], { cls: 'k-arrow t8-dash' }),
      circle(80, 240, 4, { cls: 't8-state' }), circle(188, 240, 4, { cls: 't8-state' }),
      rowsOf(64, 284, [['steps from here', 'k-tick'], ['stay inside', 'k-tick']]),
      arrow(s, [[424, 236], [526, 236]], { tone: 'accent', cls: 'k-arrow t8-strong' }),
      masked(488, 222, sendLabel, { cls: 'k-num-accent', size: 12 }),
      stateCard(248, 200, 176, before),
      stateCard(528, 200, 160, after, 'bad'),
      rowsOf(528, 128, [['outside', 'k-tick'], ['NoDoublePayout', 'k-tick']]),
      rowsOf(464, 312, [['CTI: one step, from inside', 'k-num-accent'], ['the candidate to outside', 'k-num-accent']]),
      legendLine(16, 404, 'k-arrow k-accent t8-strong', 'a step that leaves', `url(#${s}-arrow-accent)`),
      legendLine(256, 404, 'k-arrow t8-dash', 'a step between reachable states', `url(#${s}-arrow)`),
    ];
  };

  const strengthen = L => {
    const s = L.slug, ph = L.phone;
    const R = ph
      ? { nd: [8, 40, 344, 568], ow: [20, 96, 320, 372], iv: [32, 152, 296, 176] }
      : { nd: [16, 48, 592, 364], ow: [40, 104, 400, 292], iv: [64, 160, 208, 220] };
    const contract = (from, to) => {
      const [fx, fy, fw, fh] = from, [tx, ty, tw, th] = to;
      const sx = fw / tw, sy = fh / th;
      const ox = (fx - sx * tx) / (1 - sx), oy = (fy - sy * ty) / (1 - sy);
      return { sx: Number(sx.toFixed(3)), sy: Number(sy.toFixed(3)), origin: `transform-origin:${ox.toFixed(1)}px ${oy.toFixed(1)}px` };
    };
    const region = (r, cls, anim, style) => g({ anim, style }, rect(r[0], r[1], r[2], r[3], { cls, rx: 10 }));
    const c1 = contract(R.nd, R.ow), c2 = contract(R.ow, R.iv);
    const scale = (i, c) => ({ k: 'scale', d: at(i), len: 0.9, sx: c.sx, sy: c.sy });
    const dot = (x, y, cls = 't8-state') => circle(x, y, 4, { cls });
    const reach = ph ? { x: 48, y: 208, w: 160, h: 104 } : { x: 88, y: 224, w: 112, h: 136 };
    const reachDots = ph
      ? [0, 1, 2, 3].flatMap(i => [dot(68 + i * 24, 280), dot(68 + i * 24, 300)])
      : [0, 1, 2, 3].flatMap(i => [dot(108 + i * 24, 312), dot(108 + i * 24, 336)]);
    const P = ph
      ? {
        c1: { x: 192, y: 548, lab: [180, 500], to: 652, tag: [204, 552], send: [202, 588] },
        c2: { x: 48, y: 404, lab: [36, 356], to: 524, tag: [64, 408], claim: [58, 444] },
        hollow: [264, 216, 296], caption: [16, 672],
      }
      : {
        c1: { x: 468, y: 260, lab: [452, 216], to: 664, tag: [452, 292], send: [560, 248] },
        c2: { x: 300, y: 340, lab: [288, 300], to: 504, tag: [288, 368], claim: [400, 328] },
        hollow: [240, 232, 328], caption: [16, 444],
      };
    const label = (r, name, n, cls = 'k-name') => rowsOf(r[0] + 16, r[1] + 24, [[name, cls], [`${n} states`, 'k-tick']]);
    const cti1 = ph
      ? g({},
        arrow(s, [[P.c1.x, P.c1.y + 6], [P.c1.x, P.c1.to - 8]], { tone: 'accent', cls: 'k-arrow t8-strong' }),
        masked(P.c1.send[0], P.c1.send[1], 'Send(B)', { anchor: 'start', cls: 'k-num-accent', size: 12 }),
        dot(P.c1.x, P.c1.y, 't8-cti'), dot(P.c1.x, P.c1.to, 't8-bad'),
        text(P.c1.x + 12, P.c1.to + 4, 'transfers 2', { anchor: 'start', cls: 'k-num-accent' }))
      : g({},
        arrow(s, [[P.c1.x + 6, P.c1.y], [P.c1.to - 8, P.c1.y]], { tone: 'accent', cls: 'k-arrow t8-strong' }),
        masked(P.c1.send[0], P.c1.send[1], 'Send(B)', { cls: 'k-num-accent', size: 12 }),
        dot(P.c1.x, P.c1.y, 't8-cti'), dot(P.c1.to, P.c1.y, 't8-bad'),
        text(P.c1.to, P.c1.y + 24, 'transfers 2', { cls: 'k-num-accent' }));
    const cti2 = ph
      ? g({},
        arrow(s, [[P.c2.x, P.c2.y + 6], [P.c2.x, P.c2.to - 8]], { tone: 'accent', cls: 'k-arrow t8-strong' }),
        g({ cls: 't8-on2' }, masked(P.c2.claim[0], P.c2.claim[1], 'Claim(A)', { anchor: 'start', cls: 'k-num-accent', size: 12 })),
        dot(P.c2.x, P.c2.y, 't8-cti'), dot(P.c2.x, P.c2.to, 't8-bad'))
      : g({},
        arrow(s, [[P.c2.x + 6, P.c2.y], [P.c2.to - 8, P.c2.y]], { tone: 'accent', cls: 'k-arrow t8-strong' }),
        g({ cls: 't8-on2' }, masked(P.c2.claim[0], P.c2.claim[1], 'Claim(A)', { cls: 'k-num-accent', size: 12 })),
        dot(P.c2.x, P.c2.y, 't8-cti'), dot(P.c2.to, P.c2.y, 't8-bad'));
    const [hx, hy1, hy2] = P.hollow;
    return [
      step(1, `round 0: NoDoublePayout, ${COUNT.nd} states, around the ${REACH2.length} reachable states`,
        g({ anim: rise(0) }, region(R.nd, 't8-out'), label(R.nd, 'NoDoublePayout', COUNT.nd))),
      step(3, `round 1: Owed, ${COUNT.owed} states, drawn in from NoDoublePayout`,
        region(R.ow, 't8-mid', scale(2, c1), c1.origin)),
      step(5, `round 2: Inv, ${COUNT.inv} states, drawn in from Owed`,
        region(R.iv, 't8-in', scale(4, c2), c2.origin)),
      step(1, `the ${REACH2.length} reachable states, inside every candidate`,
        g({ anim: rise(0, { extra: 0.3 }) },
          rect(reach.x, reach.y, reach.w, reach.h, { cls: 't8-reach-soft', rx: 6 }),
          rowsOf(reach.x + 12, reach.y + 20, [['reachable', 'k-label'], [`${REACH2.length} states`, 'k-tick']]), reachDots)),
      step(2, 'its CTI: approved, A idle, B claimed, 1 transfer, then Send(B) makes 2 transfers',
        g({ anim: rise(1) }, rowsOf(P.c1.lab[0], P.c1.lab[1], [['(approved, idle,', 'k-num'], ['claimed, 1)', 'k-num']]), cti1)),
      step(3, 'the first CTI state now lies outside Owed',
        g({ anim: rise(2, { extra: 0.6 }) }, label(R.ow, 'Owed', COUNT.owed), text(P.c1.tag[0], P.c1.tag[1], 'ruled out by Owed', { anchor: 'start', cls: 'k-tick' }))),
      step(4, 'its CTI: approved, both idle, 1 transfer, then Claim(A)',
        g({ anim: rise(3) }, rowsOf(P.c2.lab[0], P.c2.lab[1], [['(approved, idle,', 'k-num'], ['idle, 1)', 'k-num']]), cti2)),
      step(5, 'the second CTI state now lies outside Inv',
        g({ anim: rise(4, { extra: 0.6 }) }, label(R.iv, 'Inv', COUNT.inv, 'k-name-ok'), rowsOf(P.c2.tag[0], P.c2.tag[1], ph ? [['ruled out by Unclaimed', 'k-tick']] : [['ruled out by', 'k-tick'], ['Unclaimed', 'k-tick']], { dy: 16 }))),
      step(6, 'no CTI: every step from an Inv state stays inside Inv, so TLC reports depth 1',
        g({ anim: rise(5) },
          arrow(s, [[hx, hy1 + 6], [hx, hy2 - 8]], { cls: 'k-arrow t8-ok-arrow' }),
          circle(hx, hy1, 4, { cls: 't8-hollow' }), circle(hx, hy2, 4, { cls: 't8-hollow' })),
        g({ anim: rise(5, { extra: 0.4 }) },
          ph ? rowsOf(P.caption[0], P.caption[1], [['depth 1: every step from an', 'k-num-ok'], ['Inv state stays in Inv', 'k-num-ok']])
            : text(P.caption[0], P.caption[1], 'depth 1: every step from an Inv state stays in Inv', { anchor: 'start', cls: 'k-num-ok' }))),
      text(16, 28, ph ? 'state = (status, pc A, pc B, transfers)' : 'a state is written (status, pc of A, pc of B, transfers)', { anchor: 'start', cls: 'k-tick' }),
      circle(ph ? 20 : 452, ph ? 720 : 440, 4, { cls: 't8-hollow' }),
      text(ph ? 32 : 464, ph ? 724 : 444, 'an Inv state nobody reaches', { anchor: 'start', cls: 'k-tick' }),
    ];
  };

  const oneWorker = L => {
    const s = L.slug, ph = L.phone;
    const G = ph ? { x: 40, y: 72, cols: 20, rows: 15, hi: [14, 19] } : { x: 16, y: 72, cols: 30, rows: 10, hi: [1, 29] };
    if (G.cols * G.rows !== 300) fail('one-worker grid is not 300 workers');
    const pitch = 14, size = 10;
    const chipAt = (r, c) => [G.x + c * pitch, G.y + r * pitch];
    const chips = [];
    for (let r = 0; r < G.rows; r++) for (let c = 0; c < G.cols; c++) {
      if (r === G.hi[0] && c === G.hi[1]) continue;
      const [x, y] = chipAt(r, c);
      chips.push(rect(x, y, size, size, { cls: 't8-chip', rx: 2 }));
    }
    const [hx, hy] = chipAt(...G.hi);
    const hcx = hx + size / 2, hcy = hy + size / 2;
    const card = (x, y, name, cls) => g({}, rect(x, y, 88, 32, { cls: 'k-mask-box', rx: 6 }), rect(x, y, 88, 32, { cls, rx: 6 }), text(x + 44, y + 21, name, { cls: 'k-num' }));
    const counter = (x, y, name, a, b, i, cls = 'k-num') => g({},
      text(x, y, name, { anchor: 'start', cls }),
      text(x + 160, y, String(a), { anchor: 'middle', cls }),
      g({ anim: rise(i, { dx: -8, dy: 0 }) }, text(x + 184, y, '→', { anchor: 'middle', cls }), text(x + 208, y, String(b), { anchor: 'middle', cls })));
    const C = ph ? { cx: 16, cy: 316, card: [hcx - 44, 296], card2: [hcx - 44, 360], note: [16, 440], legend: 476 }
      : { cx: 472, cy: 152, card: [480, hcy - 16], card2: [616, hcy - 16], note: [16, 248], legend: 284 };
    const zoom = ph
      ? g({},
        path(`M${hcx} ${hy + size + 4}V${C.card[1] - 2}`, { cls: 't8-leader' }),
        arrow(s, [[hcx, C.card[1] + 32], [hcx, C.card2[1] - 2]], { cls: 'k-arrow' }))
      : g({},
        path(`M${hx + size + 4} ${hcy}H${C.card[0] - 2}`, { cls: 't8-leader' }),
        arrow(s, [[C.card[0] + 88, hcy], [C.card2[0] - 2, hcy]], { cls: 'k-arrow' }));
    return [
      text(16, 28, ph ? 'Send(w): one step, 300 workers' : 'Send(w): one step of a desk with 300 workers', { anchor: 'start', cls: 'k-name' }),
      text(16, 48, ph ? 'the loan stays claimed throughout' : 'the loan is claimed before and after the step', { anchor: 'start', cls: 'k-tick' }),
      chips,
      zoom,
      rect(hx, hy, size, size, { cls: 't8-chip-claimed', rx: 2 }),
      card(C.card[0], C.card[1], 'claimed', 't8-card'),
      step(1, 'worker w moves from claimed to sent',
        rect(hx, hy, size, size, { cls: 't8-chip-sent', rx: 2, anim: fadeIn(0, 0.2) }),
        g({ anim: rise(0, { dx: -10, dy: 0, extra: 0.2 }) }, card(C.card2[0], C.card2[1], 'sent', 'k-box-accent'))),
      step(2, 'transfers goes from 0 to 1', counter(C.cx, C.cy, 'transfers', 0, 1, 1)),
      step(3, 'claims goes from 1 to 0', counter(C.cx, C.cy + 28, 'claims', 1, 0, 2)),
      line(C.cx, C.cy + 44, C.cx + 224, C.cy + 44, { cls: 'k-grid' }),
      step(4, 'their sum stays 1: the payout budget holds',
        counter(C.cx, C.cy + 68, 'transfers + claims', 1, 1, 3, 'k-num-ok')),
      step(5, '299 other workers: unchanged',
        g({ anim: rise(4, { extra: 0.2 }) }, text(C.note[0], C.note[1], '299 other workers: unchanged', { anchor: 'start', cls: 'k-note' }))),
      rect(16, C.legend - 10, size, size, { cls: 't8-chip', rx: 2 }),
      text(32, C.legend, 'idle', { anchor: 'start', cls: 'k-tick' }),
      rect(80, C.legend - 10, size, size, { cls: 't8-chip-claimed', rx: 2 }),
      text(96, C.legend, 'claimed', { anchor: 'start', cls: 'k-tick' }),
      rect(168, C.legend - 10, size, size, { cls: 't8-chip-sent', rx: 2 }),
      text(184, C.legend, 'sent', { anchor: 'start', cls: 'k-tick' }),
    ];
  };

  const css = [
    '.k-fig .t8-tick { stroke: var(--ok); stroke-width: var(--line-strong); fill: none; stroke-linecap: round; stroke-linejoin: round; }',
    '.k-fig .t8-break { stroke: var(--ink-soft); stroke-width: var(--line-strong); fill: none; }',
    '.k-fig .t8-ghost { stroke: var(--accent); stroke-width: var(--line-strong); stroke-dasharray: 5 4; }',
    '.k-fig .t8-domino { fill: var(--ink); transform: rotate(62deg); transform-box: fill-box; transform-origin: 100% 100%; }',
    '.k-fig .k-a-topple { animation-name: t8-topple; animation-timing-function: cubic-bezier(.5, 0, .9, .6); }',
    '@keyframes t8-topple { from { transform: rotate(0deg); } }',
    '.k-fig .t8-dot { fill: var(--ink-soft); }',
    '.k-fig .t8-dot-1 { opacity: 0.6; }',
    '.k-fig .t8-dot-2 { opacity: 0.3; }',
    '.k-fig .t8-bracket { stroke: var(--ink-soft); stroke-width: var(--line-hair); fill: none; }',
        '.k-fig .t8-card { fill: var(--paper); stroke: var(--ink); stroke-width: var(--line-strong); }',
    '.k-fig .t8-type { fill: var(--paper); stroke: var(--ink-soft); stroke-width: var(--line-hair); stroke-dasharray: 5 4; }',
    '.k-fig .t8-nd { fill: var(--paper-2); stroke: var(--ink-soft); stroke-width: var(--line-strong); }',
    '.k-fig .t8-reach { fill: var(--paper); stroke: var(--ink); stroke-width: var(--line-strong); }',
    '.k-fig .t8-reach-soft { fill: var(--paper); stroke: var(--ink-soft); stroke-width: var(--line-hair); stroke-dasharray: 3 3; }',
    '.k-fig .t8-state { fill: var(--ink); }',
    '.k-fig .t8-hollow { fill: var(--paper); stroke: var(--ink); stroke-width: var(--line-strong); }',
    '.k-fig .t8-cti { fill: var(--paper); stroke: var(--accent); stroke-width: var(--line-strong); }',
    '.k-fig .t8-bad { fill: var(--accent); }',
    '.k-fig .t8-dash { stroke-dasharray: 5 4; }', '.k-fig .t8-on2 .k-mask { fill: var(--paper-2); }',
    '.k-fig .t8-strong { stroke-width: var(--line-strong); }',
    '.k-fig .t8-ok-arrow { stroke: var(--ok); }',
    '.k-fig .t8-out { fill: var(--paper); stroke: var(--ink-soft); stroke-width: var(--line-hair); stroke-dasharray: 5 4; }',
    '.k-fig .t8-mid { fill: var(--paper-2); stroke: var(--ink-soft); stroke-width: var(--line-strong); }',
    '.k-fig .t8-in { fill: var(--ok-soft); stroke: var(--ok); stroke-width: var(--line-strong); }',
    '.k-fig .t8-chip { fill: var(--paper); stroke: var(--ink-soft); stroke-width: var(--line-hair); }',
    '.k-fig .t8-chip-claimed { fill: var(--accent-soft); stroke: var(--accent); stroke-width: var(--line-hair); }',
    '.k-fig .t8-chip-sent { fill: var(--accent); stroke: var(--accent); stroke-width: var(--line-hair); }',
    '.k-fig .t8-leader { stroke: var(--accent); stroke-width: var(--line-hair); stroke-dasharray: 4 3; fill: none; }',
  ].join(' ');

  const fig = (name, wide, phone, title, desc, caption, body, stepsCount = 0) => ({
    name, w: 720, h: wide, phone: { w: 360, h: phone }, title, desc, caption, steps: stepsCount,
    eyebrow: 'Lesson 8 · when checking is not enough', css, body: (kk, L) => body(L),
  });

  return [
    fig('growth', 400, 420, 'Every worker doubles the desk',
      `Bars on a log scale of the reachable states TLC counted for the desk: 2 workers 8, 3 workers 14, 4 workers 24, 5 workers 42, 6 workers 76, 12 workers 4,120. After a break in the axis, a hatched bar for 300 workers runs off the top of the chart: 2N + 2^N there has ${DIGITS} digits.`,
      `Reachable states as TLC counted them, on a log scale: each bar is 2N + 2^N. Past the break, the bar for 300 workers would need a number with ${DIGITS} digits; it leaves the chart.`,
      growth),
    fig('dominoes', 316, 348, 'Two checks cover the whole row',
      'A row of dominoes standing for the states of a behavior: Init, state 2, state k, state k+1 and state n, with gaps between. A push arrow topples Init (condition 1: Init satisfies Inv). A bracket over state k and state k+1 says any state that satisfies Inv knocks the next one over (condition 2). Every fallen state gets a tick for NoDoublePayout (condition 3).',
      'Condition 1 pushes the first domino. Condition 2 says every domino, whichever one it is, knocks over the next. Together they cover the row however long it is; condition 3 turns "fallen" into "no double payout".',
      dominoes, 6),
    fig('cti', 420, 668, 'A step out of a state nobody reaches',
      `Nested regions for two workers: every state with sensible values; inside it NoDoublePayout, ${COUNT.nd} states; inside that the ${REACH2.length} reachable states, whose steps stay inside. Outside the reachable region but inside NoDoublePayout sits the state approved, A idle, B claimed, 1 transfer. Its step Send(B) leads outside NoDoublePayout, to approved, A idle, B sent, 2 transfers: a counterexample to inductiveness.`,
      `With two workers, ${COUNT.nd} states satisfy NoDoublePayout but only ${REACH2.length} are reachable. The CTI starts in the gap between them: a state the desk never visits, one step from paying twice.`,
      cti),
    fig('strengthen', 460, 736, 'Two rounds of strengthening',
      `Three nested regions for two workers around the same ${REACH2.length} reachable states: NoDoublePayout, ${COUNT.nd} states; Owed, ${COUNT.owed}; Inv, ${COUNT.inv}. The CTI of NoDoublePayout, approved, A idle, B claimed, 1 transfer, with its step Send(B) to 2 transfers, lies outside Owed. The CTI of Owed, approved, both idle, 1 transfer, with its step Claim(A), lies outside Inv. Every step from an Inv state stays inside Inv: TLC reports depth 1.`,
      `Each round adds a conjunct that rules out the last CTI's first state and keeps every reachable state: ${COUNT.nd}, then ${COUNT.owed}, then ${COUNT.inv} states. Inside Inv, every step stays inside, which is why TLC reports depth 1.`,
      strengthen, 6),
    fig('one-worker', 300, 492, 'One step moves one worker',
      'A grid of 300 worker chips, all idle except worker w, which moves from claimed to sent in one Send step. Counters: transfers 0 to 1, claims 1 to 0, and their sum, the payout budget, stays 1. The other 299 workers are unchanged.',
      'One step of a 300-worker desk. Send moves one worker: one claim fewer, one transfer more, and the budget stays at 1. The other 299 workers play no part, which is why the argument works for any number of them.',
      oneWorker, 5),
  ];
};
