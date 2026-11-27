export default k => {
  const { g, line, path, rect, circle, text, masked, arrow, box, step } = k;

  const put = (t, i, v) => t.map((x, j) => (j === i ? v : x));
  const successors = (s, nW, nL, { cap = 1, bank = 'loan', counter = true, florist = [] } = {}) => {
    const [status, owner, pc, held, tr, keys, crashed, retries] = s;
    const out = [];
    const keyOf = l => (bank === 'account' && florist.includes(l) ? 'florist' : l);
    const pay = l => {
      if (bank === 'none') return [put(tr, l, tr[l] + 1), keys];
      const kk = keyOf(l);
      if (keys.includes(kk)) return [tr, keys];
      return [put(tr, l, tr[l] + 1), [...keys, kk].sort()];
    };
    for (let w = 0; w < nW; w++) {
      if (pc[w] === 'idle') {
        for (let l = 0; l < nL; l++) {
          if (status[l] === 'approved') out.push(['Claim', [put(status, l, 'claimed'), put(owner, l, w), put(pc, w, 'claimed'), put(held, w, l), tr, keys, crashed, retries]]);
          if (status[l] === 'claimed' && owner[l] === w) out.push(['Resume', [status, owner, put(pc, w, 'claimed'), put(held, w, l), tr, keys, crashed, retries]]);
        }
      }
      if (pc[w] === 'claimed') {
        const [tr2, k2] = pay(held[w]);
        out.push(['Send', [status, owner, put(pc, w, 'sent'), held, tr2, k2, crashed, retries]]);
        if (cap === null || retries < cap) out.push(['Lost', [status, owner, pc, held, tr2, k2, crashed, counter ? retries + 1 : retries]]);
      }
      if (pc[w] === 'sent') out.push(['Mark', [put(status, held[w], 'paid'), owner, put(pc, w, 'idle'), put(held, w, -1), tr, keys, crashed, retries]]);
      if (!crashed && pc[w] !== 'idle') out.push(['Crash', [status, owner, put(pc, w, 'idle'), put(held, w, -1), tr, keys, true, retries]]);
    }
    return out;
  };
  const init = (nW, nL) => [Array(nL).fill('approved'), Array(nL).fill(-1), Array(nW).fill('idle'), Array(nW).fill(-1), Array(nL).fill(0), [], false, 0];
  const id = s => JSON.stringify(s);
  const perms = n => (n <= 1 ? [[0]] : perms(n - 1).flatMap(p => range0(n).map(i => [...p.slice(0, i), n - 1, ...p.slice(i)])));
  const range0 = n => Array.from({ length: n }, (_, i) => i);
  const permute = (s, pw, pl) => {
    const [status, owner, pc, held, tr, keys, crashed, retries] = s;
    const byLoan = (t, f = x => x) => { const o = []; t.forEach((v, l) => { o[pl[l]] = f(v); }); return o; };
    const byWorker = (t, f = x => x) => { const o = []; t.forEach((v, w) => { o[pw[w]] = f(v); }); return o; };
    return [byLoan(status), byLoan(owner, w => (w < 0 ? -1 : pw[w])), byWorker(pc), byWorker(held, l => (l < 0 ? -1 : pl[l])), byLoan(tr), keys.map(x => pl[x]).sort(), crashed, retries];
  };
  const explore = (nW, nL, o = {}) => {
    const { symmetry = false, constraint = null, invariant = s => s[4].every(t => t <= 1), maxLevels = Infinity } = o;
    const group = symmetry ? perms(nW).flatMap(pw => perms(nL).map(pl => [pw, pl])) : null;
    const canon = s => (symmetry ? group.map(([pw, pl]) => id(permute(s, pw, pl))).sort()[0] : id(s));
    const s0 = init(nW, nL);
    const parent = new Map([[canon(s0), null]]);
    let frontier = [s0], generated = 1, depth = 1;
    const levels = [1];
    while (frontier.length && levels.length < maxLevels) {
      const next = [];
      for (const s of frontier) {
        if (constraint && !constraint(s)) continue;
        for (const [a, s2] of successors(s, nW, nL, o)) {
          generated++;
          const c2 = canon(s2);
          if (parent.has(c2)) continue;
          parent.set(c2, [canon(s), a]);
          if (!invariant(s2)) {
            const trace = [];
            for (let c = c2; parent.get(c); c = parent.get(c)[0]) trace.unshift(parent.get(c)[1]);
            return { bad: trace };
          }
          if (constraint && !constraint(s2)) { parent.delete(c2); continue; }
          next.push(s2);
        }
      }
      if (next.length) { levels.push(next.length); depth++; }
      frontier = next;
    }
    return { states: parent.size, generated, depth, levels, queue: frontier.length };
  };
  const expect = (what, got, want) => { if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`${what}: expected ${JSON.stringify(want)}, found ${JSON.stringify(got)}`); };

  const GROWTH = [[17, 85, 314, 997], [33, 327, 2379, 14325], [49, 727, 8218, 77845], [65, 1285, 19853, 261673]];
  [[0, 0], [0, 1], [0, 2], [0, 3], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2], [3, 0], [3, 1]]
    .forEach(([w, l]) => expect(`growth ${w + 1}x${l + 1}`, explore(w + 1, l + 1).states, GROWTH[w][l]));
  const BOUNDED = explore(3, 3);
  expect('bounded 3x3', [BOUNDED.states, BOUNDED.generated, BOUNDED.depth], [8218, 23752, 13]);
  const OPEN = explore(3, 3, { cap: null, maxLevels: 30 });
  expect('unbounded plateau', OPEN.levels.slice(11), Array(OPEN.levels.length - 11).fill(4983));
  const CUT = explore(3, 3, { cap: null, constraint: s => s[7] <= 1 });
  expect('constraint 3x3', [CUT.states, CUT.generated, CUT.depth], [8218, 28090, 13]);
  const SYM = [[2, 2, 327, 90], [3, 3, 8218, 323], [3, 4, 77845, 823], [4, 4, 261673, 968]];
  expect('symmetry 2x2, 3x3', [explore(2, 2, { symmetry: true }).states, explore(3, 3, { symmetry: true }).states], [90, 323]);
  ['1', '2', '3'].forEach(n => expect(`no key ${n}x${n}`, explore(+n, +n, { bank: 'none' }).bad, ['Claim', 'Lost', 'Send']));
  const paidMeansMoney = s => s[4].every(t => t <= 1) && s[0].every((st, l) => st !== 'paid' || s[4][l] === 1);
  const FLORIST = explore(3, 3, { bank: 'account', florist: [1, 2], invariant: paidMeansMoney });
  expect('florist trace', FLORIST.bad, ['Claim', 'Send', 'Claim', 'Send', 'Mark']);

  const SHAPES = ['claimed', 'idle', 'sent'];
  const RENAMINGS = perms(3).map(p => p.map(i => SHAPES[i]));
  expect('renamings of (claimed, idle, sent)', new Set(RENAMINGS.map(r => r.join())).size, 6);
  const REP = RENAMINGS.map(r => r.join()).sort()[0].split(',');
  expect('representative', REP, ['claimed', 'idle', 'sent']);

  const count = n => n.toLocaleString('en-US');
  const log = Math.log10;

  const T0 = 0.2, HOLD = 1.1, LEN = 0.6;
  const at = (i, extra = 0) => Number((T0 + i * HOLD + extra).toFixed(2));
  const rise = (i, o = {}) => ({ k: 'rise', d: at(i, o.extra || 0), len: o.len ?? LEN, dx: o.dx ?? 0, dy: o.dy ?? 8 });
  const land = (i, extra = 0) => ({ k: 'land', d: at(i, extra), len: LEN, s0: 1.12 });

  const stripes = slug => `<defs><pattern id="${slug}-stripe" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" class="t4-stripe-bg"/><line x1="0" y1="0" x2="0" y2="5" class="t4-stripe"/></pattern></defs>`;
  const SERIES = [
    ['1 worker', 't4-w1'],
    ['2 workers', 't4-w2'],
    ['3 workers', 't4-w3'],
    ['4 workers', 't4-w4'],
  ];
  const swatch = (slug, x, y, cls) => rect(x, y - 10, 20, 12, { cls, fill: cls === 't4-w2' ? `url(#${slug}-stripe)` : undefined });
  const ticks = (x0, perDecade, from, to, every, y, top, bottom) => {
    const out = [];
    for (let d = from; d <= to; d++) {
      const x = x0 + (d - from) * perDecade;
      out.push(line(x, top, x, bottom, { cls: 'k-grid' }));
      if ((d - from) % every === 0) out.push(text(x, y, count(10 ** d), { cls: 'k-tick' }));
    }
    return out;
  };

  const explosion = L => {
    const s = L.slug, ph = L.phone;
    const P = ph ? { x0: 24, per: 41, top: 64, pitch: 106, head: 0, bh: 14, gap: 4 } : { x0: 132, per: 78, top: 60, pitch: 92, head: 0, bh: 14, gap: 4 };
    const X = v => P.x0 + log(v) * P.per;
    const groupTop = l => P.top + l * P.pitch + (ph ? 14 : 0);
    const rowY = (l, w) => groupTop(l) + w * (P.bh + P.gap);
    const bottom = groupTop(3) + 4 * P.bh + 3 * P.gap + 8;
    const out = [stripes(s)];
    out.push(text(P.x0, ph ? 28 : 36, 'distinct states, log scale', { anchor: 'start', cls: 'k-tick' }));
    out.push(...ticks(P.x0, P.per, 0, 6, ph ? 2 : 1, bottom + 18, ph ? 44 : 48, bottom));
    out.push(line(P.x0, bottom, P.x0 + 6 * P.per, bottom, { cls: 'k-axis' }));
    out.push(line(P.x0, ph ? 44 : 48, P.x0, bottom, { cls: 'k-axis' }));
    [0, 1, 2, 3].forEach(l => {
      const name = `${l + 1} loan${l ? 's' : ''}`;
      out.push(ph ? text(P.x0 + 6, groupTop(l) - 6, name, { anchor: 'start', cls: 'k-name t4-halo' })
        : text(16, groupTop(l) + 2 * (P.bh + P.gap) + 4, name, { anchor: 'start', cls: 'k-name' }));
      [0, 1, 2, 3].forEach(w => {
        const v = GROWTH[w][l], y = rowY(l, w), [, cls] = SERIES[w];
        out.push(rect(P.x0, y, X(v) - P.x0, P.bh, { cls, fill: w === 1 ? `url(#${s}-stripe)` : undefined }));
        out.push(text(X(v) + 6, y + P.bh - 2, count(v), { anchor: 'start', cls: w === 2 ? 'k-num-accent' : 'k-num' }));
        if (w === 2 && l > 0) {
          const tx = X(10 * GROWTH[2][l - 1]);
          out.push(line(tx, y - 3, tx, y + P.bh + 3, { cls: 't4-ref' }));
        }
      });
    });
    const ly = bottom + (ph ? 52 : 56);
    if (ph) {
      SERIES.forEach(([name, cls], i) => {
        const x = 16 + (i % 2) * 168, y = ly + Math.floor(i / 2) * 24;
        out.push(swatch(s, x, y, cls), text(x + 28, y, name, { anchor: 'start', cls: 'k-label' }));
      });
      out.push(line(26, ly + 38, 26, ly + 54, { cls: 't4-ref' }),
        text(44, ly + 50, 'dashed tick: 10 × the 3-worker', { anchor: 'start', cls: 'k-label' }),
        text(44, ly + 68, 'count one loan earlier', { anchor: 'start', cls: 'k-label' }));
    } else {
      SERIES.forEach(([name, cls], i) => {
        const x = 16 + i * 140;
        out.push(swatch(s, x, ly, cls), text(x + 28, ly, name, { anchor: 'start', cls: 'k-label' }));
      });
      out.push(line(26, ly + 16, 26, ly + 32, { cls: 't4-ref' }),
        text(44, ly + 28, 'dashed tick: 10 × the 3-worker count one loan earlier', { anchor: 'start', cls: 'k-label' }));
    }
    return out;
  };

  const counter = L => {
    const s = L.slug, ph = L.phone;
    const C = ph ? { x0: 56, pitch: 10, bw: 7, cols: 26, chipW: 132, chips: 2, gap: 36 } : { x0: 72, pitch: 18, bw: 12, cols: 28, chipW: 136, chips: 4, gap: 36 };
    const out = [];
    out.push(text(16, 24, ph ? 'one worker, the reply lost again and again' : 'one worker at claimed, the reply lost again and again: (pc, transfers, retries)', { anchor: 'start', cls: 'k-tick' }));
    range0(C.chips).forEach(i => {
      const x = 16 + i * (C.chipW + C.gap);
      out.push(rect(x, 40, C.chipW, 32, { cls: 't4-chip', rx: 4 }));
      out.push(text(x + C.chipW / 2, 60, `('claimed', 1, ${i})`, { cls: 'k-num' }));
      out.push(text(x + C.chipW / 2, 90, 'new', { cls: 'k-tick' }));
      if (i < C.chips - 1) {
        out.push(arrow(s, [[x + C.chipW + 2, 56], [x + C.chipW + C.gap - 2, 56]]));
      }
    });
    const lastX = 16 + C.chips * (C.chipW + C.gap) - C.gap;
    out.push(arrow(s, [[lastX + 2, 56], [lastX + 18, 56]]), text(lastX + 28, 60, '…', { cls: 'k-name' }));
    out.push(text(16, 114, ph ? 'each arrow is a lost reply: retries + 1' : 'each arrow is a lost reply: retries goes up by 1, nothing else changes', { anchor: 'start', cls: 'k-tick' }));

    const H = ph ? 84 : 96;
    const Y = (base, v) => base - v / 5000 * H;
    const colX = i => C.x0 + i * C.pitch;
    const strip = (base, title, sub) => [
      text(16, base - H - 40, title, { anchor: 'start', cls: 'k-name' }),
      text(16, base - H - 20, sub, { anchor: 'start', cls: 'k-tick' }),
      line(C.x0 - 4, Y(base, 5000), C.x0 + C.cols * C.pitch, Y(base, 5000), { cls: 'k-grid' }),
      line(C.x0 - 4, base, C.x0 + C.cols * C.pitch, base, { cls: 'k-axis' }),
      text(C.x0 - 10, base + 4, '0', { anchor: 'end', cls: 'k-tick' }),
      text(C.x0 - 10, Y(base, 5000) + 4, '5,000', { anchor: 'end', cls: 'k-tick' }),
    ];
    const cols = (base, vals, from, cls) => vals.map((v, i) => rect(colX(from + i), Y(base, v), C.bw, base - Y(base, v), { cls }));

    const b1 = ph ? 280 : 290;
    const b2 = ph ? 450 : 486;
    out.push(strip(b1, 'bounded: at most one lost reply', 'new states at each level of the search'));
    out.push(step(1, `bounded desk: the levels grow to ${count(Math.max(...BOUNDED.levels))} new states, then shrink`,
      g({ anim: rise(0, { dx: -8, dy: 0 }) }, cols(b1, BOUNDED.levels, 0, 't4-col'))));
    const endX = colX(BOUNDED.levels.length) + 4;
    out.push(step(2, `the queue empties after ${BOUNDED.levels.length} levels: ${count(BOUNDED.states)} states`,
      g({ anim: rise(1, { dx: -8, dy: 0 }) },
        text(endX, b1 - 24, 'queue empty: 0 left', { anchor: 'start', cls: 'k-num-ok' }),
        text(endX, b1 - 6, `${count(BOUNDED.states)} states, depth ${BOUNDED.depth}`, { anchor: 'start', cls: 'k-num' }))));

    out.push(strip(b2, 'unbounded: retries counts forever', 'new states at each level of the search'));
    const open = OPEN.levels.slice(0, C.cols);
    const chunks = [[0, 6], [6, 11], [11, 16], [16, 21], [21, C.cols]];
    chunks.forEach(([a, b], i) => out.push(step(3 + i,
      i === 0 ? 'unbounded desk: the levels grow' : i === 1 ? `the levels reach ${count(4983)} new states` : 'and stay there, level after level',
      g({ anim: rise(2 + i * 0.6, { dx: -8, dy: 0 }) }, cols(b2, open.slice(a, b), a, 't4-col')))));
    const plateauY = Y(b2, 4983);
    const runX = colX(C.cols) + 2;
    out.push(step(8, 'the queue never empties: depth about 550 when the clock stopped, and climbing',
      g({ anim: rise(5, { dx: -8, dy: 0 }) },
        text(runX + 8, plateauY + 4, '…', { anchor: 'start', cls: 'k-name-accent' }),
        ph ? [
          text(16, b2 + 26, 'about 5,000 new states every level;', { anchor: 'start', cls: 'k-note-accent' }),
          text(16, b2 + 48, 'depth about 550, and climbing', { anchor: 'start', cls: 'k-note-accent' }),
        ] : [
          text(C.x0, b2 + 26, 'about 5,000 new states every level, so the queue never empties', { anchor: 'start', cls: 'k-note-accent' }),
          arrow(s, [[C.x0 + 452, b2 + 40], [C.x0 + 600, b2 + 40]], { tone: 'accent' }),
          text(C.x0 + 444, b2 + 45, 'depth about 550, and climbing', { anchor: 'end', cls: 'k-note-accent' }),
        ])));
    out.push(text(16, L.H - 12, ph ? 'one column per level, left to right' : 'left to right: breadth-first levels, one column each', { anchor: 'start', cls: 'k-tick' }));
    return out;
  };

  const symmetry = L => {
    const s = L.slug, ph = L.phone;
    const out = [];
    const rowX = 16, rowW = 180, rowH = 24, rowP = 30, top = 76;
    const colsX = [46, 106, 166].map(x => x + rowX - 16);
    const rows = [...RENAMINGS].sort((a, b) => a.join().localeCompare(b.join()));
    const card = { x: 252, y: top + (5 * rowP + rowH) / 2 - 40, w: ph ? 92 : 88, h: 80 };
    const midY = card.y + card.h / 2;
    out.push(text(16, 28, 'one desk state, six names', { anchor: 'start', cls: 'k-name' }));
    out.push(text(16, 46, 'pc of each worker, three workers', { anchor: 'start', cls: 'k-tick' }));
    ['A', 'B', 'C'].forEach((n, i) => out.push(text(colsX[i], top - 8, n, { cls: 'k-name' })));
    const rowBox = (x, y, r, rep) => g({},
      rect(x, y, rowW, rowH, { cls: rep ? 't4-row-rep' : 't4-chip', rx: 4 }),
      r.map((v, i) => text(x - rowX + colsX[i], y + 16, v, { cls: rep ? 'k-num-accent' : 'k-num' })));
    out.push(step(1, 'the six renamings of claimed, idle and sent over workers A, B and C',
      g({ anim: rise(0) }, rows.map((r, i) => rowBox(rowX, top + i * rowP, r, r.join() === REP.join())))));
    out.push(path(`M${rowX + rowW + 6} ${top}H${rowX + rowW + 14}V${top + 5 * rowP + rowH}H${rowX + rowW + 6}`, { cls: 't4-bracket' }));
    out.push(arrow(s, [[rowX + rowW + 14, midY], [card.x - 2, midY]], { tone: 'accent' }));
    out.push(step(2, 'all six collapse onto one state',
      g({ cls: 'k-ghost', anim: { k: 'flash', d: at(1), len: 1.2 } },
        rows.map((r, i) => g({ anim: { k: 'move', d: at(1), len: 1.2, dx: rowX - card.x, dy: top + i * rowP - (midY - rowH / 2) } },
          rowBox(card.x, midY - rowH / 2, r, false))))));
    out.push(step(3, 'the representative: A claimed, B idle, C sent, the smallest of the six',
      g({ anim: land(2.2) },
        rect(card.x, card.y, card.w, card.h, { cls: 'k-mask-box', rx: 6 }),
        rect(card.x, card.y, card.w, card.h, { cls: 'k-box-accent', rx: 6 }),
        REP.map((v, i) => text(card.x + 12, card.y + 24 + i * 20, `${'ABC'[i]} ${v}`, { anchor: 'start', cls: 'k-num' })),
        text(card.x + card.w / 2, card.y + card.h + 20, 'kept', { cls: 'k-name-accent' }),
        text(card.x + card.w / 2, card.y + card.h + 38, 'the smallest', { cls: 'k-tick' }))));
    out.push(text(16, top + 6 * rowP + 14, '6 renamings, 1 state kept', { anchor: 'start', cls: 'k-tick' }));

    const R = ph ? { ox: 0, oy: 296, lab: 16, x0: 72, per: 46 } : { ox: 0, oy: 0, lab: 384, x0: 444, per: 44 };
    const rTop = R.oy + 76;
    const X = v => R.x0 + (log(v) - 1) * R.per;
    const gTop = i => rTop + i * 48;
    const axisY = gTop(3) + 36;
    out.push(text(R.lab, R.oy + 28, 'distinct states, TLC', { anchor: 'start', cls: 'k-name' }));
    out.push(text(R.lab, R.oy + 46, 'log scale', { anchor: 'start', cls: 'k-tick' }));
    out.push(...ticks(R.x0, R.per, 1, 6, 2, axisY + 18, rTop - 10, axisY));
    out.push(line(R.x0, axisY, R.x0 + 5 * R.per, axisY, { cls: 'k-axis' }));
    out.push(line(R.x0, rTop - 10, R.x0, axisY, { cls: 'k-axis' }));
    const bars = (which, cls, numCls) => SYM.map(([w, l, without, withSym], i) => {
      const v = which ? withSym : without, y = gTop(i) + (which ? 16 : 0);
      return g({}, rect(R.x0, y, X(v) - R.x0, 12, { cls }), text(X(v) + 6, y + 11, count(v), { anchor: 'start', cls: numCls }));
    });
    SYM.forEach(([w, l], i) => out.push(text(R.lab, gTop(i) + 18, `${w} × ${l}`, { anchor: 'start', cls: 'k-name' })));
    out.push(step(4, 'without symmetry: 327, 8,218, 77,845 and 261,673 states', g({ anim: rise(3.2, { dx: -8, dy: 0 }) }, bars(0, 't4-w1', 'k-num'))));
    out.push(step(5, 'with SYMMETRY Perms: 90, 323, 823 and 968 states', g({ anim: rise(4, { dx: -8, dy: 0 }) }, bars(1, 't4-w4', 'k-num'))));
    const ly = axisY + 50;
    out.push(rect(R.lab, ly - 10, 20, 12, { cls: 't4-w1' }), text(R.lab + 28, ly, 'without symmetry', { anchor: 'start', cls: 'k-label' }));
    out.push(rect(R.lab + (ph ? 172 : 160), ly - 10, 20, 12, { cls: 't4-w4' }), text(R.lab + (ph ? 200 : 188), ly, 'with SYMMETRY', { anchor: 'start', cls: 'k-label' }));
    return out;
  };

  const constraint = L => {
    const s = L.slug, ph = L.phone;
    const xs = ph ? [116, 172, 228, 284, 340] : [176, 288, 400, 512, 624];
    const rows = ph ? { r0: 32, r1: 112, cut: 172, r2: 212, fogTop: 238, fogBot: 356 } : { r0: 32, r1: 112, cut: 168, r2: 208, fogTop: 236, fogBot: 332 };
    const lost = [1, 2];
    const R = 7;
    const out = [];
    const right = L.W - 16;
    const dot = (x, y, cls) => circle(x, y, R, { cls });
    const across = (y, from, to) => range0(to - from).map(i => arrow(s, [[xs[from + i] + R + 2, y], [xs[from + i + 1] - R - 3, y]]));
    const down = (y1, y2, js, o = {}) => js.map(j => arrow(s, [[xs[j], y1 + R + 2], [xs[j], y2 - R - 3]], o));
    [['retries 0', rows.r0], ['retries 1', rows.r1], ['retries 2', rows.r2]].forEach(([t, y]) => out.push(text(16, y + 4, t, { anchor: 'start', cls: 'k-tick' })));
    out.push(rect(ph ? 96 : 152, rows.fogTop, right - (ph ? 96 : 152), rows.fogBot - rows.fogTop, { cls: 't4-fog', rx: 6 }));
    out.push(text(16, rows.fogTop + 30, 'retries 3,', { anchor: 'start', cls: 'k-tick t4-cut-text' }));
    out.push(text(16, rows.fogTop + 48, '4, …', { anchor: 'start', cls: 'k-tick t4-cut-text' }));
    lost.forEach(j => {
      out.push(line(xs[j], rows.r2 + R + 2, xs[j], rows.fogTop + 22 - R, { cls: 't4-cut-line' }));
      out.push(circle(xs[j], rows.fogTop + 22, R, { cls: 't4-cut-dot' }));
      out.push(line(xs[j], rows.fogTop + 22 + R, xs[j], rows.fogTop + 48 - R, { cls: 't4-cut-line' }));
      out.push(circle(xs[j], rows.fogTop + 48, R, { cls: 't4-cut-dot' }));
    });
    out.push(text(right - 12, rows.fogBot - (ph ? 34 : 14), ph ? 'never looked at:' : 'never looked at: lose every reply forever', { anchor: 'end', cls: 'k-note-accent' }));
    if (ph) out.push(text(right - 12, rows.fogBot - 12, 'lose every reply forever', { anchor: 'end', cls: 'k-note-accent' }));
    out.push(...across(rows.r0, 0, 4), ...down(rows.r0, rows.r1, lost));
    out.push(...across(rows.r1, 1, 4), ...down(rows.r1, rows.r2, lost));
    xs.forEach(x => out.push(dot(x, rows.r0, 't4-dot')));
    xs.slice(1).forEach(x => out.push(dot(x, rows.r1, 't4-dot')));
    lost.forEach(j => {
      out.push(dot(xs[j], rows.r2, 't4-hollow'));
      out.push(path(`M${xs[j] + 12} ${rows.r2 - 1}L${xs[j] + 16} ${rows.r2 + 3}L${xs[j] + 23} ${rows.r2 - 5}`, { cls: 't4-tick' }));
    });
    out.push(line(16, rows.cut, right, rows.cut, { cls: 't4-cutline' }));
    out.push(text(16, rows.cut - 26, 'CONSTRAINT Bounds', { anchor: 'start', cls: 'k-num-accent' }));
    out.push(text(16, rows.cut - 8, 'retries ≤ 1', { anchor: 'start', cls: 'k-num-accent' }));
    const noteX = ph ? 116 : xs[3] - 12;
    out.push(text(noteX, rows.r2 + (ph ? -2 : 4), ph ? '' : 'built, invariant checked,', { anchor: 'start', cls: 'k-label' }));
    out.push(text(noteX, rows.r2 + (ph ? 0 : 22), ph ? '' : 'no step taken', { anchor: 'start', cls: 'k-label' }));
    const ly = rows.fogBot + (ph ? 40 : 32);
    const items = [
      ['t4-dot', 'explored: TLC steps from it'],
      ['t4-hollow', 'generated and checked, no step'],
      ['t4-cut-dot', 'cut: not generated'],
    ];
    items.forEach(([cls, t], i) => {
      const x = ph ? 16 : [16, 260, 540][i], y = ph ? ly + i * 22 : ly;
      out.push(circle(x + 8, y - 4, R, { cls }), text(x + 24, y, t, { anchor: 'start', cls: 'k-label' }));
    });
    const ay = ph ? ly + 3 * 22 : ly + 24;
    out.push(arrow(s, [[16, ay - 4], [42, ay - 4]]), text(52, ay, 'any step but Lost', { anchor: 'start', cls: 'k-label' }));
    out.push(arrow(s, [[ph ? 216 : 252, ay - 12], [ph ? 216 : 252, ay + 4]]), text(ph ? 228 : 264, ay, 'Lost: retries + 1', { anchor: 'start', cls: 'k-label' }));
    const ny = ay + 30;
    out.push(text(16, ny, ph ? `3 × 3: ${count(CUT.states)} distinct, ${count(CUT.generated)} generated` : `3 × 3: ${count(CUT.states)} distinct states, ${count(CUT.generated)} generated; the bound in the spec generates ${count(BOUNDED.generated)}`, { anchor: 'start', cls: 'k-num' }));
    if (ph) out.push(text(16, ny + 20, `the bound in the spec: ${count(BOUNDED.generated)} generated`, { anchor: 'start', cls: 'k-num' }));
    return out;
  };

  const smallScope = L => {
    const s = L.slug, ph = L.phone;
    const names = ['Claim', 'Send', 'Claim', 'Send', 'Mark'];
    const S = ph ? { x0: 16, w: 56, pitch: 68, h: 40 } : { x0: 16, w: 76, pitch: 96, h: 40 };
    const bx = i => S.x0 + i * S.pitch;
    const out = [];
    const strip = (y, last) => names.map((n, i) => {
      if (i === 4 && last === 'faded') {
        return g({ cls: 'k-faint' }, rect(bx(i), y, S.w, S.h, { cls: 't4-ghostbox', rx: 6 }), text(bx(i) + S.w / 2, y + 25, n, { cls: 'k-name' }));
      }
      return box(bx(i), y, S.w, S.h, { name: n, cls: i === 4 && last === 'bad' ? 'k-box-accent' : 'k-box' });
    });
    const links = (y, upto) => range0(upto).map(i => arrow(s, [[bx(i) + S.w + 2, y + S.h / 2], [bx(i + 1) - 3, y + S.h / 2]]));
    const yA = 92, yB = ph ? 252 : 236;
    out.push(names.map((_, i) => text(bx(i) + S.w / 2, yA - 10, `step ${i + 1}`, { cls: 'k-tick' })));
    out.push(text(16, 28, ph ? 'both vans, no budget' : 'the florist desk, both vans, no budget', { anchor: 'start', cls: 'k-name' }));
    out.push(text(16, 48, `PaidMeansMoney fails at step 5, ${count(1035)} states`, { anchor: 'start', cls: 'k-tick' }));
    out.push(links(yA, 4), strip(yA, 'bad'));
    out.push(text(bx(4) + S.w, yA + S.h + 22, ph ? 'van 2 paid, 0 transfers' : 'second van marked paid, 0 transfers', { anchor: 'end', cls: 'k-note-accent' }));
    out.push(text(16, yB - 40, ph ? 'same desk, CONSTRAINT Budget' : 'the same desk with CONSTRAINT Budget', { anchor: 'start', cls: 'k-name' }));
    out.push(text(16, yB - 20, ph ? 'level < 4: 232 kept, depth 4' : 'Budget == TLCGet("level") < 4: 232 states kept, depth 4', { anchor: 'start', cls: 'k-tick' }));
    out.push(links(yB, 3), strip(yB, 'faded'));
    const wallX = bx(4) - (S.pitch - S.w) / 2;
    out.push(line(wallX, yB - 8, wallX, yB + S.h + 8, { cls: 't4-wall' }));
    const st = ph ? { x: 16, y: yB + S.h + 24, w: 328 } : { x: wallX - 150, y: yB + S.h + 24, w: 300 };
    out.push(rect(st.x, st.y, st.w, 48, { cls: 't4-stamp', rx: 4 }),
      text(st.x + st.w / 2, st.y + 20, 'No error has been found.', { cls: 'k-num' }),
      text(st.x + st.w / 2, st.y + 38, '0 states left on queue', { cls: 'k-num' }));
    out.push(text(bx(4) + S.w / 2, yB + S.h + 16, ph ? '' : 'never taken', { cls: 'k-tick' }));
    out.push(text(bx(3) + S.w / 2, yB + S.h + 16, ph ? '' : 'cut here', { cls: 'k-tick' }));

    const side = ph ? { x: 16, y: st.y + 96, w: 328 } : { x: 520, y: 16, w: 184 };
    out.push(text(side.x, side.y + 12, ph ? 'no key: same bug at every size' : 'no key, every size', { anchor: 'start', cls: 'k-name' }));
    out.push(text(side.x, side.y + 32, ph ? 'NoDoublePayout fails at step 3' : 'NoDoublePayout fails', { anchor: 'start', cls: 'k-tick' }));
    if (!ph) out.push(text(side.x, side.y + 50, 'at step 3', { anchor: 'start', cls: 'k-tick' }));
    [['1 × 1', 8], ['2 × 2', 23], ['3 × 3', 62]].forEach(([size, n], i) => {
      const y = side.y + (ph ? 56 : 68) + i * (ph ? 52 : 60);
      out.push(text(side.x, y + 12, size, { anchor: 'start', cls: 'k-name' }));
      out.push(text(side.x + side.w, y + 12, `${n} states`, { anchor: 'end', cls: 'k-num' }));
      ['Claim', 'Lost', 'Send'].forEach((a, j) => {
        const cw = ph ? 100 : 56, cx = side.x + j * (cw + (side.w - 3 * cw) / 2);
        out.push(rect(cx, y + 20, cw, 22, { cls: 't4-chip', rx: 4 }), text(cx + cw / 2, y + 35, a, { cls: 'k-num' }));
      });
    });
    return out;
  };

  const css = [
    '.k-fig .t4-w1 { fill: var(--paper); stroke: var(--ink); stroke-width: var(--line-hair); }',
    '.k-fig .t4-w2 { stroke: var(--ink-soft); stroke-width: var(--line-hair); }',
    '.k-fig .t4-stripe-bg { fill: var(--paper); }',
    '.k-fig .t4-stripe { stroke: var(--ink-soft); stroke-width: 2; }',
    '.k-fig .t4-w3 { fill: var(--accent); }',
    '.k-fig .t4-w4 { fill: var(--ink); }',
    '.k-fig .t4-ref { stroke: var(--ink); stroke-width: var(--line-strong); stroke-dasharray: 3 2; }',
    '.k-fig .t4-chip { fill: var(--paper-2); stroke: var(--rule); stroke-width: var(--line-hair); }',
    '.k-fig .t4-row-rep { fill: var(--accent-soft); stroke: var(--accent); stroke-width: var(--line-hair); }',
    '.k-fig .t4-col { fill: var(--ink-soft); }',
    '.k-fig .t4-bracket { stroke: var(--ink-soft); stroke-width: var(--line-hair); fill: none; }',
    '.k-fig .t4-dot { fill: var(--ink); }',
    '.k-fig .t4-hollow { fill: var(--paper); stroke: var(--ink); stroke-width: var(--line-strong); }',
    '.k-fig .t4-tick { stroke: var(--ink); stroke-width: var(--line-strong); fill: none; stroke-linecap: round; stroke-linejoin: round; }',
    '.k-fig .t4-fog { fill: var(--paper-2); }',
    '.k-fig .t4-cut-dot { fill: none; stroke: var(--ink-soft); stroke-width: var(--line-hair); stroke-dasharray: 2 2; opacity: 0.7; }',
    '.k-fig .t4-cut-line { stroke: var(--ink-soft); stroke-width: var(--line-hair); stroke-dasharray: 2 3; opacity: 0.7; }',
    '.k-fig .t4-cut-text { opacity: 0.8; }',
    '.k-fig .t4-cutline { stroke: var(--accent); stroke-width: var(--line-strong); stroke-dasharray: 6 4; }',
    '.k-fig .t4-wall { stroke: var(--accent); stroke-width: var(--line-mark); }',
    '.k-fig .t4-ghostbox { fill: none; stroke: var(--ink-soft); stroke-width: var(--line-hair); stroke-dasharray: 4 3; }',
    '.k-fig .t4-halo { paint-order: stroke; stroke: var(--paper); stroke-width: var(--line-mark); stroke-linejoin: round; }',
    '.k-fig .t4-stamp { fill: var(--paper); stroke: var(--ink); stroke-width: var(--line-strong); }',
  ].join(' ');

  const fig = (name, wide, phone, title, desc, caption, body, stepsCount = 0) => ({
    name, w: 720, h: wide, phone: { w: 360, h: phone }, title, desc, caption, steps: stepsCount,
    eyebrow: 'Lesson 4 · a desk too big to check', css, body: (kk, L) => body(L),
  });

  return [
    fig('explosion', 520, 610, 'Each loan multiplies the states',
      'Horizontal bars on a log scale: distinct states for 1 to 4 workers and 1 to 4 loans with at most one lost reply. One loan: 17, 33, 49, 65. Two loans: 85, 327, 727, 1,285. Three loans: 314, 2,379, 8,218, 19,853. Four loans: 997, 14,325, 77,845, 261,673. A dashed tick on each three-worker bar marks ten times the count one loan earlier.',
      'Distinct states from TLC, at most one lost reply per run, on a log scale, so equal steps to the right mean equal multiples. Each loan pushes every bar right: with three workers it multiplies the count by 15, then 11, then 9.5, close to the ×10 ticks.',
      explosion),
    fig('counter', 582, 540, 'A queue that never drains',
      'Top: the state (claimed, 1, retries) after each lost reply, each one new. Below, the number of new states at each level of the breadth-first search for three workers and three loans. With at most one lost reply the levels rise to 1,878 and fall to 27, and the queue empties after 13 levels and 8,218 states. With retries unbounded the levels rise to 4,983 and stay there, level after level, so the depth keeps climbing.',
      'Each level of the search is one column. With a bound, the columns rise and fall to nothing: the queue empties. With an unbounded counter they settle at about 5,000 and never stop, because every lap of the retry loop is a new state.',
      counter, 8),
    fig('symmetry', 330, 610, 'Six names, one state',
      'Left: the six ways to give the pcs claimed, idle and sent to workers A, B and C, gathered into one kept representative, A claimed, B idle, C sent. Right: distinct states without and with SYMMETRY Perms, on a log scale: 2 by 2, 327 and 90; 3 by 3, 8,218 and 323; 3 by 4, 77,845 and 823; 4 by 4, 261,673 and 968.',
      'Renaming the workers never changes what can happen, so the checker keeps one state for all six names. Over workers and loans together, that turns 261,673 states into 968.',
      symmetry, 5),
    fig('constraint', 430, 540, 'What a constraint cuts',
      'The state graph in rows by retries. Rows retries 0 and 1 are explored, joined by other steps across and Lost steps down. A dashed line marks CONSTRAINT Bounds, retries at most 1. The states with retries 2 are generated and checked against the invariant, and TLC takes no step from them. Below them, retries 3, 4 and on, never looked at, including losing every reply forever. At 3 by 3: 8,218 distinct states, 28,090 generated, against 23,752 with the bound in the spec.',
      'TLC builds the states just past the line and checks the invariant on them, then stops. Everything after them, including a bank that loses every reply forever, is never looked at, and the output only hints at it through the generated count.',
      constraint),
    fig('small-scope', 380, 720, 'One step past the edge',
      'Top: on the florist desk with both vans, Claim, Send, Claim, Send, Mark; at step 5 PaidMeansMoney fails, the second van paid with no transfer. Middle: the same desk with CONSTRAINT Budget, TLCGet level less than 4, keeps the states up to three steps deep (depth 4), takes the fourth step, checks the states it reaches against the invariant and cuts them, and never takes the fifth; TLC prints No error has been found and 0 states left on queue, after 232 states. Side: without the key the bug is Claim, Lost, Send at 1 by 1, 2 by 2 and 3 by 3, with 8, 23 and 62 states.',
      'The budget stops the search one step before the bug, and the run then looks exactly like a pass. Beside it, a bigger desk finds the same three-step bug, just after more states.',
      smallScope),
  ];
};
