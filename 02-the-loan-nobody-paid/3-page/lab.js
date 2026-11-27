/* Loop and lease drawing adapted from the iwrzwr visual archive, Cycle Escapement and Context Lease studies. MIT License, Copyright (c) 2026 Kagan Yaldizkaya. */
const LoanDesk = (() => {
  const NAMES = 'ABC';
  const initial = n => ({ status: 'approved', owner: 'nobody', pc: Array(n).fill('idle'), t: 0, k: false, crashed: false });
  const keyOf = s => [s.status, s.owner, s.pc.join(','), s.t, s.k, s.crashed].join('|');
  const breaksInvariant = s => s.t > 1;

  function steps(s, o) {
    const out = [];
    const put = (w, to, change = {}) => ({ ...s, ...change, pc: s.pc.map((p, i) => (i === w ? to : p)) });
    const add = (action, worker, fair, next) => out.push({ action, worker, fair, label: worker < 0 ? action : `${action}(${NAMES[worker]})`, next });
    if (o.lease && s.status === 'claimed') add('Expire', -1, true, { ...s, status: 'approved' });
    s.pc.forEach((p, w) => {
      const name = NAMES[w];
      if (p === 'idle' && s.status === 'approved') add('Claim', w, true, put(w, 'claimed', { status: 'claimed', owner: o.resume ? name : 'nobody' }));
      if (o.resume && p === 'idle' && s.status === 'claimed' && s.owner === name) add('Resume', w, true, put(w, 'claimed'));
      if (p === 'idle' && s.status === 'paid') add('Skip', w, true, put(w, 'done'));
      if (p === 'claimed') add('Send', w, true, put(w, 'sent', { t: o.key && s.k ? s.t : s.t + 1, k: Boolean(o.key) }));
      if (p === 'sent') add('Mark', w, true, put(w, 'done', { status: 'paid' }));
      if (o.crash && !s.crashed && (p === 'claimed' || p === 'sent')) add('Crash', w, false, put(w, 'idle', { crashed: true }));
    });
    return out;
  }

  const mayStop = (s, o, fair) => s.status !== 'paid' && !(fair && steps(s, o).some(x => x.fair));

  function explore(o) {
    const start = initial(o.n);
    const nodes = [{ state: start, parent: -1, step: null }];
    const seen = new Map([[keyOf(start), 0]]);
    for (let head = 0; head < nodes.length; head++) {
      steps(nodes[head].state, o).forEach(step => {
        const key = keyOf(step.next);
        if (seen.has(key)) return;
        seen.set(key, nodes.length);
        nodes.push({ state: step.next, parent: head, step });
      });
    }
    const trace = i => {
      const out = [];
      for (; i >= 0; i = nodes[i].parent) out.unshift({ label: nodes[i].step && nodes[i].step.label, action: nodes[i].step && nodes[i].step.action, state: nodes[i].state });
      return out;
    };
    const bad = nodes.findIndex(n => breaksInvariant(n.state));
    const stuck = nodes.map((n, i) => (mayStop(n.state, o, o.fair) ? i : -1)).filter(i => i >= 0);
    return {
      options: o, count: nodes.length, stuck: stuck.length,
      double: bad >= 0 ? trace(bad) : null,
      lasso: stuck.length ? trace(stuck[0]) : null,
    };
  }

  return { NAMES, initial, keyOf, steps, mayStop, explore, breaksInvariant };
})();

if (typeof module === 'object' && module.exports) module.exports = LoanDesk;
else (() => {
  const K = window.Kit, D = LoanDesk, NAMES = D.NAMES;
  const AMOUNT = 50000, BEAT = 0.52, CHAR = 7.3, LINE = 17;
  const euros = n => `€${n.toLocaleString('en-US')}`;
  const clamp = (n, a = 0, b = 1) => Math.min(b, Math.max(a, n));
  const mix = (a, b, p) => a + (b - a) * p;
  const easeOut = t => (t >= 1 ? 1 : 1 - 2 ** (-10 * t));
  const $$ = (tag, cls, text) => { const el = document.createElement(tag); if (cls) el.className = cls; if (text !== undefined) el.textContent = text; return el; };

  function cardLines(entry, i, view) {
    const s = entry.state, lines = [];
    lines.push({ text: `${i} · ${entry.label || 'start'}`, head: true });
    const by = view.owner && s.owner !== 'nobody' && s.status === 'claimed' ? ` by ${s.owner}` : '';
    lines.push({ text: `${s.status}${by}`, status: true, expired: entry.action === 'Expire' });
    s.pc.forEach((p, w) => {
      const stale = view.lease && s.status === 'approved' && (p === 'claimed' || p === 'sent');
      lines.push({ text: `${NAMES[w]} ${p}${stale ? ' (stale)' : ''}`, stale });
    });
    lines.push({ text: `transfers ${s.t}`, bad: D.breaksInvariant(s) });
    if (view.keys) lines.push({ text: `keys ${s.k ? '{4471}' : '{}'}` });
    if (view.crash) lines.push({ text: `crashed ${s.crashed ? 'yes' : 'no'}` });
    return lines;
  }

  function stripLayout(view, w) {
    const trace = view.trace || [];
    const all = trace.map((e, i) => cardLines(e, i, view));
    const chars = Math.max(12, ...all.flat().map(l => l.text.length));
    const cardW = Math.ceil(chars * CHAR + 18), gap = w < 420 ? 20 : 26;
    const cardH = 10 + (all[0] ? all[0].length : 5) * LINE + (view.lease ? 6 : 0);
    const loopH = view.loop ? 64 : 0, rowGap = 18;
    const first = Math.max(1, Math.floor((w + gap) / (cardW + gap)));
    const more = Math.max(1, Math.floor(w / (cardW + gap)));
    const at = [];
    let row = 0, col = 0;
    trace.forEach((_, i) => {
      const limit = row ? more : first;
      if (col >= limit) { row += 1; col = 0; }
      const x = (row ? gap : 0) + col * (cardW + gap), y = 4 + row * (cardH + rowGap);
      at.push([x, y]);
      col += 1;
    });
    const rows = trace.length ? row + 1 : 1;
    return { all, cardW, cardH, gap, at, height: 8 + rows * cardH + (rows - 1) * rowGap + loopH + 4 };
  }

  function drawStrip(s, view) {
    const { ctx, c, w, pen } = s, trace = view.trace || [];
    if (!trace.length) return;
    const g = stripLayout(view, w);
    const last = trace.length - 1;
    const loopBad = view.loop && trace[last].state.status !== 'paid';
    trace.forEach((entry, i) => {
      const [x, y] = g.at[i], lines = g.all[i], bad = D.breaksInvariant(entry.state), end = view.loop && i === last;
      if (i > 0) {
        const [px, py] = g.at[i - 1];
        if (py === y) {
          const ay = y + g.cardH / 2, x1 = px + g.cardW + 3, x2 = x - 4;
          pen.line([[x1, ay], [x2, ay]], c.soft, 1);
          pen.line([[x2 - 5, ay - 4], [x2, ay], [x2 - 5, ay + 4]], c.soft, 1);
        } else {
          const ay = y + g.cardH / 2;
          pen.line([[2, ay], [x - 4, ay]], c.soft, 1);
          pen.line([[x - 9, ay - 4], [x - 4, ay], [x - 9, ay + 4]], c.soft, 1);
        }
      }
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x + 0.5, y + 0.5, g.cardW, g.cardH, 6); else ctx.rect(x + 0.5, y + 0.5, g.cardW, g.cardH);
      ctx.fillStyle = bad ? c.accentSoft : c.paper; ctx.fill();
      ctx.strokeStyle = bad || (end && loopBad) ? c.accent : c.soft; ctx.lineWidth = bad || (end && loopBad) ? 1.5 : 1; ctx.stroke();
      lines.forEach((l, j) => {
        const ty = y + 8 + LINE * (j + 1) - 4 + (view.lease && j > 1 ? 6 : 0);
        const color = l.bad ? c.accentInk : l.stale ? c.accentInk : l.head || l.status ? c.ink : c.soft;
        pen.text(l.text, x + 9, ty, { align: 'left', color, size: 12, font: l.head ? 'ui' : 'mono', weight: l.head || l.bad ? 500 : 400 });
        if (view.lease && l.status) {
          const by = ty + 5, bw = g.cardW - 18;
          if (entry.state.status === 'claimed') pen.rect(x + 9, by, bw, 3, c.ink, 0.55);
          else if (l.expired) pen.line([[x + 9, by + 1.5], [x + 9 + bw, by + 1.5]], c.accent, 1, [3, 3]);
        }
      });
    });
    if (!view.loop) return;
    const [x, y] = g.at[last], cx = x + g.cardW / 2, top = y + g.cardH, rx = Math.min(g.cardW * 0.32, 34), ry = 16;
    const color = loopBad ? c.accent : c.ink;
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.setLineDash([]);
    ctx.beginPath(); ctx.ellipse(cx, top + 2, rx, ry, 0, 0.12, Math.PI - 0.12); ctx.stroke();
    const ax = cx - rx * Math.cos(0.12), ay = top + 2 + ry * Math.sin(0.12);
    pen.line([[ax - 4, ay + 6], [ax, ay], [ax + 4, ay + 6]], color, 1.5);
    const moving = !K.reduced.matches && view.beats !== null;
    const ticks = 4;
    for (let i = 0; i < ticks; i++) {
      const a = Math.PI * (i + 0.5) / ticks;
      pen.rect(cx + rx * Math.cos(a) - 1, top + 2 + ry * Math.sin(a) - 1, 2, 2, color, 0.45);
    }
    if (moving) {
      const beat = Math.floor(view.beats), a = Math.PI * ((beat % ticks) + 0.5) / ticks, fresh = view.beats - beat < 0.3;
      pen.rect(cx + rx * Math.cos(a) - 3, top + 2 + ry * Math.sin(a) - 3, 6, 6, color, fresh ? 1 : 0.7);
    }
    const done = Math.floor(view.beats) + 1;
    const note = moving ? `${done} stuttering step${done > 1 ? 's' : ''} so far` : 'stuttering, forever';
    const sub = loopBad ? 'never marked paid' : 'nothing changes, paid';
    const half = Math.max(note.length, sub.length) * CHAR / 2;
    const lx = clamp(cx, half + 2, w - half - 2);
    pen.text(note, lx, top + ry + 20, { color, size: 12, weight: 500 });
    pen.text(sub, lx, top + ry + 36, { color: loopBad ? c.accentInk : c.soft, size: 12 });
  }

  function stripStage(canvas, view) {
    const stage = K.stage(canvas, s => drawStrip(s, view), { height: w => (view.trace && view.trace.length ? stripLayout(view, w).height : 1) });
    const beat = K.loop(canvas, dt => { view.beats += dt / BEAT; stage.redraw(); });
    return {
      show(next) {
        Object.assign(view, next);
        view.beats = view.loop ? 0 : null;
        stage.resize();
        if (view.loop) beat.start(); else beat.stop();
        canvas.setAttribute('aria-label', describe(view));
      },
      stop() { beat.stop(); },
    };
  }

  function describe(view) {
    const t = view.trace || [];
    if (!t.length) return 'No behavior yet.';
    const steps = t.slice(1).map(e => e.label).join(', ') || 'no steps';
    const end = t[t.length - 1].state;
    return `Behavior: ${steps}.${view.loop ? ` Then stuttering forever in a state with status ${end.status} and ${end.t} transfers.` : ` It ends with ${end.t} transfers.`}`;
  }

  function lamp(el, name, state, word) {
    el.dataset.state = state;
    const mark = $$('span', 'k-lamp-mark', { holds: '✓', fails: '✗', ok: '✓', wait: '·' }[state] || '·');
    mark.setAttribute('aria-hidden', 'true');
    el.replaceChildren(mark, $$('span', 'k-lamp-name', name), $$('span', 'k-lamp-word', word));
  }

  function specLines(cfg) {
    const ws = Array.from({ length: cfg.workers }, (_, i) => `"${NAMES[i]}"`).join(', ');
    const L = [{ text: `Workers   ≜ {${ws}}`, changed: cfg.workers !== 2 }];
    L.push({ text: 'Claim(w)  ≜ pc[w] = "idle" ∧ status = "approved" ∧ status′ = "claimed" ∧ pc′[w] = "claimed"' });
    if (cfg.resume) L.push({ text: '              ∧ owner′ = w', changed: true });
    if (cfg.resume) L.push({ text: 'Resume(w) ≜ pc[w] = "idle" ∧ status = "claimed" ∧ owner = w ∧ pc′[w] = "claimed"', changed: true });
    L.push({ text: 'Skip(w)   ≜ pc[w] = "idle" ∧ status = "paid" ∧ pc′[w] = "done"' });
    if (cfg.key) {
      L.push({ text: 'Send(w)   ≜ pc[w] = "claimed" ∧ pc′[w] = "sent" ∧ keys′ = keys ∪ {Loan}', changed: true });
      L.push({ text: '              ∧ transfers′ = IF Loan ∈ keys THEN transfers ELSE transfers + 1', changed: true });
    } else L.push({ text: 'Send(w)   ≜ pc[w] = "claimed" ∧ pc′[w] = "sent" ∧ transfers′ = transfers + 1' });
    L.push({ text: 'Mark(w)   ≜ pc[w] = "sent" ∧ pc′[w] = "done" ∧ status′ = "paid"' });
    L.push({ text: 'Crash(w)  ≜ ¬crashed ∧ pc[w] ∈ {"claimed", "sent"} ∧ pc′[w] = "idle" ∧ crashed′ = TRUE' });
    if (cfg.lease) L.push({ text: 'Expire    ≜ status = "claimed" ∧ status′ = "approved"', changed: true });
    L.push({ text: `Work(w)   ≜ Claim(w) ∨ ${cfg.resume ? 'Resume(w) ∨ ' : ''}Skip(w) ∨ Send(w) ∨ Mark(w)`, changed: cfg.resume });
    L.push({ text: `Next      ≜ (∃ w ∈ Workers : Work(w) ∨ Crash(w))${cfg.lease ? ' ∨ Expire' : ''}`, changed: cfg.lease });
    if (cfg.fair) L.push({ text: `Fairness  ≜ ∀ w ∈ Workers : WF_vars(Work(w))${cfg.lease ? ' ∧ WF_vars(Expire)' : ''}`, changed: true });
    L.push({ text: `Spec      ≜ Init ∧ □[Next]_vars${cfg.fair ? ' ∧ Fairness' : ''}`, changed: cfg.fair });
    return L;
  }

  function counter(el, to, done) {
    if (K.reduced.matches) { el.textContent = String(to); done(); return; }
    const t0 = performance.now(), span = 650;
    const tick = now => {
      const p = clamp((now - t0) / span);
      el.textContent = String(Math.round(easeOut(p) * to));
      if (p < 1) requestAnimationFrame(tick); else done();
    };
    requestAnimationFrame(tick);
  }

  function bakeryStage(canvas) {
    const view = { t: 1 };
    const stage = K.stage(canvas, s => {
      const { c, w, pen } = s, t = easeOut(view.t), phone = w < 440;
      const bw = phone ? 96 : 132, h = 56, y = 14, ax = w - bw - 2;
      const box = (x, color, width = 1) => { s.ctx.strokeStyle = color; s.ctx.lineWidth = width; s.ctx.strokeRect(x + 0.5, y + 0.5, bw, h); };
      box(1, c.soft);
      pen.text('bank', 1 + bw / 2, y + 22, { color: c.ink, font: 'ui', size: 13 });
      pen.text('key 4471', 1 + bw / 2, y + 42, { color: c.soft, size: 12 });
      box(ax, c.ok, 1.5);
      pen.text(phone ? 'bakery' : 'the bakery', ax + bw / 2, y + 22, { color: c.ink, font: 'ui', size: 13 });
      const arrived = t >= 0.98;
      pen.text(euros(arrived ? AMOUNT : 0), ax + bw / 2, y + 43, { color: arrived ? c.ok : c.soft, size: 13, weight: 600 });
      const x1 = 1 + bw + 6, x2 = ax - 6, mid = y + h / 2;
      pen.line([[x1, mid], [mix(x1, x2, t), mid]], c.ok, 1.5, [4, 4], 0.8);
      if (!arrived) pen.rect(mix(x1, x2, t) - 4, mid - 4, 8, 8, c.ok);
      const status = arrived ? 'loan 4471: paid' : 'loan 4471: claimed';
      const note = arrived ? 'one transfer' : 'sending…';
      const fits = note.length * CHAR < x2 - x1 - 8;
      if (fits) pen.text(note, (x1 + x2) / 2, mid - 9, { color: arrived ? c.ok : c.soft, font: 'ui', size: 13 });
      pen.text(status, w / 2, y + h + 30, { color: arrived ? c.ok : c.soft, font: 'ui', size: 13, weight: arrived ? 500 : 400 });
    }, { height: () => 104 });
    const loop = K.loop(canvas, dt => { view.t = Math.min(1, view.t + dt * 0.9); stage.redraw(); if (view.t >= 1) loop.stop(); });
    return { play() { view.t = K.reduced.matches ? 1 : 0; stage.redraw(); loop.start(); } };
  }

  function mount(host, mode) {
    host.replaceChildren(document.getElementById('desk-lab').content.cloneNode(true));
    const uid = `${host.id}-`, $ = k => host.querySelector(`[data-k="${k}"]`);
    host.querySelectorAll('[data-k]').forEach(el => { el.id = uid + el.dataset.k; });
    return mode === 'explore' ? explore(host, $) : fix(host, $);
  }

  function explore(host, $) {
    ['task', 'changes', 'spec', 'spec-note', 'run', 'cx', 'win', 'result'].forEach(k => { $(k).hidden = true; });
    const st = { predicted: false, deploy: false, state: null, trail: [], closed: false, found: { off: new Set(), on: new Set() } };
    const opts = () => ({ n: 2, crash: st.deploy });
    const totals = { off: D.explore({ n: 2, crash: false, fair: false }).stuck, on: D.explore({ n: 2, crash: true, fair: false }).stuck };
    const strip = stripStage($('strip'), { trace: [], loop: false, crash: false });

    function restart() {
      st.state = D.initial(2); st.trail = [{ label: null, action: null, state: st.state }]; st.closed = false;
      render();
    }

    function take(step) {
      st.state = step.next;
      st.trail.push({ label: step.label, action: step.action, state: step.next });
      render();
      (host.querySelector('.k-step:not(:disabled)') || $('forever')).focus();
    }

    function forever() {
      st.closed = true;
      if (st.state.status !== 'paid') st.found[st.deploy ? 'on' : 'off'].add(D.keyOf(st.state));
      render();
      $('reset').focus();
    }

    function laneNote(w, s) {
      if (s.pc[w] === 'done') return 'done';
      if (st.closed) return 'nobody moves';
      if (s.pc[w] === 'idle' && s.status === 'claimed') {
        const holder = s.pc.findIndex(p => p === 'claimed' || p === 'sent');
        return holder >= 0 ? `nothing allowed: the loan is claimed by ${NAMES[holder]}` : 'nothing allowed: the loan is claimed, and no worker remembers it';
      }
      return 'nothing allowed';
    }

    function lanes() {
      const enabled = st.closed ? [] : D.steps(st.state, opts());
      [0, 1].forEach(w => {
        const lane = host.querySelector(`[data-lane="${w}"]`);
        const nodes = enabled.filter(x => x.worker === w).map(step => {
          const b = $$('button', `k-step${step.action === 'Crash' ? ' k-crash' : ''}`, step.label);
          b.type = 'button'; b.disabled = !st.predicted;
          b.addEventListener('click', () => take(step));
          return b;
        });
        if (!nodes.length) nodes.push($$('span', 'k-lane-note', laneNote(w, st.state)));
        lane.replaceChildren(...nodes);
      });
      $('forever').disabled = !st.predicted || st.closed;
    }

    function why() {
      const n = st.trail.length - 1, s = st.state;
      if (!st.predicted) return 'Answer the question above to start.';
      if (st.closed) {
        if (s.status === 'paid') return `Paid at step ${st.trail.findIndex(e => e.state.status === 'paid')}, then nothing more. Stopping after the bakery is paid is fine.`;
        const allowed = D.steps(s, opts()).filter(x => x.action !== 'Crash').map(x => x.label);
        const tail = allowed.length
          ? ` ${allowed.join(' and ')} ${allowed.length > 1 ? 'were' : 'was'} allowed the whole time, and nobody took ${allowed.length > 1 ? 'them' : 'it'}.`
          : ' Nobody had a step left: the worker that claimed the loan forgot it in the crash.';
        return `Every state passed NoDoublePayout. The loan is never marked paid.${s.t ? ' The bakery has its money, and the books say claimed forever.' : ' The bakery has nothing.'}${tail} Press Reset to find another way to stop.`;
      }
      const enabled = D.steps(s, opts());
      if (!enabled.length) return `Step ${n}${n ? `: ${st.trail[n].label}` : ''}. No worker has a step it is allowed to take. All that is left is “Nobody moves, forever”.`;
      if (!n) return `You are the scheduler. Each button is a step that worker may take now${st.deploy ? ', and Crash restarts a worker that holds the loan (once per run)' : ''}. Or press “Nobody moves, forever”.`;
      return `Step ${n}: ${st.trail[n].label}. Pick the next step, or let nobody move, forever.`;
    }

    function render() {
      lanes();
      const bad = st.trail.some(e => D.breaksInvariant(e.state));
      const states = new Set(st.trail.map(e => D.keyOf(e.state))).size;
      lamp($('lamp-safe'), 'NoDoublePayout', bad ? 'fails' : 'holds', bad ? 'broken' : (states > 1 ? `holds in all ${states} states so far` : 'holds in 1 state so far'));
      const paidAt = st.trail.findIndex(e => e.state.status === 'paid');
      lamp($('lamp-live'), 'Loan marked paid?', paidAt >= 0 ? 'holds' : st.closed ? 'fails' : 'wait', paidAt >= 0 ? `yes, at step ${paidAt}` : st.closed ? 'never' : 'not yet');
      $('why').textContent = why();
      const mode = st.deploy ? 'on' : 'off', k = st.found[mode].size, total = totals[mode];
      const tally = $('tally'), num = $$('b', 'k-bad-n', String(k));
      tally.replaceChildren(`Endings never marked paid you found${st.deploy ? ' with the deploy' : ''}: `, num, ` of ${total}${k === total ? ' · every one found' : ''}`);
      tally.hidden = !st.predicted;
      $('deploy').setAttribute('aria-pressed', String(st.deploy));
      $('deploy').disabled = !st.predicted;
      strip.show({ trace: st.trail, loop: st.closed, crash: st.deploy, owner: false, keys: false, lease: false });
    }

    K.ask($('ask'), {
      question: 'Predict first. Lesson 1’s fixed desk with the new Skip, no crash, two workers. The table above stops after Send(B). In how many of the desk’s states can a behavior stop forever without the loan ever being marked paid?',
      options: [['1', '1'], ['2', '2'], ['5', '5'], ['8', '8']], right: '5',
      hints: {
        1: 'The table shows one, but a stuttering step is allowed in every state, not only after Send.',
        2: 'Stopping does not wait for anyone to send: the desk may stop before a single step.',
        8: 'Some of the 8 states already say paid, and stopping there is fine.',
      },
      explain: 'Every state before paid: the start, claimed by A or by B, sent by A or by B. A stuttering step is allowed in each of them. Find all five below, then turn the deploy on.',
      onSolved: () => { st.predicted = true; render(); },
      focusAfter: () => host.querySelector('.k-step'),
    });
    $('deploy').addEventListener('click', () => { st.deploy = !st.deploy; restart(); $('deploy').focus(); });
    $('forever').addEventListener('click', forever);
    $('reset').addEventListener('click', () => { restart(); $('reset').focus(); });
    restart();
  }

  function fix(host, $) {
    ['lanes', 'deploy-row', 'strip', 'tally', 'jump'].forEach(k => { $(k).hidden = true; });
    const fresh = () => ({ fair: false, lease: false, resume: false, key: false, workers: 2 });
    const st = { cfg: fresh(), report: null, running: false, predicted: false, passed: new Map(), solved: false };
    const optKey = cfg => `${cfg.fair}|${cfg.lease}|${cfg.resume}|${cfg.key}`;
    const cxSafe = stripStage($('cx-safe'), { trace: [] });
    const cxLive = stripStage($('cx-live'), { trace: [] });
    const bakery = bakeryStage($('bakery'));
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

    function feedback(cfg, r) {
      const n = r.count, steps = r.double ? r.double.length - 1 : 0, green = !r.double && !r.lasso;
      if (!cfg.fair) return `${n} states. The loan may never be marked paid: the desk may stop anywhere${r.double ? `, and it can pay twice in ${steps} steps` : ''}. What does your platform promise about workers that can work?`;
      if (green) {
        const both = (st.passed.get(optKey(cfg)) || new Set());
        const extra = '';
        if (cfg.lease && cfg.resume) return `${n} states, both lamps green, but this desk carries more than it needs: a lease and Resume both hand the claim back. Remove what isn’t needed and check again.`;
        if (both.has(2) && both.has(3)) return null;
        if (cfg.workers === 2) return `${n} states, both lamps green.${extra} Try 3 before you ship.`;
        return `${n} states, both lamps green with 3 workers.${extra} Run it with 2 as well before you ship.`;
      }
      if (!cfg.lease && !cfg.resume) {
        if (cfg.key) return `Same ${n} states, same stranded loan. A key protects a second request, but nobody sends one.`;
        return `${n} states, no double payout, and the loan can stay claimed forever: after the crash, no worker has anything it is allowed to do.`;
      }
      if (cfg.lease && cfg.resume) return `${n} states, still paid twice in ${steps} steps. Who could know the money already moved?`;
      if (cfg.lease) return `Never stranded now (${n} states), but paid twice in ${steps} steps: A was slow, not dead.`;
      return `Never stranded now (${n} states), but paid twice in ${steps} steps: A sent, crashed, came back, and sent again.`;
    }

    function showCounterexamples(r, cfg) {
      const view = { crash: true, owner: cfg.resume, keys: cfg.key, lease: cfg.lease };
      $('cx').hidden = !r.double && !r.lasso;
      $('cx-note').textContent = `Each card is one state, numbered from the start, with the step that made it.${cfg.lease ? ' A bar under “claimed” is a running lease; “(stale)” marks a worker that still holds a claim the lease took back.' : ''}${r.lasso ? ' A desk can have several behaviors that never mark the loan paid; like TLC, the checker prints one of them, so it can differ from the one quoted in the lesson.' : ''}`;
      $('cx-safe-box').hidden = !r.double;
      $('cx-live-box').hidden = !r.lasso;
      if (r.double) {
        $('cx-safe-title').textContent = `NoDoublePayout fails. The shortest path to two transfers, ${r.double.length - 1} steps:`;
        cxSafe.show({ ...view, trace: r.double, loop: false });
      } else cxSafe.stop();
      if (r.lasso) {
        const k = r.lasso.length - 1;
        $('cx-live-title').textContent = k ? `The loan may never be marked paid. One such behavior: ${k} step${k > 1 ? 's' : ''}, then nothing, forever.` : 'The loan may never be marked paid. One such behavior: nothing happens at all, forever.';
        cxLive.show({ ...view, trace: r.lasso, loop: true });
      } else cxLive.stop();
    }

    function render() {
      const cfg = st.cfg, rep = st.report, stale = rep && !same(rep.cfg, cfg);
      host.querySelectorAll('[data-toggle]').forEach(b => b.setAttribute('aria-pressed', String(cfg[b.dataset.toggle])));
      host.querySelectorAll('[data-workers]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.workers) === cfg.workers)));
      $('spec').replaceChildren(...specLines(cfg).map(l => $$('span', `k-line${l.changed ? ' k-changed' : ''}`, l.text)));
      $('spec-note').textContent = `The desk’s actions right now; tinted lines are your changes. Shorthand: pc′[w] = "sent" stands for pc′ = [pc EXCEPT ![w] = "sent"], and a variable a line does not mention stays unchanged. Crash is always in: the deploy happens.${cfg.key ? ' IF c THEN a ELSE b picks a when c is true and b when it is false, like Python’s a if c else b; Loan is 4471, and keys ∪ {Loan} is the set keys with Loan added.' : ''}`;
      $('run').disabled = !st.predicted || st.running;
      if (!rep || stale || st.running) {
        lamp($('lamp-safe'), 'NoDoublePayout', 'wait', st.running ? 'checking…' : 'not checked');
        lamp($('lamp-live'), 'Loan marked paid?', 'wait', st.running ? 'checking…' : 'not checked');
        if (!st.running) $('result').textContent = '';
        $('why').textContent = st.running ? 'The checker is exploring every reachable state…' : stale ? 'You changed the desk since the last run. Run the checker again.' : st.predicted ? 'Change the desk with the buttons above, then press “Run the checker”.' : 'Answer the question above to start.';
        if (stale) { $('cx').hidden = true; cxSafe.stop(); cxLive.stop(); }
        return;
      }
      const r = rep.result, win = st.solved;
      lamp($('lamp-safe'), 'NoDoublePayout', r.double ? 'fails' : win ? 'ok' : 'holds', r.double ? `fails in ${r.double.length - 1} steps` : 'holds in every state');
      lamp($('lamp-live'), 'Loan marked paid?', r.lasso ? 'fails' : win ? 'ok' : 'holds', r.lasso ? `not always: ${r.stuck} state${r.stuck > 1 ? 's' : ''} where the desk may stop before paid` : 'yes, in every fair behavior');
      $('result').textContent = `Explored ${r.count} reachable states with ${rep.cfg.workers} workers`;
      $('why').textContent = feedback(rep.cfg, r) || 'Both lamps green with 2 workers and with 3.';
    }

    function run() {
      const cfg = { ...st.cfg }, result = D.explore({ n: cfg.workers, crash: true, lease: cfg.lease, resume: cfg.resume, key: cfg.key, fair: cfg.fair });
      st.running = true; st.report = null; $('cx').hidden = true; $('win').hidden = true; cxSafe.stop(); cxLive.stop();
      render();
      $('result').replaceChildren('Explored ', $$('span', 'k-count', '0'), ' reachable states…');
      counter($('result').querySelector('.k-count'), result.count, () => {
        st.running = false;
        st.report = { cfg, result };
        if (cfg.fair && !result.double && !result.lasso) {
          const k = optKey(cfg), set = st.passed.get(k) || new Set();
          set.add(cfg.workers); st.passed.set(k, set);
          st.solved = set.has(2) && set.has(3) && !(cfg.lease && cfg.resume);
        } else st.solved = false;
        render();
        showCounterexamples(result, cfg);
        if (st.solved) win(cfg);
      });
    }

    function win(cfg) {
      const base = { crash: true, lease: cfg.lease, resume: cfg.resume, key: cfg.key, fair: true };
      $('win-two').textContent = String(D.explore({ ...base, n: 2 }).count);
      $('win-three').textContent = String(D.explore({ ...base, n: 3 }).count);
      const lessonFix = cfg.resume && cfg.key && !cfg.lease;
      $('win-head').textContent = lessonFix ? 'Fixed: the bakery is paid, once, through the deploy' : 'Both lamps green: this desk passes too';
      $('win-how').textContent = lessonFix
        ? 'This is the lesson’s fix. Resume makes a restarted worker finish its own claim, so the loan is never stranded, and the bank’s key turns the second Send into a request it answers without paying.'
        : `It is not the lesson’s fix, though. Its cost here: ${D.explore({ ...base, n: 2 }).count} states for the checker against ${D.explore({ ...base, lease: false, resume: true, n: 2 }).count} with Resume and the key. The text after the lab follows the lesson’s fix; concept check 3 asks you to weigh the two.`;
      $('win').hidden = false;
      bakery.play();
      document.dispatchEvent(new CustomEvent('k:solved', { detail: 'act2' }));
      document.querySelectorAll('.k-working-open').forEach(b => { b.textContent = b.closest('#recap-and-the-next-bug') ? 'Show the ending' : 'Show the fix'; });
      $('win').focus();
    }

    K.ask($('ask'), {
      question: 'Before your first run: the crash desk with fairness and the idempotency key, and nothing else. What will the checker say?',
      options: [['once', 'The bakery is always paid, once'], ['same', 'Same as without the key: the loan can stay claimed forever'], ['twice', 'The bakery can now be paid twice']],
      right: 'same',
      hints: {
        once: 'After the crash, who sends a request for the key to answer?',
        twice: 'A key can stop money moving. It never makes a worker send.',
      },
      explain: 'A key protects a second request, and after the crash nobody sends one. Check it, then find what does get the stranded loan moving.',
      onSolved: () => { st.predicted = true; render(); },
      focusAfter: () => host.querySelector('[data-toggle]'),
    });
    host.querySelectorAll('[data-toggle]').forEach(b => b.addEventListener('click', () => { st.cfg[b.dataset.toggle] = !st.cfg[b.dataset.toggle]; render(); }));
    host.querySelectorAll('[data-workers]').forEach(b => b.addEventListener('click', () => { st.cfg.workers = Number(b.dataset.workers); render(); }));
    $('run').addEventListener('click', run);
    $('reset').classList.add('quiet');
    $('reset').addEventListener('click', () => {
      Object.assign(st, { cfg: fresh(), report: null, running: false, solved: false });
      $('cx').hidden = true; $('win').hidden = true; cxSafe.stop(); cxLive.stop();
      render(); $('reset').focus();
    });
    render();
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
