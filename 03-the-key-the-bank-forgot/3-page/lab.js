/* Clock and lifetime rulers adapted from the iwrzwr visual archive, Delay Vernier study; messages in flight from Packet Stitch; the draining window from Context Lease. MIT License, Copyright (c) 2026 Kagan Yaldizkaya. */
const ClockDesk = (() => {
  const NAMES = 'ABC';
  const TIMED = new Set(['fix', 'deadline']);

  const insert = (arr, v) => (arr.includes(v) ? arr : [...arr, v].sort());
  const remove = (arr, v) => arr.filter(x => x !== v);
  const swap = (arr, out, add) => insert(remove(arr, out), add);
  const insertNum = (arr, v) => (arr.includes(v) ? arr : [...arr, v].sort((a, b) => a - b));
  const kind = m => m.split(':')[0];
  const field = m => Number(m.split(':')[1]);

  const initial = n => ({ now: 0, status: 'approved', owner: 'nobody', dl: 0, pc: Array(n).fill('idle'), net: [], t: 0, keys: [], crashed: false });
  const keyOf = s => `${s.now}|${s.status}|${s.owner}|${s.dl}|${s.pc.join(',')}|${s.net.join(',')}|${s.t}|${s.keys.join(',')}|${s.crashed ? 1 : 0}`;
  const known = s => s.keys.length > 0;

  function steps(s, cfg) {
    const { spec, n, maxTime, ttl = 2, window: wLen = 1, fresh = true, refuse = true } = cfg;
    const timed = TIMED.has(spec), out = [];
    const S = change => ({ ...s, ...change });
    const add = (a, work, next, extra = {}) => out.push({ a, work, next, ...extra });
    if (s.now < maxTime) add('Tick', false, S({ now: s.now + 1 }));
    s.keys.forEach(k => { if (s.now >= k + ttl) add('Forget', false, S({ keys: remove(s.keys, k) }), { k }); });
    if (spec !== 'clock' && spec !== 'clockask') {
      s.net.forEach(m => {
        if (kind(m) === 'pay') {
          if (timed && refuse && s.now > field(m)) add('Deliver', false, S({ net: remove(s.net, m) }), { m, refused: true });
          else if (known(s)) add('Deliver', false, S({ net: swap(s.net, m, 'ok') }), { m });
          else add('Deliver', false, S({ net: swap(s.net, m, 'ok'), t: s.t + 1, keys: insertNum(s.keys, s.now) }), { m, paid: true });
        }
        if (m === 'ask') {
          const reply = s.t > 0 ? 'found' : spec === 'fix' ? `absent:${s.now}` : 'absent';
          add('Answer', false, S({ net: swap(s.net, m, reply) }), { m, reply });
        }
        add('Drop', false, S({ net: remove(s.net, m) }), { m });
      });
    }
    for (let i = 0; i < n; i++) {
      const w = NAMES[i], p = s.pc[i];
      const put = v => s.pc.map((x, j) => (j === i ? v : x));
      const wadd = (a, next, extra) => add(a, true, next, { w: i, ...extra });
      if (p === 'idle' && s.status === 'approved') wadd('Claim', S({ status: 'claimed', owner: w, pc: put('claimed'), ...(timed ? { dl: s.now + wLen } : {}) }));
      if (p === 'idle' && s.status === 'claimed' && s.owner === w) {
        const to = { clock: 'claimed', lossy: 'claimed', clockask: 'looking' }[spec] || 'waiting';
        wadd('Resume', S({ pc: put(to) }));
      }
      if (p === 'idle' && s.status === 'paid') wadd('Skip', S({ pc: put('done') }));
      if (p === 'claimed') {
        if (spec === 'clock' || spec === 'clockask') {
          if (known(s)) wadd('Send', S({ pc: put('sent') }));
          else wadd('Send', S({ pc: put('sent'), t: s.t + 1, keys: insertNum(s.keys, s.now) }), { paid: true });
        } else if (spec === 'lossy' || spec === 'ask') wadd('Send', S({ net: insert(s.net, `pay:${s.now}`), pc: put('waiting') }));
        else if (s.now <= s.dl) wadd('Send', S({ net: insert(s.net, `pay:${s.dl}`), pc: put('waiting') }));
      }
      if (p === 'waiting' && spec === 'lossy') wadd('Retry', S({ pc: put('claimed') }));
      if (p === 'waiting' && timed && s.now <= s.dl) wadd('Retry', S({ pc: put('claimed') }));
      if (spec === 'ask' && (p === 'waiting' || p === 'asking')) wadd('AskBank', S({ net: insert(s.net, 'ask'), pc: put('asking') }));
      if (spec === 'fix' && (p === 'claimed' || p === 'waiting' || p === 'asking') && s.now > s.dl) wadd('AskBank', S({ net: insert(s.net, 'ask'), pc: put('asking') }));
      if (s.owner === w) {
        if (spec === 'lossy' && (p === 'claimed' || p === 'waiting') && s.net.includes('ok')) wadd('GotOk', S({ net: remove(s.net, 'ok'), pc: put('sent') }), { m: 'ok' });
        if (spec === 'ask' || TIMED.has(spec)) {
          const okFrom = spec === 'ask' ? ['waiting', 'asking'] : ['claimed', 'waiting', 'asking'];
          if (okFrom.includes(p)) s.net.forEach(m => { if (m === 'ok' || m === 'found') wadd('GotOk', S({ net: remove(s.net, m), pc: put('sent') }), { m }); });
          if (p === 'asking') {
            s.net.forEach(m => {
              if (kind(m) !== 'absent') return;
              if (spec === 'ask') wadd('GotAbsent', S({ net: remove(s.net, m), pc: put('claimed') }), { m });
              else if (!fresh || field(m) > s.dl) wadd('GotAbsent', S({ net: remove(s.net, m), dl: s.now + wLen, pc: put('claimed') }), { m });
            });
          }
        }
      }
      if (p === 'looking') wadd('Lookup', S({ pc: put(s.t > 0 ? 'sent' : 'claimed') }));
      if (p === 'sent') wadd('Mark', S({ status: 'paid', pc: put('done') }));
      const holding = { clock: ['claimed', 'sent'], clockask: ['claimed', 'looking', 'sent'], lossy: ['claimed', 'waiting', 'sent'] }[spec] || ['claimed', 'waiting', 'asking', 'sent'];
      if (!s.crashed && holding.includes(p)) add('Crash', false, S({ pc: put('idle'), crashed: true }), { w: i });
    }
    return out;
  }

  const labelOf = st => (st.w === undefined ? st.a : `${st.a}(${NAMES[st.w]})`);

  function* exploring(cfg, chunk = 2500) {
    const start = initial(cfg.n);
    const states = [start], parent = [-1], via = [null], seen = new Map([[keyOf(start), 0]]);
    let firstBad = -1, firstDead = -1, deadEnds = 0, maxTransfers = 0;
    for (let head = 0; head < states.length; head++) {
      const s = states[head];
      if (s.t > maxTransfers) maxTransfers = s.t;
      if (firstBad < 0 && s.t > 1) firstBad = head;
      const next = steps(s, cfg);
      if (s.status !== 'paid' && !next.some(x => x.work)) { deadEnds++; if (firstDead < 0) firstDead = head; }
      next.forEach(st => {
        const k = keyOf(st.next);
        if (seen.has(k)) return;
        seen.set(k, states.length);
        states.push(st.next); parent.push(head); via.push(st);
      });
      if (head % chunk === chunk - 1) yield states.length;
    }
    const trace = end => {
      const out = [];
      for (let i = end; i >= 0; i = parent[i]) out.unshift({ step: via[i], state: states[i] });
      return out;
    };
    return { cfg, count: states.length, maxTransfers, deadEnds, double: firstBad >= 0 ? trace(firstBad) : null, dead: firstDead >= 0 ? trace(firstDead) : null };
  }

  function explore(cfg) {
    const it = exploring(cfg);
    for (;;) { const r = it.next(); if (r.done) return r.value; }
  }

  return { NAMES, initial, keyOf, steps, explore, exploring, labelOf, kind, field };
})();

if (typeof module === 'object' && module.exports) module.exports = ClockDesk;
else (() => {
  const K = window.Kit, D = ClockDesk, NAMES = D.NAMES;
  const SVG = 'http://www.w3.org/2000/svg';
  const AMOUNT = 50000;
  const DAYS = ['Fri 17:00', 'Sat 05:00', 'Sat 17:00', 'Sun 05:00', 'Sun 17:00'];
  const num = n => n.toLocaleString('en-US');
  const euros = n => `€${num(n)}`;
  const clamp = (n, a = 0, b = 1) => Math.min(b, Math.max(a, n));
  const mix = (a, b, p) => a + (b - a) * p;
  const easeOut = t => (t >= 1 ? 1 : 1 - 2 ** (-10 * t));
  const figText = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--text-fig')) || 12;
  const hasNet = spec => spec !== 'clock' && spec !== 'clockask';
  const timed = spec => spec === 'fix' || spec === 'deadline';

  function brush(s) {
    const { ctx } = s, dpr = s.dpr || 1, size = Math.max(13, figText());
    const snapFor = width => { const offset = Math.round(width * dpr) % 2 ? 0.5 : 0; return v => (Math.round(v * dpr - offset) + offset) / dpr; };
    const ink = (alpha, color) => { ctx.globalAlpha = clamp(alpha); ctx.fillStyle = color; ctx.strokeStyle = color; };
    const b = {
      size,
      rect(x, y, w, h, color, alpha = 1) { ink(alpha, color); ctx.fillRect(Math.round(x * dpr) / dpr, Math.round(y * dpr) / dpr, Math.max(1 / dpr, Math.round(w * dpr) / dpr), Math.round(h * dpr) / dpr); ctx.globalAlpha = 1; },
      line(points, color, { alpha = 1, width = 1, dashed = false } = {}) {
        if (points.length < 2) return;
        const snap = snapFor(width);
        ink(alpha, color); ctx.lineWidth = width; ctx.lineCap = 'butt'; ctx.lineJoin = 'miter'; ctx.setLineDash(dashed ? [2, 4] : []);
        ctx.beginPath(); points.forEach(([x, y], i) => (i ? ctx.lineTo(snap(x), snap(y)) : ctx.moveTo(snap(x), snap(y)))); ctx.stroke();
        ctx.setLineDash([]); ctx.globalAlpha = 1;
      },
      box(x, y, w, h, color, opts = {}) { b.line([[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]], color, opts); },
      marker(x, y, color, sz = 4, alpha = 1) { b.rect(x - sz / 2, y - sz / 2, sz, sz, color, alpha); },
      text(str, x, y, opts = {}) { s.pen.text(str, x, y, { size, ...opts }); },
      width(str, font = 'mono') {
        const family = getComputedStyle(document.documentElement).getPropertyValue(font === 'mono' ? '--font-mono' : '--font-ui').trim();
        ctx.font = `400 ${size}px ${family}`; return ctx.measureText(str).width;
      },
    };
    return b;
  }

  function animator(target, draw) {
    const run = { value: 0, to: 0, rate: 1, done: null };
    const loop = K.loop(target, dt => {
      run.value = Math.min(run.to, run.value + dt * run.rate);
      draw();
      if (run.value >= run.to) { loop.stop(); const done = run.done; run.done = null; if (done) done(); }
    });
    run.go = (from, to, rate, done) => {
      Object.assign(run, { value: from, to, rate, done });
      if (K.reduced.matches) { run.value = to; draw(); run.done = null; if (done) done(); return; }
      draw(); loop.start();
    };
    run.stop = () => { loop.stop(); run.done = null; };
    return run;
  }

  const CLOCK_SPAN = 3;
  function clockGeometry(w) {
    const pad = w < 420 ? 34 : 44;
    return { x: t => pad + (w - 2 * pad) * t / CLOCK_SPAN, ruler: 54, key: 134, pay: 226, height: 282, pad };
  }

  function drawClock(s, view) {
    const { c, w } = s, b = brush(s), g = clockGeometry(w), st = view.state, now = view.nowShown;
    b.text('clock', 0, 16, { align: 'left', color: c.ink, font: 'ui', weight: 500 });
    b.line([[g.x(0), g.ruler], [g.x(CLOCK_SPAN), g.ruler]], c.ink, { alpha: 0.4 });
    for (let h = 0; h <= CLOCK_SPAN * 12; h++) {
      const x = g.x(h / 12), major = h % 12 === 0, half = h % 6 === 0;
      b.rect(x, g.ruler - (major ? 12 : half ? 8 : 5), 1, major ? 12 : half ? 8 : 5, c.ink, major ? 0.85 : 0.4);
    }
    for (let t = 0; t <= CLOCK_SPAN; t++) {
      const align = t === 0 ? 'left' : t === CLOCK_SPAN ? 'right' : 'center', dx = t === 0 ? -6 : t === CLOCK_SPAN ? 6 : 0;
      b.text(w < 420 ? DAYS[t].replace(':00', 'h') : DAYS[t], g.x(t) + dx, g.ruler + 18, { align, color: t <= view.maxTime ? c.soft : c.rule });
    }
    if (view.maxTime < CLOCK_SPAN) {
      const x0 = g.x(view.maxTime), x1 = g.x(CLOCK_SPAN);
      b.rect(x0 + 2, g.ruler - 14, x1 - x0, 16, c.paper2, 0.9);
      b.line([[x0, g.ruler - 22], [x0, g.ruler + 4]], c.ink, { alpha: 0.7 });
      b.text('the model’s clock stops', x1, g.ruler + 36, { align: 'right', color: c.soft, font: 'ui' });
    }
    const nx = g.x(now);
    b.line([[nx, g.ruler - 22], [nx, g.ruler + 4]], c.input, { width: 2 });
    b.marker(nx, g.ruler - 22, c.input, 7);
    const nowLabel = `now = ${st.now}`, lw = b.width(nowLabel);
    const flip = nx + 8 + lw + 6 > w;
    b.text(nowLabel, flip ? nx - 8 : nx + 8, g.ruler - 30, { align: flip ? 'right' : 'left', color: c.input, weight: 500 });

    b.text('key 4471 at the bank', 0, g.key - 34, { align: 'left', color: c.ink, font: 'ui', weight: 500 });
    view.forgotten.forEach(f => {
      const x0 = g.x(f.stored), x1 = g.x(f.at), label = `(4471, ${f.stored}) forgotten`, fw = b.width(label);
      b.box(x0, g.key - 12, Math.max(x1 - x0, 2), 10, c.soft, { dashed: true });
      b.text(label, clamp(mix(x0, x1, 0.5), fw / 2, w - fw / 2), g.key + (st.keys.length ? 44 : 26), { color: c.accentInk, weight: 500 });
    });
    if (st.keys.length) {
      const k = st.keys[0], x0 = g.x(k), xKeep = g.x(Math.min(k + 2, CLOCK_SPAN)), x1 = g.x(CLOCK_SPAN), old = st.now >= k + 2;
      for (let h = 0; k + h / 12 <= CLOCK_SPAN; h++) {
        const x = g.x(k + h / 12), day = h === 24, half = h % 12 === 0;
        b.rect(x, g.key, 1, day ? 12 : half ? 8 : 4, day && old ? c.accent : c.ink, day ? 1 : half ? 0.7 : 0.35);
      }
      b.box(x0, g.key - 12, xKeep - x0, 10, c.ink, { alpha: 0.75 });
      b.rect(x0, g.key - 12, xKeep - x0, 10, c.ink, 0.1);
      if (xKeep < x1) b.line([[xKeep, g.key - 7], [x1, g.key - 7]], old ? c.accent : c.soft, { dashed: true, width: old ? 1.5 : 1 });
      const kept = w < 420 ? 'kept 24 h' : `stored at ${k}: kept 24 h`, kw = b.width(kept);
      b.text(kept, clamp(mix(x0, xKeep, 0.5), kw / 2, w - kw / 2), g.key + 26, { color: c.ink });
      if (k + 2 <= CLOCK_SPAN) {
        b.text(old ? 'may forget now' : 'may forget from here', x1, g.key - 18, { align: 'right', color: old ? c.accentInk : c.soft, weight: old ? 500 : 400 });
      }
    } else if (!view.forgotten.length) b.text('no key yet: nothing paid', g.x(0), g.key - 4, { align: 'left', color: c.soft });

    b.text('transfers', 0, g.pay - 26, { align: 'left', color: c.ink, font: 'ui', weight: 500 });
    view.pays.forEach((p, i) => {
      const again = i > 0, label = again ? `${euros(AMOUNT)} again` : euros(AMOUNT), cw = b.width(label) + 16;
      const cx = clamp(g.x(p.at), cw / 2, w - cw / 2), y = g.pay - 10 + i * 26;
      b.box(cx - cw / 2, y, cw, 20, again ? c.accent : c.ink, { alpha: again ? 1 : 0.7, width: again ? 1.5 : 1 });
      if (again) b.rect(cx - cw / 2, y, cw, 20, c.accentSoft, 0.8);
      b.text(label, cx, y + 14, { color: again ? c.accentInk : c.ink, weight: again ? 500 : 400 });
      b.line([[g.x(p.at), g.ruler + 24], [g.x(p.at), y]], again ? c.accent : c.ink, { alpha: 0.3, dashed: true });
    });
    if (!view.pays.length) b.text('none yet', g.x(0), g.pay + 4, { align: 'left', color: c.soft });
  }

  function svgEl(name, attrs = {}, text) {
    const el = document.createElementNS(SVG, name);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    if (text !== undefined) el.textContent = text;
    return el;
  }

  function msgName(m, spec) {
    const k = D.kind(m);
    if (k === 'pay') return timed(spec) ? `pay by ${D.field(m)}` : `pay@${D.field(m)}`;
    if (k === 'absent' && m.includes(':')) return `absent at ${D.field(m)}`;
    return m;
  }

  function rowOf(item, before, spec, narrow) {
    const st = item.step, after = item.state, who = st.w;
    const paidAgain = after.t > 1 && before.t <= 1;
    switch (st.a) {
      case 'Tick': return { kind: 'tick', text: narrow ? `+12 h, ${DAYS[after.now]}` : `12 hours pass: ${DAYS[after.now]}` };
      case 'Forget': return { kind: 'note', at: 'bank', text: narrow ? 'forgets key' : `forgets key (stored ${st.k})`, strong: true };
      case 'Claim': return { kind: 'note', at: who, text: timed(spec) ? `Claim, deadline ${after.dl}` : 'Claim' };
      case 'GotAbsent': return { kind: 'arrow', from: 'net', to: who, text: `${narrow ? '' : 'reads '}${msgName(st.m, spec)}${timed(spec) && !narrow ? `, deadline ${after.dl}` : ''}` };
      case 'GotOk': return { kind: 'arrow', from: 'net', to: who, text: `${narrow ? '' : 'reads '}${st.m}` };
      case 'AskBank': return { kind: 'arrow', from: who, to: 'net', text: 'ask' };
      case 'Answer': return { kind: 'arrow', from: 'bank', to: 'net', text: msgName(st.reply, spec) };
      case 'Drop': return { kind: 'lost', at: 'net', text: `lost: ${msgName(st.m, spec)}` };
      case 'Deliver': {
        const text = st.refused ? (narrow ? 'refused' : 'too late: refused') : st.paid ? (paidAgain ? (narrow ? 'pays again' : `pays ${euros(AMOUNT)} again`) : (narrow ? 'pays' : `pays ${euros(AMOUNT)}`)) : (narrow ? 'no money' : 'key known: ok, no money');
        return { kind: 'arrow', from: 'net', to: 'bank', text, bad: paidAgain };
      }
      case 'Send':
        if (!hasNet(spec)) {
          const text = st.paid ? (paidAgain ? (narrow ? 'pays again' : `Send: pays ${euros(AMOUNT)} again`) : (narrow ? 'pays' : `Send: pays ${euros(AMOUNT)}`)) : (narrow ? 'no money' : 'Send: key known, no money');
          return { kind: 'arrow', from: who, to: 'bank', text, bad: paidAgain };
        }
        return { kind: 'arrow', from: who, to: 'net', text: msgName(after.net.find(m => !before.net.includes(m)) || (timed(spec) ? `pay:${after.dl}` : `pay:${before.now}`), spec) };
      case 'Mark': return { kind: 'note', at: who, text: 'Mark: paid' };
      default: return { kind: 'note', at: who, text: st.a };
    }
  }

  function drawTrace(host, uid, trace, spec) {
    const width = Math.max(280, Math.round(host.getBoundingClientRect().width) || 320), narrow = width < 520;
    const net = hasNet(spec), rows = trace.length - 1;
    const used = [...new Set(trace.slice(1).map(x => x.step.w).filter(w => w !== undefined))].sort();
    if (!used.length) used.push(0);
    const actors = [...used.map(i => ({ id: i, name: narrow ? NAMES[i] : `worker ${NAMES[i]}` })), ...(net ? [{ id: 'net', name: 'network' }] : []), { id: 'bank', name: 'bank' }];
    const gutter = narrow ? 44 : 60, right = narrow ? 34 : 64, first = gutter + (narrow ? 22 : 40);
    const step = (width - first - right) / Math.max(1, actors.length - 1);
    const xOf = id => first + actors.findIndex(a => a.id === id) * step;
    const top = 30, pitch = 30, yOf = i => top + 24 + i * pitch, height = yOf(rows) + 8;
    const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, width, height, role: 'img', 'aria-label': `Timeline of the behavior: ${trace.slice(1).map(x => D.labelOf(x.step)).join(', ')}.` });
    const defs = svgEl('defs');
    [['arrow', 'k-head'], ['arrow-bad', 'k-head k-head-bad']].forEach(([id, cls]) => {
      const m = svgEl('marker', { id: `${uid}-${id}`, markerWidth: 8, markerHeight: 6, refX: 7, refY: 3, orient: 'auto' });
      m.append(svgEl('polygon', { points: '0 0, 8 3, 0 6', class: cls }));
      defs.append(m);
    });
    svg.append(defs);
    actors.forEach(a => {
      const x = xOf(a.id), half = Math.max(18, a.name.length * 3.9 + 8);
      svg.append(svgEl('line', { x1: x, y1: 22, x2: x, y2: height - 2, class: 'k-life', 'stroke-dasharray': '3 3' }));
      const g = svgEl('g', { class: 'k-actor' });
      g.append(svgEl('rect', { x: x - half, y: 1, width: half * 2, height: 21, rx: 4 }));
      g.append(svgEl('text', { x, y: 16, 'text-anchor': 'middle' }, a.name));
      svg.append(g);
    });
    svg.append(svgEl('text', { x: 2, y: top + 8, class: 'k-time' }, `now ${trace[0].state.now}`));
    const masked = (text, x, y, anchor, cls = '') => {
      const tw = text.length * 7.3, rx = anchor === 'start' ? x - 2 : anchor === 'end' ? x - tw - 2 : x - tw / 2 - 2;
      svg.append(svgEl('rect', { x: rx, y: y - 11, width: tw + 4, height: 14, rx: 2, class: 'k-mask' }));
      svg.append(svgEl('text', { x, y, 'text-anchor': anchor, class: cls }, text));
    };
    if (timed(spec)) {
      used.forEach(w => {
        let open = -1;
        const close = end => { if (open < 0) return; svg.append(svgEl('rect', { x: xOf(w) - 4, y: yOf(open) - 6, width: 8, height: Math.max(8, end - yOf(open) + 6), class: 'k-window' })); open = -1; };
        trace.slice(1).forEach((item, i) => {
          if (item.step.w === w && (item.step.a === 'Claim' || item.step.a === 'GotAbsent')) { close(yOf(i) - 6); open = i; }
          else if (open >= 0 && item.state.now > item.state.dl && item.state.owner === NAMES[w]) close(yOf(i) - 4);
        });
        close(height - 4);
      });
    }
    if (net) {
      const live = new Map(), slots = [];
      const xNet = xOf('net');
      const drawPacket = (m, slot, from, to) => {
        const x = xNet + 6 + slot * 10, y1 = yOf(from) - 4, y2 = Math.max(y1 + 8, to);
        svg.append(svgEl('rect', { x, y: y1, width: 7, height: y2 - y1, rx: 1, class: 'k-packet' }));
        for (let y = y1 + 4; y < y2 - 2; y += 4) svg.append(svgEl('line', { x1: x + 2, y1: y, x2: x + 5, y2: y, class: 'k-packet-mark' }));
      };
      trace.slice(1).forEach((item, i) => {
        const before = trace[i].state.net, after = item.state.net;
        before.filter(m => !after.includes(m)).forEach(m => { const p = live.get(m); drawPacket(m, p.slot, p.from, yOf(i)); slots[p.slot] = false; live.delete(m); });
        after.filter(m => !before.includes(m)).forEach(m => { let slot = slots.findIndex(x => !x); if (slot < 0) slot = slots.length; slots[slot] = true; live.set(m, { slot, from: i }); });
      });
      live.forEach(p => drawPacket(null, p.slot, p.from, height - 4));
    }
    trace.slice(1).forEach((item, i) => {
      const r = rowOf(item, trace[i].state, spec, narrow), y = yOf(i);
      if (r.kind === 'tick') {
        svg.append(svgEl('line', { x1: gutter - 4, y1: y, x2: width - 4, y2: y, class: 'k-tickline' }));
        svg.append(svgEl('text', { x: 2, y: y + 4, class: 'k-time' }, `now ${item.state.now}`));
        masked(r.text, mix(first, width - right, 0.5), y + 4, 'middle', 'k-strong');
        return;
      }
      if (r.kind === 'note' || r.kind === 'lost') {
        const x = xOf(r.at), last = r.at === 'bank';
        if (r.kind === 'lost') {
          svg.append(svgEl('line', { x1: x - 5, y1: y - 5, x2: x + 5, y2: y + 5, class: 'k-lost' }));
          svg.append(svgEl('line', { x1: x + 5, y1: y - 5, x2: x - 5, y2: y + 5, class: 'k-lost' }));
        } else svg.append(svgEl('circle', { cx: x, cy: y, r: 3, class: 'k-head' }));
        masked(r.text, last ? x - 10 : x + 10, y + 4, last ? 'end' : 'start', r.kind === 'lost' ? 'k-bad' : r.strong ? 'k-strong' : '');
        return;
      }
      const x1 = xOf(r.from), x2 = xOf(r.to), toRight = x2 > x1;
      svg.append(svgEl('line', { x1: x1 + (toRight ? 4 : -4), y1: y, x2: x2 + (toRight ? -4 : 4), y2: y, class: `k-msg${r.bad ? ' k-bad' : ''}`, 'marker-end': `url(#${uid}-${r.bad ? 'arrow-bad' : 'arrow'})` }));
      masked(r.text, toRight ? x1 + 8 : x1 - 8, y - 6, toRight ? 'start' : 'end', r.bad ? 'k-bad' : '');
    });
    host.replaceChildren(svg);
  }

  function fillStrip(ol, trace, spec) {
    ol.replaceChildren(...trace.map((x, i) => {
      const li = document.createElement('li'), s = x.state;
      if (s.t > 1) li.classList.add('k-bad');
      if (x.step && x.step.a === 'Tick') li.classList.add('k-tick');
      const rows = [[`${i} · ${x.step ? D.labelOf(x.step) : 'start'}`, 'k-card-step'], [`now ${s.now}`], ...s.pc.map((p, w) => [`${NAMES[w]} ${p}`])];
      if (timed(spec) && s.status !== 'approved') rows.push([`deadline ${s.dl}`]);
      if (hasNet(spec)) rows.push([`net {${s.net.map(m => msgName(m, spec)).join(', ')}}`]);
      rows.push([`keys {${s.keys.map(k => `(4471, ${k})`).join(', ')}}`], [`transfers ${s.t}`, 'k-card-t']);
      rows.forEach(([text, cls]) => { const span = document.createElement('span'); span.textContent = text; if (cls) span.className = cls; li.append(span); });
      return li;
    }));
  }

  function lamps(ul, items) {
    ul.replaceChildren(...items.map(([state, text]) => { const li = document.createElement('li'); li.className = 'k-lamp'; li.dataset.state = state; li.textContent = text; return li; }));
  }

  function predict(root, { question, options, right, explain, onAnswered, hold = null }) {
    const q = document.createElement('p'); q.className = 'k-q'; q.textContent = question;
    const row = document.createElement('div'); row.className = 'row'; row.setAttribute('role', 'group'); row.setAttribute('aria-label', question);
    const fb = document.createElement('p'); fb.className = 'k-feedback'; fb.tabIndex = -1; fb.setAttribute('aria-live', 'polite');
    const buttons = options.map(([value, label]) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = label;
      b.addEventListener('click', () => {
        buttons.forEach(x => { x.disabled = true; });
        b.setAttribute('aria-pressed', 'true');
        const show = () => {
          if (value === right) { b.classList.add('k-right'); fb.textContent = `Right. ${explain.right}`; }
          else { b.classList.add('k-missed'); fb.classList.add('k-bad'); fb.textContent = `Not “${label}”. ${explain[value]}`; }
        };
        if (hold) { fb.textContent = `Noted: “${label}”. ${hold}`; reveal = show; } else show();
        onAnswered(value);
      });
      return b;
    });
    row.append(...buttons);
    root.replaceChildren(q, row, fb);
    let reveal = null;
    return { reveal() { if (reveal) { reveal(); reveal = null; } } };
  }

  function specLines(p) {
    const ask = p.waiting === 'ask', dl = p.deadline > 0, fresh = ask && dl && p.fresh;
    const lines = [{ text: `Workers ≜ {${NAMES.slice(0, p.workers).split('').map(n => `"${n}"`).join(', ')}}    MaxTime = ${p.clock} (${p.clock * 12} h)    TTL = 2 (24 h)` }];
    if (dl) {
      lines.push({ text: `Window = ${p.deadline} (${p.deadline * 12} h)`, changed: true });
      lines.push({ text: 'Claim(w)     ≜ … ∧ deadline′ = now + Window', changed: true });
      lines.push({ text: 'Send(w)      ≜ pc[w] = "claimed" ∧ now ≤ deadline', changed: true });
      lines.push({ text: '                ∧ net′ = net ∪ {[kind ↦ "pay", by ↦ deadline]}', changed: true });
      lines.push({ text: 'Deliver(m)   ≜ m.kind = "pay" ∧ IF now > m.by THEN refuse it', changed: true });
      lines.push({ text: '                ELSE pay unless Known, reply [kind ↦ "ok"]', changed: true });
    } else {
      lines.push({ text: 'Send(w)      ≜ pc[w] = "claimed" ∧ net′ = net ∪ {[kind ↦ "pay", sent ↦ now]}' });
      lines.push({ text: 'Deliver(m)   ≜ m.kind = "pay" ∧ pay unless Known, reply [kind ↦ "ok"]' });
    }
    if (!ask) lines.push({ text: `Retry(w)     ≜ pc[w] = "waiting"${dl ? ' ∧ now ≤ deadline' : ''} ∧ pc′[w] = "claimed"`, changed: dl });
    else if (!dl) {
      lines.push({ text: 'AskBank(w)   ≜ pc[w] ∈ {"waiting", "asking"} ∧ net′ = net ∪ {[kind ↦ "ask"]}', changed: true });
      lines.push({ text: 'GotAbsent(w) ≜ pc[w] = "asking" ∧ ∃ m ∈ net : m.kind = "absent" ∧ pc′[w] = "claimed"', changed: true });
    } else {
      lines.push({ text: 'Retry(w)     ≜ pc[w] = "waiting" ∧ now ≤ deadline ∧ pc′[w] = "claimed"', changed: true });
      lines.push({ text: 'AskBank(w)   ≜ pc[w] ∈ {"claimed", "waiting", "asking"} ∧ now > deadline', changed: true });
      lines.push({ text: '                ∧ net′ = net ∪ {[kind ↦ "ask"]}', changed: true });
      lines.push({ text: `GotAbsent(w) ≜ pc[w] = "asking" ∧ ∃ m ∈ net : m.kind = "absent"${fresh ? ' ∧ m.at > deadline' : ''}`, changed: true });
      lines.push({ text: '                ∧ deadline′ = now + Window ∧ pc′[w] = "claimed"', changed: true });
    }
    return lines;
  }

  const cfgOf = p => {
    const ask = p.waiting === 'ask', dl = p.deadline > 0;
    return { spec: dl ? (ask ? 'fix' : 'deadline') : (ask ? 'ask' : 'lossy'), n: p.workers, maxTime: p.clock, window: dl ? p.deadline : 1, fresh: ask && dl ? Boolean(p.fresh) : true };
  };
  const deskId = cfg => `${cfg.spec}|${cfg.window}|${cfg.fresh}`;

  function mount(host, mode) {
    host.replaceChildren(document.getElementById('clock-lab').content.cloneNode(true));
    const uid = `${host.id}-`, $ = k => host.querySelector(`[data-k="${k}"]`);
    host.querySelectorAll('[data-k]').forEach(el => { el.id = uid + el.dataset.k; });
    const traceHost = $('trace-seq');
    let shownTrace = null;
    let resizeQueued = 0;
    new ResizeObserver(() => {
      if (resizeQueued) return;
      resizeQueued = requestAnimationFrame(() => { resizeQueued = 0; if (shownTrace && traceHost.offsetParent) drawTrace(traceHost, `${uid}t`, shownTrace.trace, shownTrace.spec); });
    }).observe(host);

    function showTrace(title, trace, spec) {
      $('trace').hidden = false;
      $('trace-title').textContent = title;
      shownTrace = { trace, spec };
      drawTrace(traceHost, `${uid}t`, trace, spec);
      $('trace-key').textContent = hasNet(spec)
        ? `Time runs down; a dashed line is a Tick, 12 hours. The small boxes beside the network’s line are messages in flight, from the step that sent each one to the step that took it out.${timed(spec) ? ' A blue bar on a worker’s line is its window, from Claim or a believed “absent” until its deadline passes.' : ''}`
        : 'Time runs down; a dashed line is a Tick, 12 hours. An arrow is a step between a worker and the bank.';
      fillStrip($('trace-strip'), trace, spec);
    }
    const hideTrace = () => { $('trace').hidden = true; shownTrace = null; };

    if (mode === 'explore') return explore();
    return fix();

    function explore() {
      ['task', 'panel', 'spec-note', 'spec', 'win', 'progress'].forEach(k => { $(k).hidden = true; });
      const st = { predicted: false, maxTime: 3, best: {}, view: null };
      const cfg = () => ({ spec: 'clock', n: 2, maxTime: st.maxTime, ttl: 2 });
      const checked = {};
      const checker = () => (checked[st.maxTime] = checked[st.maxTime] || D.explore(cfg()));
      const fresh = () => { const s = D.initial(2); st.state = s; st.trail = [{ step: null, state: s }]; st.view = { from: 0, to: 0 }; };
      fresh();

      const view = () => {
        const pays = [], last = { forgotten: [] };
        st.trail.forEach((x, i) => {
          if (x.step && x.step.paid) pays.push({ at: st.trail[i - 1].state.now });
          if (x.step && x.step.a === 'Forget') last.forgotten.push({ stored: x.step.k, at: x.state.now });
        });
        return { state: st.state, maxTime: st.maxTime, pays, forgotten: last.forgotten, nowShown: mix(st.view.from, st.view.to, easeOut(clockAnim ? clockAnim.value : 1)) };
      };
      let clockAnim = null;
      const desk = K.stage($('desk'), s => drawClock(s, view()), { height: () => clockGeometry(1).height });
      clockAnim = animator($('desk'), () => desk.redraw());
      clockAnim.value = 1;

      function why() {
        const s = st.state, n = st.trail.length - 1, next = D.steps(s, cfg());
        if (!st.predicted) return 'Answer the question above to unlock the scheduler.';
        if (s.t > 1) return `Paid twice in ${n} steps: the bakery has ${euros(2 * AMOUNT)}. The second Send found no key, because the clock had passed the key’s 24 hours.${n > (checker().double || []).length - 1 ? ' Reset to look for a shorter schedule.' : ' No schedule is shorter: the checker agrees.'}`;
        if (!n) return 'You are the scheduler: each button is a step the desk may take now. Tick moves the clock 12 hours, and nothing else.';
        if (!next.length) return `No step is possible after ${n} steps, and the bakery was paid ${s.t === 1 ? 'once' : 'nothing'}. Reset to try another schedule.`;
        if (s.keys.length && next.some(x => x.a === 'Forget')) return 'Key 4471 is 24 hours old: the bank may forget it now. It doesn’t have to.';
        if (s.keys.length && s.keys[0] + 2 > st.maxTime) return `The bank holds key 4471, stored at tick ${s.keys[0]}. It could forget it at tick ${s.keys[0] + 2} at the earliest, but this model’s clock stops at tick ${st.maxTime}.`;
        if (s.keys.length) return `The bank holds key 4471, stored at tick ${s.keys[0]}. It may forget it only once the key is 24 hours old, at tick ${s.keys[0] + 2}.`;
        const last = st.trail[n].step, who = last.w === undefined ? '' : NAMES[last.w];
        if (last.a === 'Resume') return `Resume(${who}): worker ${who} found its own claim and is ready to send again. ${s.keys.length ? 'The bank still holds key 4471.' : 'The bank holds no key for 4471.'}`;
        if (last.a === 'Crash') return `Crash(${who}): worker ${who} went down before Mark, and the loan stays claimed in its name.`;
        if (s.t === 1) return 'The bank has forgotten key 4471, but not the payment. The next Send is a brand new transfer as far as the bank can tell.';
        if (s.now >= st.maxTime) return 'The model’s clock has stopped: no more Tick in this model.';
        return `Step ${n}: ${D.labelOf(st.trail[n].step)}. Pick the next step.`;
      }

      function render() {
        const s = st.state, next = D.steps(s, cfg());
        [0, 1].forEach(w => {
          host.querySelector(`[data-pc="${w}"]`).textContent = `pc = ${s.pc[w]}${s.crashed && s.pc[w] === 'idle' && s.owner === NAMES[w] ? ' (crashed)' : ''}`;
          const acts = next.filter(x => x.w === w).map(x => button(x, D.labelOf(x)));
          if (!acts.length) { const note = document.createElement('span'); note.className = 'k-lane-note'; note.textContent = s.pc[w] === 'done' ? 'done' : 'no step enabled'; acts.push(note); }
          host.querySelector(`[data-lane="${w}"]`).replaceChildren(...acts);
        });
        const tick = next.find(x => x.a === 'Tick'), forget = next.find(x => x.a === 'Forget');
        const age = s.keys.length ? (s.now - s.keys[0]) * 12 : null;
        host.querySelector('[data-pc="clock"]').textContent = `now = ${s.now}, ${DAYS[s.now]} · ${age === null ? 'no key held' : `key ${age} h old`}`;
        const tb = button(tick, 'Tick: +12 h'), fb = button(forget, 'Bank forgets key 4471');
        if (!tick) tb.title = 'The model’s clock has stopped.';
        if (!forget) fb.title = s.keys.length ? 'The key is not 24 hours old yet.' : 'The bank holds no key.';
        host.querySelector('[data-lane="world"]').replaceChildren(tb, fb);
        $('result').replaceChildren(stateLine(s));
        $('why').textContent = why();
        lamps($('lamps'), [
          s.t > 1 ? ['bad', 'NoDoublePayout broken: 2 transfers'] : ['', 'NoDoublePayout holds'],
          s.keys.length ? ['held', `bank holds key (4471, ${s.keys[0]})`] : ['', 'bank holds no key for 4471'],
        ]);
        tally();
        fillStrip($('strip'), st.trail, 'clock');
        $('run').disabled = !st.predicted;
        $('short').disabled = !st.predicted;
        $('short').setAttribute('aria-pressed', String(st.maxTime === 1));
        $('desk').setAttribute('aria-label', `Clock at tick ${s.now}, ${DAYS[s.now]}. ${s.keys.length ? `The bank holds key 4471 stored at tick ${s.keys[0]}.` : 'The bank holds no key.'} Transfers: ${s.t}.`);
        desk.redraw();
      }

      function button(step, label) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'k-step'; b.textContent = label;
        b.disabled = !st.predicted || !step;
        if (step) b.addEventListener('click', () => take(step, label));
        return b;
      }

      function stateLine(s) {
        const div = document.createElement('div');
        div.append(`now ${s.now} · keys {${s.keys.map(k => `(4471, ${k})`).join(', ')}} · `);
        const t = document.createElement('span'); t.textContent = `transfers ${s.t}`;
        if (s.t > 1) t.className = 'changed';
        div.append(t);
        return div;
      }

      function tally() {
        const r = checker(), p = $('tally');
        const mine = document.createElement('span');
        const best = st.best[st.maxTime];
        mine.textContent = best ? `${best} steps` : 'none yet';
        if (best) mine.className = 'k-bad-n';
        p.replaceChildren(`Clock to ${DAYS[st.maxTime]}. Shortest double payout you found: `, mine, ` · the checker’s: ${r.double ? `${r.double.length - 1} steps` : `none in ${num(r.count)} states`}`);
      }

      function take(step, label) {
        const before = st.state;
        st.state = step.next;
        st.trail.push({ step, state: step.next });
        if (step.next.t > 1 && before.t <= 1) { const n = st.trail.length - 1; st.best[st.maxTime] = st.best[st.maxTime] ? Math.min(st.best[st.maxTime], n) : n; }
        if (step.a === 'Tick') { st.view = { from: before.now, to: step.next.now }; clockAnim.go(0, 1, 1.4); }
        else { st.view = { from: step.next.now, to: step.next.now }; }
        render();
        const same = [...host.querySelectorAll('.k-step')].find(b => b.textContent === label && !b.disabled);
        (same || host.querySelector('.k-step:not(:disabled)') || $('reset')).focus();
      }

      function run() {
        const r = checker();
        $('progress').hidden = false;
        if (r.double) {
          $('progress').textContent = `The checker explored all ${num(r.count)} reachable states. The shortest double payout takes ${r.double.length - 1} steps.`;
          showTrace(`The checker’s shortest double payout, ${r.double.length - 1} steps`, r.double, 'clock');
        } else {
          $('progress').textContent = `${num(r.count)} states, none pays twice: the weekend doesn’t fit in this clock.`;
          hideTrace();
        }
      }

      predict($('ask'), {
        question: 'Predict first. Suppose worker A claims and sends at Saturday 05:00 (tick 1) instead, then crashes. What is the earliest the bakery can be paid twice?',
        options: [['sat', 'Saturday 17:00'], ['sun', 'Sunday 05:00'], ['never', 'Never, in this model']],
        right: 'sun',
        explain: {
          right: 'The key is stamped with the tick it was stored, 1, so the bank may forget it at tick 3 at the earliest. Try that schedule below, or any schedule that pays twice.',
          sat: 'The 24 hours count from when the key was stored, Saturday 05:00, not from Friday. Try it below: Tick first, then Claim and Send.',
          never: 'This model’s clock runs to Sunday 05:00, exactly 24 hours after that send, so it just fits. Try it below: Tick first, then Claim and Send.',
        },
        onAnswered: () => { st.predicted = true; render(); host.querySelector('.k-step:not(:disabled)').focus(); },
      });
      $('reset').addEventListener('click', () => { clockAnim.stop(); clockAnim.value = 1; fresh(); render(); $('reset').focus(); });
      $('short').addEventListener('click', () => {
        st.maxTime = st.maxTime === 1 ? 3 : 1;
        clockAnim.stop(); clockAnim.value = 1; fresh(); hideTrace();
        const r = checker();
        $('progress').hidden = false;
        $('progress').textContent = st.maxTime === 1
          ? `Clock stops at Saturday 05:00, tick 1: ${num(r.count)} states, none pays twice; the weekend doesn’t fit.`
          : `Clock runs to Sunday 05:00 again, tick 3: ${num(r.count)} states.`;
        render();
      });
      $('run').addEventListener('click', run);
      render();
      return { host };
    }

    function fix() {
      ['lanes', 'now', 'strip', 'tally', 'short', 'jump'].forEach(k => { $(k).hidden = true; });
      const DEFAULT = { waiting: 'resend', deadline: 0, fresh: 0, clock: 3, workers: 2 };
      const st = { panel: { ...DEFAULT }, guess: null, report: null, job: 0, passes: {}, solved: false };
      $('run').disabled = true;

      function renderPanel() {
        const p = st.panel, freshOn = p.waiting === 'ask' && p.deadline > 0;
        host.querySelectorAll('[data-set]').forEach(b => {
          const key = b.dataset.set, v = key === 'waiting' ? b.dataset.value : Number(b.dataset.value);
          b.setAttribute('aria-pressed', String(p[key] === v));
          if (key === 'fresh') b.disabled = !freshOn;
        });
        $('spec').replaceChildren(...specLines(p).map(l => { const span = document.createElement('span'); span.className = `k-line${l.changed ? ' k-changed' : ''}`; span.textContent = l.text; return span; }));
        const rep = st.report, stale = rep && JSON.stringify(rep.panel) !== JSON.stringify(p);
        if (!rep) {
          lamps($('lamps'), []);
          $('result').replaceChildren();
          $('why').textContent = st.guess ? 'Set the desk with the buttons above, then press “Run the checker”.' : 'Answer the question above to unlock the checker.';
          return;
        }
        if (stale) {
          lamps($('lamps'), []); $('result').replaceChildren(); hideTrace(); $('win').hidden = true;
          $('why').textContent = 'You changed the desk since the last run. Run the checker again.';
          return;
        }
        const r = rep.r;
        lamps($('lamps'), [
          r.double ? ['bad', `NoDoublePayout broken: paid twice in ${r.double.length - 1} steps`] : ['ok', 'NoDoublePayout holds'],
          r.deadEnds ? ['bad', `NoDeadEnd broken: dead end in ${r.dead.length - 1} steps (${num(r.deadEnds)} states)`] : ['ok', 'NoDeadEnd holds'],
        ]);
        const line = document.createElement('div');
        line.append(`Explored ${num(r.count)} reachable states · clock ${p.clock * 12} h · ${p.workers} workers`);
        $('result').replaceChildren(line);
        $('why').textContent = feedback(p, r);
      }

      function feedback(p, r) {
        const cfg = cfgOf(p), L = r.double ? r.double.length - 1 : 0;
        if (r.double) {
          if (cfg.spec === 'lossy') return `Paid twice in ${L} steps, ${r.double.some(x => x.step && x.step.a === 'Drop') ? 'after a lost message' : 'and nothing was lost: the reply was late'}.`;
          if (cfg.spec === 'ask') return `Paid twice in ${L} steps. The bank said “absent”, truthfully, while your request was still in flight.`;
          if (cfg.window >= 2) return `Paid twice in ${L} steps. The window is as long as the bank’s memory: the last request can land the tick the key is forgotten.${r.deadEnds ? ` And ${num(r.deadEnds)} states are dead ends.` : ''}`;
          if (cfg.spec === 'fix' && !cfg.fresh) return `Paid twice in ${L} steps: an old “absent” was read in a later window.`;
          return `Paid twice in ${L} steps.`;
        }
        if (r.deadEnds) return `Never paid twice, and stuck: after the window a slow worker has no move. ${num(r.deadEnds)} reachable states are dead ends.`;
        if (p.clock === 1) return 'Both lamps green, but a 12-hour clock never reaches the moment the bank may forget. Try the 48-hour clock before you ship.';
        if (p.clock === 3) return 'Green. Try the 48-hour clock before you ship.';
        const mine = st.passes[deskId(cfg)] || {};
        if (mine[2] && mine[3]) return 'Holds at 48 hours with 2 workers and with 3. Ship it.';
        return p.workers === 2 ? 'Holds with 2 workers at 48 hours. Try 3 before you ship.' : 'Holds with 3 workers at 48 hours. Run it with 2 as well.';
      }

      function run() {
        const panel = { ...st.panel }, cfg = cfgOf(panel), job = ++st.job, it = D.exploring(cfg);
        st.report = null; st.solved = false;
        $('win').hidden = true; hideTrace(); $('run').disabled = true;
        lamps($('lamps'), []); $('result').replaceChildren();
        $('why').textContent = 'The checker is exploring every reachable state, breadth first…';
        $('progress').hidden = false; $('progress').textContent = 'States found: 1';
        const pump = () => {
          if (job !== st.job) return;
          const until = performance.now() + 24;
          let r;
          do { r = it.next(); } while (!r.done && performance.now() < until);
          if (!r.done) { $('progress').textContent = `States found: ${num(r.value)}…`; setTimeout(pump, 0); return; }
          done(panel, cfg, r.value);
        };
        setTimeout(pump, 0);
      }

      function done(panel, cfg, r) {
        st.report = { panel, r };
        $('run').disabled = false;
        $('progress').textContent = `Done: ${num(r.count)} distinct states.`;
        const green = !r.double && !r.deadEnds;
        if (green && cfg.maxTime === 4) (st.passes[deskId(cfg)] = st.passes[deskId(cfg)] || {})[cfg.n] = r.count;
        if (cfg.spec === 'fix' && !cfg.fresh && cfg.window === 1 && cfg.maxTime === 3) guessAsk.reveal();
        renderPanel();
        if (r.double) showTrace(`The shortest double payout, ${r.double.length - 1} steps`, r.double, cfg.spec);
        else if (r.dead) showTrace(`The shortest way into a dead end, ${r.dead.length - 1} steps: the loan is not paid and no worker can take a step of work`, r.dead, cfg.spec);
        const mine = st.passes[deskId(cfg)] || {};
        if (green && cfg.maxTime === 4 && mine[2] && mine[3]) win(mine);
      }

      function win(mine) {
        st.solved = true;
        guessAsk.reveal();
        $('win-two').textContent = num(mine[2]); $('win-three').textContent = num(mine[3]);
        $('win-guess').textContent = st.guess === 'green'
          ? 'You predicted the trap: trusting any “absent” is green at 36 hours. At 48 hours it pays twice, and the fresh-answer rule is what holds.'
          : `You predicted “${GUESS.find(([v]) => v === st.guess)[1]}”. In fact, trusting any “absent” is green at 36 hours and pays twice at 48. The fresh-answer rule is what holds.`;
        $('win').hidden = false;
        bakeryAnim.go(0, 1, 0.9);
        document.dispatchEvent(new CustomEvent('k:solved', { detail: 'act2' }));
        $('win').focus();
      }

      const bakeryView = { t: 1 };
      const bakery = K.stage($('bakery'), s => {
        const { c, w } = s, b = brush(s), t = easeOut(bakeryView.t), phone = w < 420;
        const bw = phone ? 92 : 128, h = 56, y = 14, ax = w - bw - 2;
        b.box(1, y, bw, h, c.ink, { alpha: 0.5 });
        b.text('bank', 1 + bw / 2, y + 24, { color: c.ink, font: 'ui' });
        b.text('ledger: paid', 1 + bw / 2, y + 42, { color: c.soft });
        b.box(ax, y, bw, h, c.ok, { width: 1.5 });
        b.text(phone ? 'bakery' : 'the bakery', ax + bw / 2, y + 24, { color: c.ink, font: 'ui' });
        b.text(euros(AMOUNT), ax + bw / 2, y + 44, { color: c.ok, weight: 600 });
        const mid = y + h / 2, x0 = 1 + bw, x1 = ax;
        b.line([[x0, mid - 8], [mix(x0, x1, t), mid - 8]], c.input, { dashed: true });
        b.line([[x1, mid + 8], [mix(x1, x0, t), mid + 8]], c.ok, { dashed: true });
        const ask = phone ? 'ask' : 'A asks: paid?', found = phone ? 'found' : '“found”: no resend';
        if (b.width(ask) < x1 - x0 - 12) b.text(ask, mix(x0, x1, 0.5), mid - 14, { color: c.input });
        if (t >= 0.98) b.text(found, phone ? w / 2 : mix(x0, x1, 0.5), phone ? y + h + 22 : mid + 24, { color: c.ok });
      }, { height: () => 104 });
      const bakeryAnim = animator($('bakery'), () => { bakeryView.t = bakeryAnim.value; bakery.redraw(); });

      const GUESS = [['double', 'It pays twice'], ['dead', 'It gets stuck in a dead end'], ['green', 'Both lamps green']];
      const guessAsk = predict($('ask'), {
        hold: 'Run that desk (asks the bank, 12 h window, trust any “absent”, 36 h) and the checker will tell you.',
        question: 'Before your first run: a desk that asks the bank, with a 12-hour window and a bank that refuses late requests, but whose worker trusts any “absent”. With the clock at 36 hours, what will the checker say?',
        options: GUESS,
        right: 'green',
        explain: {
          right: 'At 36 hours that desk is green. Keep it in mind when you move the clock to 48 hours.',
          double: 'At 36 hours that desk never pays twice: the clock is too short for its bug to show.',
          dead: 'At 36 hours that desk never gets stuck, and never pays twice either.',
        },
        onAnswered: value => { st.guess = value; $('run').disabled = false; renderPanel(); host.querySelector('[data-set]').focus(); },
      });
      host.querySelectorAll('[data-set]').forEach(b => b.addEventListener('click', () => {
        const key = b.dataset.set;
        st.panel[key] = key === 'waiting' ? b.dataset.value : Number(b.dataset.value);
        renderPanel();
      }));
      $('run').addEventListener('click', run);
      $('reset').classList.add('quiet');
      $('reset').addEventListener('click', () => {
        st.job++;
        Object.assign(st, { panel: { ...DEFAULT }, report: null, passes: {}, solved: false });
        $('win').hidden = true; $('progress').hidden = true; hideTrace(); $('run').disabled = !st.guess;
        renderPanel(); $('reset').focus();
      });
      renderPanel();
      return { host };
    }
  }

  mount(document.getElementById('lab'), 'explore');
  document.getElementById('start-act2').addEventListener('click', () => {
    const holder = document.getElementById('act2-mount'), host = document.createElement('div');
    host.className = 'lab'; host.id = 'lab2';
    holder.replaceWith(host);
    mount(host, 'fix');
    host.querySelector('.k-predict button').focus();
  });
})();
