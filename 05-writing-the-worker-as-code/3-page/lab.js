/* Code-and-gates drawing adapted from the iwrzwr visual archive, Section Gate and Choke Pair studies. MIT License, Copyright (c) 2026 Kagan Yaldizkaya. */
const LabelDesk = (() => {
  const NAMES = 'ABC';
  const STATEMENTS = ['test', 'claimed', 'send', 'mark'];
  const CUTS = [['check', 'claim'], ['claim', 'send'], ['send', 'mark']];

  const keyOfCuts = cuts => cuts.map(Number).join('');

  function blocks(cuts) {
    const out = [];
    let cur = [];
    STATEMENTS.forEach((s, i) => {
      if (i > 0 && cuts[i - 1]) { out.push(cur); cur = []; }
      cur.push(s);
    });
    out.push(cur);
    return out;
  }

  function translate(cuts) {
    const bs = blocks(cuts);
    const labels = bs.map((b, i) => ({ name: i === 0 ? (b.includes('claimed') ? 'claim' : 'check') : { claimed: 'claim', send: 'send', mark: 'mark' }[b[0]], statements: b }));
    const bad = labels.find(l => l.statements.includes('claimed') && l.statements.includes('mark'));
    return { ok: !bad, cuts: [...cuts], key: keyOfCuts(cuts), labels, refusedAt: bad ? bad.name : null };
  }

  const initial = workers => ({ status: 'approved', transfers: 0, pc: Array(workers).fill(null) });
  const keyOf = s => `${s.status}|${s.transfers}|${s.pc.join(',')}`;
  const breaks = s => s.transfers > 1;

  function stepOf(spec, s, w) {
    const at = s.pc[w] ?? spec.labels[0].name;
    const index = spec.labels.findIndex(l => l.name === at);
    if (index < 0) return null;
    let { status, transfers } = s;
    const ran = [];
    let to = index + 1 < spec.labels.length ? spec.labels[index + 1].name : 'Done';
    for (const st of spec.labels[index].statements) {
      ran.push(st);
      if (st === 'test' && status !== 'approved') { to = 'Done'; break; }
      if (st === 'claimed') status = 'claimed';
      if (st === 'send') transfers += 1;
      if (st === 'mark') status = 'paid';
    }
    const pc = s.pc.map((p, i) => (i === w ? to : p ?? spec.labels[0].name));
    return { worker: w, label: `${at}(${NAMES[w]})`, name: at, ran, before: s, next: { status, transfers, pc } };
  }

  function steps(spec, s) {
    return s.pc.map((_, w) => stepOf(spec, s, w)).filter(Boolean);
  }

  function explore(spec, workers) {
    const start = { ...initial(workers), pc: Array(workers).fill(spec.labels[0].name) };
    const nodes = [{ state: start, parent: -1, step: null }];
    const seen = new Set([keyOf(start)]);
    let firstBad = -1;
    for (let head = 0; head < nodes.length; head++) {
      const node = nodes[head];
      if (firstBad < 0 && breaks(node.state)) firstBad = head;
      steps(spec, node.state).forEach(step => {
        const key = keyOf(step.next);
        if (seen.has(key)) return;
        seen.add(key);
        nodes.push({ state: step.next, parent: head, step });
      });
    }
    const path = [];
    for (let i = firstBad; i >= 0; i = nodes[i].parent) path.unshift(i);
    return {
      workers, count: nodes.length, pass: firstBad < 0,
      trace: firstBad < 0 ? null : path.map(i => ({ step: nodes[i].step, state: nodes[i].state })),
    };
  }

  function sample(spec, workers) {
    let s = { ...initial(workers), pc: Array(workers).fill(spec.labels[0].name) };
    const out = [{ step: null, state: s }];
    const order = [0, ...(workers > 1 ? [1] : [])];
    for (let w = 0; w < workers; w++) order.push(...Array(spec.labels.length + 1).fill(w));
    order.forEach(w => {
      const step = stepOf(spec, s, w);
      if (!step) return;
      s = step.next;
      out.push({ step, state: s });
    });
    return out;
  }


  return { NAMES, STATEMENTS, CUTS, keyOfCuts, translate, explore, sample, steps, breaks };
})();

if (typeof module === 'object' && module.exports) module.exports = LabelDesk;
else (() => {
  const K = window.Kit, D = LabelDesk, NAMES = D.NAMES;
  const clamp = (n, a = 0, b = 1) => Math.min(b, Math.max(a, n));
  const easeOut = t => (t >= 1 ? 1 : 1 - 2 ** (-10 * t));
  const ROW_NAMES = { test: 'if approved', claimed: 'claimed', send: '+1 transfer', mark: 'paid' };
  const CUT_WORDS = cuts => {
    const on = D.CUTS.filter((_, i) => cuts[i]).map(([a, b]) => `${a} | ${b}`);
    return on.length ? on.join(' and ') : 'no cut lines';
  };

  function brush(s) {
    const { ctx } = s, dpr = s.dpr || 1;
    const snap = v => (Math.round(v * dpr - 0.5) + 0.5) / dpr;
    const ink = (alpha, color) => { ctx.globalAlpha = clamp(alpha); ctx.fillStyle = color; ctx.strokeStyle = color; };
    const b = {
      rect(x, y, w, h, color, alpha = 1) { ink(alpha, color); ctx.fillRect(Math.round(x * dpr) / dpr, Math.round(y * dpr) / dpr, Math.round(w * dpr) / dpr, Math.round(h * dpr) / dpr); ctx.globalAlpha = 1; },
      line(points, color, { alpha = 1, width = 1, dashed = false } = {}) {
        if (points.length < 2) return;
        ink(alpha, color); ctx.lineWidth = width; ctx.lineCap = 'butt'; ctx.lineJoin = 'miter'; ctx.setLineDash(dashed ? [3, 4] : []);
        ctx.beginPath(); points.forEach(([x, y], i) => (i ? ctx.lineTo(snap(x), snap(y)) : ctx.moveTo(snap(x), snap(y)))); ctx.stroke();
        ctx.setLineDash([]); ctx.globalAlpha = 1;
      },
      area(points, color, alpha) { ink(alpha, color); ctx.beginPath(); points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1; },
      marker(x, y, color, size = 4, alpha = 1) { b.rect(x - size / 2, y - size / 2, size, size, color, alpha); },
      text(str, x, y, opts) { s.pen.text(str, x, y, { size: 13, ...opts }); },
    };
    return b;
  }

  function geometry(w, workers) {
    const phone = w < 480, gutter = phone ? 102 : 122, side = phone ? 78 : 112, gap = phone ? 8 : 14;
    const colW = (w - gutter - side - gap * 2) / workers, top = 30, rowH = phone ? 30 : 32;
    const colX = i => gutter + i * colW;
    const bottom = top + 4 * rowH, stripTop = bottom + 62, lane = 22;
    return { phone, gutter, side, gap, colW, top, rowH, colX, bottom, stripTop, lane, sideX: w - side, height: stripTop + workers * lane + 14 };
  }

  function draw(s, view) {
    const { c, w } = s, b = brush(s), spec = view.spec, run = view.run, workers = view.workers;
    const g = geometry(w, workers);
    const trail = run ? run.trail : [{ step: null, state: { status: 'approved', transfers: 0, pc: Array(workers).fill(spec.ok ? spec.labels[0].name : null) } }];
    const p = run ? run.p : 0, whole = Math.floor(p), part = p - whole;
    const shownIndex = Math.min(trail.length - 1, whole + (part > 0.7 ? 1 : 0));
    const shown = trail[shownIndex].state;
    const rowY = i => g.top + i * g.rowH;
    const blockStart = name => { const at = spec.labels.findIndex(l => l.name === name); return at < 0 ? 4 : D.STATEMENTS.indexOf(spec.labels[at].statements[0]); };

    D.STATEMENTS.forEach((st, i) => b.text(ROW_NAMES[st], g.gutter - 10, rowY(i) + g.rowH / 2 + 4, { align: 'right', color: c.soft }));
    b.text('Done', g.gutter - 10, g.bottom + 16, { align: 'right', color: c.soft });

    for (let wk = 0; wk < workers; wk++) {
      const x0 = g.colX(wk) + 4, x1 = g.colX(wk) + g.colW - 4, depth = g.phone ? 4 : 6;
      b.text(g.phone ? NAMES[wk] : `worker ${NAMES[wk]}`, (x0 + x1) / 2, g.top - 10, { color: c.ink, font: 'ui', weight: 500 });
      b.line([[x0 + depth, g.top - depth], [x1 + depth, g.top - depth], [x1 + depth, g.bottom - depth]], c.ink, { alpha: 0.14 });
      b.line([[x1, g.top], [x1 + depth, g.top - depth]], c.ink, { alpha: 0.14 });
      b.line([[x1, g.bottom], [x1 + depth, g.bottom - depth]], c.ink, { alpha: 0.14 });
      b.line([[x0, g.top], [x1, g.top], [x1, g.bottom], [x0, g.bottom], [x0, g.top]], c.ink, { alpha: 0.3 });
      if (spec.ok) spec.labels.forEach((l, li) => {
        if (li % 2) b.rect(x0 + 1, rowY(D.STATEMENTS.indexOf(l.statements[0])) + 1, x1 - x0 - 2, l.statements.length * g.rowH - 2, c.ink, 0.045);
      });
    }

    D.CUTS.forEach((_, i) => {
      const y = rowY(i + 1), x0 = g.colX(0), x1 = g.colX(workers - 1) + g.colW;
      if (spec.cuts[i]) {
        b.area([[x0, y], [x1, y], [x1 + 6, y - 6], [x0 + 6, y - 6]], c.input, 0.08);
        b.line([[x0, y], [x1, y]], c.input, { width: 1.5 });
      } else b.line([[x0, y], [x1, y]], c.ink, { alpha: 0.22, dashed: true });
    });
    if (!spec.ok) {
      const bad = spec.labels.find(l => l.name === spec.refusedAt), y = rowY(3) + g.rowH / 2;
      for (let wk = 0; wk < workers; wk++) {
        const x0 = g.colX(wk) + 4, x1 = g.colX(wk) + g.colW - 4;
        b.rect(x0 + 1, rowY(D.STATEMENTS.indexOf(bad.statements[0])) + 1, x1 - x0 - 2, bad.statements.length * g.rowH - 2, c.accent, 0.1);
        b.line([[x0 + 6, y], [x1 - 6, y]], c.accent, { width: 1.5 });
      }
    }

    const sentBy = [];
    for (let i = 1; i <= Math.min(whole + (part > 0 ? 1 : 0), trail.length - 1); i++) {
      const { step } = trail[i], frac = i <= whole ? 1 : easeOut(part), live = i > whole || (i === whole && run && run.playing);
      const x = g.colX(step.worker) + g.colW / 2, from = D.STATEMENTS.indexOf(step.ran[0]), to = D.STATEMENTS.indexOf(step.ran[step.ran.length - 1]) + 1;
      const y0 = rowY(from) + 3, y1 = rowY(to) - 3;
      const yEnd = y0 + (y1 - y0) * frac;
      b.line([[x, y0], [x, yEnd]], live ? c.input : c.ink, { alpha: live ? 1 : 0.6, width: 2 });
      if (frac >= 1) b.line([[x - 4, yEnd], [x + 4, yEnd]], c.ink, { alpha: 0.6 });
      if (step.ran.includes('send') && frac >= 1) sentBy.push(step);
    }
    for (let wk = 0; wk < workers; wk++) {
      const at = shown.pc[wk] ?? (spec.ok ? spec.labels[0].name : null);
      if (!at) continue;
      const x = g.colX(wk) + g.colW / 2, y = at === 'Done' ? g.bottom : rowY(blockStart(at));
      b.marker(x, y, run && run.playing && trail[Math.min(whole + 1, trail.length - 1)].step?.worker === wk ? c.input : c.ink, 9);
    }

    const sx = g.sideX + 6, sw = g.side - 8, bad = shown.transfers > 1;
    b.line([[sx, g.top], [sx + sw, g.top], [sx + sw, g.bottom], [sx, g.bottom], [sx, g.top]], bad ? c.accent : c.ink, { alpha: bad ? 1 : 0.45, width: bad ? 1.5 : 1 });
    b.text('status', sx + sw / 2, g.top + 18, { color: c.soft, font: 'ui' });
    b.text(shown.status, sx + sw / 2, g.top + 36, { color: c.ink, weight: 500 });
    b.text('transfers', sx + sw / 2, g.top + 66, { color: c.soft, font: 'ui' });
    b.text(String(shown.transfers), sx + sw / 2, g.top + 96, { color: bad ? c.accentInk : c.ink, size: 24, weight: 600 });

    const steps = trail.length - 1, span = w - g.gutter - 8, pitch = span / Math.max(steps, 6);
    const xAt = i => g.gutter + (i - 0.5) * pitch;
    b.text(g.phone ? 'writes to status' : 'writes to the loan’s status', 0, g.stripTop - 16, { align: 'left', color: c.soft, font: 'ui' });
    for (let wk = 0; wk < workers; wk++) {
      const y = g.stripTop + wk * g.lane + 8;
      b.text(NAMES[wk], g.gutter - 10, y + 4, { align: 'right', color: c.ink, font: 'ui', weight: 500 });
      b.line([[g.gutter + 4, y - 4], [g.gutter, y - 4], [g.gutter, y + 4], [g.gutter + 4, y + 4]], c.ink, { alpha: 0.28 });
    }
    const upto = Math.min(steps, whole + (part > 0 ? 1 : 0));
    const writes = [];
    for (let i = 1; i <= upto; i++) {
      const { step } = trail[i];
      if (step.ran.includes('claimed') || step.ran.includes('mark')) writes.push({ i, worker: step.worker, value: step.next.status, before: step.before.status });
    }
    writes.forEach((wr, n) => {
      const next = writes[n + 1], y = g.stripTop + wr.worker * g.lane + 8;
      const x0 = xAt(wr.i), x1 = next ? xAt(next.i) : xAt(upto) + pitch / 2;
      b.line([[x0, y], [Math.max(x0 + 2, x1 - 2), y]], c.ink, { alpha: 0.85, width: 1.5 });
      b.marker(x0, y, c.ink, 5);
      const overwrite = wr.value === 'claimed' && wr.before === 'claimed';
      if (overwrite) {
        const prev = writes[n - 1], py = g.stripTop + (prev ? prev.worker : wr.worker) * g.lane + 8;
        b.line([[x0, py - 6], [x0, py + 6]], c.accent, { width: 2 });
        b.line([[x0, y - 6], [x0, y + 6]], c.accent, { width: 2 });
      }
      if (x1 - x0 > 40 || !next) b.text(overwrite ? `${wr.value} again` : wr.value, x0 + 6, y - 5, { align: 'left', color: overwrite ? c.accentInk : c.soft, weight: overwrite ? 600 : 400 });
    });
    let count = 0;
    for (let i = 1; i <= upto; i++) {
      const { step } = trail[i];
      if (!step.ran.includes('send') || (i > whole && part < 0.7)) continue;
      count += 1;
      const y = g.stripTop + step.worker * g.lane + 8;
      b.rect(xAt(i) - 4, y + 3, 8, 8, count > 1 ? c.accent : c.input, 1);
    }
  }

  function animator(target, onFrame) {
    const run = { value: 0, to: 0, rate: 1, done: null };
    const loop = K.loop(target, dt => {
      run.value = Math.min(run.to, run.value + dt * run.rate);
      onFrame();
      if (run.value >= run.to) { loop.stop(); const done = run.done; run.done = null; if (done) done(); }
    });
    run.go = (from, to, rate, done) => {
      Object.assign(run, { value: from, to, rate, done });
      if (K.reduced.matches) { run.value = to; onFrame(); run.done = null; if (done) done(); return; }
      onFrame(); loop.start();
    };
    run.stop = () => { loop.stop(); run.done = null; };
    return run;
  }

  function fillStrip(ol, trail) {
    ol.replaceChildren(...trail.map((t, i) => {
      const li = document.createElement('li'), bad = D.breaks(t.state);
      if (bad) li.className = 'k-bad';
      const rows = [[`${i} · ${t.step ? t.step.label : 'start'}`, 'k-card-step'], [t.state.status], ...t.state.pc.map((p, w) => [`${NAMES[w]} ${p}`]), [`transfers ${t.state.transfers}`, 'k-card-t']];
      rows.forEach(([text, cls]) => { const span = document.createElement('span'); span.textContent = text; if (cls) span.className = cls; li.append(span); });
      return li;
    }));
  }

  function predictChange(root, { question, options, onAnswered }) {
    const q = document.createElement('p'); q.className = 'k-q'; q.textContent = question;
    const row = document.createElement('div'); row.className = 'row'; row.setAttribute('role', 'group'); row.setAttribute('aria-label', question);
    const fb = document.createElement('p'); fb.className = 'k-feedback'; fb.setAttribute('aria-live', 'polite');
    const buttons = options.map(([value, label]) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = label;
      b.addEventListener('click', () => {
        buttons.forEach(x => { x.disabled = true; });
        b.setAttribute('aria-pressed', 'true');
        fb.textContent = `Noted: “${label}”. Now change things and let the checker tell you.`;
        onAnswered(value, label);
      });
      return b;
    });
    row.append(...buttons);
    root.classList.add('k-ask');
    root.replaceChildren(q, row, fb);
  }

  const SPEC_ROWS = [
    { text: 'process (w \\in Workers) {' },
    { st: 'test', text: 'if (status = "approved") {' },
    { cut: 0 },
    { st: 'claimed', text: '  status := "claimed";' },
    { cut: 1 },
    { st: 'send', text: '  transfers := transfers + 1;' },
    { cut: 2 },
    { st: 'mark', text: '  status := "paid"' },
    { text: '}' },
    { text: '}', outer: true },
  ];

  const TS = {
    layer: [
      'const loan = await loans.find(loanId);',
      'if (loan.status !== "approved") return;',
      'loan.status = "claimed";',
      'await loans.save(loan);',
      'await bank.transfer(loanId, key);',
      'await db.setStatus(loanId, "paid");',
    ],
    update: [
      'const { rowCount } = await db.query(',
      '  `UPDATE loans SET status = \'claimed\'',
      '   WHERE id = $1',
      '     AND status = \'approved\'`, [loanId]);',
      'if (rowCount === 0) return;',
      'await bank.transfer(loanId, key);',
      'await db.setStatus(loanId, "paid");',
    ],
  };

  function mount(host, mode) {
    host.replaceChildren(document.getElementById('label-lab').content.cloneNode(true));
    const uid = `${host.id}-`, $ = k => host.querySelector(`[data-k="${k}"]`);
    host.querySelectorAll('[data-k]').forEach(el => { el.id = uid + el.dataset.k; });
    const explore = mode === 'explore';
    const st = {
      ready: false, cuts: explore ? [false, true, true] : [true, true, true], sawHonest: false, workers: 2, code: 'layer', run: null, report: null,
      tried: new Map(), passes: new Set(), solved: false, guess: null,
    };
    const spec = () => D.translate(st.cuts);

    const stage = K.stage($('desk'), s => draw(s, { spec: spec(), run: st.run, workers: st.run ? st.run.workers : st.workers }), { height: w => geometry(w, st.run ? st.run.workers : st.workers).height });
    const anim = animator($('desk'), () => { if (st.run) st.run.p = anim.value; stage.redraw(); });

    function renderSpec() {
      const sp = spec(), pre = $('spec'), starts = new Map(sp.labels.map(l => [l.statements[0], l.name]));
      const nodes = SPEC_ROWS.map(row => {
        if (row.cut !== undefined) {
          const b = document.createElement('button');
          const on = st.cuts[row.cut], [a, z] = D.CUTS[row.cut];
          b.type = 'button'; b.className = 'k-cut'; b.dataset.cut = String(row.cut);
          b.setAttribute('aria-pressed', String(on)); b.disabled = !st.ready;
          b.setAttribute('aria-label', `Cut line between ${a} and ${z}: ${on ? 'on' : 'off'}`);
          const name = document.createElement('span'); name.className = 'k-cut-name'; name.textContent = `${a} | ${z}`;
          const word = document.createElement('span'); word.className = 'k-cut-word'; word.textContent = on ? 'cut line' : 'no cut';
          b.append(name, word);
          b.addEventListener('click', () => { st.cuts[row.cut] = !st.cuts[row.cut]; changed(`[data-cut="${row.cut}"]`); });
          return b;
        }
        const line = document.createElement('div'); line.className = 'k-code-line';
        const label = document.createElement('span'); label.className = 'k-label';
        const name = row.st && starts.get(row.st);
        if (row.st === 'test' || name) label.textContent = `${row.st === 'test' ? sp.labels[0].name : name}:`;
        const code = document.createElement('span'); code.textContent = row.outer ? row.text : (row.st ? `  ${row.text}` : row.text === '}' ? '  }' : row.text);
        line.append(label, code);
        if (!sp.ok && row.st === 'mark') {
          line.classList.add('k-refused');
          const why = document.createElement('span'); why.className = 'k-why'; why.textContent = ' ← Missing label';
          line.append(why);
        }
        return line;
      });
      pre.replaceChildren(...nodes);
      const lamp = $('lamp');
      lamp.classList.toggle('k-bad', !sp.ok);
      lamp.textContent = sp.ok
        ? `Translator: translated. ${sp.labels.length} label${sp.labels.length > 1 ? 's' : ''}: ${sp.labels.map(l => l.name).join(', ')}, so ${sp.labels.length} step${sp.labels.length > 1 ? 's' : ''} per worker.`
        : `Translator refuses: “Missing label”. Label ${sp.refusedAt} sets status twice in one step.`;
      $('run').disabled = !st.ready || !sp.ok || st.running;
    }

    function renderCode() {
      host.querySelectorAll('[data-code]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.code === st.code)));
      $('ts').replaceChildren(...TS[st.code].map(t => { const d = document.createElement('div'); d.className = 'k-code-line k-ts'; d.textContent = t; return d; }));
    }

    function renderWorkers() {
      host.querySelectorAll('[data-workers]').forEach(b => { b.setAttribute('aria-pressed', String(Number(b.dataset.workers) === st.workers)); b.disabled = !st.ready; });
    }

    function changed(focusSel) {
      anim.stop(); st.run = null; st.report = null; st.running = false;
      const sp = spec();
      if (explore && !sp.ok) noteTried(sp, null);
      renderSpec(); renderCode(); renderWorkers();
      $('trace').hidden = true;
      stage.resize();
      readout();
      const el = focusSel && host.querySelector(focusSel);
      if (el) el.focus();
    }

    function noteTried(sp, result) {
      const entry = st.tried.get(sp.key) || { cuts: sp.cuts, refused: !sp.ok, runs: {} };
      if (result) entry.runs[result.workers] = result;
      st.tried.set(sp.key, entry);
      renderLog();
    }

    function renderLog() {
      const ol = $('log');
      const entries = [...st.tried.values()].sort((a, b) => D.keyOfCuts(a.cuts).localeCompare(D.keyOfCuts(b.cuts)));
      ol.replaceChildren(...entries.map(e => {
        const li = document.createElement('li');
        const name = document.createElement('span'); name.className = 'k-log-name'; name.textContent = CUT_WORDS(e.cuts);
        const verdict = document.createElement('span');
        if (e.refused) { verdict.textContent = 'translator refuses'; verdict.className = 'k-bad-n'; }
        else verdict.textContent = Object.values(e.runs).map(r => `${r.workers} workers: ${r.pass ? `no error, ${r.count} states` : `paid twice in ${r.trace.length - 1} steps`}`).join(' · ');
        li.append(name, verdict);
        return li;
      }));
      if (explore && st.tried.size === 8 && !st.act1Done) { st.act1Done = true; document.dispatchEvent(new CustomEvent('k:solved', { detail: 'act1' })); }
      $('tally').textContent = `Placements tried: ${st.tried.size} of 8${st.tried.size === 8 ? ' · every placement tried' : ''}`;
    }

    function verdictLine(result) {
      const div = document.createElement('div'), verdict = document.createElement('span');
      div.append(`${result.count} reachable states · `);
      if (result.pass) { verdict.textContent = 'no state breaks NoDoublePayout'; if (st.solved) verdict.className = 'ok'; }
      else { verdict.className = 'changed'; verdict.textContent = `NoDoublePayout is violated: paid twice in ${result.trace.length - 1} steps`; }
      div.append(verdict);
      return div;
    }

    function exploreWhy(rep) {
      const sp = spec();
      if (!st.ready) return 'Answer the question above to unlock the cut lines.';
      if (!sp.ok) return 'One label would hold status := "claimed" and later status := "paid". The translator stops before TLC sees anything. Add a cut line between them, or switch another one.';
      if (!rep) return `Spec with ${CUT_WORDS(st.cuts)}. Press “Run the checker”, or change a cut line.`;
      const r = rep.result;
      if (r.pass) return `No error with ${r.workers} workers: ${r.count} distinct states, none with two transfers. The picture plays one behavior: A takes a step, then B, then ${r.workers > 2 ? 'A, B and C' : 'A and B'} each run to the end in turn.`;
      return `TLC prints a counterexample, ${r.trace.length - 1} steps: ${r.trace.slice(1).map(t => t.step.label).join(', ')}. The picture replays it; the list below shows it state by state.`;
    }

    function fixWhy(rep) {
      const sp = spec();
      if (!st.ready) return 'Answer the question above to unlock the lab.';
      if (!sp.ok) return 'The translator refuses: status is set twice in one step.';
      if (!rep) return 'Choose the code and the cut lines, then press “Run the checker”.';
      const r = rep.result, k = r.pass ? 0 : r.trace.length - 1, key = sp.key;
      if (rep.code === 'layer') {
        if (key === '011') return r.pass ? `No error, ${r.count} states. Count the calls in the code: does your claim label stand for one of them?` : null;
        if (key === '111') return `Paid twice in ${k} steps. Every label here stands for one call in this code, so the spec is honest. What does that say about the code?`;
        if (key === '101' || key === '110') return 'Paid twice. And one of your labels covers two calls.';
        if (key === '001') return `No error, ${r.count} states, but check, claim and the bank call can’t all be one step in this code.`;
        if (key === '010') return `No error, ${r.count} states, but find and save can’t be one step in this code, and neither can the bank call and the mark.`;
      }
      if (key === '111') return `Paid twice in ${k} steps, but your spec splits one SQL statement in two. That race isn’t in this code.`;
      if (key === '101' || key === '110') return 'Paid twice, for a race the code doesn’t have; and one label covers the database and the bank.';
      if (key === '001' || key === '010') return `No error, ${r.count} states. The database and the bank in one step? No code can do that.`;
      if (!st.sawHonest) return `${r.count} states, no error. Before you ship it, run the code Noor shipped with its honest spec (data layer, all three cut lines) and read what the checker says.`;
      const both = st.passes.has(`update-011-2`) && st.passes.has(`update-011-3`);
      if (both) return `${r.count} states, no error: fixed, and the spec says so honestly.`;
      return r.workers === 2
        ? `${r.count} states, no error, one label per call. Try 3 before you ship.`
        : `${r.count} states, no error, one label per call. Run it with 2 as well before you ship.`;
    }

    function readout() {
      const rep = st.report;
      $('result').replaceChildren(...(rep ? [verdictLine(rep.result)] : []));
      $('why').textContent = explore ? exploreWhy(rep) : fixWhy(rep) || '';
      $('desk').setAttribute('aria-label', rep
        ? `The worker code for each of ${rep.result.workers} workers, cut into steps at the cut lines, replaying ${rep.result.pass ? 'one behavior' : 'the counterexample'}: ${rep.trail.slice(1).map(t => t.step.label).join(', ')}. Final transfers: ${rep.trail[rep.trail.length - 1].state.transfers}.`
        : `The worker code for each worker, cut into steps at the cut lines: ${CUT_WORDS(st.cuts)}.`);
    }

    function runChecker() {
      const sp = spec();
      if (!sp.ok) return;
      const result = D.explore(sp, st.workers), trail = result.pass ? D.sample(sp, st.workers) : result.trace;
      st.report = { result, trail, code: st.code, key: sp.key };
      if (explore) noteTried(sp, result);
      else {
        if (st.code === 'layer' && sp.key === '111') st.sawHonest = true;
        if (result.pass && st.sawHonest) st.passes.add(`${st.code}-${sp.key}-${st.workers}`);
      }
      st.run = { trail, p: 0, workers: st.workers, playing: true };
      st.running = true;
      stage.resize();
      $('trace').hidden = false;
      $('trace-title').textContent = result.pass ? 'One behavior of this spec, state by state:' : `The counterexample, ${trail.length - 1} steps, state by state:`;
      fillStrip($('trace-strip'), trail);
      readout(); renderSpec();
      anim.go(0, trail.length - 1, 2.2, () => {
        st.run.playing = false; st.running = false; stage.redraw(); renderSpec();
        if (!explore) checkWin();
      });
    }

    function checkWin() {
      if (st.solved || !st.sawHonest || !(st.passes.has('update-011-2') && st.passes.has('update-011-3'))) return;
      st.solved = true;
      const sp = D.translate([false, true, true]);
      $('win-two').textContent = String(D.explore(sp, 2).count);
      $('win-three').textContent = String(D.explore(sp, 3).count);
      $('win-guess').textContent = st.guess === 'both'
        ? 'Your prediction was right: it took both. The code went back to one statement, and the labels moved to match its three calls.'
        : `You predicted “${st.guessLabel}”. It took both: the code back to one statement, and labels that match its three calls.`;
      $('win').hidden = false;
      readout();
      document.dispatchEvent(new CustomEvent('k:solved', { detail: 'act2' }));
      $('win').focus();
    }


    host.querySelectorAll('[data-workers]').forEach(b => b.addEventListener('click', () => { st.workers = Number(b.dataset.workers); changed(`[data-workers="${st.workers}"]`); }));
    host.querySelectorAll('[data-code]').forEach(b => b.addEventListener('click', () => { st.code = b.dataset.code; changed(`[data-code="${st.code}"]`); }));
    $('run').addEventListener('click', runChecker);
    $('reset').addEventListener('click', () => {
      Object.assign(st, { cuts: explore ? [false, true, true] : [true, true, true], workers: 2, code: 'layer' });
      changed();
      $('reset').focus();
    });

    if (explore) {
      ['codepanel', 'win', 'task'].forEach(k => { $(k).hidden = true; });
      host.classList.add('k-act1');
      K.ask($('ask'), {
        question: 'Predict first. The lab opens on Noor’s spec, with cut lines claim | send and send | mark. Switch both of those off and put one cut line between check and claim instead. What happens?',
        options: [['pass', 'TLC: no error'], ['twice', 'TLC: paid twice'], ['refuse', 'The translator refuses']],
        right: 'refuse',
        hints: {
          pass: 'Before TLC can check anything, the translator turns each label into one step. Look at what the second label would hold.',
          twice: 'Before TLC can check anything, the translator turns each label into one step. Look at what the second label would hold.',
        },
        explain: 'The second label would set status to "claimed" and then to "paid" in one step, and one step has one ‘after’ value for status. The translator stops with “Missing label”. Try it, then try the other placements.',
        onSolved: () => { st.ready = true; changed(); },
        focusAfter: () => host.querySelector('[data-cut="0"]'),
      });
      $('log-wrap').hidden = false;
      renderLog();
    } else {
      ['log-wrap', 'jump'].forEach(k => { $(k).hidden = true; });
      predictChange($('ask'), {
        question: 'Before your first run: what will the fix change?',
        options: [['code', 'The code'], ['labels', 'The labels'], ['both', 'Both']],
        onAnswered: (value, label) => { st.guess = value; st.guessLabel = label; st.ready = true; changed('[data-code="layer"]'); },
      });
    }
    changed();
    return { host };
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
