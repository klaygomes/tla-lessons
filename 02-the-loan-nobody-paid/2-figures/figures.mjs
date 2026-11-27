export default k => {
  const { g, line, path, rect, circle, text, masked, arrow, box, step, cross, range } = k;

  const steps = (s, o) => {
    const [status, owner, pc, t, keyed, crashed] = s, out = [];
    [...'AB'].forEach((w, i) => {
      const put = v => pc.map((p, j) => (j === i ? v : p));
      if (pc[i] === 'idle' && status === 'approved') out.push([`Claim(${w})`, ['claimed', o.resume ? w : 'nobody', put('claimed'), t, keyed, crashed]]);
      if (o.resume && pc[i] === 'idle' && status === 'claimed' && owner === w) out.push([`Resume(${w})`, [status, owner, put('claimed'), t, keyed, crashed]]);
      if (pc[i] === 'idle' && status === 'paid') out.push([`Skip(${w})`, [status, owner, put('done'), t, keyed, crashed]]);
      if (pc[i] === 'claimed') out.push([`Send(${w})`, [status, owner, put('sent'), o.key && keyed ? t : t + 1, Boolean(o.key), crashed]]);
      if (pc[i] === 'sent') out.push([`Mark(${w})`, ['paid', owner, put('done'), t, keyed, crashed]]);
      if (o.crash && !crashed && ['claimed', 'sent'].includes(pc[i])) out.push([`Crash(${w})`, [status, owner, put('idle'), t, keyed, true]]);
    });
    if (o.lease && status === 'claimed') out.push(['Expire', ['approved', owner, pc, t, keyed, crashed]]);
    return out;
  };
  const INIT = ['approved', 'nobody', ['idle', 'idle'], 0, false, false];
  const key = s => JSON.stringify(s);
  const reachable = o => {
    const seen = new Set([key(INIT)]), todo = [INIT];
    while (todo.length) for (const [, after] of steps(todo.pop(), o)) if (!seen.has(key(after))) { seen.add(key(after)); todo.push(after); }
    return seen.size;
  };
  const run = (o, actions) => actions.reduce((seq, a) => {
    const next = steps(seq[seq.length - 1][1], o).find(([n]) => n === a);
    if (!next) throw new Error(`trace: ${a} is not enabled after ${seq.map(([n]) => n).join(' ')}`);
    return [...seq, next];
  }, [['(start)', INIT]]);

  const LIVE = {}, CRASH = { crash: true }, LEASE = { crash: true, lease: true }, RESUME = { crash: true, resume: true }, IDEM = { crash: true, resume: true, key: true };
  [[LIVE, 8], [CRASH, 10], [LEASE, 76], [RESUME, 29], [IDEM, 23]].forEach(([o, n]) => {
    if (reachable(o) !== n) throw new Error(`expected ${n} reachable states for ${JSON.stringify(o)}, found ${reachable(o)}`);
  });
  const STOP = run(LIVE, ['Claim(B)', 'Send(B)']);
  const PAID = steps(STOP[2][1], LIVE).find(([n]) => n === 'Mark(B)');
  const THURSDAY = run(CRASH, ['Claim(A)', 'Crash(A)']);
  const TWIN = run(CRASH, ['Claim(A)', 'Send(A)', 'Crash(A)']);
  const LEASE_RUN = run(LEASE, ['Claim(A)', 'Expire', 'Send(A)', 'Claim(B)', 'Send(B)']);
  const RESEND = run(RESUME, ['Claim(A)', 'Send(A)', 'Crash(A)', 'Resume(A)', 'Send(A)']);
  const KEYED = run(IDEM, ['Claim(A)', 'Send(A)', 'Crash(A)', 'Resume(A)', 'Send(A)']);
  const stuck = (seq, o) => steps(seq[seq.length - 1][1], o).filter(([n]) => !n.startsWith('Crash')).length === 0;
  if (!stuck(THURSDAY, CRASH) || !stuck(TWIN, CRASH)) throw new Error('quiet-twin: a crash state still has work enabled');
  if (STOP[2][1][3] !== 1 || TWIN[3][1][3] !== 1 || THURSDAY[2][1][3] !== 0) throw new Error('transfers do not match the prose tables');
  if (LEASE_RUN[5][1][3] !== 2 || RESEND[5][1][3] !== 2 || KEYED[5][1][3] !== 1) throw new Error('sequence figures: final transfers do not match TLC');

  const L1_RACE = [['(start)', 'approved', 0], ['Check(A)', 'approved', 0], ['Send(A)', 'approved', 1], ['Check(B)', 'approved', 1], ['Send(B)', 'approved', 2]];

  const T0 = 0.2, HOLD = 1.1, LEN = 0.6;
  const at = (i, extra = 0) => Number((T0 + i * HOLD + extra).toFixed(2));
  const rise = (i, o = {}) => ({ k: 'rise', d: at(i, o.extra || 0), len: LEN, dx: o.dx ?? 0, dy: o.dy ?? 8 });
  const land = (i, extra = 0) => ({ k: 'land', d: at(i, extra), len: LEN, s0: 1.12 });
  const draw = (i, extra = 0) => ({ k: 'draw', d: at(i, extra), len: 0.9 });
  const fadeIn = (i, extra = 0, len = 0.3) => ({ k: 'in', d: at(i, extra), len });

  const label = (x, y, s, cls = 'k-label', o = {}) => masked(x, y, s, { cls, ...o });
  const note = (x, y, s, cls = 'k-note') => text(x, y, s, { anchor: 'start', cls });
  const tick = (x, y, s, o = {}) => text(x, y, s, { anchor: 'start', cls: 'k-tick', ...o });
  const msg = (slug, x1, x2, y, s, o = {}) => {
    const { tone = '', ret = false, at: lx = (x1 + x2) / 2, cls = '', textCls } = o;
    const dir = Math.sign(x2 - x1);
    const lineCls = ['k-arrow', ret ? 't2-dash' : '', cls].filter(Boolean).join(' ');
    return g({},
      arrow(slug, [[x1, y], [x2 - dir, y]], { tone, cls: lineCls }),
      label(lx, y - 9, s, textCls || (tone === 'accent' ? 'k-num-accent' : 'k-label')));
  };
  const actor = (cx, y, w, name, sub) => box(cx - w / 2, y, w, 48, { name, sub });
  const lifeline = (x, y1, y2, cls = 't2-life') => line(x, y1, x, y2, { cls });
  const bar = (x, y1, y2) => rect(x - 4, y1, 8, y2 - y1, { cls: 't2-act' });

  const TONE = { '': ['k-box', 'k-name'], bad: ['k-box-accent', 'k-name-accent'], ok: ['k-box-ok', 'k-name-ok'], ghost: ['t2-ghost', 'k-tick'] };
  const cardH = n => 40 + n * 16;
  const card = (x, y, w, name, lines, tone = '') => {
    const [bc, nc] = TONE[tone], pad = w < 110 ? 8 : 12;
    return g({ cls: tone === 'ghost' ? 't2-dim' : undefined },
      rect(x, y, w, cardH(lines.length), { cls: 'k-mask-box', rx: 6 }),
      rect(x, y, w, cardH(lines.length), { cls: bc, rx: 6 }),
      text(x + pad, y + 22, name, { anchor: 'start', cls: nc }),
      lines.map(([v, c], i) => text(x + pad, y + 42 + i * 16, v, { anchor: 'start', cls: c || (tone === 'ghost' ? 'k-tick' : 'k-num') })));
  };
  const stateLines = ([status, , [a, b], t], hi = '') => [[status], [`A ${a}`], [`B ${b}`], [`transfers ${t}`, hi]];

  const slots = (n, P) => range(0, n - 1).map(i => ({ x: P.x0 + (i % P.cols) * (P.w + P.gap), y: P.y0 + Math.floor(i / P.cols) * P.pitch }));
  const wrapY = (a, P) => a.y + P.h + (P.pitch - P.h) / 2;
  const link = (s, a, b, P, o = {}) => (a.y === b.y
    ? arrow(s, [[a.x + P.w, a.y + P.h / 2], [b.x - 2, a.y + P.h / 2]], o)
    : arrow(s, [[a.x + 16, a.y + P.h], [a.x + 16, wrapY(a, P)], [b.x + 16, wrapY(a, P)], [b.x + 16, b.y - 2]], o));
  const loopAbove = (s, x, y, w, o = {}) => arrow(s, [[x + w - 28, y], [x + w - 28, y - 24], [x + 28, y - 24], [x + 28, y - 2]], { tone: 'accent', cls: 't2-loop', ...o });
  const loopRight = (s, x, y, w, o = {}) => arrow(s, [[x + w, y + 24], [x + w + 24, y + 24], [x + w + 24, y + 76], [x + w + 2, y + 76]], { tone: 'accent', cls: 't2-loop', ...o });

  const stranded = L => {
    const s = L.slug, ph = L.phone;
    const X = ph ? { A: 54, T: 138, B: 222, K: 306, w: 76 } : { A: 96, T: 272, B: 448, K: 624, w: 128 };
    const ask = ph ? 'approved?' : 'approved loans?', bw = ph ? 84 : 128;
    return [
      lifeline(X.A, 72, 192), lifeline(X.A, 210, 412), lifeline(X.T, 72, 412), lifeline(X.B, 72, 412), lifeline(X.K, 72, 424, 't2-life-accent'),
      actor(X.A, 24, X.w, 'worker A', 'payOut()'),
      actor(X.T, 24, X.w, 'loans', 'loan 4471'),
      actor(X.B, 24, X.w, 'worker B', 'payOut()'),
      actor(X.K, 24, X.w, 'bank', ph ? 'API' : 'transfer API'),
      step(1, 'worker A claims loan 4471 and gets 1 row',
        g({ anim: rise(0, { dx: -12, dy: 0 }) }, bar(X.A, 108, 196),
          msg(s, X.A + 4, X.T, 116, ph ? 'claim' : 'claim 4471'),
          msg(s, X.T, X.A + 4, 144, '1 row', { ret: true, textCls: 'k-num' }))),
      step(2, "a deploy restarts worker A's machine, and the process forgets the claim",
        g({ anim: land(1) }, cross(X.A, 201),
          ph ? [label(X.A + 12, 198, 'deploy', 'k-num-accent', { anchor: 'start' }), label(X.A + 12, 216, 'restart', 'k-num-accent', { anchor: 'start' })]
            : label(X.A + 14, 205, 'deploy restart', 'k-num-accent', { anchor: 'start' }))),
      step(3, 'the restarted worker A asks for approved loans and never mentions 4471',
        g({ anim: rise(2, { dx: -12, dy: 0 }) },
          ph ? '' : text(X.A - 12, 240, 'restarted', { anchor: 'end', cls: 'k-tick' }),
          msg(s, X.A, X.T, 252, ask),
          msg(s, X.T, X.A, 280, 'none', { ret: true, textCls: 'k-num' }))),
      step(4, 'worker B asks too; loan 4471 is claimed, so B leaves it alone',
        g({ anim: rise(3, { dx: 12, dy: 0 }) },
          msg(s, X.B, X.T, 316, ask),
          msg(s, X.T, X.B, 344, 'none', { ret: true, textCls: 'k-num' }),
          ph ? '' : [tick(X.B + 12, 376, '4471 is claimed:'), tick(X.B + 12, 394, 'left alone')])),
      step(5, 'the bank receives nothing: no transfer',
        g({ anim: land(4, 0.3) },
          rect(X.K - bw / 2, 424, bw, 36, { cls: 'k-box-accent', rx: 6 }),
          text(X.K, 447, 'no transfer', { cls: 'k-num-accent' }))),
      ph ? [note(16, 500, 'B sees 4471 claimed and'), note(16, 522, 'leaves it alone. The claim'), note(16, 544, 'outlived the process.')]
        : note(16, 496, 'the claim stayed in the table; its memory died with the process'),
    ];
  };

  const stuttering = L => {
    const s = L.slug, ph = L.phone;
    const P = ph ? { x0: 16, y0: 40, w: 120, gap: 88, cols: 2, pitch: 176, h: cardH(4) } : { x0: 16, y0: 64, w: 112, gap: 80, cols: 4, pitch: 188, h: cardH(4) };
    const pos = slots(8, P);
    const cards = [...STOP, ...range(1, 4).map(() => ['(nothing)', STOP[2][1]])];
    const stutterLabel = (a, b) => (a.y === b.y
      ? text((a.x + P.w + b.x) / 2, a.y + P.h / 2 - 10, 'stuttering', { cls: 'k-label' })
      : label(a.x + 16 - 50, wrapY(a, P) - 10, 'stuttering'));
    const markStub = p => g({},
      arrow(s, [[p.x + P.w - 16, p.y + P.h], [p.x + P.w - 16, p.y + P.h + 24]], { cls: 'k-arrow t2-dash' }),
      text(p.x + P.w - 22, p.y + P.h + 18, 'Mark(B)', { anchor: 'end', cls: 'k-tick' }));
    const last = pos[7];
    const bottom = pos[6].y + P.h;
    return [
      cards.map(([name, st], i) => step(i + 1,
        i === 0 ? 'the start state: approved, both idle, 0 transfers'
          : i < 3 ? `${name}: ${st[0]}, B ${st[2][1]}, transfers ${st[3]}`
            : `a stuttering step: the same state again, claimed, B sent, transfers 1${i === 6 ? ', and so on forever' : ''}`,
        g({ anim: rise(i, { dx: ph ? 0 : -12, dy: ph ? 8 : 0 }) },
          i > 0 ? link(s, pos[i - 1], pos[i], P) : '',
          card(pos[i].x, pos[i].y, P.w, name, stateLines(st)),
          i > 2 ? markStub(pos[i]) : '',
          i > 2 ? stutterLabel(pos[i - 1], pos[i]) : ''),
        i === 6 ? g({ anim: rise(i, { extra: 0.4, dx: ph ? 0 : -12, dy: ph ? 8 : 0 }) },
          link(s, pos[6], last, P), text(last.x + 8, last.y + P.h / 2 + 6, '… forever', { anchor: 'start', cls: 'k-note' }),
          stutterLabel(pos[6], last)) : '')),
      ph ? [note(16, bottom + 56, 'stuttering: nothing changes,'), note(16, bottom + 78, 'every variable the same as'), note(16, bottom + 100, 'the card before')]
        : note(16, bottom + 44, 'stuttering: nothing changes, every variable the same as the card before'),
      arrow(s, [[16, bottom + (ph ? 128 : 72)], [44, bottom + (ph ? 128 : 72)]], { cls: 'k-arrow t2-dash' }),
      tick(52, bottom + (ph ? 132 : 76), ph ? 'Mark(B): allowed, never taken' : 'Mark(B): allowed in every one of these states, never taken'),
    ];
  };

  const safetyLiveness = L => {
    const s = L.slug, ph = L.phone;
    const P1 = ph ? { x0: 16, y0: 44, w: 96, gap: 20, cols: 3, pitch: 108, h: cardH(2) } : { x0: 16, y0: 64, w: 112, gap: 24, cols: 5, pitch: 0, h: cardH(2) };
    const P2 = { ...P1, y0: ph ? 308 : 216 };
    const top = slots(5, P1), low = slots(5, P2);
    const thursday = [...THURSDAY, ['(nothing)', THURSDAY[2][1]]];
    const strip = (pos, P, cards) => cards.map(([name, lines, tone], i) => g({},
      i > 0 ? link(s, pos[i - 1], pos[i], P) : '', card(pos[i].x, pos[i].y, P.w, name, lines, tone)));
    const e = low[4];
    return [
      text(16, ph ? 24 : 28, 'safety · NoDoublePayout', { anchor: 'start', cls: 'k-name' }),
      strip(top, P1, L1_RACE.map(([n, st, t], i) => [n, [[st], [`transfers ${t}`, i === 4 ? 'k-num-accent' : '']], i === 4 ? 'bad' : ''])),
      ph ? note(132, 246, 'the moment it went wrong', 'k-note-accent')
        : g({}, path('M560 54V46H672V54', { cls: 't2-leader' }), text(672, 38, 'the moment it went wrong', { anchor: 'end', cls: 'k-note-accent' })),
      ph ? '' : note(16, 166, 'it fails at a moment: a finite strip shows it'),
      text(16, ph ? 288 : 196, ph ? 'liveness · eventually paid' : 'liveness · the bakery is eventually paid', { anchor: 'start', cls: 'k-name' }),
      strip(low, P2, thursday.map(([n, st]) => [n, [[st[0]], [`transfers ${st[3]}`]]])),
      arrow(s, [[low[3].x + P2.w, low[3].y + P2.h / 2], [e.x - 2, low[3].y + P2.h / 2]]),
      ['claimed,', 'claimed,', 'claimed …'].map((t, i) => text(e.x + 8, e.y + 22 + i * 16, t, { anchor: 'start', cls: `k-num t2-fade${i}` })),
      ph ? [note(16, 524, 'no single card is wrong;'), note(16, 546, 'the whole strip is')]
        : note(16, 324, 'no single card is wrong; the whole strip is'),
    ];
  };

  const lasso = L => {
    const s = L.slug, ph = L.phone, w = ph ? 136 : 120, h = cardH(4);
    const C = ph ? [[40, 64], [40, 208], [40, 352], [40, 496]] : [[16, 120], [196, 120], [376, 120], [572, 120]];
    const into = i => (ph ? [[C[i - 1][0] + 68, C[i - 1][1] + h], [C[i][0] + 68, C[i][1] - 2]] : [[C[i - 1][0] + w, C[i][1] + h / 2], [C[i][0] - 2, C[i][1] + h / 2]]);
    const [sx, sy] = C[2];
    const inset = ph ? { y: 676, x1: 16, x2: 224, head: 640 } : { y: 316, x1: 16, x2: 236, head: 300 };
    const ly = ph ? 800 : 330, lx = ph ? 16 : 420;
    const legendRow = (i, mark, s2) => g({}, mark(lx, ly + i * 24 - 4), tick(lx + 38, ly + i * 24, s2));
    return [
      ph ? [tick(16, 24, "TLC's counterexample on"), tick(16, 44, "lesson 1's fixed desk")]
        : tick(16, 28, "TLC's counterexample on lesson 1's fixed desk, drawn as a path in the state graph"),
      step(1, 'State 1, the initial predicate: approved, both idle, 0 transfers',
        g({ anim: rise(0) }, card(C[0][0], C[0][1], w, '(start)', stateLines(STOP[0][1])))),
      step(2, 'State 2, after Claim(B): claimed, B claimed, 0 transfers',
        g({ anim: rise(1) }, arrow(s, into(1)), card(C[1][0], C[1][1], w, 'Claim(B)', stateLines(STOP[1][1])))),
      step(3, 'State 3, after Send(B): claimed, B sent, 1 transfer',
        g({ anim: rise(2) }, arrow(s, into(2)), card(sx, sy, w, 'Send(B)', stateLines(STOP[2][1])))),
      step(4, 'the loop: State 3 repeats by stuttering, forever, and the loan is never paid',
        g({},
          ph ? loopRight(s, sx, sy, w, { pathLength: 1, anim: draw(3) }) : loopAbove(s, sx, sy, w, { pathLength: 1, anim: draw(3) }),
          g({ anim: fadeIn(3, 0.7) }, ph ? [text(216, sy + 48, 'stuttering,', { anchor: 'start', cls: 'k-num-accent' }), text(216, sy + 66, 'forever', { anchor: 'start', cls: 'k-num-accent' })]
            : text(sx + w / 2, sy - 36, 'stuttering, forever', { cls: 'k-num-accent' })))),
      step(5, 'the paid state, after Mark(B), is never reached on this path',
        g({ anim: fadeIn(4) },
          arrow(s, into(3), { cls: 'k-arrow t2-dash' }),
          card(C[3][0], C[3][1], w, 'Mark(B)', stateLines(PAID[1]), 'ghost'),
          ph ? [tick(184, C[3][1] + 44, 'not reached'), tick(184, C[3][1] + 62, 'on this path')]
            : [text(C[3][0] + w / 2, 248, 'not reached', { cls: 'k-tick' }), text(C[3][0] + w / 2, 266, 'on this path', { cls: 'k-tick' })])),
      step(6, 'another spec with a loop of real steps: State 1 on, State 2 off, and TLC prints Back to state 1',
        g({ anim: rise(5) },
          ph ? [tick(16, inset.head, 'with real cycles, TLC prints'), tick(16, inset.head + 20, '"Back to state n"')]
            : tick(16, inset.head, 'another spec, with a loop of real steps: TLC prints "Back to state n"'),
          box(inset.x1, inset.y, 120, 48, { name: 'on', sub: 'State 1' }),
          box(inset.x2, inset.y, 120, 48, { name: 'off', sub: 'State 2' }),
          arrow(s, [[inset.x1 + 120, inset.y + 24], [inset.x2 - 2, inset.y + 24]]),
          arrow(s, [[inset.x2 + 60, inset.y + 48], [inset.x2 + 60, inset.y + 72], [inset.x1 + 60, inset.y + 72], [inset.x1 + 60, inset.y + 50]], { tone: 'accent', cls: 't2-loop' }),
          text((inset.x1 + inset.x2) / 2 + 60, inset.y + 90, 'Back to state 1', { cls: 'k-num-accent' }))),
      legendRow(0, (x, y) => arrow(s, [[x, y], [x + 28, y]]), 'a step taken'),
      legendRow(1, (x, y) => arrow(s, [[x, y], [x + 28, y]], { cls: 'k-arrow t2-dash' }), 'a step never taken'),
      legendRow(2, (x, y) => arrow(s, [[x, y], [x + 28, y]], { tone: 'accent', cls: 't2-loop' }), 'the loop, repeated forever'),
    ];
  };

  const enabled = L => {
    const s = L.slug, ph = L.phone, w = ph ? 140 : 120, h = cardH(4);
    const X = ph ? [16, 72] : [24, 112], Y = ph ? [16, 248] : [304, 112], G = ph ? [16, 424] : [584, 112];
    const greyCross = (x, y) => path(`M${x - 6} ${y - 6}L${x + 6} ${y + 6}M${x + 6} ${y - 6}L${x - 6} ${y + 6}`, { cls: 't2-grey' });
    const ly = ph ? 560 : 324;
    const legendItem = (i, mark, s2) => {
      const x = ph ? 16 : 16 + i * 200, y = ph ? ly + i * 24 : ly;
      return g({}, mark(x, y - 4), tick(x + 38, y, s2));
    };
    return [
      tick(16, ph ? 24 : 28, ph ? 'what each state allows' : 'the stopped desk: what each state allows, and what it takes'),
      ph ? text(16, 40, 'stuttering: also allowed', { anchor: 'start', cls: 'k-tick' }) : tick(24, 64, 'stuttering: also allowed'),
      arrow(s, [[X[0] + w - 40, X[1]], [X[0] + w - 40, X[1] - (ph ? 20 : 36)], [X[0] + 40, X[1] - (ph ? 20 : 36)], [X[0] + 40, X[1] - 2]], { cls: 'k-arrow t2-dash' }),
      card(X[0], X[1], w, 'row 1', stateLines(STOP[1][1])),
      card(Y[0], Y[1], w, 'row 2', stateLines(STOP[2][1])),
      card(G[0], G[1], w, 'Mark(B)', stateLines(PAID[1]), 'ghost'),
      ph ? g({},
        arrow(s, [[86, X[1] + h], [86, Y[1] - 2]]),
        text(98, 206, 'Send(B)', { anchor: 'start', cls: 'k-label' }), tick(98, 224, 'enabled and taken'),
        arrow(s, [[86, Y[1] + h], [86, G[1] - 2]], { cls: 'k-arrow t2-dash' }),
        text(98, 382, 'Mark(B)', { anchor: 'start', cls: 'k-label' }), tick(98, 400, 'enabled, not taken'),
        path(`M${X[0] + w} 136H196`, { cls: 't2-grey' }), greyCross(204, 136),
        g({ cls: 't2-dim' }, tick(220, 122, 'Claim(A):'), tick(220, 140, 'not enabled,'), tick(220, 158, 'not approved')))
        : g({},
          arrow(s, [[X[0] + w, 164], [Y[0] - 2, 164]]), label((X[0] + w + Y[0]) / 2, 155, 'Send(B)'),
          text((X[0] + w + Y[0]) / 2, 186, 'enabled and taken', { cls: 'k-tick' }),
          arrow(s, [[Y[0] + w, 164], [G[0] - 2, 164]], { cls: 'k-arrow t2-dash' }), label((Y[0] + w + G[0]) / 2, 155, 'Mark(B)'),
          text((Y[0] + w + G[0]) / 2, 186, 'enabled, not taken', { cls: 'k-tick' }),
          path(`M${X[0] + 60} ${X[1] + h}V258`, { cls: 't2-grey' }), greyCross(X[0] + 60, 266),
          g({ cls: 't2-dim' }, tick(X[0] + 80, 262, 'Claim(A): not enabled,'), tick(X[0] + 80, 280, 'the loan is not approved'))),
      legendItem(0, (x, y) => arrow(s, [[x, y], [x + 28, y]]), 'taken'),
      legendItem(1, (x, y) => arrow(s, [[x, y], [x + 28, y]], { cls: 'k-arrow t2-dash' }), 'enabled only'),
      legendItem(2, (x, y) => path(`M${x} ${y}H${x + 28}`, { cls: 't2-grey' }), 'not enabled'),
    ];
  };

  const timeAxis = (X, n, y, ph) => g({},
    line(X(0) - 8, y, X(n) + 8, y, { cls: 'k-axis' }),
    range(0, n).map(i => g({}, line(X(i), y, X(i), y + 5, { cls: 'k-axis' }), text(X(i), y + 20, String(i), { cls: 'k-tick' }))),
    ph ? text(X(n) + 8, y + 40, 'step', { anchor: 'end', cls: 'k-tick' }) : text(16, y + 20, 'step', { anchor: 'start', cls: 'k-tick' }));
  const dot = (x, y) => circle(x, y, 4, { cls: 't2-dot' });
  const stutterTick = (x, y) => line(x, y - 7, x, y + 7, { cls: 't2-stutter' });
  const fire = (x, y) => g({}, line(x, y - 12, x, y + 12, { cls: 't2-fire' }), circle(x, y, 5, { cls: 't2-fire-dot' }));
  const bandRect = (x1, x2, y, cls = 't2-band') => rect(x1, y, x2 - x1, 16, { cls, rx: 3 });

  const fairness = L => {
    const ph = L.phone;
    const X = ph ? i => 32 + 36 * i : i => 152 + 48 * i, n = ph ? 8 : 11, right = ph ? 344 : 704;
    const R = ph ? { a: 92, b: 212, c: 312, axis: 400 } : { a: 72, b: 172, c: 268, axis: 312 };
    const rowName = (r, s2) => (ph ? text(16, r - 28, s2, { anchor: 'start', cls: 'k-name' }) : text(16, r + 5, s2, { anchor: 'start', cls: 'k-name' }));
    const marks = (r, from, to) => range(from, to).map(i => stutterTick(X(i), r));
    const grow = (i, x0, y0) => ({ anim: { k: 'scale', d: at(i), len: 1.4, sx: 0.04, sy: 1 }, style: `transform-origin:${x0}px ${y0}px` });
    return [
      tick(16, 20, ph ? "top rows: no crash; B sends at step 2" : "top rows: no crash; B sends at step 2, so Mark(B) is enabled from there on"),
      rowName(R.a, 'no fairness'), rowName(R.b, 'weak fairness'), rowName(R.c, 'after the crash'),
      [R.a, R.b].map(r => [dot(X(1), r), dot(X(2), r)]),
      dot(X(1), R.c), dot(X(2), R.c),
      step(1, 'Mark(B) becomes enabled at step 2; without fairness the band never ends, with weak fairness it ends when Mark(B) fires',
        g(grow(0, X(2), R.a + 14), bandRect(X(2), right, R.a + 14), text(X(2) + 8, R.a + 26, ph ? 'Mark(B) enabled →' : 'Mark(B) enabled, never ends →', { anchor: 'start', cls: 'k-label' }))),
      step(1, 'with weak fairness, Mark(B) is enabled from step 2 until it happens',
        g(grow(0, X(2), R.b + 14), bandRect(X(2), X(6), R.b + 14), text(X(2) + 8, R.b + 26, 'Mark(B) enabled', { anchor: 'start', cls: 'k-label' }))),
      step(2, 'without fairness, every later step is a stuttering step and Mark(B) never happens',
        g({ anim: rise(1.4, { dx: -10, dy: 0 }) }, marks(R.a, 3, n), note(X(2), R.a + 54, 'Mark(B) never happens', 'k-note-accent'))),
      step(3, 'with weak fairness, Mark(B) happens at step 6 and the loan is paid',
        g({ anim: rise(2.4, { dx: -10, dy: 0 }) }, marks(R.b, 3, 5)),
        g({ anim: land(3.2) }, fire(X(6), R.b), text(X(6), R.b - 18, 'Mark(B)', { cls: 'k-num-ok' }), text(X(6) + 14, R.b + 5, 'paid', { anchor: 'start', cls: 'k-num-ok' }))),
      step(4, 'after the crash nothing is enabled, so fairness has nothing to push',
        g({ anim: rise(4.2, { dx: -10, dy: 0 }) }, marks(R.c, 3, n),
          bandRect(X(2), right, R.c + 14, 't2-band-empty'),
          text(X(2) + 8, R.c + 26, ph ? 'nothing enabled' : 'nothing enabled: fairness has nothing to push', { anchor: 'start', cls: 'k-label' }),
          ph ? note(16, R.c + 56, 'fairness has nothing to push') : '')),
      timeAxis(X, n, R.axis, ph),
      g({}, dot(22, R.axis + (ph ? 60 : 48)), tick(34, R.axis + (ph ? 64 : 52), 'a step that changes something')),
      g({}, stutterTick(22, R.axis + (ph ? 84 : 72)), tick(34, R.axis + (ph ? 88 : 76), 'a stuttering step')),
    ];
  };

  const eventuallyAlways = L => {
    const ph = L.phone;
    const TOP = 'DLDDLLLLLLLLLLLL', LOW = 'LDDLLDLDDDLDLLDL';
    const sq = ph ? 16 : 28, X = i => 16 + i * (ph ? 20 : 36), end = X(15) + sq;
    const strip = (pat, y) => [...pat].map((c, i) => rect(X(i), y, sq, sq, { cls: c === 'L' ? 't2-lit' : 't2-unlit', rx: 2 }));
    const R = ph ? { t1: 28, s1: 72, t2: 164, s2: 180, foot: 272 } : { t1: 32, s1: 48, t2: 168, s2: 184, foot: 292 };
    const lx = ph ? [16, 150] : [440, 560], ly = ph ? 54 : 32;
    return [
      text(16, R.t1, '◇□P', { anchor: 'start', cls: 'k-math' }), text(96, R.t1, 'eventually always', { anchor: 'start', cls: 'k-name' }),
      g({}, rect(lx[0], ly - 12, 14, 14, { cls: 't2-lit', rx: 2 }), tick(lx[0] + 22, ly, 'P holds')),
      g({}, rect(lx[1], ly - 12, 14, 14, { cls: 't2-unlit', rx: 2 }), tick(lx[1] + 22, ly, 'P false')),
      strip(TOP, R.s1), text(end + 8, R.s1 + sq / 2 + 5, '…', { anchor: 'start', cls: 'k-num' }),
      path(`M${X(4)} ${R.s1 + sq + 8}V${R.s1 + sq + 16}H${end + 20}V${R.s1 + sq + 8}`, { cls: 't2-bracket' }),
      note(X(4), R.s1 + sq + 40, 'from here on, forever'),
      text(16, R.t2, '□◇P', { anchor: 'start', cls: 'k-math' }), text(96, R.t2, 'always eventually', { anchor: 'start', cls: 'k-name' }),
      strip(LOW, R.s2), text(end + 8, R.s2 + sq / 2 + 5, '…', { anchor: 'start', cls: 'k-num' }),
      [...LOW].map((c, i) => (c === 'L' ? line(X(i) + sq / 2, R.s2 + sq + 6, X(i) + sq / 2, R.s2 + sq + 14, { cls: 't2-mark' }) : '')),
      note(16, R.s2 + sq + 40, 'keeps coming back'),
      ph ? [note(16, R.foot, 'the top strip also satisfies'), note(16, R.foot + 22, 'the bottom one; not the other way round')]
        : note(16, R.foot, 'the top strip also satisfies the bottom one; not the other way round'),
    ];
  };

  const weakStrong = L => {
    const ph = L.phone;
    const n = ph ? 10 : 13, X = ph ? i => 24 + 30 * i : i => 140 + 40 * i, right = ph ? 344 : 704;
    const R = ph ? { t1: 24, w1: 84, s1: 148, b1: 206, t2: 280, w2: 320, s2: 364, b2: 380, axis: 474 }
      : { t1: 28, w1: 64, s1: 108, b1: 128, t2: 192, w2: 228, s2: 268, b2: 288, axis: 336 };
    const track = (y, name) => g({},
      line(X(0), y, right, y, { cls: 't2-track' }),
      ph ? tick(16, y - 14, name) : text(16, y + 5, name, { anchor: 'start', cls: 'k-name' }));
    const runs = [];
    for (let i = 0; i < n; i += 3) runs.push([i, Math.min(i + 2, n)]);
    return [
      text(16, R.t1, ph ? 'an action that flickers' : 'an action that flickers: enabled for 2 steps, off for 1, forever', { anchor: 'start', cls: 'k-name' }),
      ph ? tick(16, R.t1 + 18, 'enabled 2 steps, off 1, forever') : '',
      track(R.w1, ph ? 'weak fairness' : 'weak'), track(R.s1, ph ? 'strong fairness' : 'strong'),
      step(1, 'the action flickers: enabled for two steps, disabled for one, forever',
        g({}, runs.map(([a, b], j) => g({ anim: fadeIn(0, j * 0.25, 0.25) }, bandRect(X(a), X(b), R.b1))),
          g({ anim: fadeIn(0, 1.2) }, ph ? tick(24, R.b1 + 34, 'enabled') : text(16, R.b1 + 13, 'enabled', { anchor: 'start', cls: 'k-tick' })))),
      step(2, 'weak fairness: never enabled forever, so no promise',
        g({ anim: rise(1.2) }, ph ? note(16, R.w1 + 22, 'never enabled forever: no promise') : note(X(0) + 8, R.w1 - 8, 'never enabled forever, so no promise'))),
      step(3, 'strong fairness: enabled again and again, so the action must happen, here at step 4',
        g({ anim: land(2.2) }, fire(X(4), R.s1)),
        g({ anim: rise(2.2, { extra: 0.4 }) }, ph ? [note(16, R.s1 + 28, 'enabled again and again,'), note(16, R.s1 + 50, 'so it must happen')]
          : note(X(4) + 20, R.s1 - 8, 'enabled again and again, so it must happen'))),
      text(16, R.t2, ph ? 'Mark(B): on from step 2' : 'Mark(B): enabled from step 2 until it is taken', { anchor: 'start', cls: 'k-name' }),
      track(R.w2, ph ? 'weak fairness' : 'weak'), track(R.s2, ph ? 'strong fairness' : 'strong'),
      step(4, 'Mark(B) turns on at step 2 and stays on until it is taken',
        g({ anim: rise(3.2, { dx: -10, dy: 0 }) }, bandRect(X(2), X(6), R.b2),
          ph ? tick(X(2), R.b2 + 34, 'stays on until taken') : text(X(6) + 8, R.b2 + 13, 'stays on until taken', { anchor: 'start', cls: 'k-tick' }),
          ph ? '' : text(16, R.b2 + 13, 'enabled', { anchor: 'start', cls: 'k-tick' }))),
      step(5, 'both weak and strong fairness promise this one: Mark(B) happens at step 6',
        g({ anim: land(4.2) }, fire(X(6), R.w2), fire(X(6), R.s2)),
        g({ anim: rise(4.2, { extra: 0.4 }) }, ph ? note(16, R.b2 + 64, 'both promise this one') : note(X(6) + 20, R.w2 - 8, 'both promise this one'))),
      timeAxis(X, n, R.axis, ph),
      g({}, fire(22, R.axis + (ph ? 64 : 52)), tick(36, R.axis + (ph ? 68 : 56), 'the action happens')),
    ];
  };

  const quietTwin = L => {
    const s = L.slug, ph = L.phone;
    const P = ph ? { x0: 16, w: 96, gap: 20, cols: 3, pitch: 144, h: cardH(4) } : { x0: 16, w: 112, gap: 28, cols: 4, pitch: 0, h: cardH(4) };
    const top = slots(3, { ...P, y0: ph ? 64 : 72 }), low = slots(4, { ...P, y0: ph ? 300 : 272 });
    const strip = (seq, pos) => seq.map(([name, st], i) => g({},
      i > 0 ? link(s, pos[i - 1], pos[i], P) : '', card(pos[i].x, pos[i].y, P.w, name, stateLines(st))));
    const chip = (x, y, w, s2, tone) => g({}, rect(x, y, w, 28, { cls: tone === 'ok' ? 'k-box-ok' : 'k-box-accent', rx: 6 }), text(x + w / 2, y + 19, s2, { cls: tone === 'ok' ? 'k-num-ok' : 'k-num-accent' }));
    const marker = (x, y1, y2) => g({}, line(x, y1, x, y2, { cls: 'k-guide' }), text(x, y2 + 16, 'crash here', { cls: 'k-tick' }));
    const t2 = top[2], b3 = low[3];
    if (ph) {
      return [
        text(16, 24, 'Thursday', { anchor: 'start', cls: 'k-name' }),
        strip(THURSDAY, top),
        loopAbove(s, t2.x, t2.y, P.w), text(t2.x + P.w / 2, t2.y - 30, 'stuttering', { cls: 'k-tick' }),
        marker(238, 56, 176),
        chip(16, 212, 132, '€0 sent', 'bad'), note(164, 232, 'bakery calls Monday'),
        text(16, 284, 'quiet twin', { anchor: 'start', cls: 'k-name' }),
        strip(TWIN, low),
        label(low[2].x + 26, (low[2].y + P.h + wrapY(low[2], P)) / 2 + 5, 'crash here', 'k-tick', { anchor: 'start' }),
        loopRight(s, b3.x, b3.y, P.w), tick(b3.x + P.w + 32, b3.y + 48, 'stuttering,'), tick(b3.x + P.w + 32, b3.y + 66, 'forever'),
        chip(16, 568, 132, '€50,000 sent', 'ok'), chip(164, 568, 132, 'status: claimed', 'bad'),
        note(16, 624, 'nobody calls'),
        note(16, 664, 'same bug: a claim'), note(16, 686, 'nobody will finish'),
      ];
    }
    return [
      text(16, 28, 'Thursday', { anchor: 'start', cls: 'k-name' }),
      strip(THURSDAY, top),
      loopAbove(s, t2.x, t2.y, P.w), text(t2.x + P.w / 2, t2.y - 32, 'stuttering, forever', { cls: 'k-tick' }),
      marker(282, 64, 188),
      chip(572, 84, 132, '€0 sent', 'bad'), note(572, 140, 'bakery calls'), note(572, 162, 'on Monday'),
      text(16, 232, 'quiet twin', { anchor: 'start', cls: 'k-name' }),
      strip(TWIN, low),
      loopAbove(s, b3.x, b3.y, P.w), text(b3.x + P.w / 2, b3.y - 32, 'stuttering, forever', { cls: 'k-tick' }),
      marker(422, 264, 388),
      chip(572, 280, 132, '€50,000 sent', 'ok'), chip(572, 320, 132, 'status: claimed', 'bad'),
      note(572, 376, 'nobody calls'),
      note(16, 444, 'same bug: a claim nobody will finish'),
    ];
  };

  const balance = (cx, y, w, amount, tone) => g({},
    rect(cx - w / 2, y, w, 48, { cls: tone === 'ok' ? 'k-box-ok' : 'k-box-accent', rx: 6 }),
    text(cx, y + 19, w < 128 ? 'bakery balance' : "bakery's balance", { cls: 'k-tick' }),
    text(cx, y + 40, amount, { cls: tone === 'ok' ? 'k-name-ok' : 'k-name-accent' }));

  const leaseRace = L => {
    const s = L.slug, ph = L.phone;
    const X = ph ? { A: 54, T: 138, B: 222, K: 306, w: 76 } : { A: 96, T: 288, B: 480, K: 640, w: 128 };
    const pay = ph ? '€50,000' : 'transfer €50,000';
    return [
      lifeline(X.A, 72, 420), lifeline(X.T, 72, 420), lifeline(X.B, 72, 420), lifeline(X.K, 72, 392),
      actor(X.A, 24, X.w, 'worker A', 'payOut()'),
      actor(X.T, 24, X.w, 'loans', 'loan 4471'),
      actor(X.B, 24, X.w, 'worker B', 'payOut()'),
      actor(X.K, 24, X.w, 'bank', ph ? 'API' : 'transfer API'),
      step(1, 'Claim(A): worker A claims loan 4471 and gets 1 row',
        g({ anim: rise(0, { dx: -12, dy: 0 }) }, bar(X.A, 108, 156),
          msg(s, X.A + 4, X.T, 116, ph ? 'claim' : 'claim 4471'),
          msg(s, X.T, X.A + 4, 140, '1 row', { ret: true, textCls: 'k-num' }))),
      step(2, 'worker A stalls in a garbage-collection pause',
        g({ anim: rise(1, { dy: -12 }) }, rect(X.A - 6, 156, 12, 76, { cls: 't2-gap' }),
          ph ? text(X.A + 12, 200, 'GC pause', { anchor: 'start', cls: 'k-num-accent' }) : text(X.A - 12, 200, 'GC pause', { anchor: 'end', cls: 'k-num-accent' }))),
      step(2, 'Expire: the lease runs out and the loan goes back to approved',
        g({ anim: rise(1, { extra: 0.5, dx: 10, dy: 0 }) },
          arrow(s, [[X.T, 180], [X.T + 40, 180], [X.T + 40, 204], [X.T + 2, 204]]),
          ph ? label(X.T + 48, 196, 'expires', 'k-label', { anchor: 'start' }) : text(X.T + 48, 196, 'lease expires', { anchor: 'start', cls: 'k-label' }))),
      step(3, 'Send(A): worker A wakes and transfers 50,000 euros',
        g({ anim: rise(2, { dx: -12, dy: 0 }) }, bar(X.A, 232, 256),
          msg(s, X.A + 4, X.K, 248, pay, { at: ph ? (X.T + X.B) / 2 : (X.B + X.K) / 2 }))),
      step(4, 'Claim(B): worker B claims loan 4471 too and gets 1 row',
        g({ anim: rise(3, { dx: 12, dy: 0 }) }, bar(X.B, 280, 376),
          msg(s, X.B - 4, X.T, 288, ph ? 'claim' : 'claim 4471'),
          msg(s, X.T, X.B - 4, 312, '1 row', { ret: true, textCls: 'k-num' }))),
      step(5, 'Send(B): worker B transfers 50,000 euros again',
        g({ anim: rise(4, { dx: -12, dy: 0 }) }, msg(s, X.B + 4, X.K, 360, pay, { tone: 'accent', cls: 't2-strong' }))),
      step(6, "the bakery's balance reads 100,000 euros: paid twice",
        g({ anim: land(5) }, balance(ph ? 300 : X.K, 392, ph ? 112 : 128, '€100,000', 'bad'))),
      ph ? [note(16, 476, 'A was slow, not dead: it still'), note(16, 498, 'believed the claim was its own')]
        : note(16, 476, 'A was slow, not dead: it still believed the claim was its own'),
    ];
  };

  const sendTwice = (L, keyed) => {
    const s = L.slug, ph = L.phone;
    const X = ph ? { A: 60, T: 180, K: 300, w: 88 } : { A: 120, T: 360, K: 600, w: 144 };
    const pay = keyed ? (ph ? 'key 4471' : 'transfer, key 4471') : (ph ? '€50,000' : 'transfer €50,000');
    const mid = (X.T + X.K) / 2, crashY = keyed ? 268 : 248, ask = keyed ? 300 : 292, again = keyed ? 368 : 360, end = keyed ? 416 : 392;
    const bw = ph ? 112 : 128;
    return [
      lifeline(X.A, 72, crashY - 10), lifeline(X.A, crashY + 10, end + 12), lifeline(X.T, 72, end + 12), lifeline(X.K, 72, end),
      actor(X.A, 24, X.w, 'worker A', 'payOut()'),
      actor(X.T, 24, X.w, 'loans', 'loan 4471'),
      actor(X.K, 24, X.w, 'bank', ph ? 'API' : 'transfer API'),
      step(1, 'Claim(A): worker A claims loan 4471 and gets 1 row',
        g({ anim: rise(0, { dx: -12, dy: 0 }) }, bar(X.A, 108, crashY - 4),
          msg(s, X.A + 4, X.T, 116, 'claim 4471'),
          msg(s, X.T, X.A + 4, 140, '1 row', { ret: true, textCls: 'k-num' }))),
      step(2, keyed ? 'Send(A): the transfer carries key 4471; the bank has never seen it, so it pays 50,000 euros' : 'Send(A): worker A transfers 50,000 euros and the bank pays',
        g({ anim: rise(1, { dx: -12, dy: 0 }) },
          msg(s, X.A + 4, X.K, 184, pay, { at: mid }),
          msg(s, X.K, X.A + 4, 208, keyed ? 'paid' : 'ok', { ret: true, textCls: 'k-num', at: mid }))),
      keyed ? step(2, 'the bank adds 4471 to its set of keys',
        g({ anim: land(1, 0.5) }, rect(X.K - bw / 2, 224, bw, 28, { cls: 't2-chip', rx: 6 }), text(X.K, 243, 'keys {4471}', { cls: 'k-num' }))) : '',
      step(3, 'Crash(A): a deploy restarts worker A before it marks the loan paid',
        g({ anim: land(2) }, cross(X.A, crashY + 1),
          ph ? [label(X.A + 12, crashY - 6, 'deploy', 'k-num-accent', { anchor: 'start' }), label(X.A + 12, crashY + 10, 'restart', 'k-num-accent', { anchor: 'start' })]
            : label(X.A + 14, crashY + 5, 'deploy restart', 'k-num-accent', { anchor: 'start' }))),
      step(4, 'Resume(A): the restarted worker A asks for loans claimed in its name and gets 4471',
        g({ anim: rise(3, { dx: -12, dy: 0 }) }, bar(X.A, ask - 8, again + 8),
          ph ? '' : text(X.A - 12, ask - 12, 'restarted', { anchor: 'end', cls: 'k-tick' }),
          msg(s, X.A + 4, X.T, ask, 'claimed by me?'),
          msg(s, X.T, X.A + 4, ask + 24, '4471', { ret: true, textCls: 'k-num' }))),
      keyed ? step(5, 'Send(A) again with key 4471: the bank finds the key, gives the first answer and pays nothing',
        g({ anim: rise(4, { dx: -12, dy: 0 }) },
          msg(s, X.A + 4, X.K, again, pay, { at: mid }),
          msg(s, X.K, X.A + 4, again + 24, ph ? 'same answer' : 'first answer, pays nothing', { ret: true, textCls: 'k-num-ok', at: mid })))
        : step(5, 'Send(A) again: worker A transfers 50,000 euros a second time',
          g({ anim: rise(4, { dx: -12, dy: 0 }) }, msg(s, X.A + 4, X.K, again, pay, { tone: 'accent', cls: 't2-strong', at: mid }))),
      step(6, keyed ? "the bakery's balance reads 50,000 euros: paid once" : "the bakery's balance reads 100,000 euros: paid twice",
        g({ anim: land(5) }, balance(X.K, end, bw, keyed ? '€50,000' : '€100,000', keyed ? 'ok' : 'bad'))),
      keyed ? (ph ? [note(16, end + 80, 'the bank remembers'), note(16, end + 102, 'what the worker forgot')] : note(16, end + 78, 'the bank remembers what the worker forgot'))
        : (ph ? [note(16, end + 80, 'A forgot it had sent;'), note(16, end + 102, 'the crash erased it')] : note(16, end + 78, 'the fact "I already sent this" lived in worker A, and the crash erased it')),
    ];
  };

  const css = [
    '.k-fig .t2-life { stroke: var(--ink-soft); stroke-width: var(--line-hair); stroke-dasharray: 3 3; opacity: 0.6; }',
    '.k-fig .t2-life-accent { stroke: var(--accent); stroke-width: var(--line-strong); stroke-dasharray: 3 3; }',
    '.k-fig .t2-dash { stroke-dasharray: 5 4; }',
    '.k-fig .t2-strong { stroke-width: var(--line-mark); }',
    '.k-fig .t2-act { fill: var(--paper-2); stroke: var(--ink-soft); stroke-width: var(--line-hair); }',
    '.k-fig .t2-gap { fill: var(--accent-soft); stroke: var(--accent); stroke-width: var(--line-hair); }',
    '.k-fig .t2-leader { stroke: var(--accent); stroke-width: var(--line-hair); fill: none; }',
    '.k-fig .t2-bracket { stroke: var(--ink-soft); stroke-width: var(--line-strong); fill: none; }',
    '.k-fig .t2-loop { stroke: var(--accent); stroke-width: 2; fill: none; stroke-linejoin: round; }',
    '.k-fig .t2-ghost { fill: var(--paper); stroke: var(--ink-soft); stroke-width: var(--line-hair); stroke-dasharray: 4 3; }',
    '.k-fig .t2-dim { opacity: 0.75; }',
    '.k-fig .t2-grey { stroke: var(--ink-soft); stroke-width: var(--line-strong); stroke-dasharray: 2 3; fill: none; opacity: 0.75; }',
    '.k-fig .t2-band { fill: var(--paper-2); stroke: var(--ink-soft); stroke-width: var(--line-hair); }',
    '.k-fig .t2-band-empty { fill: none; stroke: var(--ink-soft); stroke-width: var(--line-hair); stroke-dasharray: 4 3; }',
    '.k-fig .t2-track { stroke: var(--rule); stroke-width: var(--line-hair); }',
    '.k-fig .t2-stutter { stroke: var(--ink-soft); stroke-width: var(--line-strong); }',
    '.k-fig .t2-dot { fill: var(--ink); }',
    '.k-fig .t2-fire { stroke: var(--ok); stroke-width: var(--line-mark); stroke-linecap: round; }',
    '.k-fig .t2-fire-dot { fill: var(--ok); }',
    '.k-fig .t2-lit { fill: var(--accent); stroke: var(--accent); stroke-width: var(--line-hair); }',
    '.k-fig .t2-unlit { fill: var(--paper); stroke: var(--ink-soft); stroke-width: var(--line-hair); }',
    '.k-fig .t2-mark { stroke: var(--ink); stroke-width: var(--line-strong); }',
    '.k-fig .t2-chip { fill: var(--paper-2); stroke: var(--ink); stroke-width: var(--line-strong); }',
    '.k-fig .t2-fade0 { opacity: 1; }',
    '.k-fig .t2-fade1 { opacity: 0.75; }',
    '.k-fig .t2-fade2 { opacity: 0.55; }',
  ].join(' ');

  const fig = (name, wide, phone, title, desc, caption, body, stepsCount = 0) => ({
    name, w: 720, h: wide, phone: { w: 360, h: phone }, title, desc, caption, steps: stepsCount,
    eyebrow: 'Lesson 2 · the loan nobody paid', css, body: (kk, L) => body(L),
  });

  return [
    fig('stranded', 516, 564, 'The claim nobody finished',
      'A sequence over time with lifelines for worker A, the loans table, worker B and the bank. Worker A claims loan 4471 and gets 1 row; a deploy restarts worker A; the restarted worker asks for approved loans and gets none, never mentioning 4471; worker B asks too, gets none and leaves the claimed loan alone. The bank receives nothing: no transfer.',
      'Thursday. The claim lives in the table, but the memory of why lives in a process the deploy ended. Nobody asks about 4471 again, and the bank never hears a thing.',
      stranded, 5),
    fig('stuttering', 456, 824, 'The desk that just stops',
      'A behavior as a strip of state cards: the start state, Claim(B), Send(B) with the loan claimed, worker B sent and 1 transfer, then four cards identical to the Send(B) card joined by stuttering steps, and then forever. From each repeated card a dashed Mark(B) arrow leaves and is never taken.',
      'After Send(B), every step is a stuttering step: each card is the one before it again. Mark(B) is allowed in every one of those states, and it never happens.',
      stuttering, 7),
    fig('safety-liveness', 344, 566, 'Two kinds of promises',
      "Two behaviors as strips of state cards. Top, safety: lesson 1's race, start, Check(A), Send(A), Check(B), Send(B), a finite strip whose last card has 2 transfers, marked as the moment it went wrong. Bottom, liveness: Thursday, start, Claim(A), Crash(A), then nothing, with claimed repeating forever; no single card is wrong.",
      'A safety violation has a moment: the strip ends at the bad card. A liveness violation has none: every card is fine, and only the strip going on forever without the good thing is wrong.',
      safetyLiveness),
    fig('lasso', 428, 864, 'A path into a loop',
      "TLC's counterexample for lesson 1's fixed desk as a path in the state graph: the start, then Claim(B), then Send(B), whose state loops back to itself by stuttering forever. The paid state after Mark(B) is greyed: never reached on this path. An inset shows another spec where the loop has real steps: State 1 on, State 2 off, and TLC prints Back to state 1.",
      'A lasso: a path from the start into a loop the behavior repeats forever. On the payout desk the loop is one state stuttering; with real cycles, TLC names the state the loop goes back to.',
      lasso, 6),
    fig('enabled', 344, 628, 'Enabled is not taken',
      'Three state cards from the stopped desk. From row 1 (claimed, A idle, B claimed, 0 transfers), Send(B) is enabled and taken, leading to row 2; stuttering is also allowed. From row 2 (claimed, A idle, B sent, 1 transfer), Mark(B) is enabled but not taken, so the paid state is greyed. Claim(A) is not enabled because the loan is not approved.',
      'Enabled means a step of the action could be taken from this state. A behavior takes at most one step next; the other enabled steps stay enabled, not taken.',
      enabled),
    fig('fairness', 408, 520, 'Weak fairness forbids waiting forever',
      "Three timelines over steps. The desk without a crash, with no fairness: Mark(B) is enabled from step 2 on, forever, and every later step is a stuttering step; Mark(B) never happens. With weak fairness: Mark(B) is enabled from step 2 and happens at step 6, so the loan is paid. After the crash: nothing is enabled, so fairness has nothing to push.",
      'Weak fairness forbids the top line: an action enabled from some point on, forever, must eventually happen. After the crash nothing is enabled, so weak fairness makes no demand at all.',
      fairness, 4),
    fig('eventually-always', 312, 314, 'Eventually always, always eventually',
      'Two strips of 16 states, filled where P holds. Top, eventually always: off, on, off, off, then on for every remaining state, bracketed from here on, forever. Bottom, always eventually: on and off irregularly to the end, never more than three off in a row, with a mark under every on state: it keeps coming back.',
      'The top strip also satisfies the bottom one; not the other way round.',
      eventuallyAlways),
    fig('weak-strong', 404, 544, 'Weak and strong fairness',
      'Two timelines. Top: an action that flickers, enabled for two steps and off for one, forever. Under weak fairness it never happens, because it is never enabled forever; under strong fairness it happens, here at step 4, because it is enabled again and again. Bottom: Mark(B) turns on at step 2 and stays on until taken, and both kinds of fairness make it happen at step 6.',
      'Weak fairness only promises an action that stays enabled. Strong fairness also promises one that keeps coming back. The payout desk only needs the weak kind.',
      weakStrong, 5),
    fig('quiet-twin', 460, 694, 'Thursday and its quiet twin',
      'Two behaviors aligned by step. Thursday: start, Claim(A), Crash(A), then stuttering forever in claimed with both workers idle and 0 transfers; the bank sent 0 euros and the bakery calls on Monday. The quiet twin: start, Claim(A), Send(A), Crash(A), then stuttering forever in claimed with both idle and 1 transfer; the bank sent 50,000 euros, the status still reads claimed, and nobody calls.',
      'The twins differ only in where the crash lands: before Send or after it. One is loud and one is quiet, and both leave a claim nobody will finish.',
      quietTwin),
    fig('lease-race', 492, 516, 'The lease expired under a slow worker',
      "A sequence with lifelines for worker A, the loans table, worker B and the bank. Worker A claims loan 4471, then stalls in a GC pause while the lease expires and the loan goes back to approved. Worker A wakes and transfers 50,000 euros; worker B claims the loan and transfers 50,000 euros again. The bakery's balance reads 100,000 euros.",
      'The steps of the TLC counterexample: Claim(A), Expire, Send(A), Claim(B), Send(B). An expired lease lets someone else in; it does not stop the old holder.',
      leaseRace, 6),
    fig('resend', 492, 516, 'Resume sends twice',
      "A sequence with lifelines for worker A, the loans table and the bank. Worker A claims loan 4471 and transfers 50,000 euros; a deploy restarts it before it marks the loan paid. The restarted worker asks for loans claimed in its name, gets 4471 and transfers 50,000 euros again. The bakery's balance reads 100,000 euros.",
      'The steps of the TLC counterexample: Claim(A), Send(A), Crash(A), Resume(A), Send(A). The restarted worker does what a claim tells it to do: send.',
      L => sendTwice(L, false), 6),
    fig('idempotency-key', 516, 540, 'The bank remembers the key',
      "The resend sequence with an idempotency key. Worker A claims loan 4471 and sends the transfer with key 4471; the bank has never seen the key, so it pays 50,000 euros and adds 4471 to its keys. A deploy restarts worker A, which resumes its claim and sends again with key 4471; the bank finds the key, gives the first answer and pays nothing. The bakery's balance reads 50,000 euros.",
      'The same steps as the resend: Claim(A), Send(A), Crash(A), Resume(A), Send(A). The second Send lands on a key the bank already has, so it moves no money.',
      L => sendTwice(L, true), 6),
  ];
};
