/* State and branch drawing adapted from the iwrzwr visual archive, State Boxes and Branch Memory studies. MIT License, Copyright (c) 2026 Kagan Yaldizkaya. */
const PayoutDesk = (() => {
  const WORKER_NAMES = 'ABC';
  const initial = workers => ({ status: 'approved', pc: Array(workers).fill('idle'), transfers: 0 });
  const keyOf = s => `${s.status}|${s.pc.join(',')}|${s.transfers}`;
  const moved = (s, w, to, change = {}) => ({ status: s.status, transfers: s.transfers, ...change, pc: s.pc.map((p, i) => (i === w ? to : p)) });
  const breaksInvariant = s => s.transfers > 1;

  function steps(design, s) {
    const out = [];
    const add = (action, worker, next) => out.push({ action, worker, label: `${action}(${WORKER_NAMES[worker]})`, next });
    s.pc.forEach((p, w) => {
      if (design === 'claim') {
        if (p === 'idle' && s.status === 'approved') add('Claim', w, moved(s, w, 'claimed', { status: 'claimed' }));
        if (p === 'idle' && s.status !== 'approved') add('Skip', w, moved(s, w, 'done'));
        if (p === 'claimed') add('Send', w, moved(s, w, 'sent', { transfers: s.transfers + 1 }));
        if (p === 'sent') add('Mark', w, moved(s, w, 'done', { status: 'paid' }));
        return;
      }
      if (p === 'idle' && s.status === 'approved') add('Check', w, moved(s, w, 'checked'));
      if (p === 'idle' && s.status === 'paid') add('Skip', w, moved(s, w, 'done'));
      if (design === 'recheck') {
        if (p === 'checked' && s.status === 'approved') add('Recheck', w, moved(s, w, 'rechecked'));
        if (p === 'checked' && s.status === 'paid') add('Recheck', w, moved(s, w, 'done'));
        if (p === 'rechecked') add('Send', w, moved(s, w, 'sent', { transfers: s.transfers + 1 }));
      } else if (p === 'checked') add('Send', w, moved(s, w, 'sent', { transfers: s.transfers + 1 }));
      if (p === 'sent') add('Mark', w, moved(s, w, 'done', { status: 'paid' }));
    });
    return out;
  }

  function explore(design, workers) {
    const start = initial(workers);
    const nodes = [{ state: start, depth: 0, parent: -1, via: null }];
    const seen = new Map([[keyOf(start), 0]]);
    let firstBad = -1;
    for (let head = 0; head < nodes.length; head++) {
      const node = nodes[head];
      if (firstBad < 0 && breaksInvariant(node.state)) firstBad = head;
      steps(design, node.state).forEach(step => {
        const key = keyOf(step.next);
        if (seen.has(key)) return;
        seen.set(key, nodes.length);
        nodes.push({ state: step.next, depth: node.depth + 1, parent: head, via: step.label, action: step.action, worker: step.worker });
      });
    }
    const path = [];
    for (let i = firstBad; i >= 0; i = nodes[i].parent) path.unshift(i);
    const layers = [];
    nodes.forEach((n, i) => { (layers[n.depth] = layers[n.depth] || []).push(i); });
    const trace = path.map(i => ({ label: nodes[i].via, action: nodes[i].action, worker: nodes[i].worker, state: nodes[i].state }));
    return { design, workers, nodes, layers, firstBad, path, trace, count: nodes.length, badCount: nodes.filter(n => breaksInvariant(n.state)).length };
  }

  function behaviors(design, workers) {
    const memo = new Map();
    const walk = s => {
      const key = keyOf(s);
      if (memo.has(key)) return memo.get(key);
      const next = steps(design, s);
      const tally = next.length
        ? next.reduce((t, step) => { const c = walk(step.next); return { total: t.total + c.total, twice: t.twice + c.twice }; }, { total: 0, twice: 0 })
        : { total: 1, twice: breaksInvariant(s) ? 1 : 0 };
      memo.set(key, tally);
      return tally;
    };
    return walk(initial(workers));
  }

  return { WORKER_NAMES, initial, keyOf, steps, explore, behaviors, breaksInvariant };
})();

if (typeof module === 'object' && module.exports) module.exports = PayoutDesk;
else (() => {
  const K = window.Kit, D = PayoutDesk, NAMES = D.WORKER_NAMES;
  const SVG = 'http://www.w3.org/2000/svg';
  const AMOUNT = 50000;
  const euros = n => `€${n.toLocaleString('en-US')}`;
  const clamp = (n, a = 0, b = 1) => Math.min(b, Math.max(a, n));
  const mix = (a, b, p) => a + (b - a) * p;
  const easeOut = t => (t >= 1 ? 1 : 1 - 2 ** (-10 * t));
  const NAIVE_ORDERINGS = D.behaviors('naive', 2);

  function lengthsOf(path) { return path.slice(1).map((p, i) => Math.hypot(p[0] - path[i][0], p[1] - path[i][1])); }
  function pointOn(path, progress) {
    const lengths = lengthsOf(path);
    let distance = clamp(progress) * lengths.reduce((a, b) => a + b, 0);
    for (let i = 0; i < lengths.length; i++) {
      if (distance <= lengths[i] || i === lengths.length - 1) { const q = lengths[i] ? distance / lengths[i] : 0; return [mix(path[i][0], path[i + 1][0], q), mix(path[i][1], path[i + 1][1], q)]; }
      distance -= lengths[i];
    }
    return path[0];
  }
  function prefix(path, progress) {
    const lengths = lengthsOf(path);
    let distance = clamp(progress) * lengths.reduce((a, b) => a + b, 0);
    const out = [path[0]];
    for (let i = 0; i < lengths.length; i++) {
      if (distance < lengths[i]) { const q = lengths[i] ? distance / lengths[i] : 0; out.push([mix(path[i][0], path[i + 1][0], q), mix(path[i][1], path[i + 1][1], q)]); break; }
      out.push(path[i + 1]); distance -= lengths[i];
    }
    return out;
  }

  function brush(s) {
    const { ctx } = s, dpr = s.dpr || 1;
    const snapFor = width => { const offset = Math.round(width * dpr) % 2 ? 0.5 : 0; return v => (Math.round(v * dpr - offset) + offset) / dpr; };
    const ink = (alpha, color) => { ctx.globalAlpha = clamp(alpha); ctx.fillStyle = color; ctx.strokeStyle = color; };
    const b = {
      rect(x, y, w, h, color, alpha = 1) { ink(alpha, color); ctx.fillRect(Math.round(x * dpr) / dpr, Math.round(y * dpr) / dpr, Math.round(w * dpr) / dpr, Math.round(h * dpr) / dpr); ctx.globalAlpha = 1; },
      line(points, color, { alpha = 1, width = 1, dashed = false } = {}) {
        if (points.length < 2) return;
        const snap = snapFor(width);
        ink(alpha, color); ctx.lineWidth = width; ctx.lineCap = 'butt'; ctx.lineJoin = 'miter'; ctx.setLineDash(dashed ? [2, 4] : []);
        ctx.beginPath(); points.forEach(([x, y], i) => (i ? ctx.lineTo(snap(x), snap(y)) : ctx.moveTo(snap(x), snap(y)))); ctx.stroke();
        ctx.setLineDash([]); ctx.globalAlpha = 1;
      },
      box(x, y, w, h, color, opts = {}) { b.line([[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]], color, opts); },
      card(x, y, w, h, { stroke, fill, width = 1, alpha = 1 }) {
        const snap = snapFor(width), r = Math.min(6, h / 3);
        ctx.globalAlpha = alpha; ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(snap(x), snap(y), Math.round(w * dpr) / dpr, Math.round(h * dpr) / dpr, r); else ctx.rect(snap(x), snap(y), w, h);
        if (fill) { ctx.fillStyle = fill; ctx.fill(); }
        if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
        ctx.globalAlpha = 1;
      },
      marker(x, y, color, size = 4, alpha = 1) { b.rect(x - size / 2, y - size / 2, size, size, color, alpha); },
      dot(x, y, r, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); },
      text(str, x, y, opts) { s.pen.text(str, x, y, { size: 12, ...opts }); },
      width(str, size = 12, font = 'mono') {
        const family = getComputedStyle(document.documentElement).getPropertyValue(font === 'mono' ? '--font-mono' : '--font-ui').trim();
        ctx.font = `400 ${size}px ${family}`; return ctx.measureText(str).width;
      },
    };
    return b;
  }

  const PC_COLUMNS = ['idle', 'checked', 'sent', 'done'];

  function deskGeometry(w) {
    const phone = w < 360, label = phone ? 20 : 64, bank = phone ? 92 : 112, gutter = phone ? 10 : 18;
    const pitch = (w - label - bank - gutter) / 4, size = Math.min(40, pitch - (phone ? 8 : 14));
    const rows = [26, 26 + size + 16], statusY = rows[1] + size + 16, statusH = 28;
    const cx = i => label + pitch * (i + 0.5);
    return { phone, label, bank, pitch, size, rows, statusY, statusH, cx, bankX: w - bank, height: statusY + statusH + 4 };
  }

  function drawDesk(s, view) {
    const { c, w } = s, g = deskGeometry(w), b = brush(s), anim = view.anim, t = anim ? anim.t : 1;
    const shown = anim && t < 0.7 ? anim.before : view.state;
    PC_COLUMNS.forEach((name, i) => b.text(name, g.cx(i), 14, { color: c.soft, font: 'ui' }));
    [0, 1].forEach(w0 => {
      const cy = g.rows[w0] + g.size / 2;
      b.text(g.phone ? NAMES[w0] : `worker ${NAMES[w0]}`, 0, cy + 4, { align: 'left', color: c.ink, font: 'ui', weight: 500 });
      PC_COLUMNS.forEach((name, i) => {
        const x = g.cx(i) - g.size / 2, y = g.rows[w0], here = view.state.pc[w0] === name && !(anim && anim.worker === w0 && t < 1);
        b.box(x, y, g.size, g.size, c.ink, { alpha: here ? 0.85 : 0.28 });
        b.line([[g.cx(i) - 3, cy], [g.cx(i) + 3, cy]], c.ink, { alpha: 0.2 });
        b.line([[g.cx(i), cy - 3], [g.cx(i), cy + 3]], c.ink, { alpha: 0.2 });
        if (here) b.marker(g.cx(i), cy, anim && anim.worker === w0 ? c.input : c.ink, 8);
      });
    });
    const sx = g.label, sw = g.pitch * 4;
    b.box(sx + 4, g.statusY, sw - 8, g.statusH, c.ink, { alpha: 0.5 });
    const long = `status: ${shown.status} · loan 4471`, statusText = b.width(long, 12, 'ui') < sw - 20 ? long : `status: ${shown.status}`;
    b.text(statusText, sx + sw / 2, g.statusY + 18, { color: c.ink, font: 'ui' });
    const bx = g.bankX, by = g.rows[0], bh = g.rows[1] + g.size - by, bad = shown.transfers > 1;
    b.box(bx, by, g.bank, bh, bad ? c.accent : c.ink, { alpha: bad ? 1 : 0.5, width: bad ? 1.5 : 1 });
    b.text('transfers', bx + g.bank / 2, by + 16, { color: c.soft, font: 'ui' });
    b.text(String(shown.transfers), bx + g.bank / 2, by + bh / 2 + 10, { color: bad ? c.accentInk : c.ink, size: 26, weight: 600 });
    for (let i = 0; i < shown.transfers; i++) b.marker(bx + g.bank / 2 - 6 + i * 12, by + bh - 12, bad ? c.accent : c.ink, 8);
    const paid = euros(shown.transfers * AMOUNT), bakeryText = b.width(`bakery ${paid}`, 12, 'ui') < g.bank - 4 ? `bakery ${paid}` : paid;
    b.text(bakeryText, bx + g.bank / 2, g.statusY + 18, { color: bad ? c.accentInk : c.soft, font: 'ui', weight: bad ? 600 : 400 });
    if (!anim || t >= 1) return;
    const w0 = anim.worker, cy = g.rows[w0] + g.size / 2;
    const from = g.cx(PC_COLUMNS.indexOf(anim.before.pc[w0])), to = g.cx(PC_COLUMNS.indexOf(anim.after.pc[w0]));
    const statusMid = g.statusY + g.statusH / 2;
    let route;
    if (anim.action === 'Send') route = [[to, cy], [bx + g.bank / 2, cy]];
    else if (anim.action === 'Mark') route = [[to, cy], [to, statusMid]];
    else route = [[from, statusMid], [from, cy]];
    b.line(prefix(route, easeOut(t)), anim.action === 'Send' && anim.after.transfers > 1 ? c.accent : c.input, { alpha: 0.7, dashed: anim.action !== 'Send' });
    const tip = pointOn(route, easeOut(t));
    b.marker(tip[0], tip[1], c.input, 6);
    const pcRoute = [[from, cy], [to, cy]], p = pointOn(pcRoute, easeOut(t));
    b.line(prefix(pcRoute, easeOut(t)), c.input, { alpha: 0.35 });
    b.marker(p[0], p[1], c.input, 8);
  }

  const CODE = { idle: 'i', checked: 'c', rechecked: 'r', claimed: 'c', sent: 's', done: 'd' };
  const SHORT = { idle: 'idle', checked: 'chk', rechecked: 'rchk', claimed: 'clm', sent: 'sent', done: 'done' };
  const STATUS_SHORT = { approved: 'appr', claimed: 'clmd', paid: 'paid' };
  const ACTION_CODE = { Check: 'c', Recheck: 'r', Claim: 'c', Send: 's', Mark: 'm', Skip: 'k' };

  function graphGeometry(result, w) {
    const widest = Math.max(...result.layers.map(l => l.length));
    const detailed = result.workers <= 2, phone = w < 520, left = phone ? 4 : 62, usable = w - left - 6;
    const slot = usable / widest;
    const boxW = detailed ? Math.min(112, slot - 8) : clamp(slot - 3, 5, 10), boxH = detailed ? 36 : boxW;
    const short = detailed && boxW < 96, pitch = detailed ? boxH + 34 : boxH + 16, top = detailed ? 44 + boxH / 2 : 30;
    const at = new Map();
    result.layers.forEach((layer, d) => layer.forEach((n, i) => at.set(n, [left + usable / 2 + (i - (layer.length - 1) / 2) * slot, top + d * pitch])));
    const edges = result.nodes.map((node, i) => {
      if (node.parent < 0) return null;
      const [px, py] = at.get(node.parent), [cx, cy] = at.get(i), stagger = (result.layers[node.depth - 1].indexOf(node.parent) % 3) * (detailed ? 4 : 2);
      const mid = py + boxH / 2 + (detailed ? 6 : 4) + stagger;
      return [[px, py + boxH / 2], [px, mid], [cx, mid], [cx, cy - boxH / 2]];
    });
    return { detailed, short, phone, left, boxW, boxH, pitch, top, at, edges, height: top + (result.layers.length - 1) * pitch + boxH / 2 + 10 };
  }

  function drawGraph(s, view) {
    const { c, w } = s, result = view.result;
    if (!result) return;
    const g = graphGeometry(result, w), b = brush(s), p = view.p, onPath = new Set(result.path);
    if (!g.phone) result.layers.forEach((_, d) => { if (d <= Math.ceil(p)) b.text(`depth ${d}`, 0, g.top + d * g.pitch + 4, { align: 'left', color: c.soft, font: 'ui' }); });
    const [rx, ry] = g.at.get(0);
    if (g.detailed) { b.dot(rx, 10, 5, c.ink); b.line([[rx, 15], [rx, ry - g.boxH / 2]], c.ink, { alpha: 0.7 }); }
    result.nodes.forEach((node, i) => {
      if (!g.edges[i]) return;
      const grow = clamp(p - (node.depth - 1));
      if (grow <= 0) return;
      b.line(prefix(g.edges[i], easeOut(grow)), c.ink, { alpha: 0.4 });
      if (grow < 1) { const tip = pointOn(g.edges[i], easeOut(grow)); b.marker(tip[0], tip[1], c.ink, 4); }
    });
    if (view.q > 0 && result.path.length > 1) {
      const route = result.path.slice(1).flatMap(i => g.edges[i]);
      b.line(prefix(route, easeOut(view.q)), c.accent, { width: 2.5 });
    }
    result.nodes.forEach((node, i) => {
      const appear = clamp((p - node.depth + 0.35) / 0.35);
      if (appear <= 0) return;
      const [x, y] = g.at.get(i), bad = D.breaksInvariant(node.state), marked = view.q >= 1 && onPath.has(i);
      if (!g.detailed) {
        if (bad) b.rect(x - g.boxW / 2, y - g.boxH / 2, g.boxW, g.boxH, c.accent, appear);
        else b.rect(x - g.boxW / 2, y - g.boxH / 2, g.boxW, g.boxH, c.ink, 0.75 * appear);
        if (marked) b.box(x - g.boxW / 2 - 2, y - g.boxH / 2 - 2, g.boxW + 4, g.boxH + 4, c.accent, { width: 1.5 });
        return;
      }
      b.card(x - g.boxW / 2, y - g.boxH / 2, g.boxW, g.boxH, { fill: bad ? c.accentSoft : c.paper, stroke: bad || marked ? c.accent : c.soft, width: marked ? 2 : 1, alpha: appear });
      const st = node.state, words = g.short ? st.pc.map(v => CODE[v]).join(' ') : st.pc.map(v => SHORT[v]).join(' ');
      s.ctx.globalAlpha = appear;
      b.text(g.short ? STATUS_SHORT[st.status] : st.status, x, y - 3, { color: bad ? c.accentInk : c.ink });
      b.text(`${words} ${g.short ? '' : '· '}${st.transfers}`, x, y + 12, { color: bad ? c.accentInk : c.soft, weight: bad ? 500 : 400 });
      s.ctx.globalAlpha = 1;
      if (node.via && appear >= 1) {
        const label = g.short ? `${ACTION_CODE[node.action]}${NAMES[node.worker]}` : node.via;
        b.text(label, x + 4, y - g.boxH / 2 - 4, { align: 'left', color: c.soft });
      }
    });
  }

  function graphKey(result, w) {
    if (result.workers > 2) return 'Each square is one reachable state, one row per depth; amber squares break NoDoublePayout. A line joins each state to the state the checker first reached it from.';
    const g = graphGeometry(result, w), cl = result.design === 'claim', re = result.design === 'recheck';
    const top = 'Each box is one state: status on top, then pc of A, pc of B and transfers. Amber boxes break NoDoublePayout. A line joins each state to the state the checker first reached it from, labelled with the step.';
    if (!g.short) return `${top} Short forms: ${cl ? 'clm claimed' : re ? 'chk checked, rchk rechecked' : 'chk checked'}.`;
    return `${top} Narrow screen codes: appr approved, ${cl ? 'clmd claimed, ' : ''}i idle, c ${cl ? 'claimed' : 'checked'}, ${re ? 'r rechecked, ' : ''}s sent, d done; on a line, c ${cl ? 'Claim' : 'Check'}, ${re ? 'r Recheck, ' : ''}s Send, m Mark, k Skip, then the worker.`;
  }

  function svgEl(name, attrs = {}, text) {
    const el = document.createElementNS(SVG, name);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    if (text !== undefined) el.textContent = text;
    return el;
  }

  function messageOf(step, before, after, narrow) {
    const read = before.status;
    const full = {
      Check: `Check: ${read}`, Skip: `Skip: ${read}`, Recheck: `Recheck: ${read}`, Claim: 'Claim: claimed',
      Send: `Send ${euros(AMOUNT)}`, Mark: 'Mark: paid',
    }[step.action];
    return { to: step.action === 'Send' ? 'bank' : 'loans', label: narrow ? step.action : full, bad: step.action === 'Send' && after.transfers > 1 };
  }

  function drawSequence(host, uid, trace, workers) {
    const width = Math.max(240, Math.round(host.getBoundingClientRect().width) || 320), narrow = width < 420;
    const used = new Set(trace.slice(1).map(t => t.worker));
    const actors = [{ id: 0, name: 'A' }, { id: 'loans', name: 'loans table' }, { id: 1, name: 'B' }];
    if (workers > 2 && used.has(2)) actors.push({ id: 2, name: 'C' });
    actors.push({ id: 'bank', name: 'bank' });
    const margin = narrow ? 34 : 48, step = (width - 2 * margin) / (actors.length - 1);
    const xOf = id => margin + actors.findIndex(a => a.id === id) * step;
    const rows = trace.length - 1, top = 30, pitch = 30, height = top + 16 + Math.max(rows, 1) * pitch + 6;
    const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, width, height, role: 'img', 'aria-label': rows ? `Sequence diagram of the behavior: ${trace.slice(1).map(t => t.label).join(', ')}.` : 'Sequence diagram: no steps yet.' });
    const defs = svgEl('defs');
    [['arrow', 'k-head'], ['arrow-bad', 'k-head k-head-bad']].forEach(([id, cls]) => {
      const m = svgEl('marker', { id: `${uid}-${id}`, markerWidth: 8, markerHeight: 6, refX: 7, refY: 3, orient: 'auto' });
      m.append(svgEl('polygon', { points: '0 0, 8 3, 0 6', class: cls }));
      defs.append(m);
    });
    svg.append(defs);
    actors.forEach(a => {
      const x = xOf(a.id), label = narrow && a.id === 'loans' ? 'loans' : a.name, half = Math.max(18, label.length * 3.8 + 8);
      svg.append(svgEl('line', { x1: x, y1: 22, x2: x, y2: height - 2, class: 'k-life', 'stroke-dasharray': '3 3' }));
      const g = svgEl('g', { class: 'k-actor' });
      g.append(svgEl('rect', { x: x - half, y: 1, width: half * 2, height: 21, rx: 4 }));
      g.append(svgEl('text', { x, y: 16, 'text-anchor': 'middle' }, label));
      svg.append(g);
    });
    const yOf = i => top + 16 + i * pitch;
    [0, 1, 2].forEach(w0 => {
      const startAt = trace.findIndex((t, i) => i > 0 && t.worker === w0 && ['Check', 'Claim'].includes(t.action));
      if (startAt < 0 || !actors.some(a => a.id === w0)) return;
      let endAt = trace.findIndex((t, i) => i > startAt && t.worker === w0 && t.state.pc[w0] === 'done');
      const y1 = yOf(startAt - 1) - 4, y2 = endAt < 0 ? height - 4 : yOf(endAt - 1) + 4;
      svg.append(svgEl('rect', { x: xOf(w0) - 4, y: y1, width: 8, height: Math.max(8, y2 - y1), class: 'k-bar' }));
    });
    trace.slice(1).forEach((t, i) => {
      const m = messageOf(t, trace[i].state, t.state, narrow), x1 = xOf(t.worker), x2 = xOf(m.to), y = yOf(i), right = x2 > x1;
      const end = x2 + (right ? -4 : 4);
      svg.append(svgEl('line', { x1: x1 + (right ? 4 : -4), y1: y, x2: end, y2: y, class: `k-msg${m.bad ? ' k-bad' : ''}`, 'marker-end': `url(#${uid}-${m.bad ? 'arrow-bad' : 'arrow'})` }));
      const tw = m.label.length * 7.2, tx = right ? x1 + 8 : x1 - 8;
      svg.append(svgEl('rect', { x: right ? tx - 2 : tx - tw - 2, y: y - 17, width: tw + 4, height: 14, rx: 2, class: 'k-mask' }));
      svg.append(svgEl('text', { x: tx, y: y - 6, 'text-anchor': right ? 'start' : 'end', class: m.bad ? 'k-bad' : '' }, m.label));
    });
    if (!rows) svg.append(svgEl('text', { x: width / 2, y: top + 24, 'text-anchor': 'middle' }, 'No steps yet'));
    host.replaceChildren(svg);
  }

  function fillStrip(ol, trace) {
    ol.replaceChildren(...trace.map((t, i) => {
      const li = document.createElement('li'), bad = D.breaksInvariant(t.state);
      if (bad) li.className = 'k-bad';
      const rows = [[`${i} · ${t.label || 'start'}`, 'k-card-step'], [t.state.status], ...t.state.pc.map((p, w) => [`${NAMES[w]} ${p}`]), [`transfers ${t.state.transfers}`, 'k-card-t']];
      rows.forEach(([text, cls]) => { const span = document.createElement('span'); span.textContent = text; if (cls) span.className = cls; li.append(span); });
      return li;
    }));
  }

  function predict(root, { question, options, right, onAnswered }) {
    const q = document.createElement('p'); q.className = 'k-q'; q.textContent = question;
    const row = document.createElement('div'); row.className = 'row'; row.setAttribute('role', 'group'); row.setAttribute('aria-label', question);
    const fb = document.createElement('p'); fb.className = 'k-feedback'; fb.tabIndex = -1; fb.setAttribute('aria-live', 'polite');
    const buttons = options.map(value => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = value;
      b.addEventListener('click', () => {
        buttons.forEach(x => { x.disabled = true; });
        b.setAttribute('aria-pressed', 'true');
        if (value === right) { b.classList.add('k-right'); fb.textContent = `Right. Keep ${right} in mind: the lesson explains where it comes from after the lab.`; }
        else { b.classList.add('k-missed'); fb.classList.add('k-bad'); fb.textContent = `Not ${value}. Keep your guess in mind: run the checker below and count.`; }
        onAnswered(value === right);
      });
      return b;
    });
    row.append(...buttons);
    root.replaceChildren(q, row, fb);
  }

  function animator(target, draw) {
    const run = { from: 0, to: 0, value: 0, rate: 1, done: null };
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
    const ws = Array.from({ length: cfg.workers }, (_, i) => `"${NAMES[i]}"`).join(', ');
    const lines = [{ text: `Workers ≜ {${ws}}`, changed: cfg.workers !== 2 }];
    if (cfg.claim) {
      lines.push({ text: 'Claim(w)   ≜ pc[w] = "idle" ∧ status = "approved"', changed: true });
      lines.push({ text: '             ∧ status′ = "claimed" ∧ pc′[w] = "claimed"', changed: true });
      lines.push({ text: 'Skip(w)    ≜ pc[w] = "idle" ∧ status ≠ "approved" ∧ pc′[w] = "done"', changed: true });
      lines.push({ text: 'Send(w)    ≜ pc[w] = "claimed" ∧ pc′[w] = "sent" ∧ transfers′ = transfers + 1', changed: true });
    } else {
      lines.push({ text: 'Check(w)   ≜ pc[w] = "idle" ∧ status = "approved" ∧ pc′[w] = "checked"' });
      lines.push({ text: 'Skip(w)    ≜ pc[w] = "idle" ∧ status = "paid" ∧ pc′[w] = "done"' });
      if (cfg.recheck) {
        lines.push({ text: 'Recheck(w) ≜ pc[w] = "checked" ∧ status = "approved" ∧ pc′[w] = "rechecked"', changed: true });
        lines.push({ text: '             ∨ pc[w] = "checked" ∧ status = "paid" ∧ pc′[w] = "done"', changed: true });
        lines.push({ text: 'Send(w)    ≜ pc[w] = "rechecked" ∧ pc′[w] = "sent" ∧ transfers′ = transfers + 1', changed: true });
      } else lines.push({ text: 'Send(w)    ≜ pc[w] = "checked" ∧ pc′[w] = "sent" ∧ transfers′ = transfers + 1' });
    }
    lines.push({ text: 'Mark(w)    ≜ pc[w] = "sent" ∧ pc′[w] = "done" ∧ status′ = "paid"' });
    if (cfg.delay) lines.push({ text: '(* random delay: no line to write, the spec has no clock *)', changed: true });
    const acts = cfg.claim ? 'Claim(w) ∨ Skip(w) ∨ Send(w) ∨ Mark(w)' : `Check(w) ∨ Skip(w) ∨ ${cfg.recheck ? 'Recheck(w) ∨ ' : ''}Send(w) ∨ Mark(w)`;
    lines.push({ text: `Next ≜ ∃ w ∈ Workers : ${acts}`, changed: cfg.claim || cfg.recheck });
    return lines;
  }

  function mount(host, mode) {
    host.replaceChildren(document.getElementById('desk-lab').content.cloneNode(true));
    const uid = `${host.id}-`, $ = k => host.querySelector(`[data-k="${k}"]`);
    host.querySelectorAll('[data-k]').forEach(el => { el.id = uid + el.dataset.k; });
    const explore = mode === 'explore';
    const st = {
      predicted: !explore, state: D.initial(2), trail: [], tried: new Map(), anim: null,
      result: null, p: 0, q: 0, phase: 'idle',
      cfg: { recheck: false, delay: false, claim: false, workers: 2 }, report: null, solved: false,
    };
    st.trail = [{ label: null, state: st.state }];

    const desk = explore ? K.stage($('desk'), s => drawDesk(s, { state: st.state, anim: st.anim }), { height: w => deskGeometry(w).height }) : null;
    const deskAnim = explore ? animator($('desk'), () => { if (st.anim) st.anim.t = deskAnim.value; desk.redraw(); }) : null;
    const graph = K.stage($('graph'), s => drawGraph(s, { result: st.result, p: st.p, q: st.q }), { height: w => (st.result ? graphGeometry(st.result, w).height : 1) });
    const graphAnim = animator($('graph'), () => { if (st.phase === 'path') st.q = graphAnim.value; else st.p = graphAnim.value; graph.redraw(); });

    const seqHosts = [];
    const sequenceInto = (el, trace, workers) => { el.kTrace = trace; el.kWorkers = workers; drawSequence(el, `${uid}${el.dataset.k}`, trace, workers); };
    new ResizeObserver(() => seqHosts.forEach(el => { if (el.kTrace && el.offsetParent) drawSequence(el, `${uid}${el.dataset.k}`, el.kTrace, el.kWorkers); })).observe(host);
    seqHosts.push($('seq'), $('trace-seq'));

    function stateLine(s) {
      const div = document.createElement('div');
      const parts = [`status ${s.status}`, ...s.pc.map((p, w) => `pc of ${NAMES[w]} ${p}`)];
      div.append(parts.join(' · '), ' · ');
      const t = document.createElement('span');
      t.textContent = `transfers ${s.transfers}`;
      if (s.transfers > 1) t.className = 'changed';
      div.append(t);
      return div;
    }

    function exploreWhy() {
      const s = st.state, n = st.trail.length - 1, enabled = D.steps('naive', s);
      if (!st.predicted) return 'Answer the question above to unlock the scheduler.';
      if (!n) return 'You are the scheduler. Each button is a step that worker may take now. Pick who moves first.';
      if (!enabled.length) {
        const key = st.trail.slice(1).map(t => t.label).join(' '), fresh = st.lastFresh;
        return `Both workers are done after ${n} steps: ${key.split(' ').join(', ')}. ${s.transfers > 1 ? `Two transfers: the bakery got ${euros(2 * AMOUNT)}.` : `One transfer: the bakery got ${euros(AMOUNT)}.`} ${fresh ? 'A new ordering.' : 'You have tried this ordering before.'} Press Reset to try another.`;
      }
      if (s.transfers > 1) return `Two transfers already: the bakery has ${euros(2 * AMOUNT)}. This ordering pays twice whatever happens next.`;
      if (s.pc.every(p => p === 'checked')) return 'Both workers have read “approved”. Nothing either of them can do now will stop two transfers.';
      return `Step ${n}: ${st.trail[n].label}. Pick the next step.`;
    }

    function tally() {
      const p = $('tally'), tried = st.tried.size, twice = [...st.tried.values()].filter(Boolean).length;
      const bad = document.createElement('span'); bad.className = twice ? 'k-bad-n' : ''; bad.textContent = String(twice);
      p.replaceChildren(`Orderings you have tried: ${tried} of ${NAIVE_ORDERINGS.total} · paid twice: `, bad, tried === NAIVE_ORDERINGS.total ? ' · every ordering tried' : '');
    }

    function lanes() {
      [0, 1].forEach(w0 => {
        const lane = host.querySelector(`[data-lane="${w0}"]`), enabled = D.steps('naive', st.state).filter(x => x.worker === w0);
        const nodes = enabled.map(step => {
          const b = document.createElement('button');
          b.type = 'button'; b.className = 'k-step'; b.textContent = step.label; b.disabled = !st.predicted;
          b.addEventListener('click', () => take(step));
          return b;
        });
        if (!enabled.length) { const note = document.createElement('span'); note.className = 'k-lane-note'; note.textContent = st.state.pc[w0] === 'done' ? 'done' : 'no step enabled'; nodes.push(note); }
        lane.replaceChildren(...nodes);
      });
    }

    function take(step) {
      const before = st.state;
      st.state = step.next;
      st.trail.push({ label: step.label, action: step.action, worker: step.worker, state: step.next });
      if (!D.steps('naive', st.state).length) {
        const key = st.trail.slice(1).map(t => t.label).join(' ');
        st.lastFresh = !st.tried.has(key);
        st.tried.set(key, D.breaksInvariant(st.state));
      }
      st.anim = { worker: step.worker, action: step.action, before, after: step.next, t: 0 };
      deskAnim.go(0, 1, 1.6, () => { st.anim = null; desk.redraw(); });
      renderExplore();
      const next = host.querySelector('.k-step');
      (next || $('reset')).focus();
    }

    function renderExplore() {
      lanes();
      $('result').replaceChildren(stateLine(st.state));
      $('why').textContent = exploreWhy();
      tally();
      fillStrip($('strip'), st.trail);
      sequenceInto($('seq'), st.trail, 2);
      $('run').disabled = !st.predicted;
      $('desk').setAttribute('aria-label', `State: status ${st.state.status}, pc of A ${st.state.pc[0]}, pc of B ${st.state.pc[1]}, transfers ${st.state.transfers}.`);
      desk.redraw();
    }

    function showTrace(result) {
      const has = result.firstBad >= 0;
      $('trace').hidden = !has;
      if (!has) return;
      $('trace-title').textContent = `The shortest counterexample, ${result.trace.length - 1} steps, as a sequence and state by state:`;
      sequenceInto($('trace-seq'), result.trace, result.workers);
      fillStrip($('trace-strip'), result.trace);
    }

    function startGraph(result, stopDepth, rate, done) {
      st.result = result; st.p = 0; st.q = 0; st.phase = 'layers';
      $('checker').hidden = false; $('trace').hidden = true;
      $('graph-key').textContent = graphKey(result, $('graph').getBoundingClientRect().width || 600);
      $('graph').setAttribute('aria-label', `Breadth-first exploration of ${result.count} reachable states in ${result.layers.length} layers.`);
      graph.resize();
      $('graph-note').textContent = 'Exploring breadth first: the start state, then every state one step away, then two…';
      graphAnim.go(0, stopDepth, rate, () => {
        if (result.firstBad < 0 || result.nodes[result.firstBad].depth > stopDepth) { done(); return; }
        st.phase = 'path';
        graphAnim.go(0, 1, 1.1, () => { st.phase = 'idle'; done(); });
      });
    }

    function exploreRun() {
      const result = D.explore('naive', 2), stop = result.nodes[result.firstBad].depth;
      $('more').hidden = true;
      const found = result.layers.slice(0, stop + 1).reduce((t, l) => t + l.length, 0);
      startGraph(result, stop, 1.5, () => {
        $('graph-note').textContent = `Stopped at depth ${stop}, at the first state that breaks NoDoublePayout: transfers ${result.nodes[result.firstBad].state.transfers}. The amber line is the shortest counterexample, ${result.trace.length - 1} steps. ${found} states found so far.`;
        showTrace(result);
        $('more').hidden = false;
      });
    }

    function exploreRest() {
      const result = st.result, last = result.layers.length - 1;
      $('more').hidden = true;
      st.phase = 'layers';
      graphAnim.go(st.p, last, 1.5, () => {
        $('graph-note').textContent = `Every reachable state explored: ${result.count} distinct states, ${result.badCount} of them with two transfers.`;
        st.q = 1; graph.redraw();
      });
    }

    const designOf = cfg => (cfg.claim ? 'claim' : cfg.recheck ? 'recheck' : 'naive');

    function feedback(cfg, result) {
      const pass = result.firstBad < 0, steps = result.trace.length - 1;
      if (cfg.workers === 1) return 'No double payout, and no second worker. The queue needs at least two.';
      if (cfg.claim && pass) return cfg.workers === 2 ? 'Holds with 2. Try 3 before you ship.' : null;
      if (cfg.recheck) return `Still pays twice: the shortest counterexample is now ${steps} steps. A check is its own step.${cfg.delay ? ' The delay changes nothing either: the spec has no clock.' : ''}`;
      if (cfg.delay) return `Same ${result.count} states, same counterexample. The spec has no clock.`;
      return `Pays twice: the shortest counterexample is ${steps} steps. Change the desk and run the checker again.`;
    }

    function fixRun() {
      const cfg = { ...st.cfg }, result = D.explore(designOf(cfg), cfg.workers);
      st.report = null; st.solved = false;
      $('win').hidden = true; $('run').disabled = true;
      renderFix();
      startGraph(result, result.layers.length - 1, cfg.workers > 2 ? 3 : 2, () => {
        st.report = { cfg, result };
        st.solved = cfg.claim && cfg.workers === 3 && result.firstBad < 0;
        $('run').disabled = false;
        showTrace(result);
        renderFix();
        if (st.solved) win();
      });
    }

    function win() {
      const two = D.explore('claim', 2).count, three = st.report.result.count;
      $('win-two').textContent = String(two); $('win-three').textContent = String(three);
      $('win').hidden = false;
      bakeryAnim.go(0, 1, 0.9);
      document.dispatchEvent(new CustomEvent('k:solved', { detail: 'act2' }));
      $('win').focus();
    }

    const bakeryView = { t: 1 };
    const bakery = K.stage($('bakery'), s => {
      const { c, w } = s, b = brush(s), t = easeOut(bakeryView.t), phone = w < 420;
      const bw = phone ? 84 : 120, h = 52, y = 18, ax = w - bw - 2;
      b.box(1, y, bw, h, c.ink, { alpha: 0.5 });
      b.text('bank', 1 + bw / 2, y + 31, { color: c.ink, font: 'ui' });
      b.box(ax, y, bw, h, c.ok, { width: 1.5 });
      b.text(phone ? 'bakery' : 'the bakery', ax + bw / 2, y + 22, { color: c.ink, font: 'ui' });
      const arrived = t >= 0.98;
      b.text(arrived ? euros(AMOUNT) : euros(0), ax + bw / 2, y + 42, { color: arrived ? c.ok : c.soft, weight: 600 });
      const route = [[1 + bw, y + h / 2], [mix(1 + bw, ax, 0.5), y + h / 2], [mix(1 + bw, ax, 0.5), y + h / 2], [ax, y + h / 2]];
      b.line(prefix(route, t), c.ok, { alpha: 0.6, dashed: true });
      const tip = pointOn(route, t);
      if (!arrived) b.marker(tip[0], tip[1], c.ok, 10);
      else b.marker(ax + bw / 2, y + h + 10, c.ok, 8);
      b.text(arrived ? `one transfer, ${euros(AMOUNT)}` : 'sending…', mix(1 + bw, ax, 0.5), y + h / 2 - 8, { color: arrived ? c.ok : c.soft, font: 'ui' });
    }, { height: () => 84 });
    const bakeryAnim = animator($('bakery'), () => { bakeryView.t = bakeryAnim.value; bakery.redraw(); });

    function renderFix() {
      const cfg = st.cfg, rep = st.report;
      host.querySelectorAll('[data-toggle]').forEach(b => { b.setAttribute('aria-pressed', String(Boolean(cfg[b.dataset.toggle]))); });
      host.querySelectorAll('[data-workers]').forEach(b => { b.setAttribute('aria-pressed', String(Number(b.dataset.workers) === cfg.workers)); });
      $('spec').replaceChildren(...specLines(cfg).map(l => { const span = document.createElement('span'); span.className = `k-line${l.changed ? ' k-changed' : ''}`; span.textContent = l.text; return span; }));
      const stale = rep && JSON.stringify(rep.cfg) !== JSON.stringify(cfg);
      const parts = [];
      if (rep && !stale) {
        const r = rep.result, div = document.createElement('div');
        div.append(`Explored ${r.count} reachable states · `);
        const verdict = document.createElement('span');
        if (r.firstBad >= 0) { verdict.className = 'changed'; verdict.textContent = `NoDoublePayout breaks, shortest counterexample ${r.trace.length - 1} steps`; }
        else { verdict.className = st.solved ? 'ok' : ''; verdict.textContent = 'no state breaks NoDoublePayout'; }
        div.append(verdict);
        parts.push(div);
      }
      $('result').replaceChildren(...parts);
      $('why').textContent = !rep ? (st.result ? 'The checker is exploring…' : 'Change the desk with the buttons above, then press “Run the checker”.')
        : stale ? 'You changed the desk since the last run. Run the checker again.'
        : feedback(rep.cfg, rep.result) || 'Holds with 3 as well. Ship it.';
      if (stale) { $('trace').hidden = true; $('win').hidden = true; }
    }

    if (explore) {
      ['task', 'changes', 'spec', 'spec-note', 'win'].forEach(k => { $(k).hidden = true; });
      predict($('ask'), {
        question: 'Predict first. How many distinct states can the two-worker desk reach, counting every ordering until both workers are done?',
        options: ['5', '17', '20', '40'], right: '17',
        onAnswered: () => { st.predicted = true; renderExplore(); host.querySelector('.k-step').focus(); },
      });
      $('reset').addEventListener('click', () => {
        deskAnim.stop(); st.anim = null;
        st.state = D.initial(2); st.trail = [{ label: null, state: st.state }];
        renderExplore(); $('reset').focus();
      });
      $('run').addEventListener('click', exploreRun);
      $('more').addEventListener('click', exploreRest);
      renderExplore();
    } else {
      ['ask', 'lanes', 'now', 'strip', 'tally', 'more', 'jump'].forEach(k => { $(k).hidden = true; });
      $('reset').classList.add('quiet');
      host.querySelectorAll('[data-toggle]').forEach(b => b.addEventListener('click', () => {
        const k = b.dataset.toggle;
        st.cfg[k] = !st.cfg[k];
        if (k === 'claim' && st.cfg.claim) st.cfg.recheck = false;
        if (k === 'recheck' && st.cfg.recheck) st.cfg.claim = false;
        renderFix();
      }));
      host.querySelectorAll('[data-workers]').forEach(b => b.addEventListener('click', () => { st.cfg.workers = Number(b.dataset.workers); renderFix(); }));
      $('run').addEventListener('click', fixRun);
      $('reset').addEventListener('click', () => {
        graphAnim.stop();
        Object.assign(st, { cfg: { recheck: false, delay: false, claim: false, workers: 2 }, report: null, result: null, solved: false });
        $('checker').hidden = true; $('win').hidden = true; $('run').disabled = false;
        renderFix(); $('reset').focus();
      });
      renderFix();
    }
    return { host };
  }

  mount(document.getElementById('lab'), 'explore');
  document.getElementById('start-act2').addEventListener('click', () => {
    const holder = document.getElementById('act2-mount'), host = document.createElement('div');
    host.className = 'lab'; host.id = 'lab2';
    holder.replaceWith(host);
    mount(host, 'fix');
    host.querySelector('[data-toggle]').focus();
  });
})();
