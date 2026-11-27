/* Fence corners adapted from the iwrzwr visual archive, Confidence Fence study; the budget beam from its Moment Balance study. MIT License, Copyright (c) 2026 Kagan Yaldizkaya. */
const ClaimDesk = (() => {
  const NAMES = 'ABCDEFGHIJKL';
  const PCS = ['idle', 'claimed', 'sent', 'done'];
  const STATUSES = ['approved', 'claimed', 'paid'];
  const key = s => `${s.status}|${s.pc.join(',')}|${s.t}`;
  const init = n => ({ status: 'approved', pc: Array(n).fill('idle'), t: 0 });

  function steps(s) {
    const out = [];
    s.pc.forEach((p, w) => {
      const put = (v, change = {}) => ({ status: s.status, t: s.t, ...change, pc: s.pc.map((q, i) => (i === w ? v : q)) });
      const add = (action, next) => out.push({ action, worker: w, label: `${action}(${NAMES[w]})`, next });
      if (p === 'idle' && s.status === 'approved') add('Claim', put('claimed', { status: 'claimed' }));
      if (p === 'claimed') add('Send', put('sent', { t: s.t + 1 }));
      if (p === 'sent') add('Mark', put('done', { status: 'paid' }));
      if (p === 'idle' && s.status === 'paid') add('Skip', put('done'));
    });
    return out;
  }

  function typeOk(n) {
    const pcs = [];
    for (let i = 0; i < 4 ** n; i++) pcs.push(Array.from({ length: n }, (_, w) => PCS[Math.floor(i / 4 ** (n - 1 - w)) % 4]));
    const out = [];
    STATUSES.forEach(status => pcs.forEach(pc => [0, 1, 2].forEach(t => out.push({ status, pc, t }))));
    return out;
  }
  const inTypeOk = s => s.t >= 0 && s.t <= 2;

  const CONJUNCTS = {
    Owed: s => s.t + s.pc.filter(p => p === 'claimed').length <= 1,
    Unclaimed: s => s.status !== 'approved' || (s.t === 0 && s.pc.every(p => p === 'idle')),
    OnlyOneBusy: s => s.pc.filter(p => p !== 'idle').length <= 1,
  };
  const noDouble = s => s.t <= 1;
  const candidate = names => s => noDouble(s) && names.every(k => CONJUNCTS[k](s));

  function explore(n) {
    const start = init(n), parent = new Map([[key(start), null]]), order = [start];
    for (let i = 0; i < order.length; i++) {
      steps(order[i]).forEach(st => {
        const k = key(st.next);
        if (parent.has(k)) return;
        parent.set(k, { from: order[i], label: st.label });
        order.push(st.next);
      });
    }
    return { order, parent };
  }
  const memo = new Map();
  function reachable(n) {
    if (!memo.has(n)) { const r = explore(n); memo.set(n, { ...r, keys: new Set(r.order.map(key)) }); }
    return memo.get(n);
  }

  function traceTo(n, s) {
    const { parent } = reachable(n), labels = [];
    for (let p = parent.get(key(s)); p; p = parent.get(key(p.from))) labels.unshift(p.label);
    return labels;
  }

  function fromInit(names, n) {
    const pred = candidate(names), r = reachable(n);
    const bad = r.order.find(s => !pred(s));
    return { initOk: pred(init(n)), count: r.order.length, ok: !bad, bad: bad || null, trace: bad ? traceTo(n, bad) : [] };
  }

  function inductive(names, n) {
    const pred = candidate(names), starting = typeOk(n).filter(pred), ctis = [];
    starting.forEach(s => {
      const st = steps(s).find(x => !(inTypeOk(x.next) && pred(x.next)));
      if (st) ctis.push({ before: s, step: st.label, after: st.next });
    });
    const reach = reachable(n).keys;
    return { n, names: [...names], starting: starting.length, ctis, first: ctis[0] || null, reachableCtis: ctis.filter(c => reach.has(key(c.before))).length };
  }

  const isReachable = (s, n) => reachable(n).keys.has(key(s));

  return { NAMES, PCS, STATUSES, CONJUNCTS, key, init, steps, typeOk, noDouble, candidate, reachable, fromInit, inductive, isReachable };
})();

if (typeof module === 'object' && module.exports) module.exports = ClaimDesk;
else (() => {
  const K = window.Kit, D = ClaimDesk, NAMES = D.NAMES;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const mix = (a, b, p) => a + (b - a) * p;
  const ease = t => (t >= 1 ? 1 : 1 - 2 ** (-10 * t));
  const LETTER = { idle: 'i', claimed: 'c', sent: 's', done: 'd' };
  const STATUS_SHORT = { approved: 'appr', claimed: 'clmd', paid: 'paid' };
  const ORDER = ['Owed', 'Unclaimed', 'OnlyOneBusy'];
  const TOTAL_ACT1 = D.inductive([], 2).ctis.length;

  function stateText(s) {
    return [`status ${s.status}`, ...s.pc.map((p, w) => `pc of ${NAMES[w]} ${p}`), `transfers ${s.t}`].join(' · ');
  }
  function candidateText(names) {
    return ['TypeOK', ...(names.includes('Owed') ? [] : ['NoDoublePayout']), ...ORDER.filter(k => names.includes(k))].join(' ∧ ');
  }

  function boardGeometry(n, w) {
    const phone = w < 520, label = phone ? 58 : 112, head = n === 2 ? (phone ? 40 : 44) : 60, right = 6;
    const cols = 4 ** n, cw = (w - label - right) / cols, rowH = phone ? 20 : 24, gap = 6;
    const rowY = r => head + r * rowH + Math.floor(r / 3) * gap;
    const colX = c => label + c * cw;
    const colOf = s => s.pc.reduce((a, p) => a * 4 + D.PCS.indexOf(p), 0);
    const rowOf = s => D.STATUSES.indexOf(s.status) * 3 + s.t;
    return { phone, label, head, cols, cw, rowH, rowY, colX, colOf, rowOf, height: rowY(8) + rowH + 30, n };
  }

  function cellAt(g, x, y) {
    if (x < g.label) return null;
    const c = Math.floor((x - g.label) / g.cw);
    for (let r = 0; r < 9; r++) {
      const y0 = g.rowY(r);
      if (y >= y0 && y < y0 + g.rowH && c >= 0 && c < g.cols) return { r, c };
    }
    return null;
  }

  function stateAt(g, cell) {
    const pc = Array.from({ length: g.n }, (_, w) => D.PCS[Math.floor(cell.c / 4 ** (g.n - 1 - w)) % 4]);
    return { status: D.STATUSES[Math.floor(cell.r / 3)], pc, t: cell.r % 3 };
  }

  function fence(pen, x, y, w, h, color, arm = 4, width = 1.5) {
    pen.line([[x + arm, y], [x, y], [x, y + arm]], color, width);
    pen.line([[x + w - arm, y], [x + w, y], [x + w, y + arm]], color, width);
    pen.line([[x, y + h - arm], [x, y + h], [x + arm, y + h]], color, width);
    pen.line([[x + w - arm, y + h], [x + w, y + h], [x + w, y + h - arm]], color, width);
  }

  function drawBoard(s, view) {
    const { c, w, pen } = s, n = view.n, g = boardGeometry(n, w), pred = D.candidate(view.names);
    const reach = D.reachable(n).keys, found = view.found || new Set(), pair = view.pair;
    const size = Math.max(2, Math.min(g.cw - (g.cw > 8 ? 4 : 1), g.rowH - 8));
    const centre = st => [g.colX(g.colOf(st)) + g.cw / 2, g.rowY(g.rowOf(st)) + g.rowH / 2];
    if (n === 2) {
      D.PCS.forEach((p, i) => {
        const x = g.colX(i * 4) + 2 * g.cw;
        pen.text(g.phone ? `A ${LETTER[p]}` : `A ${p}`, x, 14, { color: c.ink, font: 'ui', size: 12 });
        pen.line([[g.colX(i * 4) + 3, 20], [g.colX(i * 4 + 4) - 3, 20]], c.rule, 1);
        D.PCS.forEach((q, j) => pen.text(LETTER[q], g.colX(i * 4 + j) + g.cw / 2, g.head - 8, { color: c.soft, size: 12 }));
      });
      if (!g.phone) pen.text('B', g.label - 10, g.head - 8, { color: c.soft, font: 'ui', size: 12, align: 'right' });
    } else {
      D.PCS.forEach((p, i) => {
        const x = g.colX(i * 16) + 8 * g.cw;
        pen.text(g.phone ? `A ${LETTER[p]}` : `A ${p}`, x, 14, { color: c.ink, font: 'ui', size: 12 });
        pen.line([[g.colX(i * 16) + 3, 20], [g.colX(i * 16 + 16) - 3, 20]], c.rule, 1);
        D.PCS.forEach((q, j) => {
          pen.text(LETTER[q], g.colX(i * 16 + j * 4) + 2 * g.cw, 34, { color: c.ink, size: 12 });
          D.PCS.forEach((u, k) => pen.text(LETTER[u], g.colX(i * 16 + j * 4 + k) + g.cw / 2, g.head - 8, { color: c.soft, size: 12 }));
        });
      });
      pen.text('B', g.label - 10, 34, { color: c.ink, font: 'ui', size: 12, align: 'right' });
      pen.text('C', g.label - 10, g.head - 8, { color: c.soft, font: 'ui', size: 12, align: 'right' });
    }
    D.STATUSES.forEach((st, k) => {
      const y = g.rowY(k * 3);
      pen.text(g.phone ? STATUS_SHORT[st] : st, 0, y + g.rowH * 1.5 + 4, { color: c.ink, font: 'ui', size: 12, align: 'left' });
      [0, 1, 2].forEach(t => pen.text(String(t), g.label - 10, g.rowY(k * 3 + t) + g.rowH / 2 + 4, { color: t === 2 ? c.accentInk : c.soft, size: 12, align: 'right' }));
    });
    D.typeOk(n).forEach(st => {
      const [x, y] = centre(st), inside = pred(st), k = D.key(st);
      if (found.has(k)) { pen.rect(x - size / 2, y - size / 2, size, size, c.accent); return; }
      if (inside) {
        s.ctx.strokeStyle = c.ink; s.ctx.lineWidth = 1; s.ctx.globalAlpha = 0.6;
        s.ctx.strokeRect(Math.round(x - size / 2) + 0.5, Math.round(y - size / 2) + 0.5, Math.round(size) - 1, Math.round(size) - 1);
        s.ctx.globalAlpha = 1;
      } else pen.rect(x - 1, y - 1, 2, 2, c.soft, 0.5);
      if (view.showReach && reach.has(k)) pen.dot(x, y, Math.max(1.5, Math.min(4, size / 3)), c.ink);
    });
    if (pair) {
      const [x1, y1] = centre(pair.before), outside = !(pair.after.t <= 2);
      const bad = pair.bad, color = bad ? c.accent : c.input;
      let x2, y2;
      if (outside) { x2 = w - 4; y2 = y1; } else [x2, y2] = centre(pair.after);
      const p = ease(view.p ?? 1), mid = [x1, y2];
      const route = Math.abs(x1 - x2) < 1 || Math.abs(y1 - y2) < 1 ? [[x1, y1], [x2, y2]] : [[x1, y1], mid, [x2, y2]];
      const total = route.slice(1).reduce((a, q, i) => a + Math.hypot(q[0] - route[i][0], q[1] - route[i][1]), 0);
      let left = p * total; const drawn = [route[0]];
      for (let i = 1; i < route.length && left > 0; i++) {
        const seg = Math.hypot(route[i][0] - route[i - 1][0], route[i][1] - route[i - 1][1]), q = Math.min(1, left / seg);
        drawn.push([mix(route[i - 1][0], route[i][0], q), mix(route[i - 1][1], route[i][1], q)]); left -= seg;
      }
      pen.line(drawn, color, 2, bad ? [] : [4, 3]);
      if (p >= 1 && !outside) fence(pen, x2 - size / 2 - 3, y2 - size / 2 - 3, size + 6, size + 6, color, 3, 1.5);
    }
    if (view.current) {
      const [x, y] = centre(view.current);
      fence(pen, x - size / 2 - 4, y - size / 2 - 4, size + 8, size + 8, c.input, g.cw > 8 ? 4 : 3, 2);
    }
    const ky = g.height - 10;
    const items = g.phone
      ? [['box', 'in the candidate'], ['dot', 'reachable'], ['fill', 'CTI']]
      : [['box', 'satisfies the candidate'], ['dot', 'reachable'], ['fill', view.act2 ? 'first state of a CTI' : 'CTI found'], ...(view.act2 ? [] : [['fence', 'your state']])];
    let kx = 0;
    items.forEach(([mark, text]) => {
      if (mark === 'box') { s.ctx.strokeStyle = c.ink; s.ctx.lineWidth = 1; s.ctx.strokeRect(kx + 0.5, ky - 9.5, 9, 9); }
      if (mark === 'dot') pen.dot(kx + 5, ky - 5, 3, c.ink);
      if (mark === 'fill') pen.rect(kx, ky - 10, 10, 10, c.accent);
      if (mark === 'fence') fence(pen, kx, ky - 10, 10, 10, c.input, 3, 1.5);
      pen.text(text, kx + 15, ky, { color: c.soft, font: 'ui', size: 12, align: 'left' });
      s.ctx.font = `400 12px ${getComputedStyle(document.documentElement).getPropertyValue('--font-ui')}`;
      kx += 15 + s.ctx.measureText(text).width + (g.phone ? 12 : 22);
    });
  }

  function animator(target, draw) {
    const run = { value: 1, to: 1, rate: 1, done: null };
    const loop = K.loop(target, dt => {
      run.value = Math.min(run.to, run.value + dt * run.rate);
      draw(run.value);
      if (run.value >= run.to) { loop.stop(); const d = run.done; run.done = null; if (d) d(); }
    });
    run.go = (rate, done) => {
      Object.assign(run, { value: 0, to: 1, rate, done });
      if (K.reduced.matches) { run.value = 1; draw(1); run.done = null; if (done) done(); return; }
      draw(0); loop.start();
    };
    return run;
  }

  function broken(s, names) {
    if (s.t > 1) return [];
    const claims = s.pc.filter(p => p === 'claimed').length, busy = s.pc.filter(p => p !== 'idle').length;
    if (names.includes('Owed') && !D.CONJUNCTS.Owed(s)) return [`transfers + claims ${s.t + claims}`];
    if (names.includes('Unclaimed') && !D.CONJUNCTS.Unclaimed(s)) return ['approved, but not untouched'];
    if (names.includes('OnlyOneBusy') && !D.CONJUNCTS.OnlyOneBusy(s)) return [`busy workers ${busy}`];
    return [];
  }

  function card(label, s, bad, names = []) {
    const li = document.createElement('li');
    if (bad) li.className = 'k-bad';
    const extra = bad ? broken(s, names) : [];
    [[label, 'k-card-step'], [s.status], ...s.pc.map((p, w) => [`${NAMES[w]} ${p}`]), [`transfers ${s.t}`, bad && s.t > 1 ? 'k-card-t' : ''], ...extra.map(x => [x, 'k-card-t'])].forEach(([text, cls]) => {
      const span = document.createElement('span'); span.textContent = text; if (cls) span.className = cls; li.append(span);
    });
    return li;
  }

  function lamp(el, reachable, what = 'First state') {
    el.className = `k-lamp ${reachable ? 'k-lamp-on' : 'k-lamp-off'}`;
    el.textContent = `${what}: ${reachable ? 'reachable from Init' : 'never reached from Init'}`;
  }

  function pressGroup(host, attr, value) {
    host.querySelectorAll(`[${attr}]`).forEach(b => b.setAttribute('aria-pressed', String(b.getAttribute(attr) === String(value))));
  }

  function mountHunt(host) {
    host.replaceChildren(document.getElementById('cti-lab').content.cloneNode(true));
    const $ = k => host.querySelector(`[data-k="${k}"]`);
    const st = { predicted: false, state: { status: 'approved', pc: ['idle', 'claimed'], t: 1 }, found: new Map(), pair: null, p: 1, showReach: false, all: false };
    const allCtis = D.inductive([], 2).ctis;
    const board = K.stage($('board'), s => drawBoard(s, {
      n: 2, names: [], found: new Set(st.all ? allCtis.map(x => D.key(x.before)) : st.found.keys()),
      pair: st.pair, p: st.p, current: st.predicted ? st.state : null, showReach: st.showReach,
    }), { height: w => boardGeometry(2, w).height });
    const anim = animator($('board'), v => { st.p = v; board.redraw(); });

    function render() {
      const s = st.state;
      pressGroup(host, 'data-status', s.status);
      pressGroup(host, 'data-pa', s.pc[0]);
      pressGroup(host, 'data-pb', s.pc[1]);
      pressGroup(host, 'data-t', s.t);
      host.querySelectorAll('.k-builder button, [data-k="reach"], [data-k="all"]').forEach(b => { b.disabled = !st.predicted; });
      $('reach').setAttribute('aria-pressed', String(st.showReach));
      $('state').textContent = stateText(s);
      lamp($('lamp'), D.isReachable(s, 2), 'This state');
      const enabled = D.steps(s);
      $('steps').replaceChildren(...(enabled.length ? enabled.map(step => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'k-step'; b.textContent = step.label; b.disabled = !st.predicted;
        b.addEventListener('click', () => take(step));
        return b;
      }) : [Object.assign(document.createElement('span'), { className: 'k-lane-note', textContent: 'No step is enabled in this state.' })]));
      const k = st.found.size, reachableFound = [...st.found.values()].filter(Boolean).length;
      const tally = $('tally'); tally.replaceChildren();
      if (st.predicted) {
        const n = document.createElement('span'); n.className = k ? 'k-bad-n' : ''; n.textContent = String(k);
        tally.append('CTIs found: ', n, ` of ${TOTAL_ACT1}; reachable among them: ${reachableFound}`);
      }
      $('all').hidden = !st.predicted || k < 3 || st.all;
      $('board').setAttribute('aria-label', `Every state with sensible values for two workers, one row per status and transfer count, one column per pair of pcs. ${k} CTIs found.${st.showReach ? ' The 8 reachable states are marked with dots.' : ''}`);
      board.redraw();
    }

    function why(step, after) {
      const two = after.t > 1, reach = D.isReachable(st.state, 2);
      if (two) {
        return reach
          ? `CTI found, and this first state is reachable: the desk itself would pay twice.`
          : `CTI found: this state satisfies NoDoublePayout, and ${step.label} makes a second transfer. Its marker says the desk never reaches it.`;
      }
      return `${step.label} keeps NoDoublePayout: ${after.t} transfer${after.t === 1 ? '' : 's'} after the step. You are now in the state after it.`;
    }

    function take(step) {
      const before = st.state, after = step.next, bad = after.t > 1;
      st.pair = { before, after, bad };
      $('pair').replaceChildren(card('before', before, false), card(`after ${step.label}`, after, bad));
      $('pair').hidden = false;
      $('why').textContent = why(step, after);
      if (bad) st.found.set(D.key(before), D.isReachable(before, 2));
      else st.state = after;
      render();
      anim.go(2.2);
      const next = host.querySelector('.k-step');
      (next || $('reset')).focus();
    }

    function set(change) {
      st.state = { ...st.state, ...change, pc: change.pc || st.state.pc };
      st.pair = null; $('pair').hidden = true;
      $('why').textContent = 'Pick a step to see where it goes.';
      render();
    }

    host.querySelectorAll('[data-status]').forEach(b => b.addEventListener('click', () => set({ status: b.dataset.status })));
    host.querySelectorAll('[data-pa]').forEach(b => b.addEventListener('click', () => set({ pc: [b.dataset.pa, st.state.pc[1]] })));
    host.querySelectorAll('[data-pb]').forEach(b => b.addEventListener('click', () => set({ pc: [st.state.pc[0], b.dataset.pb] })));
    host.querySelectorAll('[data-t]').forEach(b => b.addEventListener('click', () => set({ t: Number(b.dataset.t) })));
    $('board').addEventListener('click', e => {
      if (!st.predicted) return;
      const r = $('board').getBoundingClientRect(), g = boardGeometry(2, r.width), cell = cellAt(g, e.clientX - r.left, e.clientY - r.top);
      if (!cell) return;
      const s = stateAt(g, cell);
      if (s.t > 1) { $('why').textContent = 'That state has two transfers: it is outside NoDoublePayout. Build states with 0 or 1.'; return; }
      set(s);
    });
    $('reach').addEventListener('click', () => { st.showReach = !st.showReach; render(); });
    $('all').addEventListener('click', () => {
      st.all = true;
      $('why').textContent = `All ${TOTAL_ACT1} CTIs, in amber. ${st.showReach ? 'No amber square carries a reachable dot.' : 'Turn on “Show reachable” and compare.'}`;
      render();
    });
    $('reset').addEventListener('click', () => {
      Object.assign(st, { state: D.init(2), pair: null, found: new Map(), all: false });
      $('pair').hidden = true; $('why').textContent = 'Back at the start state, with nothing found yet.';
      render(); $('reset').focus();
    });
    K.ask($('ask'), {
      question: 'Predict first. NoDoublePayout holds in every reachable state. With two workers, how many states that satisfy it can step to a double payout?',
      options: [['0', '0'], ['1', '1'], ['21', '21'], ['96', '96']], right: '21',
      hints: {
        0: 'It holds on every reachable state, but the question counts every state with at most one transfer, reachable or not.',
        1: 'There is more than one: the lesson’s state is only the first the search meets.',
        96: 'A state where nobody holds a claim cannot make a transfer in one step.',
      },
      explain: '21 of the 96 states can step to a double payout. Build some below, and watch each first state’s marker: reachable from Init, or never reached.',
      onSolved: () => { st.predicted = true; const go = document.getElementById('start-act2'), gate = document.getElementById('act2-gate'); if (go) go.disabled = false; if (gate) gate.hidden = true; $('why').textContent = 'You are on the lesson’s state: approved, B claimed, one transfer. Press a step.'; render(); },
      focusAfter: () => host.querySelector('.k-step'),
    });
    $('why').textContent = 'Answer the question above to unlock the lab.';
    render();
  }

  const REASONS = [
    ['Claim', [
      ['right', 'Unclaimed said no transfer and nobody claimed; now 0 + 1 = 1'],
      ['count', 'With two workers, at most two claims exist, and TLC checked two'],
      ['same', 'Claim changes neither the transfers nor the claims'],
      ['paid', 'The loan is already paid, so Claim changes nothing'],
    ], {
      count: 'This reason counts workers, so it only covers the sizes you checked.',
      same: 'Claim adds a claim. Look at what the budget was before it.',
      paid: 'Claim needs the loan approved, not paid.',
    }],
    ['Send', [
      ['mark', 'Send makes no transfer; the transfer happens at Mark'],
      ['right', 'One claim less, one transfer more: the sum is unchanged'],
      ['back', 'Send turns the loan back to approved'],
      ['count', 'With three workers at most three claims exist, and TLC checked three'],
    ], {
      mark: 'Send is the step that makes the transfer.',
      back: 'Send leaves the status alone.',
      count: 'This reason counts workers, so it only covers the sizes you checked.',
    }],
    ['Mark', [
      ['count', 'By then the other N − 1 workers are idle, so at most N − 1 can follow'],
      ['zero', 'Mark sets the transfers back to 0'],
      ['right', 'Transfers and claims are unchanged; the status becomes paid'],
      ['pays', 'Mark adds a transfer, and the claim it removes pays for it'],
    ], {
      count: 'This reason counts workers, so it only covers the sizes you checked.',
      zero: 'Nothing on the desk ever lowers the transfer count.',
      pays: 'Mark changes the status and w’s pc; the transfer was Send’s.',
    }],
    ['Skip', [
      ['claim', 'Skip removes a claim, so the budget goes down'],
      ['right', 'The loan is paid; w goes from idle to done, transfers and claims unchanged'],
      ['count', 'Only one of the 300 workers can skip'],
      ['back', 'Skip turns the loan back to approved'],
    ], {
      claim: 'Skip starts from idle: w held no claim.',
      count: 'This reason counts workers, and every idle worker may skip once the loan is paid.',
      back: 'Skip leaves the status at paid.',
    }],
  ];

  function mountFix(host) {
    host.replaceChildren(document.getElementById('cti-lab').content.cloneNode(true));
    host.classList.add('k-act2');
    const $ = k => host.querySelector(`[data-k="${k}"]`);
    ['ask', 'builder', 'now', 'all', 'tally', 'jump'].forEach(k => { $(k).hidden = true; });
    ['task', 'fix', 'checks'].forEach(k => { $(k).hidden = false; });
    const st = { names: [], n: 2, ind: new Map(), init: new Map(), last: null, pair: null, p: 1, showReach: false, solved: false, reasons: 0, judged: false, asking: false };
    const ck = () => [...st.names].sort().join('+');
    const ctiKeys = () => { const r = st.ind.get(`${ck()}|${st.n}`); return r ? new Set(r.ctis.map(x => D.key(x.before))) : new Set(); };
    const board = K.stage($('board'), s => drawBoard(s, { n: st.n, names: st.names, found: ctiKeys(), act2: true, pair: st.pair, p: st.p, showReach: st.showReach }), { height: w => boardGeometry(st.n, w).height });
    const anim = animator($('board'), v => { st.p = v; board.redraw(); });

    function passes() {
      const i2 = st.ind.get(`${ck()}|2`), i3 = st.ind.get(`${ck()}|3`), fi = st.init.get(ck());
      return {
        init: fi ? fi.initOk : null,
        two: i2 ? i2.ctis.length === 0 : null,
        three: i3 ? i3.ctis.length === 0 : null,
        reach: fi ? fi.ok : null,
      };
    }

    function checklist() {
      const p = passes();
      p.judged = st.judged || null;
      const rows = [['judged', 'You judged one CTI’s first state: reached or not'], ['init', 'The start state satisfies it'], ['two', 'No CTI with 2 workers'], ['three', 'No CTI with 3 workers'], ['reach', 'It holds on every reachable state']];
      $('checks').replaceChildren(...rows.map(([k, text]) => {
        const li = document.createElement('li'), v = p[k];
        li.className = v === null ? 'k-unknown' : v ? 'k-pass' : 'k-fail';
        li.textContent = `${v === null ? 'not run yet' : v ? 'yes' : 'no'} · ${text}`;
        return li;
      }));
      return p;
    }

    function hint(r) {
      const has = k => r.names.includes(k), fi = st.init.get(ck());
      if (fi && !fi.ok) return 'The desk itself breaks this candidate, so this CTI is not a reason to strengthen. Drop the conjunct the desk breaks.';
      if (!fi) return 'This first state is never reached. Before you call the candidate too weak, ask the first question: does it hold on every reachable state? Run it from Init.';
      if (!has('Owed') && !has('Unclaimed')) return 'Too weak: this state is never reached. What does the real desk know here?';
      if (has('Owed')) return 'Better. Is a transfer possible while the loan is still approved?';
      return 'Better. Here a transfer is made and a claim is still held. Can the real desk owe both at once?';
    }

    function showInductive(r) {
      $('result').textContent = `Inductive check, ${r.n} workers: ${r.starting} starting states · ${r.ctis.length ? `${r.ctis.length} CTI${r.ctis.length === 1 ? '' : 's'}` : 'no CTI'}`;
      if (r.first) {
        const reach = D.isReachable(r.first.before, r.n);
        st.pair = { before: r.first.before, after: r.first.after, bad: true };
        $('pair').replaceChildren(card('before', r.first.before, false), card(`after ${r.first.step}`, r.first.after, true, r.names));
        $('pair').hidden = false; $('lamp-row').hidden = true;
        lamp($('lamp'), reach);
        $('state').textContent = `The first CTI: ${stateText(r.first.before)}, then ${r.first.step}.`;
        const verdict = reach ? 'This first state is reachable: the desk itself breaks the candidate. Drop the conjunct the desk breaks.' : hint(r);
        askReach(reach, verdict);
      } else {
        $('reach-q').hidden = true; st.asking = false;
        st.pair = null; $('pair').hidden = true; $('lamp-row').hidden = true; $('state').textContent = '';
        const p = passes();
        $('why').textContent = p.two && p.three
          ? (p.reach ? '' : 'No CTI with 2 or 3 workers. Now the first question too: run it from Init.')
          : `No CTI. Try ${r.n === 2 ? 3 : 2} workers${p.reach ? '' : ', and run it from Init'}, then give the reasons.`;
      }
    }

    function askReach(reach, verdict) {
      const box = $('reach-q');
      box.hidden = false; st.asking = true; st.showReach = false; render();
      $('why').textContent = 'Judge the first state before you read on.';
      box.querySelectorAll('button').forEach(b => {
        b.disabled = false; b.classList.remove('k-wrong');
        b.onclick = () => {
          if ((b.dataset.reach === 'yes') === reach) {
            st.judged = true; st.asking = false; box.hidden = true; $('lamp-row').hidden = false;
            $('why').textContent = `Right. ${verdict}`;
            render();
            $('why').textContent = `Right. ${verdict}`;
            return;
          }
          b.disabled = true; b.classList.add('k-wrong');
          $('why').textContent = reach
            ? 'Not quite. Every value in it can come from Init by Claim, Send, Mark and Skip. Try again.'
            : 'Not quite. Look at the status, the pcs and the transfers together: can Claim, Send, Mark and Skip, starting from Init, produce all of them at once? Try again.';
          box.querySelector('button:not(:disabled)').focus();
        };
      });
      box.querySelector('button').focus();
    }

    function showInit(r, n) {
      $('reach-q').hidden = true; st.asking = false;
      st.pair = null; $('pair').hidden = true; $('lamp-row').hidden = true; $('state').textContent = '';
      $('result').textContent = `From Init, ${n} workers: ${r.count} reachable states · ${r.ok ? 'all satisfy it' : 'one breaks it'}`;
      if (!r.ok) {
        const busy = r.bad.pc.filter(p => p !== 'idle').length;
        $('state').textContent = `After ${r.trace.join(', ')}: ${stateText(r.bad)}.`;
        $('why').textContent = `The desk itself breaks this one: ${busy} workers are busy (not idle) in a reachable state. Drop the conjunct; no strengthening rescues it.`;
        st.pair = { before: D.init(n), after: r.bad, bad: true };
      } else {
        const p = passes();
        $('why').textContent = p.two && p.three ? '' : `Holds on all ${r.count} reachable states, and the start state satisfies it. Now the inductive check.`;
      }
    }

    function render() {
      host.querySelectorAll('[data-conj]').forEach(b => b.setAttribute('aria-pressed', String(st.names.includes(b.dataset.conj))));
      pressGroup(host, 'data-workers', st.n);
      $('reach').setAttribute('aria-pressed', String(st.showReach));
      $('reach').disabled = st.asking;
      $('board').style.width = st.n === 3 ? `${Math.max($('board-wrap').clientWidth, 112 + 64 * 16 + 6)}px` : '';
      $('spec').textContent = `Candidate ≜ ${candidateText(st.names)}`;
      $('board-cap').textContent = `Every state with sensible values (TypeOK) for ${st.n} workers${st.n === 3 ? ', wider than the lab: scroll it sideways' : ''}: one row per status and transfer count, one column per combination of the workers’ pcs, grouped by A${st.n === 3 ? ', then B, then C' : ''}. Outlined squares satisfy the candidate, ${candidateText(st.names)}; amber squares are the first states of its CTIs in the last inductive check at this size. On narrow screens: appr approved, clmd claimed, and “A i” means A idle.`;
      const p = checklist();
      const ready = p.init && p.two && p.three && p.reach && st.judged;
      $('reasons').hidden = !ready && !st.solved;
      if (ready && !$('reasons').dataset.built) buildReasons();
      if (p.init && p.two && p.three && p.reach && !st.judged && !st.solved) $('why').textContent = 'The checks pass, but you have not judged a CTI yet. Run a weaker candidate, and decide whether its CTI’s first state is reachable.';
      if (ready && !st.solved && st.reasons < 4) $('why').textContent = `Every check passes: ${st.ind.get(`${ck()}|2`).starting} states with 2 workers, ${st.ind.get(`${ck()}|3`).starting} with 3, no CTI, and it holds from Init. Last piece: the reasons below.`;
      $('board').setAttribute('aria-label', `The ${D.typeOk(st.n).length} TypeOK states with ${st.n} workers; outlined squares satisfy the candidate.${st.showReach ? ` Dots mark the ${D.reachable(st.n).order.length} reachable states.` : ''}`);
      board.resize();
    }

    function buildReasons() {
      const box = $('reason-list'); box.dataset.built = '1'; $('reasons').dataset.built = '1';
      REASONS.forEach(([action, options, hints]) => {
        const div = document.createElement('div'); box.append(div);
        const pose = shownBefore => K.ask(div, {
          question: shownBefore
            ? `${action}(w): why does the candidate still hold after it? You saw the answer: “${options.find(o => o[0] === 'right')[1]}”. Pick it yourself to count it.`
            : `${action}(w): why does the candidate still hold after it?`,
          options, right: 'right', hints,
          explain: 'This line never mentions how many workers there are.',
          onSolved: shown => {
            if (shown) { setTimeout(() => { pose(true); const first = div.querySelector('button'); if (first) first.focus(); }, 0); return; }
            st.reasons += 1; if (st.reasons === 4) win();
          },
          focusAfter: () => div.nextElementSibling && div.nextElementSibling.querySelector('button:not(:disabled)'),
        });
        pose(false);
      });
    }

    const winView = { t: 1 };
    const beam = K.stage($('beam'), s => drawBeam(s, winView.t), { height: w => (w < 520 ? 150 : 132) });
    const beamAnim = animator($('beam'), v => { winView.t = v; beam.redraw(); });

    function win() {
      st.solved = true;
      host.querySelectorAll('[data-conj], [data-workers], [data-k="run"], [data-k="run-init"], [data-k="reset"]').forEach(b => { b.disabled = true; });
      $('win-two').textContent = String(st.ind.get(`${ck()}|2`).starting);
      $('win-three').textContent = String(st.ind.get(`${ck()}|3`).starting);
      $('why').textContent = '';
      $('win').hidden = false;
      beam.resize();
      beamAnim.go(0.5);
      document.dispatchEvent(new CustomEvent('k:solved', { detail: 'act2' }));
      $('win').focus();
    }

    function stale() {
      $('reach-q').hidden = true; st.asking = false;
      st.pair = null; $('pair').hidden = true; $('lamp-row').hidden = true; $('state').textContent = '';
      $('result').textContent = `Candidate: ${candidateText(st.names)}, ${st.n} workers.`;
      $('why').textContent = 'Run the inductive check or run it from Init.';
    }

    host.querySelectorAll('[data-conj]').forEach(b => b.addEventListener('click', () => {
      if (st.solved) return;
      const k = b.dataset.conj;
      st.names = st.names.includes(k) ? st.names.filter(x => x !== k) : ORDER.filter(x => x === k || st.names.includes(x));
      stale(); render();
    }));
    host.querySelectorAll('[data-workers]').forEach(b => b.addEventListener('click', () => { st.n = Number(b.dataset.workers); stale(); render(); }));
    $('reach').addEventListener('click', () => { st.showReach = !st.showReach; render(); });
    $('run').addEventListener('click', () => {
      const r = D.inductive(st.names, st.n);
      st.ind.set(`${ck()}|${st.n}`, r);
      render(); showInductive(r); render();
      if (st.pair) anim.go(2.2);
    });
    $('run-init').addEventListener('click', () => {
      const r = D.fromInit(st.names, st.n);
      st.init.set(ck(), r);
      render(); showInit(r, st.n); render();
      if (st.pair) anim.go(2.2);
    });
    $('reset').addEventListener('click', () => {
      if (st.solved) return;
      Object.assign(st, { names: [], n: 2, ind: new Map(), init: new Map(), pair: null });
      stale(); render(); $('reset').focus();
    });
    $('reasons').hidden = true;
    stale();
    render();
  }

  function drawBeam(s, t) {
    const { c, w, pen } = s, phone = w < 520, n = 300;
    const left = 8, right = w - 8, span = right - left, y0 = phone ? 34 : 30;
    const chipW = span / n, mover = 7, p = ease(t);
    for (let i = 0; i < n; i++) {
      const x = left + i * chipW + chipW / 2;
      if (i === mover) continue;
      pen.line([[x, y0], [x, y0 + 6]], c.soft, 1, [], 0.45);
    }
    const mx = left + mover * chipW + chipW / 2;
    pen.line([[mx, y0 - 4], [mx, y0 + 14]], c.input, 2);
    pen.text(phone ? '299 idle, unchanged' : '299 other workers: idle, unchanged', right, y0 - 10, { color: c.soft, font: 'ui', size: 12, align: 'right' });
    pen.text(`worker ${p < 0.5 ? 'claimed' : 'sent'}`, left, y0 - 10, { color: c.input, font: 'ui', size: 12, align: 'left' });
    const by = y0 + (phone ? 58 : 50), cx = w / 2, half = Math.min(span / 2 - 10, phone ? 130 : 200);
    pen.line([[cx - half, by], [cx + half, by]], c.ink, 1.5);
    pen.line([[cx - 8, by + 14], [cx, by + 2], [cx + 8, by + 14], [cx - 8, by + 14]], c.ok, 1.5);
    const load = (x, value, label) => {
      if (value > 0) { pen.line([[x, by - 22 * value], [x, by]], c.ink, 2); pen.line([[x - 3, by - 3], [x, by], [x + 3, by - 3]], c.ink, 1); }
      else pen.line([[x - 2, by], [x + 2, by]], c.soft, 1);
      pen.text(label, x, by + 30, { color: c.soft, font: 'ui', size: 12 });
    };
    const claims = 1 - p, transfers = p;
    load(cx - half * 0.6, claims, `claims ${claims >= 0.5 ? 1 : 0}`);
    load(cx + half * 0.6, transfers, `transfers ${transfers >= 0.5 ? 1 : 0}`);
    pen.text(`transfers + claims = 1`, cx, by - 30, { color: c.ok, font: 'mono', size: 13, weight: 500 });
  }

  mountHunt(document.getElementById('lab'));
  document.getElementById('start-act2').addEventListener('click', () => {
    const holder = document.getElementById('act2-mount'), host = document.createElement('div');
    host.className = 'lab'; host.id = 'lab2';
    holder.replaceWith(host);
    mountFix(host);
    host.querySelector('[data-conj]').focus();
  });
})();
