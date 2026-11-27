/* Branching level drawing adapted from the iwrzwr visual archive, Branch Memory (Causal Instruments), Section Gate and Compression Atlas (Field Operations) studies. MIT License, Copyright (c) 2026 Kagan Yaldizkaya. */
const BigDesk = (() => {
  const STATUS = ['approved', 'claimed', 'paid'];
  const PC = ['idle', 'claimed', 'sent'];

  function permutations(n) {
    if (n <= 1) return [Array.from({ length: n }, (_, i) => i)];
    const out = [];
    permutations(n - 1).forEach(p => { for (let i = 0; i <= p.length; i++) out.push([...p.slice(0, i), n - 1, ...p.slice(i)]); });
    return out;
  }

  function encode(s) {
    return `${s.status.join('')}|${s.owner.join(',')}|${s.pc.join('')}|${s.held.join(',')}|${s.tr.join('')}|${s.keys.join('')}|${s.crashed ? 1 : 0}|${s.retries}`;
  }

  function permute(s, pw, pl) {
    const nW = s.pc.length, nL = s.status.length;
    const status = Array(nL), owner = Array(nL), tr = Array(nL), keys = Array(nL), pc = Array(nW), held = Array(nW);
    for (let l = 0; l < nL; l++) {
      status[pl[l]] = s.status[l]; owner[pl[l]] = s.owner[l] < 0 ? -1 : pw[s.owner[l]];
      tr[pl[l]] = s.tr[l]; keys[pl[l]] = s.keys[l];
    }
    for (let w = 0; w < nW; w++) { pc[pw[w]] = s.pc[w]; held[pw[w]] = s.held[w] < 0 ? -1 : pl[s.held[w]]; }
    return { status, owner, pc, held, tr, keys, crashed: s.crashed, retries: s.retries };
  }

  function init(nW, nL) {
    return { status: Array(nL).fill(0), owner: Array(nL).fill(-1), pc: Array(nW).fill(0), held: Array(nW).fill(-1), tr: Array(nL).fill(0), keys: Array(nL).fill(0), crashed: false, retries: 0 };
  }

  const put = (t, i, v) => { const c = t.slice(); c[i] = v; return c; };

  function successors(s, cfg) {
    const out = [], nW = s.pc.length, nL = s.status.length;
    const bank = l => (s.keys[l] ? [s.tr, s.keys] : [put(s.tr, l, s.tr[l] + 1), put(s.keys, l, 1)]);
    for (let w = 0; w < nW; w++) {
      if (s.pc[w] === 0) {
        for (let l = 0; l < nL; l++) {
          if (s.status[l] === 0) out.push([true, { ...s, status: put(s.status, l, 1), owner: put(s.owner, l, w), pc: put(s.pc, w, 1), held: put(s.held, w, l) }]);
          if (s.status[l] === 1 && s.owner[l] === w) out.push([true, { ...s, pc: put(s.pc, w, 1), held: put(s.held, w, l) }]);
        }
      }
      if (s.pc[w] === 1) {
        const [tr, keys] = bank(s.held[w]);
        out.push([true, { ...s, pc: put(s.pc, w, 2), tr, keys }]);
        if (cfg.cap === null || s.retries < cfg.cap) out.push([true, { ...s, tr, keys, retries: cfg.counter ? s.retries + 1 : s.retries }]);
      }
      if (s.pc[w] === 2) out.push([true, { ...s, status: put(s.status, s.held[w], 2), pc: put(s.pc, w, 0), held: put(s.held, w, -1) }]);
      if (!s.crashed && s.pc[w] !== 0) out.push([false, { ...s, pc: put(s.pc, w, 0), held: put(s.held, w, -1), crashed: true }]);
    }
    return out;
  }

  function settings({ workers, loans, mode, symmetry = false }) {
    const unbounded = mode === 'unbounded' || mode === 'constraint';
    return {
      workers, loans, mode, symmetry,
      cap: unbounded || mode === 'nocount' ? null : Number(mode.slice(1)),
      counter: mode !== 'nocount',
      constraint: mode === 'constraint' ? (s => s.retries <= 1) : null,
      finite: mode !== 'unbounded',
    };
  }

  function search(options) {
    const cfg = settings(options);
    const perms = [];
    if (cfg.symmetry) permutations(cfg.workers).forEach(pw => permutations(cfg.loans).forEach(pl => perms.push([pw, pl])));
    const canon = s => {
      if (!cfg.symmetry) return encode(s);
      let best = null;
      for (const [pw, pl] of perms) { const k = encode(permute(s, pw, pl)); if (best === null || k < best) best = k; }
      return best;
    };
    const s0 = init(cfg.workers, cfg.loans);
    const seen = new Set([canon(s0)]);
    const queue = [[s0, 0]];
    const run = { cfg, generated: 1, depth: 1, head: 0, found: [1], done: [0], stuck: 0, bad: false };
    Object.defineProperty(run, 'states', { get: () => seen.size });
    Object.defineProperty(run, 'queue', { get: () => queue.length - run.head });
    Object.defineProperty(run, 'finished', { get: () => run.head >= queue.length });
    run.advance = budget => {
      let n = 0;
      while (run.head < queue.length && n < budget) {
        const [s, d] = queue[run.head];
        queue[run.head++] = null;
        n++;
        run.depth = Math.max(run.depth, d + 1);
        run.done[d] = (run.done[d] || 0) + 1;
        if (cfg.constraint && !cfg.constraint(s)) continue;
        const self = canon(s);
        let fairExit = false;
        for (const [fair, s2] of successors(s, cfg)) {
          run.generated++;
          const c2 = canon(s2);
          if (fair && c2 !== self) fairExit = true;
          if (seen.has(c2)) continue;
          if (s2.tr.some(t => t > 1)) run.bad = true;
          if (cfg.constraint && !cfg.constraint(s2)) continue;
          seen.add(c2);
          run.found[d + 1] = (run.found[d + 1] || 0) + 1;
          queue.push([s2, d + 1]);
        }
        if (!fairExit && s.status.some(x => x !== 2)) run.stuck++;
        if (run.head > 65536) { queue.splice(0, run.head); run.head = 0; }
      }
      return run;
    };
    return run;
  }

  function count(options) { const r = search(options); while (!r.finished) r.advance(1e6); return r; }

  return { STATUS, PC, search, count, settings };
})();

if (typeof module === 'object' && module.exports) module.exports = BigDesk;
else (() => {
  const K = window.Kit, D = BigDesk;
  const n = v => Math.round(v).toLocaleString('en-US');
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const reduced = K.reduced;
  const CAP_STATES = 200000;
  const W_NAMES = ['A', 'B', 'C'], L_NAMES = ['L4471', 'L4472', 'L4473'];
  const WARN_SYMMETRY = 'Warning: Declaring symmetry during liveness checking is dangerous. It might cause TLC to miss violations of the stated liveness properties. Please check liveness without symmetry defined.';
  const WARN_CONSTRAINT = 'Warning: Declaring state or action constraints during liveness checking is dangerous: …';

  function brush(s) {
    const { ctx } = s, dpr = s.dpr || 1;
    const snap = v => (Math.round(v * dpr - 0.5) + 0.5) / dpr;
    const ink = (alpha, color) => { ctx.globalAlpha = clamp(alpha); ctx.fillStyle = color; ctx.strokeStyle = color; };
    const b = {
      rect(x, y, w, h, color, alpha = 1) { ink(alpha, color); ctx.fillRect(Math.round(x * dpr) / dpr, Math.round(y * dpr) / dpr, Math.max(1 / dpr, Math.round(w * dpr) / dpr), Math.max(1 / dpr, Math.round(h * dpr) / dpr)); ctx.globalAlpha = 1; },
      line(points, color, { alpha = 1, width = 1, dashed = false } = {}) {
        if (points.length < 2) return;
        ink(alpha, color); ctx.lineWidth = width; ctx.lineCap = 'butt'; ctx.lineJoin = 'miter'; ctx.setLineDash(dashed ? [3, 3] : []);
        ctx.beginPath(); points.forEach(([x, y], i) => (i ? ctx.lineTo(snap(x), snap(y)) : ctx.moveTo(snap(x), snap(y)))); ctx.stroke();
        ctx.setLineDash([]); ctx.globalAlpha = 1;
      },
      box(x, y, w, h, color, opts = {}) { b.line([[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]], color, opts); },
      marker(x, y, color, size = 4, alpha = 1) { b.rect(x - size / 2, y - size / 2, size, size, color, alpha); },
      text(str, x, y, opts) { s.pen.text(str, x, y, { size: 12, ...opts }); },
      width(str, size = 12) { ctx.font = `400 ${size}px ${getComputedStyle(document.documentElement).getPropertyValue('--font-mono').trim()}`; return ctx.measureText(str).width; },
    };
    return b;
  }

  const LOG_TOP = Math.log10(200000 / 0.5);
  function levelGeometry(w) {
    const phone = w < 520, left = phone ? 34 : 52, right = phone ? 8 : 12, top = 22, plotH = phone ? 150 : 170;
    const slots = phone ? 14 : 20;
    return { phone, left, right, top, plotH, slots, pitch: (w - left - right) / slots, base: top + plotH, height: top + plotH + 44 };
  }
  const yOf = (g, v) => g.base - (v <= 0 ? 0 : (Math.log10(v / 0.5) / LOG_TOP) * g.plotH);

  function drawLevels(s, view) {
    const { c, w } = s, g = levelGeometry(w), b = brush(s), run = view.run;
    [1, 10, 100, 1000, 10000, 100000].forEach(v => {
      const y = yOf(g, v);
      b.line([[g.left - 4, y], [w - g.right, y]], c.rule, { alpha: 0.8 });
      b.text(v >= 1000 ? `${v / 1000}k` : String(v), g.left - 7, y + 4, { align: 'right', color: c.soft });
    });
    b.line([[g.left, g.base], [w - g.right, g.base]], c.soft);
    b.text('states found at each depth (log scale)', g.left, 12, { align: 'left', color: c.soft, font: 'ui' });
    const levels = run ? run.found.length : 0, first = Math.max(0, levels - g.slots);
    const xOf = d => g.left + (d - first + 0.5) * g.pitch;
    const bar = Math.max(3, Math.min(18, g.pitch * 0.56));
    if (view.pin) {
      const pts = [];
      view.pin.found.forEach((v, d) => { if (d < first || d >= first + g.slots) return; const x = xOf(d); pts.push([x - bar / 2, yOf(g, v)], [x + bar / 2, yOf(g, v)]); });
      b.line(pts, c.input, { dashed: true, width: 1.5 });
    }
    if (!run) { b.text('no run yet', w / 2, g.base - g.plotH / 2, { color: c.soft, font: 'ui' }); return; }
    const root = [g.left - 2, g.base + 14];
    for (let d = first; d < levels; d++) {
      const x = xOf(d), found = run.found[d] || 0, done = Math.min(run.done[d] || 0, found);
      const yTop = yOf(g, found), yDone = yOf(g, done);
      b.line([[root[0], root[1]], [x, root[1]], [x, g.base + 2]], c.soft, { alpha: 0.35 });
      if (done > 0) b.rect(x - bar / 2, yDone, bar, g.base - yDone, c.ink, 0.78);
      if (found > done) b.box(x - bar / 2, yTop, bar, Math.max(1, yDone - yTop), c.accent, { width: 1.5 });
      if (found > done) b.marker(x, yTop - 4, c.accent, 4);
      if (done > 0 && (!g.phone || d % 2 === 0 || d === run.depth - 1)) b.text(String(d + 1), x, g.base + 28, { color: c.soft });
    }
    b.marker(root[0], root[1], c.ink, 5);
    if (first > 0) b.text(`…${first} earlier`, g.left + 2, g.base + 42, { align: 'left', color: c.soft, font: 'ui' });
    b.text('depth', w - g.right, g.base + 42, { align: 'right', color: c.soft, font: 'ui' });
  }

  function driver(target, onTick, offscreenOk) {
    let timer = 0, on = false, visible = false, lastDraw = 0;
    const go = () => { if (!timer && on && !document.hidden) timer = setTimeout(tick, reduced.matches || (!visible && offscreenOk()) ? 0 : 33); };
    function tick() {
      timer = 0;
      if (!on) return;
      const now = performance.now(), draw = visible && (!reduced.matches || now - lastDraw > 1000);
      if (draw) lastDraw = now;
      onTick(draw, !visible);
      go();
    }
    new IntersectionObserver(es => { visible = es[es.length - 1].isIntersecting; go(); }).observe(target);
    document.addEventListener('visibilitychange', go);
    return { start() { on = true; go(); }, stop() { on = false; clearTimeout(timer); timer = 0; }, get on() { return on; } };
  }

  function choiceGroup(root, name, value, onPick) {
    root.querySelectorAll(`[data-${name}]`).forEach(btn => {
      btn.setAttribute('aria-pressed', String(btn.dataset[name] === String(value())));
      btn.onclick = () => { onPick(btn.dataset[name]); };
    });
  }

  function tlcText(run, cfg, stoppedBy) {
    const lines = [];
    if (cfg.promise === 'live' && cfg.symmetry) lines.push(WARN_SYMMETRY);
    if (cfg.promise === 'live' && cfg.mode === 'constraint') lines.push(WARN_CONSTRAINT);
    if (!run) return lines;
    if (!run.finished && !stoppedBy) {
      lines.push(`Progress: ${n(run.generated)} states generated, ${n(run.states)} distinct states found, ${n(run.queue)} states left on queue.`);
      return lines;
    }
    lines.push('Model checking completed. No error has been found.');
    lines.push(`${n(run.generated)} states generated, ${n(run.states)} distinct states found, ${n(run.queue)} states left on queue.`);
    lines.push(`The depth of the complete state graph search is ${n(run.depth)}.`);
    return lines;
  }

  function cfgText(cfg) {
    const lines = ['CONSTANTS', `  Workers = {${W_NAMES.slice(0, cfg.workers).join(', ')}}`, `  Loans = {${L_NAMES.slice(0, cfg.loans).join(', ')}}`];
    if (cfg.mode !== 'nocount') lines.push(`  MaxRetries = ${cfg.mode[0] === 'R' ? cfg.mode.slice(1) : 1}`);
    lines.push('  Nobody = Nobody', '  NoLoan = NoLoan', 'SPECIFICATION Spec');
    if (cfg.promise === 'safety') lines.push('INVARIANT NoDoublePayout'); else lines.push('INVARIANT NoDoublePayout', 'PROPERTY ClaimLeadsToPaid');
    if (cfg.symmetry) lines.push('SYMMETRY Perms');
    if (cfg.mode === 'constraint') lines.push('CONSTRAINT Bounds');
    return lines;
  }

  function lostText(mode) {
    const guard = mode[0] === 'R';
    const out = [{ t: 'Lost(w) ==' }, { t: '  /\\ pc[w] = "claimed"' }];
    if (guard) out.push({ t: '  /\\ retries < MaxRetries', changed: true });
    out.push({ t: '  /\\ Bank(held[w])' });
    if (mode !== 'nocount') out.push({ t: '  /\\ retries\' = retries + 1' });
    out.push({ t: '  /\\ UNCHANGED <<status, owner,' }, { t: '                 pc, held, crashed>>' });
    if (mode === 'nocount') out.unshift({ t: '(* the variable retries is gone from the spec *)', changed: true });
    if (mode === 'constraint') out.push({ t: '' }, { t: 'Bounds == retries <= MaxRetries', changed: true });
    return out;
  }

  function predictAct1(root, onDone) {
    K.ask(root, {
      question: 'Predict first. Three workers and three loans, with at most one lost reply per run, is 8,218 states. Now let the bank lose up to two replies per run. How many states?',
      options: [['9000', 'about 9,000'], ['13000', 'about 13,000'], ['16000', 'about 16,000'], ['66000', 'about 66,000']],
      right: '13000',
      hints: {
        '9000': 'A second lost reply can happen to any loan, after many different first ones. It adds more than a few hundred.',
        '16000': 'That would mean the second lost reply doubles everything. Does one more value of one counter double the desk?',
        '66000': 'That is the kind of jump a new loan gives. A lost reply is one more value of one counter, not a new thing with its own states.',
      },
      explain: 'It is 13,195. Going from one lost reply to two adds about 5,000 states, the same as going from none to one. More lost replies add. Try it with the controls, then add a loan and compare.',
      onSolved: onDone,
    });
  }

  function predictAct2(root, onDone) {
    K.ask(root, {
      question: 'Before your first run: finance’s model is 3 × 3 with retries counting forever. Turn SYMMETRY on and leave everything else. Will TLC finish?',
      options: [['yes323', 'Yes, in about 323 states'], ['slow', 'Yes, but it takes hours'], ['no', 'No, the queue never empties']],
      right: 'no',
      hints: {
        yes323: '323 is the bounded desk with symmetry. Does renaming workers and loans change how many times a reply was lost?',
        slow: 'Each lap of the retry loop gives a state with a bigger retries. Is there ever a last lap?',
      },
      explain: 'Symmetry glues states that differ only by names. A state with retries 7 is not a renaming of one with retries 6, so every lap is still new, and the queue never empties.',
      onSolved: onDone,
    });
  }

  function mount(host, act) {
    host.replaceChildren(document.getElementById('big-desk-lab').content.cloneNode(true));
    const uid = `${host.id}-`, $ = k => host.querySelector(`[data-k="${k}"]`);
    host.querySelectorAll('[data-k]').forEach(el => { el.id = uid + el.dataset.k; });
    host.querySelectorAll('label[for]').forEach(el => { el.htmlFor = uid + el.htmlFor; });
    const explore = act === 'explore';
    const st = {
      ready: false, cfg: explore ? { workers: 3, loans: 3, mode: 'R1', symmetry: false, promise: 'safety', forever: false } : { workers: 3, loans: 3, mode: 'unbounded', symmetry: false, promise: 'safety' },
      run: null, runCfg: null, stopped: null, pin: null, tried: new Set(), biggest: 0, last: null, signed: { safety: null, live: null }, solved: false,
    };

    const stage = K.stage($('levels'), s => drawLevels(s, { run: st.run, pin: st.pin }), { height: w => levelGeometry(w).height });
    const tick = driver($('levels'), (draw, hidden) => {
      const run = st.run;
      if (!run) { tick.stop(); return; }
      const total = run.cfg.finite ? Math.max(400, Math.ceil(estimated(run.cfg) / 75)) : 1500;
      run.advance((reduced.matches || hidden) && run.cfg.finite ? Infinity : total);
      if (!run.cfg.finite && run.states >= CAP_STATES) { stop('cap'); return; }
      if (run.finished) { tick.stop(); finish(); return; }
      if (draw) { stage.redraw(); render(); }
    }, () => Boolean(st.run && st.run.cfg.finite));

    function estimated(cfg) { return { 1: 30, 2: 400, 3: 9000 }[cfg.loans] * (cfg.workers === 3 ? 1.5 : 1) * (cfg.symmetry ? 0.06 : 1); }

    function currentModel() {
      const c = st.cfg;
      if (explore) return { workers: c.workers, loans: c.loans, mode: c.forever ? 'unbounded' : `R${c.lost}`, symmetry: false, promise: 'safety' };
      return { ...c };
    }

    function startRun() {
      const model = currentModel();
      tick.stop();
      st.run = D.search(model); st.runCfg = model; st.stopped = null;
      $('stop').hidden = false; $('stop').disabled = false;
      render(); stage.redraw();
      tick.start();
    }

    function stop(why) {
      if (!st.run || st.run.finished) return;
      tick.stop(); st.stopped = why;
      $('stop').disabled = true;
      stage.redraw(); render(); afterRun();
    }

    function finish() {
      $('stop').disabled = true;
      const r = st.run, m = st.runCfg;
      if (explore) {
        const key = `${m.workers}×${m.loans}×${m.mode}`;
        st.tried.add(key);
        st.biggest = Math.max(st.biggest, r.states);
      }
      stage.redraw(); render(); afterRun();
    }

    function afterRun() {
      const r = st.run, m = st.runCfg;
      if (explore) {
        if (r.finished) {
          st.compare = st.last ? compare(st.last, { m, states: r.states }) : null;
          st.last = { m, states: r.states };
        }
        render();
        return;
      }
      judge(r, m);
      render();
    }

    function compare(a, b) {
      const dw = b.m.workers - a.m.workers, dl = b.m.loans - a.m.loans, dr = Number(b.m.mode.slice(1)) - Number(a.m.mode.slice(1));
      const changed = [dw !== 0, dl !== 0, dr !== 0].filter(Boolean).length;
      if (changed !== 1) return `${n(b.states)} states, against ${n(a.states)} for your last finished run.`;
      const ratio = b.states / a.states, diff = b.states - a.states;
      const many = (k, one, more) => (Math.abs(k) === 1 ? `a ${one}` : `${Math.abs(k)} ${more}`);
      const what = dw ? `${dw > 0 ? 'Adding' : 'Taking away'} ${many(dw, 'worker', 'workers')}`
        : dl ? `${dl > 0 ? 'Adding' : 'Taking away'} ${many(dl, 'loan', 'loans')}`
        : `Allowing ${Math.abs(dr) === 1 ? 'one' : 'two'} ${dr > 0 ? 'more' : 'fewer'} lost ${Math.abs(dr) === 1 ? 'reply' : 'replies'}`;
      if (dr) return `${what} ${diff > 0 ? 'added' : 'removed'} ${n(Math.abs(diff))} states (${n(a.states)} to ${n(b.states)}).`;
      return `${what} ${ratio >= 1 ? 'multiplied' : 'divided'} the states by ${(ratio >= 1 ? ratio : 1 / ratio).toFixed(1)} (${n(a.states)} to ${n(b.states)}).`;
    }

    function judge(r, m) {
      const size = `${m.workers} × ${m.loans}`;
      const left = () => (st.signed.safety && st.signed.live ? (st.whyDone ? '' : ' Both runs are in: answer the question below and finance signs.') : ' Now the other promise.');
      let msg = '', ok = false;
      if (!r.finished) msg = 'TLC says no error, with states left on queue. Would you sign this?';
      else if (m.mode === 'constraint' && m.promise === 'live') msg = 'TLC warns before it starts. In your spec, can the bank lose every reply forever?';
      else if (m.mode === 'constraint') msg = `${n(r.states)} states, the same as a bound. What did TLC throw away, and does your spec know?`;
      else if (m.promise === 'live' && m.symmetry) msg = 'TLC warns: symmetry can hide lassos. Check this promise without it.';
      else if (m.mode === 'R0') msg = `${n(r.states)} states, passes. But MaxRetries 0 says the bank never loses a reply, and finance’s bank does. Would you sign a model of a different bank?`;
      else if (m.promise === 'safety') {
        if (m.workers === 3 && m.loans === 3) {
          ok = true; st.signed.safety = { states: r.states, m };
          msg = `${n(r.states)} states, signed.${left()}`;
        } else msg = `${n(r.states)} states at ${size}, no double payout. Finance asked for this promise on the real desk: three workers, three loans.`;
      } else if (m.workers < 2 || m.loans < 2) msg = `${n(r.states)} states at ${size}, and the promise holds. With one worker or one loan, nothing can collide. Use at least two of each.`;
      else {
        ok = true; st.signed.live = { states: r.states, m };
        msg = m.mode === 'nocount'
          ? `${n(r.states)} states (${size}), passes, signed. Which assumption about lost replies did fairness just make for you?${left()}`
          : `${n(r.states)} states (${size}), ClaimLeadsToPaid holds, signed. The spec says so out loud: at most ${m.mode.slice(1)} lost ${m.mode === 'R1' ? 'reply' : 'replies'} per run.${left()}`;
      }
      st.feedback = { msg, ok };
      if (ok && !st.asked) askWhy();
      maybeWin();
    }

    function askWhy() {
      st.asked = true;
      $('why-ask').hidden = false;
      K.ask($('why-ask'), {
        question: 'Before finance signs: why does this run finish, when finance’s model never did?',
        options: [
          ['finite', 'No variable can grow forever, so the reachable states run out'],
          ['symmetry', 'Symmetry glued enough states together'],
          ['cut', 'TLC was told where to stop looking'],
          ['size', 'Three workers and three loans is a small desk'],
        ],
        right: 'finite',
        hints: {
          symmetry: 'Symmetry on finance’s unbounded model never finished either. What did you change in the spec?',
          cut: 'That is what a CONSTRAINT does, and a constraint run never counts here. Look at the Lost action you ran.',
          size: 'Finance’s model was exactly this size, and its queue never emptied.',
        },
        explain: 'A bound in the spec, or no counter at all, leaves nothing that can grow without limit, so the queue has to empty. Symmetry only makes a finite run cheaper.',
        onSolved: () => { st.whyDone = true; maybeWin(); },
      });
    }

    function maybeWin() { if (st.signed.safety && st.signed.live && st.whyDone && !st.solved) win(); }

    function win() {
      st.solved = true;
      const a = st.signed.safety, b = st.signed.live;
      $('win-safety').textContent = `${n(a.states)} states, ${a.m.workers} × ${a.m.loans}${a.m.symmetry ? ', with symmetry' : ''}`;
      $('win-live').textContent = `${n(b.states)} states, ${b.m.workers} × ${b.m.loans}, no symmetry`;
      const deleted = [a, b].some(x => x.m.mode === 'nocount');
      $('win-story').textContent = deleted
        ? 'Finance signs off. On Friday the model ran all weekend and proved nothing; now it finishes in seconds. One assumption is not in the spec: with the counter deleted, fairness quietly says replies are not lost forever. Write it next to the signature.'
        : `Finance signs off. On Friday the model ran all weekend and proved nothing; now it finishes in seconds, and its assumption about lost replies is written in the spec: at most ${b.m.mode.slice(1)} per run.`;
      $('win').hidden = false;
      document.dispatchEvent(new CustomEvent('k:solved', { detail: 'act2' }));
      $('win').focus();
    }

    function statusLine() {
      const r = st.run;
      const frag = document.createDocumentFragment();
      if (!r) { frag.append(st.ready ? 'Move a control to start a run.' : 'Answer the question above to unlock the controls.'); return frag; }
      const state = r.finished ? 'finished' : st.stopped ? (st.stopped === 'cap' ? 'stopped by the lab' : 'stopped by you') : 'still running';
      const head = document.createElement('b'); head.textContent = state; frag.append(head, ` · ${n(r.states)} distinct states · `);
      const q = document.createElement('span'); q.textContent = `${n(r.queue)} states left on queue`;
      q.className = r.queue > 0 && !r.finished ? 'changed' : '';
      frag.append(q, ` · depth ${n(r.depth)}`);
      return frag;
    }

    function exploreWhy() {
      const r = st.run, m = st.runCfg;
      if (!st.ready) return '';
      if (!r) return 'Each change starts a breadth-first run of the checker on that desk.';
      if (st.stopped === 'cap') return `The lab stopped at ${n(CAP_STATES)} states to spare your browser. TLC would keep going, and so would the queue. Stopped this way, TLC still prints “Model checking completed. No error has been found.”`;
      if (st.stopped) return 'You stopped it. TLC prints “Model checking completed. No error has been found.” here too, with states still on the queue.';
      if (!r.finished) return m.mode === 'unbounded' ? 'Retries count forever. Watch the queue and the depth: does either one ever settle?' : 'Exploring breadth first: the start state, every state one step away, then two…';
      return `Finished: the queue is empty. ${st.compare || ''}`;
    }

    function act2Why() {
      const r = st.run;
      if (!st.ready) return '';
      if (!r) return st.signed.safety || st.signed.live ? 'Setup reset. Runs already signed stay signed. Set up the next run, then press “Run the checker”.' : 'Set up the run, then press “Run the checker”.';
      if (stale()) return 'You changed the setup since the last run. Run the checker again.';
      if (!r.finished && !st.stopped) return st.runCfg.mode === 'unbounded' ? 'Still running: the queue never empties. What makes the 500th lap of the retry loop a new state?' : 'Exploring…';
      return st.feedback ? st.feedback.msg : '';
    }

    const stale = () => st.runCfg && JSON.stringify(st.runCfg) !== JSON.stringify(currentModel());

    function renderControls() {
      const c = st.cfg;
      host.querySelectorAll('[data-k="controls"] button, [data-k="controls"] input').forEach(el => { el.disabled = !st.ready; });
      choiceGroup(host, 'workers', () => c.workers, v => { c.workers = Number(v); changed(); });
      choiceGroup(host, 'loans', () => c.loans, v => { c.loans = Number(v); changed(); });
      if (explore) {
        const lost = $('lost-range');
        lost.value = String(c.lost); $('lost-out').textContent = c.forever ? 'off: retries count forever' : String(c.lost);
        lost.disabled = !st.ready || c.forever;
        $('forever').setAttribute('aria-pressed', String(c.forever));
      } else {
        choiceGroup(host, 'mode', () => (c.mode[0] === 'R' ? 'bound' : c.mode), v => { c.mode = v === 'bound' ? `R${st.capPick}` : v; changed(); });
        choiceGroup(host, 'cap', () => (c.mode[0] === 'R' ? c.mode.slice(1) : ''), v => { st.capPick = Number(v); c.mode = `R${v}`; changed(); });
        $('caps').hidden = c.mode[0] !== 'R';
        choiceGroup(host, 'promise', () => c.promise, v => { c.promise = v; changed(); });
        $('symmetry').setAttribute('aria-pressed', String(c.symmetry));
        const lost = lostText(c.mode), cfg = cfgText(c);
        $('spec').replaceChildren(...lost.map(l => line(l.t, l.changed)));
        $('cfg').replaceChildren(...cfg.map(t => line(t, /^(SYMMETRY|CONSTRAINT|PROPERTY)/.test(t))));
      }
    }

    function line(text, mark) { const span = document.createElement('span'); span.className = `k-line${mark ? ' k-changed' : ''}`; span.textContent = text; return span; }

    function render() {
      renderControls();
      $('status').replaceChildren(statusLine());
      if (explore) {
        $('why').textContent = exploreWhy();
        $('tally').textContent = st.tried.size ? `Sizes you tried: ${st.tried.size} · the biggest that finished: ${n(st.biggest)} states` : '';
        $('pin').disabled = !(st.run && st.run.finished);
        $('pin-note').textContent = st.pin ? `Pinned (dashed): ${st.pin.label}, ${n(st.pin.states)} states.` : '';
      } else {
        const tlc = tlcText(st.run && !stale() ? st.run : null, st.run && !stale() ? st.runCfg : currentModel(), st.stopped);
        $('tlc').textContent = tlc.join('\n');
        $('tlc').hidden = !tlc.length;
        $('why').textContent = act2Why();
        $('why').className = st.feedback && st.feedback.ok && !stale() ? 'k-good' : '';
        $('run').disabled = !st.ready;
        [['safety', 'sign-safety'], ['live', 'sign-live']].forEach(([k, id]) => {
          const s = st.signed[k], el = $(id);
          el.classList.toggle('k-signed', Boolean(s));
          el.querySelector('.k-sign-val').textContent = s ? `signed · ${n(s.states)} states, ${s.m.workers} × ${s.m.loans}` : 'not yet';
        });
      }
      $('stop').hidden = !st.run || st.run.finished || Boolean(st.stopped);
      $('levels').setAttribute('aria-label', st.run ? `Breadth-first levels: ${st.run.found.length} depths reached, ${n(st.run.states)} distinct states, ${n(st.run.queue)} on the queue.` : 'No run yet.');
    }

    function changed() {
      if (explore) { startRun(); return; }
      if (st.run && !st.run.finished && !st.stopped) { tick.stop(); st.stopped = 'you'; }
      render();
    }

    $('stop').addEventListener('click', () => stop('you'));

    if (explore) {
      host.querySelectorAll('[data-only="act2"]').forEach(el => { el.hidden = true; });
      st.cfg.lost = 1;
      predictAct1($('ask'), () => { st.ready = true; startRun(); });
      $('lost-range').addEventListener('input', e => { st.cfg.lost = Number(e.target.value); changed(); });
      $('forever').addEventListener('click', () => { st.cfg.forever = !st.cfg.forever; changed(); });
      $('pin').addEventListener('click', () => {
        const r = st.run, m = st.runCfg;
        st.pin = { found: r.found.slice(), states: r.states, label: `${m.workers} workers × ${m.loans} loans, ${m.mode === 'unbounded' ? 'retries forever' : `${m.mode.slice(1)} lost`}` };
        stage.redraw(); render();
      });
      $('run').hidden = true;
      render();
    } else {
      host.querySelectorAll('[data-only="act1"]').forEach(el => { el.hidden = true; });
      st.capPick = 1;
      predictAct2($('ask'), () => { st.ready = true; render(); host.querySelector('[data-workers]').focus(); });
      $('symmetry').addEventListener('click', () => { st.cfg.symmetry = !st.cfg.symmetry; changed(); });
      $('run').addEventListener('click', () => { st.feedback = null; startRun(); });
      $('reset').addEventListener('click', () => {
        tick.stop();
        Object.assign(st, { cfg: { workers: 3, loans: 3, mode: 'unbounded', symmetry: false, promise: 'safety' }, run: null, runCfg: null, stopped: null, feedback: null });
        stage.redraw(); render(); $('reset').focus();
      });
      render();
    }
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
