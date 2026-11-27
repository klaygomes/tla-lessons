/* Strip-pair drawing adapted from the iwrzwr visual archive, Transcode Window and Revision Strata studies (night 07, Signal Translations). MIT License, Copyright (c) 2026 Kagan Yaldizkaya. */
const QueueDesk = (() => {
  const NAMES = 'ABCD';
  const initial = n => ({ queue: 'visible', status: 'approved', pc: Array(n).fill('idle'), keyed: false, transfers: 0, crashed: false });
  const keyOf = s => `${s.queue}|${s.status}|${s.pc.join(',')}|${s.keyed}|${s.transfers}|${s.crashed}`;

  function steps(s, { key = true, lease = true, markFirst = false } = {}) {
    const out = [];
    const put = (i, to, change = {}) => ({ ...s, ...change, pc: s.pc.map((p, j) => (j === i ? to : p)) });
    const add = (action, i, fair, next) => out.push({ action, worker: i, label: `${action}(${NAMES[i]})`, fair, next });
    s.pc.forEach((p, i) => {
      if (p === 'idle' && s.queue === 'visible') add('Receive', i, true, put(i, 'claimed', { queue: 'hidden' }));
      const paid = key && s.keyed ? s.transfers : s.transfers + 1;
      let hold;
      if (!markFirst) {
        if (p === 'claimed') add('Send', i, true, put(i, 'sent'));
        if (p === 'sent') add('Confirm', i, true, put(i, 'confirmed', { keyed: true, transfers: paid }));
        if (p === 'confirmed') add('Mark', i, true, put(i, 'done', { queue: 'deleted', status: 'paid' }));
        hold = ['claimed', 'sent', 'confirmed'];
      } else {
        if (p === 'claimed') add('Mark', i, true, put(i, 'marked', { queue: 'deleted', status: 'paid' }));
        if (p === 'marked') add('Send', i, true, put(i, 'sent'));
        if (p === 'sent') add('Confirm', i, true, put(i, 'done', { keyed: true, transfers: paid }));
        hold = ['claimed', 'marked', 'sent'];
      }
      if (!s.crashed && hold.includes(p)) add('Crash', i, false, put(i, 'idle', { crashed: true }));
    });
    if (s.queue === 'hidden') out.unshift({ action: 'Expire', worker: -1, label: 'Expire', fair: lease, next: { ...s, queue: 'visible' } });
    return out;
  }

  const MAPPINGS = {
    bank: s => [s.transfers > 0 ? 'paid' : 'approved', s.transfers],
    table: s => [s.status, s.transfers],
    send: s => [s.pc.some(p => ['sent', 'confirmed', 'done'].includes(p)) ? 'paid' : 'approved', s.transfers],
  };

  function kind(a, b) {
    if (a[0] === b[0] && a[1] === b[1]) return 'stutter';
    if (a[0] === 'approved' && b[0] === 'paid' && b[1] === a[1] + 1) return 'pay';
    return 'bad';
  }

  function explore(n, opts = {}, map = MAPPINGS.bank) {
    const start = initial(n);
    const nodes = [{ state: start, parent: -1, via: null }];
    const index = new Map([[keyOf(start), 0]]);
    const counts = { pay: 0, stutter: 0, bad: 0 };
    let generated = 1, firstBad = null;
    const fairOut = [];
    for (let head = 0; head < nodes.length; head++) {
      const s = nodes[head].state, out = steps(s, opts);
      fairOut[head] = out.some(x => x.fair);
      out.forEach(step => {
        generated += 1;
        const k = kind(map(s), map(step.next));
        counts[k] += 1;
        if (k === 'bad' && !firstBad) firstBad = { from: head, step };
        const key = keyOf(step.next);
        if (!index.has(key)) { index.set(key, nodes.length); nodes.push({ state: step.next, parent: head, via: step }); }
      });
    }
    const pathTo = i => {
      const out = [];
      for (let j = i; j >= 0; j = nodes[j].parent) out.unshift({ label: nodes[j].via ? nodes[j].via.label : null, action: nodes[j].via ? nodes[j].via.action : null, state: nodes[j].state });
      return out;
    };
    const badTrace = firstBad ? [...pathTo(firstBad.from), { label: firstBad.step.label, action: firstBad.step.action, state: firstBad.step.next }] : null;
    const lassos = nodes.map((nd, i) => i).filter(i => !fairOut[i] && map(nodes[i].state)[0] === 'approved');
    return {
      n, states: nodes.length, generated, steps: generated - 1, counts, badTrace,
      lassos: lassos.length, lassoTrace: lassos.length ? pathTo(lassos[0]) : null,
    };
  }

  return { NAMES, initial, keyOf, steps, MAPPINGS, kind, explore };
})();

if (typeof module === 'object' && module.exports) module.exports = QueueDesk;
else (() => {
  const K = window.Kit, D = QueueDesk, NAMES = D.NAMES;
  const AMOUNT = '€50,000';
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const mix = (a, b, p) => a + (b - a) * p;
  const ease = t => (t >= 1 ? 1 : 1 - 2 ** (-10 * t));
  const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
  const MAP_NAMES = { bank: 'the bank', table: 'the table', send: 'the send' };
  const KIND_WORD = { pay: 'Pay', stutter: 'stutter', bad: 'not allowed' };
  const SHORT = { visible: 'vis', hidden: 'hid', deleted: 'del', approved: 'appr', paid: 'paid', idle: 'idle', claimed: 'claim', sent: 'sent', confirmed: 'conf', marked: 'mark', done: 'done' };
  const SHORT_ACTION = { Receive: 'Rcv', Send: 'Snd', Confirm: 'Cnf', Mark: 'Mrk', Crash: 'Crs', Expire: 'Exp' };
  const UNLUCKY = ['Receive(A)', 'Expire', 'Receive(B)', 'Send(A)', 'Confirm(A)', 'Send(B)', 'Confirm(B)', 'Mark(A)', 'Mark(B)'];
  const abs = v => `${v[0]}, ${v[1]}`;
  const actionsOf = trace => trace.slice(1).map(t => t.action || t.label).join(', ');

  function measure(ctx, str, font = 'mono', size = 12, weight = 400) {
    const family = getComputedStyle(document.documentElement).getPropertyValue(font === 'mono' ? '--font-mono' : '--font-ui').trim();
    ctx.font = `${weight} ${size}px ${family}`;
    return ctx.measureText(str).width;
  }

  function brush(s) {
    const { ctx } = s, dpr = s.dpr || 1;
    const snap = v => (Math.round(v * dpr - 0.5) + 0.5) / dpr;
    const b = {
      line(points, color, { alpha = 1, width = 1, dash = [] } = {}) {
        if (points.length < 2) return;
        ctx.globalAlpha = clamp(alpha); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'butt'; ctx.setLineDash(dash);
        ctx.beginPath(); points.forEach(([x, y], i) => (i ? ctx.lineTo(snap(x), snap(y)) : ctx.moveTo(snap(x), snap(y)))); ctx.stroke();
        ctx.setLineDash([]); ctx.globalAlpha = 1;
      },
      card(x, y, w, h, { stroke, fill, width = 1, alpha = 1, dash = [] }) {
        ctx.globalAlpha = clamp(alpha); ctx.beginPath(); ctx.setLineDash(dash);
        if (ctx.roundRect) ctx.roundRect(snap(x), snap(y), Math.round(w), Math.round(h), 5); else ctx.rect(snap(x), snap(y), w, h);
        if (fill) { ctx.fillStyle = fill; ctx.fill(); }
        if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
        ctx.setLineDash([]); ctx.globalAlpha = 1;
      },
      marker(x, y, color, size = 4, alpha = 1) { ctx.globalAlpha = clamp(alpha); ctx.fillStyle = color; ctx.fillRect(x - size / 2, y - size / 2, size, size); ctx.globalAlpha = 1; },
      head(x, y, dir, color, alpha = 1) { b.line([[x - 5 * dir, y - 4], [x, y], [x - 5 * dir, y + 4]], color, { alpha, width: 1.5 }); },
      text(str, x, y, { alpha = 1, ...opts } = {}) { ctx.globalAlpha = clamp(alpha); s.pen.text(str, x, y, { size: 12, ...opts }); ctx.globalAlpha = 1; },
      cross(x, y, color, alpha = 1) { ctx.globalAlpha = clamp(alpha); s.pen.cross(x, y, color); ctx.globalAlpha = 1; },
    };
    return b;
  }

  function pairGeometry(s, view) {
    const { w, ctx } = s, phone = w < 520, n = view.n;
    const value = v => (phone ? SHORT[v] || String(v) : String(v));
    const rowsOf = st => [value(st.queue), value(st.status), ...st.pc.map(value), String(st.transfers)];
    const absText = v => (phone ? `${SHORT[v[0]]} ${v[1]}` : abs(v));
    let widest = 0;
    view.rows.forEach(r => {
      rowsOf(r.state).forEach(t => { widest = Math.max(widest, measure(ctx, t)); });
      widest = Math.max(widest, measure(ctx, absText(view.map(r.state)), 'ui', 12, 500));
    });
    const gutter = phone ? 62 : 90, cardW = Math.max(phone ? 44 : 70, Math.ceil(widest) + (phone ? 8 : 10)), gap = phone ? 8 : 12, pitch = cardW + gap;
    const extra = view.lasso ? 1 : 0, slots = Math.max(2, Math.floor((w - gutter - 4) / pitch));
    return { phone, n, gutter, cardW, gap, pitch, slots, extra, rowsOf, absText, ...vertical(n, phone, view.lasso) };
  }

  function vertical(n, phone, lasso) {
    const rowH = 15, top = 24, cardH = (3 + n) * rowH + 8;
    const boundary = top + cardH + 20, absY = boundary + 18, absH = 26, tagY = absY + absH + 17;
    const stairTop = tagY + (phone ? 20 : 12), stairH = 26, height = stairTop + stairH + (lasso ? 22 : 8);
    return { rowH, top, cardH, boundary, absY, absH, tagY, stairTop, stairH, height };
  }

  function pairHeight(n, lasso) { return w => vertical(n, w < 520, lasso).height; }

  function drawPair(s, view) {
    const { c, w } = s, b = brush(s), g = pairGeometry(s, view), rows = view.rows;
    if (!rows.length) return;
    const last = rows.length - 1, r = view.reveal == null ? last : clamp(view.reveal, 0, last);
    const room = g.slots - g.extra, k = Math.floor(r), f = r - k;
    const slide = f > 0 ? ease(clamp(f / 0.35)) : 0;
    const start = Math.max(0, k + slide + 1 - room);
    const xOf = i => g.gutter + (i - start) * g.pitch;
    const local = i => (i === 0 ? 1 : clamp(r - (i - 1)));
    const absOf = i => view.map(rows[i].state);
    const kindOf = i => D.kind(absOf(i - 1), absOf(i));
    const labels = ['queue', 'table', ...Array.from({ length: g.n }, (_, i) => `pc ${NAMES[i]}`), 'transfers'];
    labels.forEach((t, j) => b.text(t, 0, g.top + 4 + (j + 1) * g.rowH - 3, { align: 'left', color: c.soft, font: 'ui' }));
    b.text(g.phone ? 'step' : 'design step', 0, 14, { align: 'left', color: c.soft, font: 'ui' });
    b.text(g.phone ? 'PayOnce' : 'PayOnce sees', 0, g.absY + 17, { align: 'left', color: c.ink, font: 'ui', weight: 500 });
    b.text(g.phone ? 'through' : 'translated', 0, g.boundary + 4, { align: 'left', color: c.soft, font: 'ui' });
    b.line([[g.gutter - 6, g.boundary], [w - 2, g.boundary]], c.soft, { alpha: 0.45 });
    b.line([[g.gutter - 6, g.boundary - 3], [g.gutter - 6, g.boundary + 3]], c.soft, { alpha: 0.7 });
    b.line([[w - 2, g.boundary - 3], [w - 2, g.boundary + 3]], c.soft, { alpha: 0.7 });
    const level = v => (v[1] > 1 ? g.stairTop : v[0] === 'paid' ? g.stairTop + 8 : g.stairTop + g.stairH - 2);
    if (!g.phone) {
      b.text('approved', g.gutter - 8, g.stairTop + g.stairH + 2, { align: 'right', color: c.soft, font: 'ui' });
      b.text('paid', g.gutter - 8, g.stairTop + 12, { align: 'right', color: c.soft, font: 'ui' });
    }
    s.ctx.save(); s.ctx.beginPath(); s.ctx.rect(g.gutter - 4, 0, w - g.gutter + 4, g.height); s.ctx.clip();
    const fade = i => clamp((xOf(i) - g.gutter + g.pitch * 0.6) / (g.pitch * 0.6));
    let stair = [];
    rows.forEach((row, i) => {
      const x = xOf(i), q = local(i), seen = fade(i);
      if (q <= 0 || x > w || x + g.cardW < g.gutter - g.pitch) return;
      const cx = x + g.cardW / 2, top = clamp(q / 0.35), drop = clamp((q - 0.35) / 0.35), bottom = clamp((q - 0.7) / 0.3);
      const newest = view.live && i === last && i > 0;
      const k2 = i > 0 ? kindOf(i) : null, bad = k2 === 'bad';
      const head = i === 0 ? 'start' : g.phone ? `${SHORT_ACTION[row.action] || row.action}${row.label.includes('(') ? ` ${row.label.slice(-2, -1)}` : ''}` : row.label;
      b.text(head, cx, 14, { color: newest ? c.input : c.ink, font: 'ui', weight: 500, alpha: top * seen });
      b.card(x, g.top, g.cardW, g.cardH, { stroke: newest ? c.input : c.soft, fill: c.paper, width: newest ? 1.5 : 1, alpha: top * seen });
      g.rowsOf(row.state).forEach((t, j) => {
        const prev = i > 0 ? g.rowsOf(rows[i - 1].state)[j] : t;
        b.text(t, cx, g.top + 4 + (j + 1) * g.rowH - 3, { color: prev !== t ? c.ink : c.soft, weight: prev !== t ? 500 : 400, alpha: top * seen });
      });
      if (drop > 0) {
        const y1 = g.top + g.cardH + 2, y2 = g.absY - 2, yy = mix(y1, y2, ease(drop));
        b.line([[cx, y1], [cx, yy]], c.soft, { alpha: 0.6 * seen, dash: [2, 3] });
        b.marker(cx, g.boundary, c.ink, 3, 0.8 * seen);
        if (drop < 1) b.marker(cx, yy, c.ink, 4, seen);
      }
      if (bottom <= 0) return;
      const a = absOf(i), color = bad ? c.accent : c.soft;
      b.card(x, g.absY, g.cardW, g.absH, { stroke: bad ? c.accent : k2 === 'pay' ? c.ink : c.soft, fill: bad ? c.accentSoft : c.paper, width: bad || k2 === 'pay' ? 1.5 : 1, alpha: bottom * seen });
      b.text(g.absText(a), cx, g.absY + 17, { color: bad ? c.accentInk : c.ink, font: 'ui', weight: 500, alpha: bottom * seen });
      if (i > 0) {
        const x0 = xOf(i - 1) + g.cardW + 1, x1 = x - 2, y = g.absY + g.absH / 2;
        const style = k2 === 'pay' ? { width: 2, color: c.ink } : bad ? { width: 2, color: c.accent } : { width: 1, color: c.soft, dash: [3, 3] };
        b.line([[x0, y], [x1, y]], style.color, { width: style.width, dash: style.dash || [], alpha: bottom * seen });
        b.head(x1, y, 1, style.color, bottom * seen);
        const word = KIND_WORD[k2];
        if (bad && g.phone) {
          b.text('not', cx, g.tagY, { color: c.accentInk, font: 'ui', weight: 500, alpha: bottom * seen });
          b.text('allowed', cx, g.tagY + 13, { color: c.accentInk, font: 'ui', weight: 500, alpha: bottom * seen });
        } else if (bad) {
          b.cross(cx - measure(s.ctx, word, 'ui') / 2 - 6, g.tagY - 4, c.accent, bottom * seen);
          b.text(word, cx + 4, g.tagY, { color: c.accentInk, font: 'ui', weight: 500, alpha: bottom * seen });
        } else b.text(word, cx, g.tagY, { color: k2 === 'pay' ? c.ink : c.soft, font: 'ui', weight: k2 === 'pay' ? 600 : 400, alpha: bottom * seen });
      }
      stair.push({ i, x, cx, y: level(a), bad, alpha: bottom * seen });
    });
    stair.forEach((p, j) => {
      const prev = stair[j - 1];
      if (prev && prev.i === p.i - 1) b.line([[prev.x + g.cardW, prev.y], [p.x, p.y]], p.bad ? c.accent : c.ink, { alpha: p.alpha * 0.9, width: p.bad ? 2 : 1.25 });
      b.line([[p.x, p.y], [p.x + g.cardW, p.y]], p.bad ? c.accent : c.ink, { alpha: p.alpha * 0.9, width: p.bad ? 2 : 1.25 });
    });
    if (view.lasso && local(last) >= 1) {
      const x = xOf(last), cx = x + g.cardW / 2, gx = xOf(last + 1), y = g.absY + g.absH / 2;
      const loop = (yy) => {
        s.ctx.globalAlpha = 0.9; s.ctx.strokeStyle = c.accent; s.ctx.lineWidth = 1.5; s.ctx.beginPath();
        s.ctx.arc(x + g.cardW, yy, 9, -Math.PI * 0.6, Math.PI * 0.6); s.ctx.stroke(); s.ctx.globalAlpha = 1;
      };
      loop(g.top + g.cardH / 2); loop(y);
      b.card(gx, g.absY, g.cardW, g.absH, { stroke: c.soft, fill: c.paper2, alpha: 0.7, dash: [3, 3] });
      b.text(g.absText(['paid', 1]), gx + g.cardW / 2, g.absY + 17, { color: c.soft, font: 'ui', weight: 500, alpha: 0.9 });
      b.line([[x + g.cardW + 12, y], [gx - 2, y]], c.accent, { dash: [4, 3], width: 1.5 });
      b.cross(mix(x + g.cardW + 12, gx, 0.5), y - 9, c.accent);
      b.text(g.phone ? 'Pay never taken' : 'stutter forever: Pay enabled, never taken', g.phone ? cx : x, g.stairTop + g.stairH + 18, { color: c.accentInk, font: 'ui', weight: 500, align: g.phone ? 'center' : 'left' });
    }
    if (view.needle != null && view.needle < last + 1) {
      const nx = xOf(Math.min(last, Math.ceil(r))) + g.cardW / 2;
      b.line([[nx, 4], [nx, g.stairTop + g.stairH]], c.ink, { alpha: 0.3 });
    }
    s.ctx.restore();
    if (start > 0.05) {
      const hidden = Math.ceil(start);
      s.ctx.clearRect(0, 0, g.gutter - 6, 20);
      b.text(`‹ ${hidden} earlier`, 0, 14, { align: 'left', color: c.soft, font: 'ui' });
    }
  }

  function describe(rows, map) {
    if (rows.length < 2) return 'No steps yet. PayOnce sees approved, 0.';
    const parts = rows.slice(1).map((r, i) => `${r.label}: ${KIND_WORD[D.kind(map(rows[i].state), map(r.state))]}`);
    return `Behavior, step by step, with what PayOnce sees: ${parts.join('; ')}. PayOnce ends at ${abs(map(rows[rows.length - 1].state))}.`;
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
    run.stop = () => { loop.stop(); run.value = run.to; run.done = null; };
    return run;
  }

  function pairView(canvas, height) {
    const view = { rows: [], map: D.MAPPINGS.bank, n: 2, reveal: null, needle: null, live: false, lasso: false };
    const stage = K.stage(canvas, s => drawPair(s, view), { height: w => height(view)(w) });
    const anim = animator(canvas, () => { view.reveal = anim.value; stage.redraw(); });
    return { view, stage, anim };
  }

  function reasonBad(a, b) {
    if (a[0] === 'paid') return `PayOnce’s Pay starts from approved; from ${abs(a)}, the only step it allows is a stutter, and ${abs(b)} is not the same state.`;
    if (a[0] !== b[0] && a[1] === b[1]) return `The status turned ${b[0]} while the transfers stayed at ${b[1]}. A Pay changes both together, and a stutter changes neither.`;
    if (a[0] === b[0] && a[1] !== b[1]) return `The money moved while the status stayed ${b[0]}. A Pay changes both together, and a stutter changes neither.`;
    return 'It is neither a Pay nor a stutter.';
  }

  const PILOT = { order: 'mark', key: true, lease: true, n: 2 };

  function specLines(cfg) {
    const ws = Array.from({ length: cfg.n }, (_, i) => `"${NAMES[i]}"`).join(', ');
    return [
      { text: `Workers  ≜ {${ws}}`, changed: cfg.n !== PILOT.n },
      { text: cfg.order === 'mark' ? 'one worker: Receive, Mark, Send, Confirm' : 'one worker: Receive, Send, Confirm, Mark', changed: cfg.order !== PILOT.order },
      { text: cfg.key ? 'Confirm(w): transfers′ = IF Loan ∈ keys THEN transfers ELSE transfers + 1' : 'Confirm(w): transfers′ = transfers + 1', changed: cfg.key !== PILOT.key },
      { text: `Fairness ≜ ∀ w : WF_vars(Work(w)) ∧ ∀ w : WF_vars(Confirm(w))${cfg.lease ? ' ∧ WF_vars(Expire)' : ''}`, changed: cfg.lease !== PILOT.lease },
      { text: 'Crash(w): once per run, while holding the loan' },
      { text: 'Abstract ≜ INSTANCE PayOnce WITH status ← PaidAtBank, transfers ← transfers' },
    ];
  }

  function feedback(cfg, r) {
    const head = `${r.states.toLocaleString('en-US')} states`;
    const bad = r.badTrace, stuck = r.lassoTrace;
    const badText = bad && (cfg.order === 'mark'
      ? `a forbidden step after ${WORDS[bad.length - 1]}: two workers both marked and both sent, and paid, 1 became paid, 2.`
      : `a forbidden step after ${WORDS[bad.length - 1]}: an expired lease, a second worker, and paid, 1 becomes paid, 2.`);
    const stuckText = stuck && (cfg.lease
      ? `the money can stay put forever: ${actionsOf(stuck)}. The books say paid.`
      : `a crash strands the message: ${actionsOf(stuck)}, and the message never comes back.`);
    if (bad && stuck) return `${head}, ${badText} And the second lamp is red as well: ${stuckText}`;
    if (bad) return `${head}, ${badText}`;
    if (stuck) return `${head}. Every step is fine, and ${stuckText}`;
    return null;
  }

  function mount(host, mode) {
    host.replaceChildren(document.getElementById('pair-lab').content.cloneNode(true));
    const uid = `${host.id}-`, $ = k => host.querySelector(`[data-k="${k}"]`);
    host.querySelectorAll('[data-k]').forEach(el => { el.id = uid + el.dataset.k; });
    const explore = mode === 'explore';

    const st = {
      predicted: !explore, n: 2, map: 'bank', trail: [{ label: null, action: null, state: D.initial(2) }], playing: null,
      cfg: { ...PILOT }, report: null, passed: { 2: false, 3: false }, guess: null, solved: false,
    };

    const main = pairView($('pair'), v => pairHeight(v.n, false));
    const trace = pairView($('trace'), v => pairHeight(v.n, false));
    const lasso = pairView($('lasso'), v => pairHeight(v.n, true));
    main.view.live = true;

    function setPressed(sel, test) { host.querySelectorAll(sel).forEach(b => b.setAttribute('aria-pressed', String(test(b)))); }

    function showTrace(which, rows, n, title) {
      const v = which.view;
      Object.assign(v, { rows, n, map: D.MAPPINGS[explore ? st.map : 'bank'], needle: 0, reveal: 0, lasso: which === lasso });
      which.stage.resize();
      $('trace-key').hidden = which.stage.w >= 520;
      const canvas = which === lasso ? $('lasso') : $('trace');
      canvas.setAttribute('aria-label', `${title} ${describe(rows, v.map)}${which === lasso ? ' Then it stutters forever: Pay stays enabled and is never taken.' : ''}`);
      which.anim.go(0, rows.length - 1, 2.2, () => { v.needle = null; v.reveal = null; which.stage.redraw(); });
      clearTimeout(which.timer);
      which.timer = setTimeout(() => { which.anim.stop(); v.needle = null; v.reveal = null; which.stage.redraw(); }, (rows.length - 1) / 2.2 * 1000 + 250);
    }

    function lanes() {
      const n = st.n, s = st.trail[st.trail.length - 1].state, enabled = D.steps(s);
      const box = $('lanes');
      const nodes = [];
      for (const i of [...Array(n).keys(), -1]) {
        const lane = document.createElement('div'); lane.className = 'k-lane';
        const name = document.createElement('span'); name.className = 'k-lane-name'; name.textContent = i < 0 ? 'The lease' : `Worker ${NAMES[i]}`;
        const row = document.createElement('div'); row.className = 'row';
        const mine = enabled.filter(x => x.worker === i);
        mine.forEach(step => {
          const b = document.createElement('button'); b.type = 'button'; b.className = 'k-step'; b.textContent = step.label;
          b.disabled = !st.predicted || Boolean(st.playing);
          b.addEventListener('click', () => take(step));
          row.append(b);
        });
        if (!mine.length) {
          const note = document.createElement('span'); note.className = 'k-lane-note';
          note.textContent = i < 0 ? (s.queue === 'deleted' ? 'message deleted' : 'message visible') : s.pc[i] === 'done' ? 'done' : s.pc[i] === 'idle' ? 'idle, nothing to receive' : 'no step enabled';
          row.append(note);
        }
        lane.append(name, row);
        nodes.push(lane);
      }
      box.replaceChildren(...nodes);
    }

    function kinds() {
      const map = D.MAPPINGS[st.map];
      return st.trail.slice(1).map((t, i) => D.kind(map(st.trail[i].state), map(t.state)));
    }

    function tally() {
      const ks = kinds(), count = k => ks.filter(x => x === k).length, p = $('tally');
      const bad = document.createElement('span'); bad.textContent = String(count('bad'));
      if (count('bad')) bad.className = 'k-bad-n';
      p.replaceChildren(`Pay ${count('pay')} · stutter ${count('stutter')} · not allowed `, bad);
    }

    function strip() {
      const map = D.MAPPINGS[st.map], ks = kinds();
      $('strip').replaceChildren(...st.trail.map((t, i) => {
        const li = document.createElement('li'), k = i ? ks[i - 1] : null;
        if (k === 'bad') li.className = 'k-bad';
        [[`${i} · ${t.label || 'start'}`, 'k-card-step'], [`sees ${abs(map(t.state))}`], ...(k ? [[KIND_WORD[k], k === 'bad' ? 'k-card-t' : '']] : [])].forEach(([text, cls]) => {
          const span = document.createElement('span'); span.textContent = text; if (cls) span.className = cls; li.append(span);
        });
        return li;
      }));
    }

    function exploreWhy() {
      const s = st.trail[st.trail.length - 1].state, n = st.trail.length - 1, map = D.MAPPINGS[st.map];
      if (!st.predicted) return 'Answer the question above to unlock the scheduler.';
      if (!n) return 'You are the scheduler of the design. Each button is a step the design may take now. Underneath, PayOnce sees only status and transfers, read through the bank, the table or the send.';
      const t = st.trail[n], a = map(st.trail[n - 1].state), b = map(t.state), k = D.kind(a, b);
      const what = k === 'pay' ? `PayOnce sees ${abs(a)} become ${abs(b)}: a Pay step, the status and the money changing together.`
        : k === 'stutter' ? `PayOnce sees ${abs(a)} before and after: nothing it can see changed, so to PayOnce this is a stutter.`
        : `PayOnce sees ${abs(a)} become ${abs(b)}: not allowed. ${reasonBad(a, b)}`;
      const ks = kinds(), firstBad = ks.indexOf('bad');
      const whole = `Read through “${MAP_NAMES[st.map]}”, the whole behavior is Pay ${ks.filter(x => x === 'pay').length}, stutter ${ks.filter(x => x === 'stutter').length}, not allowed ${ks.filter(x => x === 'bad').length}${firstBad < 0 ? '' : `; the first not-allowed step is step ${firstBad + 1}, ${st.trail[firstBad + 1].label}`}.`;
      const ended = D.steps(s).length ? '' : ` The behavior has ended. ${whole} Press Reset for another, switch the reading, or try every behavior.`;
      return `Step ${n}, ${t.label}. ${what}${ended}`;
    }

    function renderExplore() {
      lanes(); tally(); strip();
      const s = st.trail[st.trail.length - 1].state;
      $('result').textContent = `queue ${s.queue} · table ${s.status} · ${s.pc.map((p, i) => `pc ${NAMES[i]} ${p}`).join(' · ')} · transfers ${s.transfers}`;
      $('why').textContent = exploreWhy();
      setPressed('[data-map]', b => b.dataset.map === st.map);
      setPressed('[data-workers]', b => Number(b.dataset.workers) === st.n);
      $('run').disabled = !st.predicted;
      $('play').disabled = !st.predicted || Boolean(st.playing);
      Object.assign(main.view, { rows: st.trail, n: st.n, map: D.MAPPINGS[st.map] });
      $('pair').setAttribute('aria-label', describe(st.trail, D.MAPPINGS[st.map]));
      $('pair-cap').textContent = `Top: the design’s states, one card per step. Bottom: what PayOnce sees through “${MAP_NAMES[st.map]}”, with each step tagged Pay, stutter, or not allowed (neither a Pay nor a stutter, so PayOnce forbids it); the line under the cards climbs from approved to paid.${main.stage.w < 520 ? ' Short forms: vis visible, hid hidden, del deleted, appr approved, claim claimed, conf confirmed; Rcv Receive, Snd Send, Cnf Confirm, Mrk Mark, Crs Crash, Exp Expire.' : ' Older steps slide out to the left; the list below keeps every step.'}`;
      main.stage.resize();
    }

    function take(step, rate = 1.6, done) {
      st.trail.push({ label: step.label, action: step.action, state: step.next });
      renderExplore();
      if (done) {
        main.anim.go(st.trail.length - 2, st.trail.length - 1, rate);
        st.timer = setTimeout(() => { main.anim.stop(); main.view.reveal = null; main.stage.redraw(); done(); }, K.reduced.matches ? 350 : 1000 / rate);
        return;
      }
      main.anim.go(st.trail.length - 2, st.trail.length - 1, rate, () => { main.view.reveal = null; main.stage.redraw(); });
      { const next = host.querySelector('.k-step'); (next || $('reset')).focus(); }
    }

    function reset() {
      main.anim.stop(); clearTimeout(st.timer); st.playing = null;
      st.trail = [{ label: null, action: null, state: D.initial(st.n) }];
      main.view.reveal = null;
      renderExplore();
    }

    function playUnlucky() {
      if (st.n !== 2) st.n = 2;
      reset();
      const queue = [...UNLUCKY];
      st.playing = queue;
      const next = () => {
        if (st.playing !== queue) return;
        const label = queue.shift();
        if (!label) { st.playing = null; renderExplore(); $('play').focus(); return; }
        const step = D.steps(st.trail[st.trail.length - 1].state).find(x => x.label === label);
        take(step, 1.4, next);
      };
      renderExplore();
      $('pair').scrollIntoView({ block: 'center', behavior: K.reduced.matches ? 'auto' : 'smooth' });
      next();
    }

    function searchExplore() {
      const r = D.explore(st.n, {}, D.MAPPINGS[st.map]);
      $('search').hidden = false; $('lasso-block').hidden = true;
      const head = `Every behavior with ${st.n} workers: ${r.states.toLocaleString('en-US')} states, ${r.steps.toLocaleString('en-US')} steps. Through “${MAP_NAMES[st.map]}”, PayOnce sees Pay ${r.counts.pay.toLocaleString('en-US')}, stutter ${r.counts.stutter.toLocaleString('en-US')}, not allowed ${r.counts.bad.toLocaleString('en-US')}.`;
      $('search-note').textContent = r.badTrace
        ? `${head} The first not-allowed step comes after ${r.badTrace.slice(1).map(t => t.label).join(', ')}.`
        : `${head} Not one step is something PayOnce forbids.`;
      $('trace-block').hidden = !r.badTrace;
      if (r.badTrace) { $('trace-title').textContent = 'The shortest behavior that reaches a step PayOnce does not allow:'; showTrace(trace, r.badTrace, st.n, 'Shortest behavior to a not-allowed step.'); }
    }

    function lamp(el, state, text) {
      el.dataset.state = state;
      el.querySelector('.k-lamp-word').textContent = state === 'ok' ? 'holds' : state === 'bad' ? 'fails' : 'not checked';
      el.querySelector('.k-lamp-text').textContent = text;
    }

    function renderFix() {
      const cfg = st.cfg, rep = st.report;
      setPressed('[data-order]', b => b.dataset.order === cfg.order);
      setPressed('[data-key]', b => (b.dataset.key === 'on') === cfg.key);
      setPressed('[data-lease]', b => (b.dataset.lease === 'on') === cfg.lease);
      setPressed('[data-workers]', b => Number(b.dataset.workers) === cfg.n);
      $('spec').replaceChildren(...specLines(cfg).map(l => { const span = document.createElement('span'); span.className = `k-line${l.changed ? ' k-changed' : ''}`; span.textContent = l.text; return span; }));
      const stale = rep && JSON.stringify(rep.cfg) !== JSON.stringify(cfg);
      const l1 = $('lamp-steps'), l2 = $('lamp-pay');
      if (!rep || stale) {
        lamp(l1, 'none', 'every step is a Pay or a stutter'); lamp(l2, 'none', 'the Pay happens');
        $('result').textContent = '';
        $('why').textContent = !st.guess ? 'Answer the question above first.' : stale ? 'You changed the design since the last check. Check refinement again.' : 'Change the design with the panel, then press “Check refinement”.';
        $('search').hidden = true;
        return;
      }
      const r = rep.result, ok = rep.cfg.order === 'send' && rep.cfg.key && rep.cfg.lease;
      lamp(l1, r.badTrace ? 'bad' : 'ok', 'every step is a Pay or a stutter');
      lamp(l2, r.lassos ? 'bad' : 'ok', 'the Pay happens');
      $('result').textContent = `Checked ${r.states.toLocaleString('en-US')} states and ${r.steps.toLocaleString('en-US')} steps through PaidAtBank.`;
      const other = rep.cfg.n === 2 ? 3 : 2;
      $('why').textContent = feedback(rep.cfg, r)
        || (st.solved ? `${r.states} states, both lamps green: the pilot now refines PayOnce.`
          : ok && !st.passed[other] ? `${r.states} states, both lamps green. Try ${other} workers before you ship.` : `${r.states} states, both green.`);
    }

    function check() {
      const cfg = { ...st.cfg }, r = D.explore(cfg.n, { key: cfg.key, lease: cfg.lease, markFirst: cfg.order === 'mark' });
      st.report = { cfg, result: r };
      if (cfg.order === 'send' && cfg.key && cfg.lease && !r.badTrace && !r.lassos) st.passed[cfg.n] = true;
      const winNow = !st.solved && st.passed[2] && st.passed[3];
      if (winNow) st.solved = true;
      renderFix();
      $('search').hidden = !(r.badTrace || r.lassos);
      $('search-note').textContent = '';
      $('trace-block').hidden = !r.badTrace; $('lasso-block').hidden = !r.lassos;
      if (r.badTrace) { $('trace-title').textContent = `The forbidden step, ${r.badTrace.length - 1} steps in, with the PayOnce column:`; showTrace(trace, r.badTrace, cfg.n, 'Shortest behavior to a forbidden step.'); }
      if (r.lassos) { $('lasso-title').textContent = 'The lasso: the design can stop here, and PayOnce still waits for its Pay.'; showTrace(lasso, r.lassoTrace, cfg.n, 'A behavior that ends in stuttering.'); }
      if (winNow) win();
    }

    const reconView = { t: 1 };
    const recon = K.stage($('recon'), s => {
      const { c, w } = s, b = brush(s), t = ease(reconView.t), phone = w < 420;
      const bw = phone ? Math.floor((w - 40) / 2) : 190, h = 58, y = 8, bx = w - bw - 1;
      b.card(1, y, bw, h, { stroke: c.soft, fill: c.paper });
      b.text('loans table', 1 + bw / 2, y + 20, { color: c.soft, font: 'ui' });
      b.text('4471 · paid', 1 + bw / 2, y + 42, { color: c.ink });
      b.card(bx, y, bw, h, { stroke: t >= 0.98 ? c.ok : c.soft, fill: c.paper, width: t >= 0.98 ? 1.5 : 1 });
      b.text('bank statement', bx + bw / 2, y + 20, { color: c.soft, font: 'ui' });
      b.text(t >= 0.98 ? `4471 · ${AMOUNT}` : '4471 · €0', bx + bw / 2, y + 42, { color: t >= 0.98 ? c.ok : c.soft, weight: t >= 0.98 ? 600 : 400 });
      const x0 = 1 + bw + 6, x1 = bx - 6, ym = y + h / 2;
      b.line([[x0, ym], [mix(x0, x1, t), ym]], c.ok, { dash: [3, 3], alpha: 0.8 });
      if (t >= 0.98) s.pen.tick(mix(x0, x1, 0.5), ym - 10, c.ok);
      b.text(t >= 0.98 ? 'the row matches' : 'reconciling…', w / 2, y + h + 22, { color: t >= 0.98 ? c.ok : c.soft, font: 'ui', weight: 500 });
    }, { height: () => 96 });
    const reconAnim = animator($('recon'), () => { reconView.t = reconAnim.value; recon.redraw(); });

    function win() {
      const two = D.explore(2).states, three = D.explore(3).states, pilot = D.explore(2, { markFirst: true }).lassos;
      $('win-two').textContent = String(two); $('win-three').textContent = String(three);
      $('win-was').textContent = String(pilot); $('win-now').textContent = String(D.explore(2).lassos);
      $('win-guess').textContent = 'The key and the lease were already doing their jobs in the pilot. The order was the bug: the books said paid before the bank had moved any money.';
      $('win').hidden = false;
      reconAnim.go(0, 1, 0.8);
      document.dispatchEvent(new CustomEvent('k:solved', { detail: 'act2' }));
      $('win').focus();
    }

    if (explore) {
      ['task', 'panel', 'spec', 'spec-note', 'lamps', 'win'].forEach(k => { $(k).hidden = true; });
      $('run').textContent = 'Try every behavior';
      K.ask($('ask'), {
        question: 'Predict first. In the unlucky behavior above (worker A stalls, the lease runs out, worker B receives the message too), how many of the nine steps does PayOnce see as a Pay step?',
        options: [['0', '0'], ['1', '1'], ['2', '2'], ['9', '9']], right: '1',
        hints: {
          0: 'The bank does make a transfer in that behavior. Which step makes it?',
          2: 'Two requests reach the bank, but count the steps where the transfers actually change.',
          9: 'Most steps leave the transfers alone. PayOnce sees only the status and the transfers.',
        },
        explain: 'Only Confirm(A), step 5, changes what PayOnce sees: approved, 0 becomes paid, 1. Worker B’s Confirm finds key 4471 already at the bank, so the transfers stay at 1. The table above is open now.',
        onSolved: () => { st.predicted = true; document.dispatchEvent(new CustomEvent('k:solved', { detail: 'act1' })); renderExplore(); },
        focusAfter: () => host.querySelector('.k-step'),
      });
      host.querySelectorAll('[data-map]').forEach(b => b.addEventListener('click', () => {
        st.map = b.dataset.map; renderExplore();
        if (!$('search').hidden) searchExplore();
      }));
      host.querySelectorAll('[data-workers]').forEach(b => b.addEventListener('click', () => {
        st.n = Number(b.dataset.workers); $('search').hidden = true; reset();
      }));
      $('reset').addEventListener('click', () => { reset(); $('reset').focus(); });
      $('play').addEventListener('click', playUnlucky);
      $('run').addEventListener('click', searchExplore);
      renderExplore();
    } else {
      ['lanes', 'translate', 'pair', 'pair-cap', 'strip', 'tally', 'play', 'jump'].forEach(k => { $(k).hidden = true; });
      $('run').textContent = 'Check refinement';
      $('run').disabled = true;
      $('reset').classList.add('quiet');
      K.ask($('ask'), {
        question: 'Predict before your first check. Take the pilot and turn its idempotency key off, keeping mark first and the lease. Which lamps go red?',
        options: [['first', 'only “every step is a Pay or a stutter”'], ['second', 'only “the Pay happens”'], ['both', 'both'], ['neither', 'neither']],
        right: 'both',
        hints: {
          first: 'The order is still mark first. What can a crash right after Mark do to the money?',
          second: 'Without the key, a second worker’s Confirm moves money again. What does PayOnce make of paid, 1 then paid, 2?',
          neither: 'Taking a safeguard away rarely fixes anything. Think about two workers, and about a crash after Mark.',
        },
        explain: 'Without the key, two workers can both mark and both send, so paid, 1 becomes paid, 2: a forbidden step. And mark first still lets a crash after Mark leave the money unsent forever. Check it with the panel, then fix the pilot.',
        onSolved: () => { st.guess = 'done'; $('run').disabled = false; renderFix(); },
        focusAfter: () => host.querySelector('[data-order]'),
      });
      const flip = (sel, apply) => host.querySelectorAll(sel).forEach(b => b.addEventListener('click', () => { apply(b); renderFix(); }));
      flip('[data-order]', b => { st.cfg.order = b.dataset.order; });
      flip('[data-key]', b => { st.cfg.key = b.dataset.key === 'on'; });
      flip('[data-lease]', b => { st.cfg.lease = b.dataset.lease === 'on'; });
      flip('[data-workers]', b => { st.cfg.n = Number(b.dataset.workers); });
      $('run').addEventListener('click', check);
      $('reset').addEventListener('click', () => {
        trace.anim.stop(); lasso.anim.stop(); reconAnim.stop();
        Object.assign(st, { cfg: { ...PILOT }, report: null });
        $('win').hidden = !st.solved;
        renderFix(); $('reset').focus();
      });
      renderFix();
    }
  }

  mount(document.getElementById('lab'), 'explore');
  document.getElementById('start-act2').addEventListener('click', () => {
    const holder = document.getElementById('act2-mount'), host = document.createElement('div');
    host.className = 'lab'; host.id = 'lab2';
    holder.replaceWith(host);
    mount(host, 'fix');
    host.querySelector('.k-ask button').focus();
  });
})();
