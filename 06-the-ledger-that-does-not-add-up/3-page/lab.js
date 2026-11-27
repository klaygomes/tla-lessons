/* Balance and escrow drawing adapted from the iwrzwr visual archive, Moment Balance (Visible Invariants) and Error Escrow (Procedural Marks) studies. MIT License, Copyright (c) 2026 Kagan Yaldizkaya. */
const Ledger = (() => {
  const POT = 200000;
  const AMOUNT = { 4471: 50000, 4472: 30000, 4473: 20000 };
  const OWNER = { 4471: 'bakery', 4472: 'florist', 4473: 'repair shop' };
  const loansOf = n => [4471, 4472, 4473].slice(0, n);
  const put = (t, i, v) => t.map((x, j) => (j === i ? v : x));
  const sum = xs => xs.reduce((a, b) => a + b, 0);
  const cap = w => w[0].toUpperCase() + w.slice(1);

  function twoWrites(loans, first, key, crash = true) {
    const second = first === 'debit' ? 'credit' : 'debit', mid = first === 'debit' ? 'debited' : 'credited';
    const init = () => ({ fund: POT, credit: loans.map(() => 0), pc: loans.map(() => 'todo'), crashed: false });
    const keyOf = s => `${s.fund}|${s.credit}|${s.pc}|${s.crashed}`;
    function write(kind, s, i) {
      const a = AMOUNT[loans[i]];
      if (kind === 'debit') return { fund: s.fund - a, credit: s.credit };
      return { fund: s.fund, credit: put(s.credit, i, key ? a : s.credit[i] + a) };
    }
    function steps(s) {
      const out = [];
      loans.forEach((l, i) => {
        if (s.pc[i] === 'todo') out.push({ action: cap(first), loan: l, work: true, next: { ...s, ...write(first, s, i), pc: put(s.pc, i, mid) } });
        if (s.pc[i] === mid) out.push({ action: cap(second), loan: l, work: true, next: { ...s, ...write(second, s, i), pc: put(s.pc, i, 'done') } });
        if (crash && !s.crashed && s.pc[i] === mid) out.push({ action: 'Crash', loan: l, work: false, next: { ...s, pc: put(s.pc, i, 'todo'), crashed: true } });
      });
      return out.map(x => ({ ...x, label: `${x.action}(${x.loan})` }));
    }
    const total = s => s.fund + sum(s.credit);
    const atRest = s => s.pc.every(p => p === 'todo' || p === 'done');
    const settled = s => s.credit.every((c, i) => c === AMOUNT[loans[i]]) && s.pc.every(p => p === 'done');
    return { kind: 'two', loans, first, mid, init, keyOf, steps, total, atRest, settled };
  }

  function outbox(loans, key, twoTxn) {
    const init = () => ({ fund: POT, credit: loans.map(() => 0), status: loans.map(() => 'approved'), outbox: loans.map(() => false), held: loans.map(() => false), crashed: false, pc: loans.map(() => 'idle') });
    const keyOf = s => `${s.fund}|${s.credit}|${s.status}|${s.outbox}|${s.held}|${s.crashed}|${s.pc}`;
    function steps(s) {
      const out = [];
      const add = (action, loan, work, next) => out.push({ action, loan, work, label: loan ? `${action}(${loan})` : action, next: { ...s, ...next } });
      loans.forEach((l, i) => {
        const a = AMOUNT[l];
        if (!twoTxn && s.status[i] === 'approved') add('Pay', l, true, { fund: s.fund - a, status: put(s.status, i, 'paid'), outbox: put(s.outbox, i, true) });
        if (twoTxn && s.status[i] === 'approved' && s.pc[i] === 'idle') add('Debit', l, true, { fund: s.fund - a, status: put(s.status, i, 'paid'), pc: put(s.pc, i, 'debited') });
        if (twoTxn && s.pc[i] === 'debited') add('Enqueue', l, true, { outbox: put(s.outbox, i, true), pc: put(s.pc, i, 'idle') });
        if (twoTxn && !s.crashed && s.pc[i] === 'debited') add('CrashWorker', l, false, { crashed: true, pc: put(s.pc, i, 'idle') });
        if (s.outbox[i] && !s.held[i]) add('Deliver', l, true, { credit: put(s.credit, i, key ? a : s.credit[i] + a), held: put(s.held, i, true) });
        if (s.held[i]) add('Ack', l, true, { outbox: put(s.outbox, i, false), held: put(s.held, i, false) });
      });
      if (!s.crashed && s.held.some(Boolean)) add('CrashRelay', null, false, { held: loans.map(() => false), crashed: true });
      return out;
    }
    const owed = s => sum(loans.map((l, i) => (s.outbox[i] && s.credit[i] === 0 ? AMOUNT[l] : 0)));
    const total = s => s.fund + owed(s) + sum(s.credit);
    const atRest = s => s.pc.every(p => p === 'idle');
    const settled = s => !s.outbox.some(Boolean) && s.credit.every((c, i) => c === AMOUNT[loans[i]]);
    return { kind: 'outbox', loans, twoTxn, init, keyOf, steps, total, owed, atRest, settled };
  }

  const DESIGNS = ['debit', 'credit', 'outbox2', 'outbox1'];
  function make(design, key, n, crash = true) {
    const loans = loansOf(n);
    if (design === 'debit' || design === 'credit') return twoWrites(loans, design, key, crash);
    return outbox(loans, key, design === 'outbox2');
  }

  function explore(spec) {
    const start = spec.init(), nodes = [{ state: start, parent: -1, step: null }], seen = new Map([[spec.keyOf(start), 0]]);
    for (let head = 0; head < nodes.length; head++) {
      spec.steps(nodes[head].state).forEach(step => {
        const k = spec.keyOf(step.next);
        if (seen.has(k)) return;
        seen.set(k, nodes.length);
        nodes.push({ state: step.next, parent: head, step });
      });
    }
    const pathTo = i => { const out = []; for (; i >= 0; i = nodes[i].parent) out.unshift({ label: nodes[i].step ? nodes[i].step.label : null, state: nodes[i].state }); return out; };
    const off = s => spec.atRest(s) && spec.total(s) !== POT;
    const stuck = s => !spec.settled(s) && !spec.steps(s).some(x => x.work && spec.keyOf(x.next) !== spec.keyOf(s));
    const firstBad = nodes.findIndex(n => off(n.state)), firstStuck = nodes.findIndex(n => stuck(n.state));
    return {
      count: nodes.length, nodes,
      rest: nodes.filter(n => spec.atRest(n.state)).length,
      bad: nodes.filter(n => off(n.state)).length,
      stuck: nodes.filter(n => stuck(n.state)).length,
      offBy: firstBad < 0 ? 0 : spec.total(nodes[firstBad].state) - POT,
      trace: firstBad < 0 ? null : pathTo(firstBad),
      lasso: firstStuck < 0 ? null : pathTo(firstStuck),
      offs: [...new Set(nodes.filter(n => off(n.state)).map(n => spec.total(n.state) - POT))].sort((a, b) => a - b),
    };
  }

  function replay(spec, labels) {
    let s = spec.init();
    const out = [{ label: null, state: s }];
    labels.forEach(want => { s = spec.steps(s).find(x => x.label === want).next; out.push({ label: want, state: s }); });
    return out;
  }

  return { POT, AMOUNT, OWNER, DESIGNS, loansOf, make, explore, replay, twoWrites };
})();

if (typeof module === 'object' && module.exports) module.exports = Ledger;
else (() => {
  const K = window.Kit, L = Ledger, POT = L.POT;
  const MINUS = '−';
  const num = n => `${n < 0 ? MINUS : ''}${Math.abs(n).toLocaleString('en-US')}`;
  const euros = n => `${n < 0 ? MINUS : ''}€${Math.abs(n).toLocaleString('en-US')}`;
  const signed = n => (n > 0 ? `+${euros(n)}` : euros(n));
  const clamp = (n, a = 0, b = 1) => Math.min(b, Math.max(a, n));
  const mix = (a, b, p) => a + (b - a) * p;
  const easeOut = t => (t >= 1 ? 1 : 1 - 2 ** (-10 * t));
  const MAX_TILT = 0.2;
  const DESIGN_NAME = { debit: 'two writes, debit first', credit: 'two writes, credit first', outbox2: 'outbox, separate transaction', outbox1: 'outbox, same transaction' };

  function brush(s) {
    const { ctx } = s, dpr = s.dpr || 1;
    const snapFor = width => { const offset = Math.round(width * dpr) % 2 ? 0.5 : 0; return v => (Math.round(v * dpr - offset) + offset) / dpr; };
    const ink = (alpha, color) => { ctx.globalAlpha = clamp(alpha); ctx.fillStyle = color; ctx.strokeStyle = color; };
    const b = {
      line(points, color, { alpha = 1, width = 1, dash = null } = {}) {
        if (points.length < 2) return;
        const snap = snapFor(width);
        ink(alpha, color); ctx.lineWidth = width; ctx.lineCap = 'butt'; ctx.lineJoin = 'miter'; ctx.setLineDash(dash || []);
        ctx.beginPath(); points.forEach(([x, y], i) => (i ? ctx.lineTo(snap(x), snap(y)) : ctx.moveTo(snap(x), snap(y)))); ctx.stroke();
        ctx.setLineDash([]); ctx.globalAlpha = 1;
      },
      fill(x, y, w, h, color, alpha = 1) { ink(alpha, color); ctx.fillRect(x, y, w, h); ctx.globalAlpha = 1; },
      box(x, y, w, h, color, opts) { b.line([[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]], color, opts); },
      poly(points, color, alpha = 1) { ink(alpha, color); ctx.beginPath(); points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1; },
      hatch(x, y, w, h, color, alpha = 0.5) {
        ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
        for (let d = -h; d < w; d += 7) b.line([[x + d, y + h], [x + d + h, y]], color, { alpha });
        ctx.restore();
      },
      text(str, x, y, opts) { s.pen.text(str, x, y, { size: 12, ...opts }); },
      width(str, size = 12, font = 'mono') {
        const family = getComputedStyle(document.documentElement).getPropertyValue(font === 'mono' ? '--font-mono' : '--font-ui').trim();
        ctx.font = `400 ${size}px ${family}`; return ctx.measureText(str).width;
      },
    };
    return b;
  }

  function balanceGeometry(w) {
    const phone = w < 520, arm = Math.min(phone ? w * 0.31 : w * 0.3, 240), col = phone ? Math.max(72, arm * 0.78) : 132;
    const swing = arm * Math.sin(MAX_TILT), pivotY = 30 + swing, scale = phone ? 0.00058 : 0.00052;
    return { phone, arm, col, pivotY, scale, height: pivotY + swing + 26 + 340000 * scale + 30 };
  }

  function drawBalance(s, view) {
    const { c, w } = s, b = brush(s), g = balanceGeometry(w), st = view.state, spec = view.spec;
    const cx = w / 2, th = view.theta, cos = Math.cos(th), sin = Math.sin(th);
    const end = side => [cx + side * g.arm * cos, g.pivotY + side * g.arm * sin];
    const total = spec.total(st), diff = total - POT, rest = spec.atRest(st);
    b.line([[cx - g.arm - g.col / 2, g.pivotY], [cx + g.arm + g.col / 2, g.pivotY]], c.soft, { alpha: 0.6, dash: [2, 4] });
    if (!g.phone) b.text('level', cx + g.arm + g.col / 2, g.pivotY - 6, { align: 'right', color: c.soft, font: 'ui' });
    b.line([end(-1), end(1)], c.ink, { width: 2 });
    b.poly([[cx, g.pivotY + 2], [cx - 9, g.pivotY + 18], [cx + 9, g.pivotY + 18]], rest && diff !== 0 ? c.accent : c.ink, 0.9);
    const label = (name, amount, x, y, h, color, weight = 400) => {
      const full = `${name} ${num(amount)}`, cx0 = x + g.col / 2;
      const lines = h < 16 ? [] : b.width(full) <= g.col - 8 ? [full] : h >= 30 ? [name, num(amount)] : [num(amount)];
      lines.forEach((t, i) => b.text(t, cx0, y + h / 2 + 4 - (lines.length - 1) * 7 + i * 14, { color, weight }));
    };
    const hang = (side, title) => {
      const [ex, ey] = end(side), x = ex - g.col / 2, top = ey + 22;
      b.line([[ex, ey], [ex, top]], c.ink, { alpha: 0.7 });
      b.line([[x - 4, top], [x + g.col + 4, top]], c.ink, { width: 1.5 });
      b.text(title, ex, ey - 8, { color: c.ink, font: 'ui', weight: 500 });
      return { x, y: top + 2 };
    };
    const potAt = hang(-1, 'the pot'), ph = POT * g.scale;
    b.box(potAt.x, potAt.y, g.col, ph, c.soft, { dash: [3, 3] });
    label('pot', POT, potAt.x, potAt.y, ph, c.soft);
    const at = hang(1, 'the ledgers');
    let y = at.y;
    [{ name: 'treasury', amount: st.fund, fill: c.paper2 }, ...spec.loans.map((l, i) => ({ name: String(l), amount: st.credit[i], fill: c.paper }))].forEach(k => {
      if (!k.amount) return;
      const h = k.amount * g.scale;
      b.fill(at.x, y, g.col, h, k.fill); b.box(at.x, y, g.col, h, c.ink, { alpha: 0.75 });
      label(k.name, k.amount, at.x, y, h, c.ink);
      y += h;
    });
    if (rest && diff > 0) {
      const y0 = at.y + ph, h = diff * g.scale;
      b.hatch(at.x, y0, g.col, h, c.accent, 0.35);
      b.box(at.x, y0, g.col, h, c.accent, { width: 1.5 });
    }
    if (diff < 0) {
      const h = -diff * g.scale;
      b.box(at.x, y, g.col, h, rest ? c.accent : c.soft, { width: 1.5, dash: [3, 3] });
      label(rest ? 'nowhere' : 'not in a ledger', -diff, at.x, y, h, rest ? c.accentInk : c.soft, rest ? 500 : 400);
    }
    b.line([[at.x - 8, at.y + ph], [at.x + g.col + 8, at.y + ph]], c.soft, { dash: [2, 3] });
    const tag = rest ? (diff === 0 ? 'adds up' : `${signed(diff)} at rest`) : 'mid-transfer';
    b.text(`total ${euros(total)} · ${tag}`, cx, g.height - 10, { color: rest && diff ? c.accentInk : c.ink, font: 'ui', weight: 500 });
  }

  function thetaFor(spec, st) {
    const diff = spec.total(st) - POT;
    return clamp(diff / 100000 * 0.17, -MAX_TILT, MAX_TILT);
  }

  function drawEscrow(s, view) {
    const { c, w } = s, b = brush(s), trace = view.trace;
    if (!trace) return;
    const n = trace.length, phone = w < 520, left = phone ? 40 : 64, usable = w - left - 8, pitch = usable / Math.max(n, 4);
    const base = s.h - 40, scale = (base - 30) / 340000;
    const yOf = v => base - v * scale, x = i => left + (i + 0.5) * pitch;
    b.text('pot', left - 8, yOf(POT) + 4, { align: 'right', color: c.soft, font: 'ui' });
    b.text('€0', left - 8, base + 4, { align: 'right', color: c.soft, font: 'ui' });
    b.line([[left, yOf(POT)], [left + usable, yOf(POT)]], c.soft, { alpha: 0.5, dash: [2, 4] });
    b.line([[left, base], [left + usable, base]], c.rule);
    const shown = Math.min(n, Math.floor(view.p) + 1);
    for (let i = 0; i < shown; i++) {
      const t = view.totals[i], bad = view.bad[i], solved = view.solved, at = x(i);
      const color = bad ? c.accent : solved ? c.ok : c.ink, grow = i === shown - 1 && view.p < n - 1 ? easeOut(view.p - i) : 1;
      b.line([[at - 5, yOf(POT)], [at + 5, yOf(POT)]], c.soft, { alpha: 0.9 });
      b.line([[at, base], [at, mix(base, yOf(t), grow)]], color, { width: bad ? 3 : 2 });
      if (view.owed && view.owed[i]) b.line([[at + 4, yOf(t)], [at + 4, yOf(t - view.owed[i])]], color, { width: 1, dash: [2, 2] });
      b.text(String(i), at, base + 16, { color: c.soft });
      if (bad && grow >= 1) {
        const d = t - POT;
        b.line([[at, yOf(POT)], [at, yOf(t)]], c.accent, { width: 3 });
        b.line([[at - 7, yOf(t)], [at + 7, yOf(t)]], c.accent, { width: 1.5 });
        const label = signed(d), lw = b.width(label);
        const lx = at + 10 + lw > w - 4 ? at - 10 : at + 10;
        b.text(label, lx, yOf(t) + (d < 0 ? 16 : -6), { align: lx < at ? 'right' : 'left', color: c.accentInk, weight: 500 });
      }
    }
  }

  function strip(ol, trace, spec, { lasso = false, solved = false } = {}) {
    const items = trace.map((t, i) => {
      const li = document.createElement('li'), s = t.state, total = spec.total(s), rest = spec.atRest(s), bad = rest && total !== POT && !solved;
      if (bad) li.className = 'k-bad';
      const rows = [[`${i} · ${t.label || 'start'}`, 'k-card-step'], [`treasury ${num(s.fund)}`]];
      rows.push([spec.loans.map((l, j) => `${l}: ${num(s.credit[j])}`).join(' · ')]);
      if (spec.kind === 'outbox') {
        const rows2 = spec.loans.filter((l, j) => s.outbox[j]);
        rows.push([`outbox ${rows2.length ? `{${rows2.join(', ')}}` : '{}'}${s.held.some(Boolean) ? ` · held {${spec.loans.filter((l, j) => s.held[j]).join(', ')}}` : ''}`]);
      } else rows.push([spec.loans.map((l, j) => s.pc[j]).join(' · ')]);
      rows.push([`total ${num(total)}${bad ? ` (${signed(total - POT)})` : rest ? '' : ' · mid-transfer'}`, 'k-card-t']);
      rows.forEach(([text, cls]) => { const span = document.createElement('span'); span.textContent = text; if (cls) span.className = cls; li.append(span); });
      return li;
    });
    if (lasso) {
      const last = trace[trace.length - 1].state, li = document.createElement('li');
      li.className = 'k-loop';
      const open = spec.loans.filter((l, j) => last.credit[j] !== L.AMOUNT[l] || (spec.kind === 'outbox' && last.outbox[j]));
      [[`${trace.length} · Stuttering ↺`, 'k-card-step'], ['no work step is enabled'], [`never settles: ${open.join(', ')}`]].forEach(([text, cls]) => { const span = document.createElement('span'); span.textContent = text; if (cls) span.className = cls; li.append(span); });
      items.push(li);
    }
    ol.replaceChildren(...items);
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

  function specLines(cfg) {
    const loans = L.loansOf(cfg.loans), lines = [{ text: `Loans ≜ {${loans.join(', ')}}`, changed: cfg.loans !== 2 }];
    const credit = cfg.key ? 'credit′[l] = Amount[l]' : 'credit′[l] = credit[l] + Amount[l]';
    if (cfg.design === 'debit' || cfg.design === 'credit') {
      const df = cfg.design === 'debit', mid = df ? 'debited' : 'credited', flip = !df;
      const debit = `fund′ = fund − Amount[l]`;
      lines.push({ text: `${df ? 'Debit(l) ' : 'Credit(l)'} ≜ pc[l] = "todo" ∧ pc′[l] = "${mid}"`, changed: flip });
      lines.push({ text: `             ∧ ${df ? debit : credit}`, changed: flip || (!df && cfg.key) });
      lines.push({ text: `${df ? 'Credit(l)' : 'Debit(l) '} ≜ pc[l] = "${mid}" ∧ pc′[l] = "done"`, changed: flip });
      lines.push({ text: `             ∧ ${df ? credit : debit}`, changed: flip || (df && cfg.key) });
      lines.push({ text: `Crash(l)  ≜ ¬crashed ∧ pc[l] = "${mid}"`, changed: flip });
      lines.push({ text: '             ∧ pc′[l] = "todo" ∧ crashed′ = TRUE' });
      return lines;
    }
    if (cfg.design === 'outbox2') {
      lines.push({ text: 'Debit(l)   ≜ status[l] = "approved" ∧ pc[l] = "idle"', changed: true });
      lines.push({ text: '              ∧ status′[l] = "paid" ∧ fund′ = fund − Amount[l]', changed: true });
      lines.push({ text: '              ∧ pc′[l] = "debited"', changed: true });
      lines.push({ text: 'Enqueue(l) ≜ pc[l] = "debited" ∧ outbox′ = outbox ∪ {l}', changed: true });
      lines.push({ text: '              ∧ pc′[l] = "idle"', changed: true });
      lines.push({ text: 'CrashWorker(l) ≜ ¬crashed ∧ pc[l] = "debited"', changed: true });
      lines.push({ text: '              ∧ pc′[l] = "idle" ∧ crashed′ = TRUE', changed: true });
    } else {
      lines.push({ text: 'Pay(l)     ≜ status[l] = "approved" ∧ status′[l] = "paid"', changed: true });
      lines.push({ text: '              ∧ fund′ = fund − Amount[l] ∧ outbox′ = outbox ∪ {l}', changed: true });
    }
    lines.push({ text: 'Deliver(l) ≜ l ∈ outbox ∧ l ∉ held ∧ held′ = held ∪ {l}', changed: true });
    lines.push({ text: `              ∧ ${credit}`, changed: true });
    lines.push({ text: 'Ack(l)     ≜ l ∈ held ∧ outbox′ = outbox \\ {l} ∧ held′ = held \\ {l}', changed: true });
    lines.push({ text: 'CrashRelay ≜ ¬crashed ∧ held ≠ {} ∧ held′ = {} ∧ crashed′ = TRUE', changed: true });
    return lines;
  }

  function feedback(cfg, r) {
    const n = cfg.loans;
    if (cfg.design === 'debit') return `${r.count} states; short by ${euros(-r.offBy)} two steps in.${cfg.key ? ' The key changes nothing here: the step that repeats is a debit.' : ''}`;
    if (cfg.design === 'credit' && !cfg.key) return `${r.count} states; over by ${euros(r.offBy)}, and a retry credits the bakery twice.`;
    if (cfg.design === 'credit') return `${r.count} states; every finished run adds up, but right after the crash the books show ${euros(POT + r.offBy)}. Month-end can run at any moment.`;
    if (cfg.design === 'outbox2') return `${r.count} states; short by ${euros(-r.offBy)} in two steps: the debit committed, the row never did, and the loan never settles.`;
    if (!cfg.key) return `${r.count} states; Pay, Deliver, relay crash, Deliver: the bakery’s account shows €100,000.`;
    return null;
  }

  function predict(root, { question, options, right, why, onAnswered }) {
    const q = document.createElement('p'); q.className = 'k-q'; q.textContent = question;
    const row = document.createElement('div'); row.className = 'row'; row.setAttribute('role', 'group'); row.setAttribute('aria-label', question);
    const fb = document.createElement('p'); fb.className = 'k-feedback'; fb.tabIndex = -1; fb.setAttribute('aria-live', 'polite');
    const buttons = options.map(([value, label]) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = label;
      b.addEventListener('click', () => {
        buttons.forEach(x => { x.disabled = true; });
        b.setAttribute('aria-pressed', 'true');
        if (right === undefined) fb.textContent = `Noted: “${label}”. Now pick a design and let the checker tell you.`;
        else if (value === right) { b.classList.add('k-right'); fb.textContent = `Right. ${why[value]}`; }
        else { b.classList.add('k-missed'); fb.classList.add('k-bad'); fb.textContent = `Not ${label}. ${why[value]}`; }
        onAnswered(value);
      });
      return b;
    });
    row.append(...buttons);
    root.replaceChildren(q, row, fb);
  }

  function mount(host, mode) {
    host.replaceChildren(document.getElementById('ledger-lab').content.cloneNode(true));
    const uid = `${host.id}-`, $ = k => host.querySelector(`[data-k="${k}"]`);
    host.querySelectorAll('[data-k]').forEach(el => { el.id = uid + el.dataset.k; });
    return mode === 'explore' ? explore(host, $) : fix(host, $);
  }

  function explore(host, $) {
    ['task', 'design', 'spec-note', 'spec', 'checker', 'win', 'run'].forEach(k => { $(k).hidden = true; });
    const st = { predicted: false, order: 'debit', spec: null, state: null, trail: [], found: { debit: new Set(), credit: new Set() }, theta: 0, target: 0, revealed: false, lastOff: null };
    const reset = () => { st.spec = L.make(st.order, false, 2); st.state = st.spec.init(); st.trail = [{ label: null, state: st.state }]; st.lastOff = null; st.target = thetaFor(st.spec, st.state); };
    reset(); st.theta = st.target;
    const stage = K.stage($('scene'), s => drawBalance(s, { spec: st.spec, state: st.state, theta: st.theta }), { height: w => balanceGeometry(w).height });
    const tilt = animator($('scene'), () => { st.theta = mix(st.from, st.target, easeOut(tilt.value)); stage.redraw(); });
    const swing = () => { st.from = st.theta; tilt.go(0, 1, 1.4); };

    function lanes() {
      const lane = $('lanes');
      lane.replaceChildren(...st.spec.loans.map((l, i) => {
        const box = document.createElement('div'); box.className = 'k-lane';
        const name = document.createElement('span'); name.className = 'k-lane-name'; name.textContent = `Loan ${l} · ${L.OWNER[l]} · ${euros(L.AMOUNT[l])}`;
        const where = document.createElement('span'); where.className = 'k-lane-note'; where.textContent = `job: ${st.state.pc[i]}`;
        const row = document.createElement('div'); row.className = 'row';
        const steps = st.spec.steps(st.state).filter(x => x.loan === l);
        steps.forEach(step => {
          const b = document.createElement('button'); b.type = 'button';
          b.className = step.action === 'Crash' ? 'k-crash' : 'k-step';
          b.textContent = step.action === 'Crash' ? 'Deploy: crash this job' : `${step.action} ${l}`;
          b.disabled = !st.predicted;
          b.addEventListener('click', () => take(step));
          row.append(b);
        });
        if (!steps.length) { const note = document.createElement('span'); note.className = 'k-lane-note'; note.textContent = 'done'; row.append(note); }
        if (st.state.crashed && st.state.pc[i] === st.spec.mid) { const note = document.createElement('span'); note.className = 'k-lane-note'; note.textContent = 'the one deploy is used'; row.append(note); }
        box.append(name, where, row);
        return box;
      }));
    }

    function take(step) {
      st.state = step.next;
      st.trail.push({ label: step.label, state: st.state });
      const total = st.spec.total(st.state);
      if (st.spec.atRest(st.state) && total !== POT) { st.found[st.order].add(st.spec.keyOf(st.state)); st.lastOff = total - POT; } else st.lastOff = null;
      st.target = thetaFor(st.spec, st.state); swing();
      render();
      const next = host.querySelector('[data-k="lanes"] button:not(:disabled)');
      (next || $('reset')).focus();
    }

    function lamp() {
      const s = st.state, rest = st.spec.atRest(s), d = st.spec.total(s) - POT, el = $('lamp');
      el.className = `k-lamp ${!rest ? 'k-lamp-off' : d ? 'k-lamp-bad' : 'k-lamp-even'}`;
      el.querySelector('.k-lamp-text').textContent = !rest ? 'Books add up? Not checked: a job is between its two writes.' : d ? `Books add up? No: ${d < 0 ? 'short' : 'over'} by ${euros(Math.abs(d))}.` : 'Books add up? Yes, every job is at rest and the total is the pot.';
    }

    function why() {
      if (!st.predicted) return 'Answer the question above to unlock the desk.';
      const n = st.trail.length - 1;
      if (st.lastOff !== null) return `Every write moved the right amount. The books are ${euros(Math.abs(st.lastOff))} ${st.lastOff < 0 ? 'short' : 'over'}.`;
      if (!n) return `You are the scheduler. Each button is the next write that job may make, ${st.order} first. A deploy can hit a job between its two writes, once per run.`;
      const done = !st.spec.steps(st.state).length;
      if (done) return `Both jobs are done. Total ${euros(st.spec.total(st.state))}. Press Reset and try another run, or switch the order.`;
      const mid = st.state.pc.some(p => p === st.spec.mid);
      return mid ? `Step ${n}: ${st.trail[n].label}. A job is between its writes: this is the moment a deploy can land.` : `Step ${n}: ${st.trail[n].label}. Pick the next write.`;
    }

    function tally() {
      const p = $('tally'), parts = ['At-rest states off the pot you found: '];
      ['debit', 'credit'].forEach((o, i) => {
        const k = st.found[o].size, span = document.createElement('span');
        span.className = k ? 'k-bad-n' : ''; span.textContent = String(k);
        parts.push(`${i ? ' · ' : ''}${o} first `, span);
      });
      p.replaceChildren(...parts);
      if (st.found.debit.size && st.found.credit.size && !st.revealed) { st.revealed = true; document.dispatchEvent(new CustomEvent('k:act1')); }
      $('reveal').hidden = !st.revealed;
    }

    function render() {
      host.querySelectorAll('[data-order]').forEach(b => { b.setAttribute('aria-pressed', String(b.dataset.order === st.order)); b.disabled = !st.predicted; });
      lanes(); lamp(); tally();
      $('why').textContent = why();
      strip($('strip'), st.trail, st.spec);
      const s = st.state;
      $('scene').setAttribute('aria-label', `Balance: the pot ${euros(POT)} against the treasury ${euros(s.fund)} plus loan accounts ${st.spec.loans.map((l, i) => `${l} ${euros(s.credit[i])}`).join(', ')}; total ${euros(st.spec.total(s))}.`);
      stage.redraw();
    }

    predict($('ask'), {
      question: 'Predict first. A deploy can land between the two writes. Which order is safe?',
      options: [['debit', 'debit first'], ['credit', 'credit first'], ['neither', 'neither']], right: 'neither',
      why: {
        neither: 'Now find the crash that breaks each order below.',
        debit: 'That is this month’s order. Drop a deploy between its writes below and watch the total.',
        credit: 'Switch to credit first below, drop a deploy between its writes, and watch the total.',
      },
      onAnswered: () => { st.predicted = true; render(); host.querySelector('[data-k="lanes"] button').focus(); },
    });
    host.querySelectorAll('[data-order]').forEach(b => b.addEventListener('click', () => { st.order = b.dataset.order; tilt.stop(); reset(); st.theta = st.target; render(); }));
    $('reset').addEventListener('click', () => { tilt.stop(); reset(); swing(); render(); $('reset').focus(); });
    render();
  }

  function fix(host, $) {
    ['lanes', 'order', 'lamp', 'cards-note', 'strip', 'tally', 'reveal', 'scene-wrap', 'jump'].forEach(k => { $(k).hidden = true; });
    const st = { cfg: { design: 'debit', key: false, loans: 2 }, report: null, passed: new Set(), solved: false, guess: null, view: null, p: 0 };
    const escrow = K.stage($('escrow'), s => drawEscrow(s, { ...st.view, p: st.p }), { height: w => (st.view ? (w < 520 ? 200 : 220) : 1) });
    const grow = animator($('escrow'), () => { st.p = grow.value; escrow.redraw(); });
    const winView = { p: 0 };
    const winStage = K.stage($('win-scene'), s => drawEscrow(s, { ...winView.data, p: winView.p }), { height: w => (w < 520 ? 200 : 220) });
    const winGrow = animator($('win-scene'), () => { winView.p = winGrow.value; winStage.redraw(); });

    function viewOf(spec, trace, solved = false) {
      return { trace, solved, totals: trace.map(t => spec.total(t.state)), bad: trace.map(t => !solved && spec.atRest(t.state) && spec.total(t.state) !== POT), owed: spec.kind === 'outbox' ? trace.map(t => spec.owed(t.state)) : null };
    }

    function lampSet(el, ok, text) {
      el.className = `k-lamp ${ok ? 'k-lamp-ok' : 'k-lamp-bad'}`;
      el.querySelector('.k-lamp-text').textContent = text;
    }

    function run() {
      const cfg = { ...st.cfg }, spec = L.make(cfg.design, cfg.key, cfg.loans), r = L.explore(spec);
      st.report = { cfg, r, spec };
      const pass = !r.trace && !r.lasso;
      if (pass && cfg.design === 'outbox1' && cfg.key) st.passed.add(cfg.loans);
      $('checker').hidden = false;
      $('states').textContent = `Explored ${r.count} reachable states with ${cfg.loans} loans, ${DESIGN_NAME[cfg.design]}, ${cfg.key ? 'keyed' : 'plain'} credit, one deploy per run.`;
      const where = cfg.design === 'outbox1' ? 'in every state' : 'at rest';
      lampSet($('lamp-safe'), !r.trace, r.trace ? `Books add up ${where}: no. ${r.bad} states are off, the first ${r.trace.length - 1} steps in (${signed(r.offBy)}).` : `Books add up ${where}: yes, in all ${r.count} reachable states.`);
      lampSet($('lamp-live'), !r.lasso, r.lasso ? `Every loan settles (its account ends at exactly its amount): no. ${r.stuck} states have no work left and a loan unsettled.` : 'Every loan settles (its account ends at exactly its amount): yes, on every fair behavior.');
      $('trace').hidden = !r.trace;
      $('lasso').hidden = !r.lasso;
      if (r.trace) {
        $('trace-title').textContent = `The shortest run to books that do not add up, ${r.trace.length - 1} steps:`;
        strip($('trace-strip'), r.trace, spec);
        st.view = viewOf(spec, r.trace); st.p = 0; escrow.resize();
        $('escrow').setAttribute('aria-label', `Total after each step: ${st.view.totals.map(num).join(', ')}; the pot is ${num(POT)}.`);
        grow.go(0, r.trace.length - 1, 2.2);
      } else { st.view = null; escrow.resize(); }
      if (r.lasso) {
        $('lasso-title').textContent = `A fair behavior that never settles: ${r.lasso.length - 1} steps, then nothing left to do.`;
        strip($('lasso-strip'), r.lasso, spec, { lasso: true });
      }
      const both = st.passed.has(2) && st.passed.has(3);
      $('why').textContent = feedback(cfg, r) || (both ? `${r.count} states, both green: fixed.` : cfg.loans === 2 ? `${r.count} states, both green. Try 3 before you ship.` : `${r.count} states, both green. Run it with 2 loans as well before you ship.`);
      $('why').className = pass ? 'k-good' : '';
      if (both && !st.solved) win();
      render();
    }

    function win() {
      st.solved = true;
      const two = L.explore(L.make('outbox1', true, 2)).count, three = L.explore(L.make('outbox1', true, 3)).count;
      $('win-two').textContent = String(two); $('win-three').textContent = String(three);
      $('win-guess').textContent = st.guess === 'x5'
        ? `Your prediction was right: a third loan multiplies the states, ${two} to ${three}.`
        : `You predicted ${st.guessLabel}. The checker counted ${three}: a third loan multiplies the states rather than adding to them.`;
      const spec = L.make('outbox1', true, 2);
      const run = L.replay(spec, ['Pay(4471)', 'Deliver(4471)', 'CrashRelay', 'Deliver(4471)', 'Ack(4471)', 'Pay(4472)', 'Deliver(4472)', 'Ack(4472)']);
      winView.data = viewOf(spec, run, true); winView.p = 0;
      $('win').hidden = false;
      winStage.resize();
      winGrow.go(0, run.length - 1, 2.4);
      document.dispatchEvent(new CustomEvent('k:solved', { detail: 'act2' }));
      $('win').focus();
    }

    function render() {
      const cfg = st.cfg, rep = st.report;
      host.querySelectorAll('[data-design]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.design === cfg.design)));
      host.querySelectorAll('[data-key]').forEach(b => b.setAttribute('aria-pressed', String((b.dataset.key === 'on') === cfg.key)));
      host.querySelectorAll('[data-loans]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.loans) === cfg.loans)));
      $('spec').replaceChildren(...specLines(cfg).map(l => { const span = document.createElement('span'); span.className = `k-line${st.prevSpec && !st.prevSpec.has(l.text) ? ' k-changed' : ''}`; span.textContent = l.text; return span; }));
      const stale = rep && JSON.stringify(rep.cfg) !== JSON.stringify(cfg);
      if (stale) { $('checker').hidden = true; $('why').className = ''; $('why').textContent = 'You changed the desk since the last run. Run the checker again.'; }
      else if (!rep) $('why').textContent = st.guess ? 'Pick a design, the credit and the number of loans, then press “Run the checker”.' : 'Answer the question above to unlock the checker.';
      $('run').disabled = !st.guess;
    }

    const GUESS = [['x1', 'about 55'], ['x5', 'about 180'], ['x25', 'about 1,000']];
    predict($('ask'), {
      question: 'Before your first run: the fixed desk has 37 reachable states with two loans. About how many with three?',
      options: GUESS, right: 'x5',
      why: {
        x5: 'The checker will give the exact count when you run three loans.',
        x1: 'A third loan does not add a few states, it multiplies them. Run three loans and count.',
        x25: 'Fewer than that. Run three loans and count.',
      },
      onAnswered: value => { st.guess = value; st.guessLabel = GUESS.find(([v]) => v === value)[1]; render(); host.querySelector('[data-design]').focus(); },
    });
    const change = f => { st.prevSpec = new Set(specLines(st.cfg).map(l => l.text)); f(); render(); };
    host.querySelectorAll('[data-design]').forEach(b => b.addEventListener('click', () => change(() => { st.cfg.design = b.dataset.design; })));
    host.querySelectorAll('[data-key]').forEach(b => b.addEventListener('click', () => change(() => { st.cfg.key = b.dataset.key === 'on'; })));
    host.querySelectorAll('[data-loans]').forEach(b => b.addEventListener('click', () => change(() => { st.cfg.loans = Number(b.dataset.loans); })));
    $('run').addEventListener('click', run);
    $('reset').classList.add('quiet');
    $('reset').addEventListener('click', () => {
      grow.stop();
      Object.assign(st, { cfg: { design: 'debit', key: false, loans: 2 }, report: null, view: null, prevSpec: null });
      $('checker').hidden = true; $('why').className = '';
      render(); $('reset').focus();
    });
    render();
  }

  mount(document.getElementById('lab'), 'explore');
  const startAct2 = document.getElementById('start-act2');
  startAct2.disabled = true;
  document.addEventListener('k:act1', () => { startAct2.disabled = false; document.getElementById('act2-gate').hidden = true; });
  document.getElementById('start-act2').addEventListener('click', () => {
    const holder = document.getElementById('act2-mount'), host = document.createElement('div');
    host.className = 'lab'; host.id = 'lab2';
    holder.replaceWith(host);
    mount(host, 'fix');
    host.querySelector('.k-predict button').focus();
  });
})();
