export default k => {
  const { g, line, path, rect, circle, text, masked, arrow, box, step, cross } = k;

  const TTL = 2;
  const euro = n => `€${n.toLocaleString('en-US')}`;
  const count = n => n.toLocaleString('en-US');

  const T0 = 0.2, HOLD = 1.1, LEN = 0.6;
  const at = (i, extra = 0) => Number((T0 + i * HOLD + extra).toFixed(2));
  const rise = (i, o = {}) => ({ k: 'rise', d: at(i, o.extra || 0), len: LEN, dx: o.dx ?? 0, dy: o.dy ?? 8 });
  const land = (i, extra = 0) => ({ k: 'land', d: at(i, extra), len: LEN, s0: 1.12 });

  const label = (x, y, s, cls = 'k-label', o = {}) => masked(x, y, s, { cls, ...o });
  const tickMark = (x, y) => path(`M${x - 5} ${y}L${x - 1} ${y + 4}L${x + 6} ${y - 4}`, { cls: 't3-tick' });
  const lifeline = (x, y1, y2) => line(x, y1, x, y2, { cls: 't3-life' });
  const actor = (cx, y, w, name) => box(cx - w / 2, y, w, 40, { name });
  const msg = (slug, x1, x2, y, s, o = {}) => {
    const { tone = '', ret = false, textCls } = o;
    const dir = Math.sign(x2 - x1);
    return g({},
      line(x1, y, x2, y, { cls: 't3-halo' }),
      arrow(slug, [[x1, y], [x2 - dir, y]], { tone, cls: ['k-arrow', ret ? 't3-dash' : ''].filter(Boolean).join(' ') }),
      label((x1 + x2) / 2, y - 9, s, textCls || (tone === 'accent' ? 'k-num-accent' : 'k-num')));
  };
  const span = (x1, x2, y, h, cls, s, sCls = 'k-num', anchor = 'middle') => g({},
    rect(x1, y, x2 - x1, h, { cls, rx: 3 }),
    s ? text(anchor === 'start' ? x1 + 8 : (x1 + x2) / 2, y + h / 2 + 4, s, { anchor, cls: sCls }) : '');
  const chip = (x, y, w, s, cls = 't3-chip', sCls = 'k-num') => g({},
    rect(x, y, w, 24, { cls, rx: 4 }),
    text(x + w / 2, y + 16, s, { cls: sCls }));

  const WEEKEND = [
    ['start', 0, null, 0],
    ['Claim', 0, null, 0],
    ['Send', 0, 0, 1],
    ['Crash', 0, 0, 1],
    ['Tick', 1, 0, 1],
    ['Tick', 2, 0, 1],
    ['Forget', 2, null, 1],
    ['Resume', 2, null, 1],
    ['Send', 2, 2, 2],
  ];
  WEEKEND.forEach(([name, now, key, t], i) => {
    if (!i) return;
    const [, pNow, pKey, pT] = WEEKEND[i - 1];
    const ok = name === 'Tick' ? now === pNow + 1 && key === pKey && t === pT
      : name === 'Forget' ? now === pNow && pKey !== null && now >= pKey + TTL && key === null
      : name === 'Send' ? now === pNow && (pKey === null ? key === now && t === pT + 1 : key === pKey && t === pT)
      : now === pNow && key === pKey && t === pT;
    if (!ok) throw new Error(`clock: card ${i} (${name}) does not follow from card ${i - 1}`);
  });
  if (WEEKEND.length - 1 !== 8) throw new Error('clock: the weekend is 8 steps');

  const GROWTH = [23, 62, 139, 238, 365, 514, 685];
  const reachesTTL = m => m >= TTL;

  const weekend = L => {
    const ph = L.phone;
    const x0 = ph ? 24 : 120, x1 = ph ? 336 : 680, HOURS = 64.2;
    const X = h => x0 + (h / HOURS) * (x1 - x0);
    const yA = ph ? 72 : 80, yB = ph ? 176 : 160, yAxis = ph ? 252 : 248;
    return [
      ph ? text(16, 28, 'worker A', { anchor: 'start', cls: 'k-name' }) : text(16, yA + 5, 'worker A', { anchor: 'start', cls: 'k-name' }),
      ph ? text(16, 136, 'bank', { anchor: 'start', cls: 'k-name' }) : text(16, yB + 5, 'bank', { anchor: 'start', cls: 'k-name' }),
      line(X(24), yB + 8, X(24), yAxis, { cls: 'k-guide' }),
      line(x0, yA, x1, yA, { cls: 't3-lane' }),
      span(x0 + 20, x1 - 10, yA - 8, 16, 't3-down', ''),
      text((x0 + x1) / 2 + 10, yA + 4, 'machine down', { cls: 'k-tick' }),
      circle(x0, yA, 5, { cls: 't3-dot' }),
      text(x0 - (ph ? 0 : 6), yA - 20, 'send 4471', { anchor: 'start', cls: 'k-num' }),
      cross(x0 + 12, yA + 26),
      text(x0 + 24, yA + 31, 'crash', { anchor: 'start', cls: 'k-tick' }),
      circle(x1, yA, 5, { cls: 't3-dot' }),
      text(x1 + (ph ? 0 : 6), yA - 20, 'resume, send 4471', { anchor: 'end', cls: 'k-num' }),
      rect(x0, yB - 8, X(24) - x0, 16, { cls: 't3-key', rx: 3 }),
      text(x0, yB - 16, ph ? 'key 4471, kept 24 h' : 'key 4471, kept 24 hours', { anchor: 'start', cls: 'k-num' }),
      line(X(24), yB, x1, yB, { cls: 't3-gone' }),
      text((X(24) + x1) / 2, yB - 10, 'forgotten', { cls: 'k-tick' }),
      line(x0 + 12, yB + 8, x0 + 12, yB + 24, { cls: 't3-lane' }),
      chip(x0, yB + 24, 72, euro(50000)),
      line(x1 - 12, yB, x1 - 12, yB + 24, { cls: 't3-lane' }),
      chip(x1 - 112, yB + 24, 112, `${euro(50000)} again`, 'k-box-accent', 'k-num-accent'),
      line(x0, yAxis, x1, yAxis, { cls: 'k-axis' }),
      [[7, 'Sat'], [31, 'Sun'], [55, 'Mon']].map(([h, s]) => g({},
        line(X(h), yAxis - 4, X(h), yAxis + 4, { cls: 'k-axis' }),
        text(X(h), yAxis + 18, s, { cls: 'k-tick' }))),
      text(x0, yAxis + 36, 'Fri 17:00', { anchor: ph ? 'start' : 'middle', cls: 'k-tick' }),
      text(X(24), yAxis + 36, 'Sat 17:00', { cls: 'k-tick' }),
      text(x1, yAxis + 36, 'Mon 09:12', { anchor: ph ? 'end' : 'middle', cls: 'k-tick' }),
      ph ? [text(16, 332, 'by Monday the key is 64 hours old;', { anchor: 'start', cls: 'k-note' }),
        text(16, 354, 'the bank kept it for 24', { anchor: 'start', cls: 'k-note' })]
        : text(16, 332, 'by Monday the key is 64 hours old; the bank kept it for 24', { anchor: 'start', cls: 'k-note' }),
    ];
  };

  const dial = (cx, cy, r, now) => {
    const ang = now * 90;
    const hx = cx + r * 0.75 * Math.sin(ang * Math.PI / 180), hy = cy - r * 0.75 * Math.cos(ang * Math.PI / 180);
    return g({},
      circle(cx, cy, r, { cls: 't3-dial' }),
      [0, 1, 2, 3].map(n => {
        const a = n * Math.PI / 2;
        return line(cx + (r - 3) * Math.sin(a), cy - (r - 3) * Math.cos(a), cx + r * Math.sin(a), cy - r * Math.cos(a), { cls: 't3-notch' });
      }),
      path(`M${cx} ${cy}L${Math.round(hx * 100) / 100} ${Math.round(hy * 100) / 100}`, { cls: 't3-hand' }));
  };

  const clock = L => {
    const s = L.slug, ph = L.phone;
    const keyText = key => (key === null ? 'none' : `@${key}`);
    const isTick = i => WEEKEND[i][0] === 'Tick';
    const last = WEEKEND.length - 1;
    if (ph) {
      const cx = 36, cw = 308, ch = 32, short = 14, long = 44;
      const ys = [];
      let y = 76;
      WEEKEND.forEach((_, i) => { ys.push(y); y += ch + (i < last && isTick(i + 1) ? long : short); });
      const card = i => {
        const [name, now, key, t] = WEEKEND[i], top = ys[i], bad = t > 1, mid = top + ch / 2;
        return g({},
          rect(cx, top, cw, ch, { cls: 'k-mask-box', rx: 6 }),
          rect(cx, top, cw, ch, { cls: bad ? 'k-box-accent' : 't3-card', rx: 6 }),
          text(cx + 10, mid + 5, name, { anchor: 'start', cls: bad ? 'k-name-accent' : 'k-num' }),
          dial(154, mid, 10, now),
          text(172, mid + 5, String(now), { anchor: 'start', cls: 'k-num' }),
          text(236, mid + 5, keyText(key), { cls: 'k-num' }),
          text(312, mid + 5, String(t), { cls: bad ? 'k-num-accent' : 'k-num' }));
      };
      const link = i => {
        const y1 = ys[i - 1] + ch, y2 = ys[i];
        return isTick(i)
          ? g({}, arrow(s, [[64, y1], [64, y2 - 2]], { cls: 'k-arrow t3-strong' }), text(76, (y1 + y2) / 2 + 5, '+12 h', { anchor: 'start', cls: 'k-num' }))
          : arrow(s, [[64, y1], [64, y2 - 2]]);
      };
      const bTop = ys[1], bBot = ys[3] + ch;
      return [
        text(46, 52, 'step', { anchor: 'start', cls: 'k-tick' }),
        text(160, 52, 'now', { cls: 'k-tick' }),
        text(236, 52, 'key 4471', { cls: 'k-tick' }),
        text(312, 52, 'transfers', { cls: 'k-tick' }),
        card(0),
        WEEKEND.slice(1).map((st, j) => step(j + 1,
          `${st[0]}: now ${st[1]}, key ${keyText(st[2])}, transfers ${st[3]}`,
          g({ anim: rise(j, { dy: -8 }) }, link(j + 1), card(j + 1)),
          j === 2 ? g({ anim: rise(j, { extra: 0.4, dy: 0, dx: 6 }) }, path(`M28 ${bTop}H22V${bBot}H28`, { cls: 't3-bracket' })) : '')),
        text(16, y + 8, 'bracket: three steps inside tick 0;', { anchor: 'start', cls: 'k-note' }),
        text(16, y + 30, 'any number of steps fit in one tick', { anchor: 'start', cls: 'k-note' }),
        text(16, y + 56, '@0: key stored at tick 0', { anchor: 'start', cls: 'k-tick' }),
      ];
    }
    const cw = 40, short = 20, long = 68, top = 104, ch = 88;
    const xs = [];
    let x = 100;
    WEEKEND.forEach((_, i) => { xs.push(x); x += cw + (i < last && isTick(i + 1) ? long : short); });
    const rows = { now: 128, key: 160, t: 184 };
    const card = i => {
      const [name, now, key, t] = WEEKEND[i], x0 = xs[i], bad = t > 1, cxm = x0 + cw / 2;
      return g({},
        text(cxm, top - 10, name, { cls: bad ? 'k-num-accent' : 'k-num' }),
        rect(x0, top, cw, ch, { cls: 'k-mask-box', rx: 6 }),
        rect(x0, top, cw, ch, { cls: bad ? 'k-box-accent' : 't3-card', rx: 6 }),
        dial(x0 + 13, rows.now - 4, 9, now),
        text(x0 + 30, rows.now + 1, String(now), { cls: 'k-num' }),
        text(cxm, rows.key, keyText(key), { cls: 'k-num' }),
        text(cxm, rows.t, String(t), { cls: bad ? 'k-num-accent' : 'k-num' }));
    };
    const link = i => {
      const x1 = xs[i - 1] + cw, x2 = xs[i], y = top + 44;
      return isTick(i)
        ? g({}, arrow(s, [[x1, y], [x2 - 2, y]], { cls: 'k-arrow t3-strong' }), text((x1 + x2) / 2, y - 10, '+12 h', { cls: 'k-num' }))
        : arrow(s, [[x1, y], [x2 - 2, y]]);
    };
    const bL = xs[1], bR = xs[3] + cw;
    return [
      text(16, rows.now + 1, 'now', { anchor: 'start', cls: 'k-tick' }),
      text(16, rows.key, 'key 4471', { anchor: 'start', cls: 'k-tick' }),
      text(16, rows.t, 'transfers', { anchor: 'start', cls: 'k-tick' }),
      card(0),
      WEEKEND.slice(1).map((st, j) => step(j + 1,
        `${st[0]}: now ${st[1]}, key ${keyText(st[2])}, transfers ${st[3]}`,
        g({ anim: rise(j, { dx: -10, dy: 0 }) }, link(j + 1), card(j + 1)),
        j === 2 ? g({ anim: rise(j, { extra: 0.4 }) },
          path(`M${bL} 72V64H${bR}V72`, { cls: 't3-bracket' }),
          text((bL + bR) / 2, 52, 'any number of steps inside one tick', { cls: 'k-note' })) : '')),
      line(16, 236, 36, 236, { cls: 'k-arrow' }),
      text(44, 240, 'a step: now stays', { anchor: 'start', cls: 'k-tick' }),
      line(212, 236, 268, 236, { cls: 'k-arrow t3-strong' }),
      text(276, 240, 'Tick: now + 1 (12 hours)', { anchor: 'start', cls: 'k-tick' }),
      text(704, 240, '@0: stored at tick 0', { anchor: 'end', cls: 'k-tick' }),
    ];
  };

  const timeoutGuard = L => {
    const ph = L.phone;
    const X = t => (ph ? 40 + t * 68 : 168 + t * 128);
    const bandEnd = ph ? L.W - 16 : X(3.5);
    const yMark = 92, yF = 112, yS = 164, yAxis = 220;
    const neverX = ph ? 316 : X(3.5) + 52;
    return [
      ph ? '' : [text(16, yF + 16, 'Forget', { anchor: 'start', cls: 'k-name' }), text(16, yS + 16, 'a resend', { anchor: 'start', cls: 'k-name' })],
      text(ph ? 16 : X(0), 40, ph ? 'key 4471 stored at tick 0' : 'key 4471 stored at tick 0; when may the bank drop it?', { anchor: 'start', cls: 'k-tick' }),
      line(X(2), yMark + 8, X(2), yAxis, { cls: 'k-guide' }),
      text(X(2) - 8, yMark + 8, 'now ≥ 0 + TTL', { anchor: 'end', cls: 'k-num' }),
      circle(X(2), yMark, 5, { cls: 't3-dot' }),
      text(X(2), yMark - 16, ph ? 'here' : 'Forget here', { cls: 'k-num' }),
      circle(X(3), yMark, 5, { cls: 't3-dot' }),
      text(X(3), yMark - 16, 'or here', { cls: 'k-num' }),
      circle(neverX, yMark, 5, { cls: 't3-ring' }),
      text(neverX, yMark - 16, 'or never', { cls: 'k-num' }),
      span(X(0), X(2) - 4, yF, 24, 't3-off', ph ? 'not yet' : 'not enabled: key under 24 h', 'k-tick'),
      span(X(2), bandEnd, yF, 24, 't3-on', ph ? 'Forget enabled' : 'Forget(4471, 0) enabled', 'k-num'),
      span(X(0), X(2) - 4, yS, 24, 't3-off', ph ? 'finds the key' : 'a resend finds the key', 'k-tick'),
      span(X(2), bandEnd, yS, 24, 'k-box-accent', ph ? 'may pay twice' : 'may pay twice', 'k-num-accent'),
      line(X(0), yAxis, bandEnd, yAxis, { cls: 'k-axis' }),
      [0, 1, 2, 3].map(t => g({},
        line(X(t), yAxis - 4, X(t), yAxis + 4, { cls: 'k-axis' }),
        text(X(t), yAxis + 18, `tick ${t}`, { cls: 'k-tick' }),
        text(X(t), yAxis + 36, ph ? ['Fri 17', 'Sat 05', 'Sat 17', 'Sun 05'][t] : ['Fri 17:00', 'Sat 05:00', 'Sat 17:00', 'Sun 05:00'][t], { cls: 'k-tick' }))),
      text(ph ? 16 : X(0), yAxis + 68, ph ? 'all three allowed: enabled, never forced' : 'all three are allowed: enabled, never forced', { anchor: 'start', cls: 'k-note' }),
    ];
  };

  const clockBound = L => {
    const ph = L.phone;
    const P = ph ? k.plot({ x: 56, y: 104, w: 288, h: 228, xs: [-0.5, 6.5], ys: [0, 800] })
      : k.plot({ x: 96, y: 72, w: 592, h: 220, xs: [-0.5, 6.5], ys: [0, 800] });
    const bw = ph ? 28 : 48;
    const legendY = ph ? 32 : 36;
    const legendItem = (x, y, cls, s) => g({}, rect(x, y - 11, 14, 14, { cls }), text(x + 22, y + 1, s, { anchor: 'start', cls: 'k-tick' }));
    const xm = P.X(1.5);
    return [
      legendItem(ph ? 16 : 96, legendY, 't3-bar-open', 'no double payout in the model'),
      legendItem(ph ? 16 : 400, legendY + (ph ? 22 : 0), 'k-bar-accent', 'TLC finds the double payout'),
      k.axes(P, {
        grid: true,
        yTicks: [[0, '0'], [200, '200'], [400, '400'], [600, '600'], [800, '800']],
        xTicks: GROWTH.map((_, m) => [m, String(m)]),
        xTitle: ph ? 'MaxTime' : 'MaxTime: the last tick the clock may reach',
        yTitle: 'reachable states',
      }),
      line(xm, P.y0 + 4, xm, P.y1, { cls: 'k-guide' }),
      ph ? [text(xm + 6, P.y0 + 18, 'the weekend', { anchor: 'start', cls: 'k-note' }), text(xm + 6, P.y0 + 38, 'fits from here', { anchor: 'start', cls: 'k-note' })]
        : [text(xm + 8, P.y0 + 16, 'the weekend fits from here', { anchor: 'start', cls: 'k-note' }), text(xm + 8, P.y0 + 36, '(now can reach TTL = 2)', { anchor: 'start', cls: 'k-tick' })],
      GROWTH.map((v, m) => {
        const top = P.Y(v);
        return g({},
          rect(P.X(m) - bw / 2, top, bw, P.Y(0) - top, { cls: reachesTTL(m) ? 'k-bar-accent' : 't3-bar-open' }),
          text(P.X(m), top - 8, count(v), { cls: reachesTTL(m) ? 'k-num-accent' : 'k-num' }));
      }),
      ph ? [text(P.X(0) - 14, P.Y(23) - 72, 'lesson', { anchor: 'start', cls: 'k-tick' }), text(P.X(0) - 14, P.Y(23) - 56, "2's desk", { anchor: 'start', cls: 'k-tick' }),
        line(P.X(0), P.Y(23) - 50, P.X(0), P.Y(23) - 26, { cls: 't3-lane' })]
        : [text(P.X(0) - 24, P.Y(23) - 72, "= lesson 2's desk", { anchor: 'start', cls: 'k-tick' }), text(P.X(0) - 24, P.Y(23) - 56, '(frozen clock)', { anchor: 'start', cls: 'k-tick' }),
          line(P.X(0), P.Y(23) - 50, P.X(0), P.Y(23) - 26, { cls: 't3-lane' })],
    ];
  };

  const twoWorlds = L => {
    const s = L.slug, ph = L.phone;
    const panel = (ox, oy, lost) => {
      const X = ph ? { A: ox + 48, N: ox + 164, B: ox + 280 } : { A: ox + 52, N: ox + 164, B: ox + 276 };
      const aw = ph ? 80 : 88;
      const y = n => oy + n;
      const bottom = y(268);
      return {
        frame: g({},
          text(ox, y(20), lost ? 'world 2: the reply is lost' : 'world 1: the request is lost', { anchor: 'start', cls: 'k-name' }),
          lifeline(X.A, y(76), bottom), lifeline(X.N, y(76), bottom), lifeline(X.B, y(76), bottom),
          actor(X.A, y(36), aw, 'worker A'), actor(X.N, y(36), aw, 'network'), actor(X.B, y(36), aw, 'bank')),
        send: msg(s, X.A, X.N, y(112), 'pay'),
        deliver: lost ? g({},
          msg(s, X.N, X.B, y(144), 'pay'),
          text(X.B + 10, y(170), 'pays', { anchor: 'start', cls: 'k-tick' }),
          msg(s, X.B, X.N, y(196), 'ok', { ret: true })) : '',
        loss: g({}, cross(X.N, lost ? y(228) : y(152)), text(X.N + 12, (lost ? y(228) : y(152)) + 5, lost ? 'ok lost' : 'pay lost', { anchor: 'start', cls: 'k-num-accent' })),
        balance: g({},
          rect(X.B - 40, bottom, 80, 44, { cls: 'k-mask-box', rx: 6 }),
          rect(X.B - 40, bottom, 80, 44, { cls: 't3-card', rx: 6 }),
          text(X.B, bottom + 18, 'transfers', { cls: 'k-tick' }),
          text(X.B, bottom + 36, lost ? '1' : '0', { cls: 'k-num' })),
        view: g({},
          rect(X.A - 48, bottom, 96, 60, { cls: 'k-mask-box', rx: 6 }),
          rect(X.A - 48, bottom, 96, 60, { cls: 'k-box', rx: 6 }),
          text(X.A, bottom + 18, 'what A sees', { cls: 'k-tick' }),
          text(X.A, bottom + 36, 'waiting', { cls: 'k-num' }),
          text(X.A, bottom + 52, 'no reply', { cls: 'k-num' })),
      };
    };
    const [l, r] = ph ? [panel(16, 0, false), panel(16, 360, true)] : [panel(16, 0, false), panel(372, 0, true)];
    return [
      l.frame, r.frame,
      ph ? line(16, 348, 344, 348, { cls: 'k-grid' }) : line(360, 16, 360, 340, { cls: 'k-grid' }),
      step(1, 'in both worlds, worker A sends the payment request', g({ anim: rise(0, { dx: -10, dy: 0 }) }, l.send), g({ anim: rise(0, { dx: -10, dy: 0 }) }, r.send)),
      step(2, 'in world 2, the bank receives it, pays, and replies ok', g({ anim: rise(1, { dx: -10, dy: 0 }) }, r.deliver)),
      step(3, 'the network loses a message: the request in world 1, the reply in world 2', g({ anim: land(2) }, l.loss), g({ anim: land(2) }, r.loss)),
      step(4, 'transfers: 0 in world 1, 1 in world 2', g({ anim: rise(3) }, l.balance), g({ anim: rise(3) }, r.balance)),
      step(5, 'what A sees is the same in both: waiting, no reply', g({ anim: rise(4) }, l.view), g({ anim: rise(4) }, r.view)),
      ph ? text(16, 712, 'same view in A, different bank', { anchor: 'start', cls: 'k-note' })
        : text(16, 392, 'the same view inside worker A, a different bank', { anchor: 'start', cls: 'k-note' }),
    ];
  };

  const staleAnswer = L => {
    const s = L.slug, ph = L.phone;
    const X = ph ? { A: 56, N: 180, B: 300 } : { A: 100, N: 320, B: 540 };
    const aw = ph ? 80 : 112;
    const Y = ph ? { pay: 112, ask: 144, askB: 176, abs: 208, payB: 244, payBox: 256, band: 312, forgot: 372, read: 404, pay2: 436, pay2B: 468, box2: 480, end: 528 }
      : { pay: 112, ask: 144, askB: 176, abs: 208, payB: 244, payBox: 228, band: 280, forgot: 344, read: 368, pay2: 400, pay2B: 432, box2: 416, end: 468 };
    const inflight = (x, y1, y2) => line(x, y1, x, y2, { cls: 't3-flight' });
    const bankBox = (y, lines, cls, tCls) => ph
      ? g({}, rect(X.B - 52, y, 104, 40, { cls: 'k-mask-box', rx: 6 }), rect(X.B - 52, y, 104, 40, { cls, rx: 6 }),
        lines.map((t, i) => text(X.B, y + 17 + i * 16, t, { cls: tCls })))
      : g({}, rect(X.B + 16, y, 148, 40, { cls, rx: 6 }),
        lines.map((t, i) => text(X.B + 90, y + 17 + i * 16, t, { cls: tCls })));
    return [
      rect(16, Y.band, L.W - 32, 40, { cls: 't3-band' }),
      lifeline(X.A, 72, Y.end), lifeline(X.N, 72, Y.end), lifeline(X.B, 72, Y.end),
      actor(X.A, 28, aw, 'worker A'), actor(X.N, 28, aw, 'network'), actor(X.B, 28, aw, 'bank'),
      step(1, 'worker A sends pay; the request waits in the network',
        g({ anim: rise(0, { dx: -10, dy: 0 }) }, inflight(X.N + 8, Y.pay, Y.payB), msg(s, X.A, X.N, Y.pay, 'pay'),
          text(X.N + 16, Y.pay + 24, ph ? 'in flight' : 'pay, in flight', { anchor: 'start', cls: 'k-tick' }))),
      step(2, 'worker A asks; the question reaches the bank first',
        g({ anim: rise(1, { dx: -10, dy: 0 }) }, msg(s, X.A, X.N, Y.ask, 'ask'), msg(s, X.N, X.B, Y.askB, 'ask'))),
      step(3, 'the bank answers absent, truthfully, while pay is still in flight',
        g({ anim: rise(2, { dx: 10, dy: 0 }) }, inflight(X.N - 8, Y.abs, Y.read), msg(s, X.B, X.N, Y.abs, 'absent', { ret: true }),
          text(X.N - 16, Y.abs + 44, ph ? 'in flight' : 'absent, in flight', { anchor: 'end', cls: 'k-tick' }))),
      step(4, 'the payment request lands: the bank pays 50,000 euros and stores key 4471 at tick 0',
        g({ anim: rise(3, { dx: -10, dy: 0 }) }, msg(s, X.N, X.B, Y.payB, 'pay'), bankBox(Y.payBox, [`pays ${euro(50000)}`, 'key (4471, 0)'], 't3-card', 'k-num'))),
      step(5, 'two ticks pass, 24 hours, and the bank forgets the key',
        g({ anim: rise(4) }, text(ph ? 24 : 32, Y.band + 25, ph ? 'Tick, Tick: 24 h' : 'Tick, Tick: 24 hours pass', { anchor: 'start', cls: 'k-num' }),
          text(ph ? X.B - 4 : X.B + 16, Y.forgot, ph ? 'key forgotten' : 'key 4471 forgotten', { anchor: ph ? 'middle' : 'start', cls: 'k-tick' }))),
      step(6, 'worker A reads the old absent and sends pay again',
        g({ anim: rise(5, { dx: 10, dy: 0 }) }, msg(s, X.N, X.A, Y.read, 'absent', { ret: true }), msg(s, X.A, X.N, Y.pay2, 'pay'))),
      step(7, 'the bank pays 50,000 euros again',
        g({ anim: land(6) }, msg(s, X.N, X.B, Y.pay2B, 'pay', { tone: 'accent' }), bankBox(Y.box2, [`pays ${euro(50000)}`, 'again'], 'k-box-accent', 'k-num-accent'))),
    ];
  };

  const deadline = L => {
    const ph = L.phone;
    const X = t => (ph ? 40 + t * 72 : 176 + t * 120);
    const lane = 30, bh = 22;
    const after1 = X(1) + 6;
    const row = (oy, w, title) => {
      const ok = w < TTL;
      const y = n => oy + 28 + n * lane;
      const out = [text(16, oy + 14, title, { anchor: 'start', cls: 'k-name' })];
      const lbl = (n, s) => (ph ? '' : text(16, y(n) + 15, s, { anchor: 'start', cls: 'k-tick' }));
      out.push(lbl(0, 'send window'), span(X(0), X(w), y(0), bh, 't3-window', ph ? 'send' : 'send and resend', 'k-num-input'));
      out.push(lbl(1, 'key 4471'), span(X(0), X(TTL), y(1), bh, 't3-on', ph ? 'key kept' : 'key kept at least until tick 2', 'k-num'));
      if (ok) {
        out.push(lbl(2, 'late requests'), span(after1, X(4), y(2), bh, 't3-off', ph ? 'bank refuses them' : "bank refuses this window's requests", 'k-num'));
        out.push(lbl(3, 'after deadline'), span(after1, X(4), y(3), bh, 't3-off', ph ? 'ask; trust after 1' : 'ask; trust answers written after tick 1', 'k-num'));
        out.push(tickMark(X(0) + 6, y(4) + 10), label(X(0) + 18, y(4) + 15, `last payment ${w} < first forget ${TTL}`, 'k-num-ok', { anchor: 'start' }));
      } else {
        out.push(line(X(w), y(0) - 6, X(w), y(2), { cls: 't3-clash' }), cross(X(w), y(2) + 8),
          ph ? label(X(0), y(2) + 30, `pay and forget: both tick ${w}`, 'k-num-accent', { anchor: 'start' }) : [label(X(0), y(2) + 30, `last payment ${w} = first forget ${TTL}:`, 'k-num-accent', { anchor: 'start' }), label(X(w) + 16, y(2) + 30, 'same tick, either order', 'k-num-accent', { anchor: 'start' })]);
      }
      return out;
    };
    const yAxis = ph ? 376 : 372;
    return [
      [1, 2].map(t => line(X(t), 40, X(t), yAxis, { cls: 'k-guide' })),
      row(16, 1, ph ? 'Window 1 (12 h)' : 'Window 1: 12 hours'),
      row(ph ? 212 : 208, 2, ph ? 'Window 2 (24 h)' : 'Window 2: 24 hours'),
      line(X(0), yAxis, X(4), yAxis, { cls: 'k-axis' }),
      [0, 1, 2, 3, 4].map(t => g({},
        line(X(t), yAxis - 4, X(t), yAxis + 4, { cls: 'k-axis' }),
        text(X(t), yAxis + 18, ph ? String(t) : `tick ${t}`, { cls: 'k-tick' }),
        ph ? '' : text(X(t), yAxis + 36, ['Fri 17:00', 'Sat 05:00', 'Sat 17:00', 'Sun 05:00', 'Sun 17:00'][t], { cls: 'k-tick' }))),
      text(ph ? 16 : X(0), yAxis + (ph ? 44 : 60), ph ? 'now, in ticks of 12 h; claim at tick 0' : 'claim at tick 0; key stored no earlier than the claim; TTL 2', { anchor: 'start', cls: 'k-tick' }),
    ];
  };

  const freshAnswer = L => {
    const ph = L.phone;
    const X = t => (ph ? 40 + t * 70 : 168 + t * 112);
    const yW = ph ? 48 : 40, yN1 = ph ? 116 : 100, yN2 = ph ? 152 : 136, yK = ph ? 248 : 216, yAxis = ph ? 352 : 320;
    const lane = (y, s) => (ph ? text(16, y, s, { anchor: 'start', cls: 'k-tick' }) : text(16, y, s, { anchor: 'start', cls: 'k-name' }));
    return [
      [1, 2, 3, 4].map(t => line(X(t), 28, X(t), yAxis, { cls: 'k-guide' })),
      ph ? lane(yW - 8, 'worker A') : lane(yW + 16, 'worker A'),
      span(X(0), X(1), yW, 22, 't3-window', ph ? 'first' : 'first window', 'k-num-input'),
      span(X(2), X(3), yW, 22, 't3-window', ph ? 'second' : 'second window', 'k-num-input'),
      ph ? lane(yN1 - 20, 'network') : lane(yN1 + 5, 'network'),
      circle(X(2), yN1, 5, { cls: 't3-dot' }),
      label(X(2) + 12, yN1 + 5, ph ? '2 > 1: taken' : 'absent@2: 2 > 1, taken; second window opens', 'k-num', { anchor: 'start' }),
      circle(X(2), yN2, 5, { cls: 't3-dot' }),
      line(X(2) + 6, yN2, X(4) - 6, yN2, { cls: 't3-flight-accent' }),
      label((X(2) + X(4)) / 2, yN2 - 10, ph ? 'absent@2, in flight' : 'a second absent@2, in flight', 'k-num-accent'),
      circle(X(4), yN2, 5, { cls: 't3-ring-accent' }),
      ph ? lane(yK - 20, 'bank') : lane(yK + 16, 'bank'),
      span(X(2), X(4), yK, 22, 't3-on', ph ? '(4471, 2)' : 'key (4471, 2) kept', 'k-num'),
      label(X(2), yK + 40, ph ? 'pays' : 'pays at tick 2', 'k-tick'),
      label(ph ? 344 : X(4), yK + 40, 'forgotten', 'k-tick', { anchor: ph ? 'end' : 'middle' }),
      chip(ph ? 248 : X(4) - 54, yK + 52, ph ? 96 : 108, 'pays again', 'k-box-accent', 'k-num-accent'),
      ph ? g({},
        rect(16, yN2 + 16, 328, 40, { cls: 't3-rule', rx: 6 }),
        text(24, yN2 + 32, 'fix: m.at > deadline', { anchor: 'start', cls: 'k-num-input' }),
        text(24, yN2 + 48, 'at tick 4: 2 > 3 is false', { anchor: 'start', cls: 'k-num' }))
        : g({},
          line(X(4), yN2 + 6, X(4), yN2 + 20, { cls: 't3-lane' }),
          rect(X(1) + 40, yN2 + 20, X(4) + 88 - X(1) - 40, 44, { cls: 't3-rule', rx: 6 }),
          text(X(1) + 52, yN2 + 38, 'the fix believes absent only if m.at > deadline', { anchor: 'start', cls: 'k-num-input' }),
          text(X(1) + 52, yN2 + 56, 'at tick 4: 2 > 3 is false, written inside the second window', { anchor: 'start', cls: 'k-num' })),
      line(X(0), yAxis, X(4), yAxis, { cls: 'k-axis' }),
      [0, 1, 2, 3, 4].map(t => g({},
        line(X(t), yAxis - 4, X(t), yAxis + 4, { cls: 'k-axis' }),
        text(X(t), yAxis + 18, ph ? String(t) : `tick ${t}`, { cls: 'k-tick' }))),
      text(ph ? 16 : X(0), yAxis + (ph ? 40 : 40), ph ? 'now, in ticks; FixStale, 17 steps' : 'now, in ticks of 12 hours; FixStale (no m.at check), 17 steps', { anchor: 'start', cls: 'k-tick' }),
    ];
  };

  const css = [
    '.k-fig .t3-life { stroke: var(--ink-soft); stroke-width: var(--line-hair); stroke-dasharray: 3 3; opacity: 0.6; }',
    '.k-fig .t3-dash { stroke-dasharray: 5 4; }',
    '.k-fig .t3-strong { stroke: var(--ink); stroke-width: 2; }',
    '.k-fig .t3-halo { stroke: var(--paper); stroke-width: 7; }',
    '.k-fig .t3-lane { stroke: var(--ink-soft); stroke-width: var(--line-hair); }',
    '.k-fig .t3-dot { fill: var(--ink); }',
    '.k-fig .t3-ring { fill: var(--paper); stroke: var(--ink); stroke-width: var(--line-strong); stroke-dasharray: 2 2; }',
    '.k-fig .t3-ring-accent { fill: var(--paper); stroke: var(--accent); stroke-width: var(--line-mark); }',
    '.k-fig .t3-down { fill: var(--paper-2); stroke: var(--rule); stroke-width: var(--line-hair); }',
    '.k-fig .t3-key { fill: var(--paper-2); stroke: var(--ink); stroke-width: var(--line-strong); }',
    '.k-fig .t3-gone { stroke: var(--ink-soft); stroke-width: var(--line-strong); stroke-dasharray: 2 5; stroke-linecap: round; }',
    '.k-fig .t3-chip { fill: var(--paper-2); stroke: var(--ink); stroke-width: var(--line-hair); }',
    '.k-fig .t3-card { fill: var(--paper-2); stroke: var(--ink); stroke-width: var(--line-strong); }',
    '.k-fig .t3-dial { fill: var(--paper); stroke: var(--ink); stroke-width: var(--line-strong); }',
    '.k-fig .t3-notch { stroke: var(--ink-soft); stroke-width: var(--line-strong); }',
    '.k-fig .t3-hand { stroke: var(--ink); stroke-width: 2; stroke-linecap: round; fill: none; }',
    '.k-fig .t3-bracket { stroke: var(--ink-soft); stroke-width: var(--line-strong); fill: none; }',
    '.k-fig .t3-on { fill: var(--paper-2); stroke: var(--ink); stroke-width: var(--line-strong); }',
    '.k-fig .t3-off { fill: var(--paper); stroke: var(--ink-soft); stroke-width: var(--line-hair); stroke-dasharray: 4 3; }',
    '.k-fig .t3-window { fill: var(--input-soft); stroke: var(--input); stroke-width: var(--line-strong); }',
    '.k-fig .t3-clash { stroke: var(--accent); stroke-width: var(--line-mark); }',
    '.k-fig .t3-tick { stroke: var(--ok); stroke-width: var(--line-strong); fill: none; stroke-linecap: round; stroke-linejoin: round; }',
    '.k-fig .t3-band { fill: var(--paper-2); }',
    '.k-fig .t3-bar-open { fill: var(--paper-2); stroke: var(--ink-soft); stroke-width: var(--line-strong); stroke-dasharray: 4 3; }',
    '.k-fig .t3-flight { stroke: var(--ink); stroke-width: 2; stroke-dasharray: 6 4; }',
    '.k-fig .t3-flight-accent { stroke: var(--accent); stroke-width: 2; stroke-dasharray: 6 4; }',
    '.k-fig .t3-rule { fill: var(--paper); stroke: var(--input); stroke-width: var(--line-hair); stroke-dasharray: 4 3; }',
  ].join(' ');

  const fig = (name, wide, phone, title, desc, caption, body, stepsCount = 0) => ({
    name, w: 720, h: wide, phone: { w: 360, h: phone }, title, desc, caption, steps: stepsCount,
    eyebrow: 'Lesson 3 · the key the bank forgot', css, body: (kk, L) => body(L),
  });

  return [
    fig('weekend', 352, 372, 'A key that outlived its memory',
      'A timeline from Friday 17:00 to Monday 09:12. Worker A sends transfer 4471 on Friday, crashes, and its machine stays down until Monday, when it resumes and sends 4471 again. The bank keeps key 4471 for 24 hours, until Saturday 17:00, then forgets it, so it pays 50,000 euros on Friday and again on Monday.',
      'The bank kept key 4471 for 24 hours. Worker A came back after 64, sent the same key, and the bank paid €50,000 a second time.',
      weekend),
    fig('clock', 256, 664, 'Time moves only on Tick',
      "The weekend behavior as a strip of nine state cards, each with a dial for now. Claim, Send and Crash happen inside tick 0 and leave the dial alone; two Tick steps move it to 1 and then 2; Forget, Resume and Send happen at tick 2, and the last Send makes transfers 2.",
      'The weekend as states. Only the two Tick steps move the dial, each by 12 hours; every other step happens inside a tick, and as many of them as you like fit in one.',
      clock, 8),
    fig('timeout-guard', 300, 300, 'A timeout switches Forget on',
      'A time axis from tick 0 to tick 3. Forget for key 4471 stored at tick 0 is not enabled before tick 2 and enabled from tick 2 on; it may happen at tick 2, at tick 3, or never. From tick 2 on, a resend may pay twice.',
      'A timeout switches an action on; it does not force it. From tick 2 the bank may forget key 4471 at any moment, or never, and from then on a resend may pay twice.',
      timeoutGuard),
    fig('clock-bound', 360, 380, 'A short clock hides the weekend',
      'A bar chart of reachable states for MaxTime 0 to 6: 23, 62, 139, 238, 365, 514 and 685. With MaxTime 0 and 1 the model holds no double payout; from MaxTime 2, when now can reach TTL, TLC finds it. MaxTime 0 is lesson 2 desk with 23 states.',
      'Each extra tick adds states. MaxTime 0 and 1 have no double payout because the clock never reaches the key’s 24 hours; from MaxTime 2 on, every clock contains the weekend.',
      clockBound),
    fig('two-worlds', 400, 720, 'Two worlds, one view from A',
      'Two sequence diagrams with worker A, the network and the bank. In world 1 the network loses the payment request and transfers stay 0. In world 2 the bank pays and replies ok, the network loses the ok, and transfers are 1. In both, worker A sees the same thing: waiting, no reply.',
      'A lost request and a lost reply. The bank differs, 0 transfers or 1, but worker A sees exactly the same thing in both: waiting, no reply.',
      twoWorlds, 5),
    fig('stale-answer', 484, 544, 'True when written, false when read',
      'A sequence with worker A, the network and the bank. A sends pay and then asks; the question overtakes the payment, so the bank answers absent while pay is still in flight. Then pay lands and the bank pays 50,000 euros with key 4471 at tick 0. Two ticks pass and the key is forgotten. A reads the old absent, sends pay again, and the bank pays again.',
      'True when written, false when read. The bank answered “absent” while the payment was still in the network; by the time worker A read it, the money had moved and the key was gone.',
      staleAnswer, 7),
    fig('deadline', 440, 432, 'The window must end before the key can',
      'Two rows on a time axis from tick 0 to tick 4. With Window 1, sending is allowed from tick 0 to tick 1, the key is kept at least until tick 2, and after tick 1 the bank refuses the window’s requests and the worker reconciles. With Window 2, the window ends at tick 2, the same tick the key may be forgotten.',
      'Window 1 closes a tick before the bank may forget the key, so every request of the window that pays lands on it. Window 2 ends on the tick the key may vanish: same tick, either order.',
      deadline),
    fig('fresh-answer', 376, 408, 'An absent from the wrong window',
      'A timeline of the FixStale counterexample from tick 0 to tick 4. The first window runs from tick 0 to 1 and the second from tick 2 to 3. Two absent answers are written at tick 2; the first is taken and opens the second window, the other stays in flight. The bank pays at tick 2; at tick 4 the key is forgotten, A takes the old absent and the bank pays again. The fix rule m.at > deadline would reject it, since 2 > 3 is false.',
      'Both answers were written at tick 2. The first came after the first window closed and was right to trust; the other was read in the second window, and only the check m.at > deadline tells them apart.',
      freshAnswer),
  ];
};
