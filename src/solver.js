/* ============================================================
   Maths solver — works the answer out exactly, with steps.
   The assistant shows this as a "checked by calculator" card and
   hands it to the AI so the AI never has to do the arithmetic.
   Covers the common AQA Foundation question types.
   ============================================================ */
const Solver = (() => {
  const N = '(-?\\d+(?:\\.\\d+)?)';
  const r3 = (x) => Math.round(x * 1000) / 1000;
  const r2 = (x) => Math.round(x * 100) / 100;
  const fm = (x) => { if (!isFinite(x)) return String(x); const v = r3(x); return (Object.is(v, -0) ? 0 : v).toLocaleString('en-GB', { maximumFractionDigits: 3 }); };
  const mon = (x) => (Number.isInteger(r2(x)) ? '£' + fm(x) : '£' + r2(x).toFixed(2));
  const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
  const lcm = (a, b) => Math.abs(a * b) / gcd(a, b);
  const frac = (n, d) => { if (d < 0) { n = -n; d = -d; } const g = gcd(n, d) || 1; return [n / g, d / g]; };
  const fstr = ([n, d]) => (d === 1 ? String(n) : `${n}/${d}`);
  const isPrime = (n) => { if (n < 2 || !Number.isInteger(n)) return false; for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; };
  const nums = (s) => (s.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
  // decimal → nice fraction if it's a simple one
  const niceFrac = (x) => { for (let d = 1; d <= 20; d++) { const n = Math.round(x * d); if (Math.abs(n / d - x) < 1e-9) return fstr(frac(n, d)); } return null; };
  const out = (title, answer, steps, extra) => Object.assign({ title, answer, steps }, extra || {});

  function norm(t) {
    // ignore exam clutter like "(3 marks)" or "Question 7" so it isn't mistaken for part of the question
    let s = ' ' + String(t).toLowerCase().replace(/\(\s*\d+\s*marks?\s*\)|\[\s*\d+\s*marks?\s*\]|\b\d+\s*marks?\b|total for question\s*\d+[^\n]*|\bquestion\s*\d+\b|\bq\s*\d+\b[.:)]?/g, ' ') + ' ';
    s = s.replace(/[−–—]/g, '-').replace(/÷/g, '/').replace(/×/g, '*').replace(/²/g, '^2').replace(/³/g, '^3').replace(/π/g, 'pi')
      .replace(/(\d),(\d{3})(?!\d)/g, '$1$2').replace(/£\s*/g, '£').replace(/\bdegrees?\b|°/g, '°')
      .replace(/(\d)\s*[x]\s*(\d)/g, (m, a, b) => a + ' * ' + b)
    return s;
  }

  /* ---------- expression parser (BIDMAS, implicit ×, variables) → polynomial in one letter ---------- */
  // polynomial = { power: coef }
  const P = {
    c: (k) => ({ 0: k }),
    add(a, b, s) { const r = Object.assign({}, a); for (const k in b) r[k] = (r[k] || 0) + s * b[k]; return r; },
    mul(a, b) { const r = {}; for (const i in a) for (const j in b) { const k = +i + +j; r[k] = (r[k] || 0) + a[i] * b[j]; } return r; },
    isConst(a) { return Object.keys(a).every((k) => k === '0' || Math.abs(a[k]) < 1e-12); },
    val(a) { return a[0] || 0; },
    deg(a) { let d = 0; for (const k in a) if (Math.abs(a[k]) > 1e-12) d = Math.max(d, +k); return d; },
  };
  function parse(src, vars, letter) {
    const toks = []; let i = 0; const s = src.replace(/\s+/g, '');
    while (i < s.length) {
      const ch = s[i];
      if (/[\d.]/.test(ch)) { let j = i; while (j < s.length && /[\d.]/.test(s[j])) j++; toks.push({ t: 'n', v: parseFloat(s.slice(i, j)) }); i = j; }
      else if (s.startsWith('pi', i)) { toks.push({ t: 'n', v: Math.PI }); i += 2; }
      else if (s.startsWith('sqrt', i) || s.startsWith('√', i)) { toks.push({ t: 'f', v: 'sqrt' }); i += s[i] === '√' ? 1 : 4; }
      else if (/[a-z]/.test(ch)) { toks.push({ t: 'v', v: ch }); i++; }
      else if ('+-*/^()'.includes(ch)) { toks.push({ t: ch }); i++; }
      else throw new Error('bad char ' + ch);
    }
    let p = 0;
    const peek = () => toks[p], next = () => toks[p++];
    const startsAtom = (k) => k && (k.t === 'n' || k.t === 'v' || k.t === '(' || k.t === 'f');
    function expr() { let a = term(); while (peek() && (peek().t === '+' || peek().t === '-')) { const o = next().t; const b = term(); a = P.add(a, b, o === '+' ? 1 : -1); } return a; }
    function term() {
      let a = unary();
      for (;;) {
        const k = peek();
        if (k && (k.t === '*' || k.t === '/')) { next(); const b = unary(); if (k.t === '*') a = P.mul(a, b); else { if (!P.isConst(b) || P.val(b) === 0) throw new Error('div'); a = P.mul(a, P.c(1 / P.val(b))); } }
        else if (startsAtom(k)) a = P.mul(a, unary()); // implicit multiplication: 3x, 2(x+1)
        else return a;
      }
    }
    function unary() { if (peek() && peek().t === '-') { next(); return P.mul(P.c(-1), unary()); } if (peek() && peek().t === '+') { next(); return unary(); } return power(); }
    function power() { const a = atom(); if (peek() && peek().t === '^') { next(); const e = unary(); if (!P.isConst(e)) throw new Error('pow'); const n = P.val(e); if (P.isConst(a)) return P.c(Math.pow(P.val(a), n)); if (!Number.isInteger(n) || n < 0 || n > 3) throw new Error('pow'); let r = P.c(1); for (let k = 0; k < n; k++) r = P.mul(r, a); return r; } return a; }
    function atom() {
      const k = next(); if (!k) throw new Error('end');
      if (k.t === 'n') return P.c(k.v);
      if (k.t === 'v') { if (vars && k.v in vars) return P.c(vars[k.v]); if (letter && k.v === letter) return { 1: 1 }; throw new Error('var'); }
      if (k.t === '(') { const a = expr(); if (!next() || toks[p - 1].t !== ')') throw new Error(')'); return a; }
      if (k.t === 'f') { const a = atom(); if (!P.isConst(a)) throw new Error('sqrt'); return P.c(Math.sqrt(P.val(a))); }
      throw new Error('unexpected');
    }
    const r = expr(); if (p !== toks.length) throw new Error('trailing'); return r;
  }
  const evalNum = (e, vars) => { const r = parse(e, vars); if (!P.isConst(r)) throw new Error('not const'); return P.val(r); };

  /* ---------- handlers ---------- */
  const H = [];
  // % change from A to B
  H.push((s) => {
    const m = s.match(new RegExp(`(?:percentage|percent|%)\\s*(increase|decrease|change|profit|loss)?[^\\d£]*?from\\s+£?${N}\\s+to\\s+£?${N}`)) || s.match(new RegExp(`from\\s+£?${N}\\s+to\\s+£?${N}[^.?]*?(?:percentage|percent|%)`));
    if (!m) return null;
    const [a, b] = m.slice(-2).map(Number), ch = b - a, pc = ch / a * 100;
    return out(`Percentage ${ch >= 0 ? 'increase' : 'decrease'}`, `${fm(Math.abs(pc))}% ${ch >= 0 ? 'increase' : 'decrease'}`, [
      `Find the change: ${fm(b)} − ${fm(a)} = ${fm(ch)}`, `Divide by the ORIGINAL amount: ${fm(ch)} ÷ ${fm(a)} = ${fm(ch / a)}`, `× 100 to make a percentage: ${fm(pc)}%`], { tip: 'Change ÷ original × 100.' });
  });
  // increase/decrease X by P%
  H.push((s) => {
    let m = s.match(new RegExp(`(increase|decrease|reduce|raise|rise|add|take|cut|lower)\\w*\\s+(?:[a-z]+\\s+){0,3}?(£?)${N}\\s*(?:[a-z]+\\s+){0,3}?by\\s+${N}\\s*%`));
    let up, x, p, money;
    if (m) { up = /incr|rais|rise|add/.test(m[1]); money = !!m[2]; x = +m[3]; p = +m[4]; }
    else {
      const ma = s.match(new RegExp(`${N}\\s*%\\s*(off|discount|reduction|sale|increase|more|less|decrease|vat)[^\\d£]*?(£?)${N}`)), mb = s.match(new RegExp(`(£?)${N}[^\\d%]*?${N}\\s*%\\s*(off|discount|reduction|sale|increase|more|less|decrease|vat)`));
      m = ma && mb ? (mb[1] && !ma[3] ? mb : ma) : ma || mb; // prefer the one with a £ amount
      if (!m) return null;
      if (/^\d|^-/.test(m[1])) { p = +m[1]; up = /increase|more|vat/.test(m[2]); money = !!m[3]; x = +m[4]; }
      else { money = !!m[1]; x = +m[2]; p = +m[3]; up = /increase|more|vat/.test(m[4]); }
    }
    const amt = x * p / 100, res = up ? x + amt : x - amt, f = money ? mon : fm;
    return out(`${up ? 'Increase' : 'Decrease'} by ${fm(p)}%`, f(res), [
      `Find ${fm(p)}% of ${f(x)}: ${f(x)} ÷ 100 × ${fm(p)} = ${f(amt)}`, `${up ? 'Add it on' : 'Take it off'}: ${f(x)} ${up ? '+' : '−'} ${f(amt)} = ${f(res)}`,
      `Or in one step: ${f(x)} × ${fm(up ? 1 + p / 100 : 1 - p / 100)} = ${f(res)}`]);
  });
  // P% of X
  H.push((s) => {
    const m = s.match(new RegExp(`${N}\\s*%\\s*of\\s*(£?)${N}`)); if (!m) return null;
    const p = +m[1], money = !!m[2], x = +m[3], a = x * p / 100, f = money ? mon : fm;
    const steps = [];
    if (p === 50) steps.push(`50% is half: ${f(x)} ÷ 2 = ${f(a)}`);
    else if (p === 25) steps.push(`25% is a quarter: ${f(x)} ÷ 4 = ${f(a)}`);
    else if (p % 10 === 0) steps.push(`10% of ${f(x)} = ${f(x)} ÷ 10 = ${f(x / 10)}`, `${fm(p)}% = ${fm(p / 10)} × 10% = ${fm(p / 10)} × ${f(x / 10)} = ${f(a)}`);
    else if (p % 5 === 0) steps.push(`10% = ${f(x)} ÷ 10 = ${f(x / 10)}`, `5% = half of 10% = ${f(x / 20)}`, `${fm(p)}% = ${Math.floor(p / 10) === 1 ? '10%' : Math.floor(p / 10) + ' lots of 10%'} + 5% = ${f(Math.floor(p / 10) * x / 10)} + ${f(x / 20)} = ${f(a)}`);
    else steps.push(`1% of ${f(x)} = ${f(x)} ÷ 100 = ${f(x / 100)}`, `${fm(p)}% = ${fm(p)} × ${f(x / 100)} = ${f(a)}`);
    steps.push(`Calculator way: ${f(x)} × ${fm(p / 100)} = ${f(a)}`);
    return out(`${fm(p)}% of ${f(x)}`, f(a), steps);
  });
  // fraction of an amount
  H.push((s) => {
    let m = s.match(new RegExp(`(\\d+)\\s*/\\s*(\\d+)\\s*of\\s*(?:a\\s+)?(£?)${N}`)), n, d, money, x;
    if (m) { n = +m[1]; d = +m[2]; money = !!m[3]; x = +m[4]; }
    else {
      m = s.match(new RegExp(`(a |one |)(half|third|quarter|fifth|tenth)s?\\s+of\\s*(£?)${N}`)); if (!m) return null;
      n = 1; d = { half: 2, third: 3, quarter: 4, fifth: 5, tenth: 10 }[m[2]]; money = !!m[3]; x = +m[4];
    }
    const f = money ? mon : fm, one = x / d;
    return out(`${n}/${d} of ${f(x)}`, f(one * n), [`Divide by the bottom number: ${f(x)} ÷ ${d} = ${f(one)}`, ...(n > 1 ? [`Times by the top number: ${f(one)} × ${n} = ${f(one * n)}`] : [])], { tip: 'Divide by the bottom, times by the top.' });
  });
  // share in a ratio
  H.push((s) => {
    const m = s.match(new RegExp(`(?:share|split|divide)[a-z]*\\s+(£?)${N}[^\\d]*?(\\d+)\\s*:\\s*(\\d+)(?:\\s*:\\s*(\\d+))?`)); if (!m) return null;
    const money = !!m[1], tot = +m[2], parts = [m[3], m[4], m[5]].filter(Boolean).map(Number), sum = parts.reduce((a, b) => a + b, 0), one = tot / sum, f = money ? mon : fm;
    return out(`Share ${f(tot)} in the ratio ${parts.join(' : ')}`, parts.map((p) => f(p * one)).join(' and '), [
      `Add the parts: ${parts.join(' + ')} = ${sum}`, `One part: ${f(tot)} ÷ ${sum} = ${f(one)}`, ...parts.map((p) => `${p} parts: ${p} × ${f(one)} = ${f(p * one)}`), `Check: ${parts.map((p) => f(p * one)).join(' + ')} = ${f(tot)} ✓`]);
  });
  // simplify ratio / fraction
  H.push((s) => {
    let m = s.match(/simplif\w*\s*(?:the\s+ratio\s*)?(\d+)\s*:\s*(\d+)(?:\s*:\s*(\d+))?/);
    if (m) { const v = [m[1], m[2], m[3]].filter(Boolean).map(Number), g = v.reduce(gcd); return out(`Simplify ${v.join(' : ')}`, v.map((x) => x / g).join(' : '), [`Find the biggest number that divides into all of them: ${g}`, `Divide each by ${g}: ${v.map((x) => `${x} ÷ ${g} = ${x / g}`).join(', ')}`]); }
    m = s.match(/simplif\w*\s*(?:the\s+fraction\s*)?(\d+)\s*\/\s*(\d+)/);
    if (m) { const a = +m[1], b = +m[2], g = gcd(a, b); return out(`Simplify ${a}/${b}`, `${a / g}/${b / g}`, [`The biggest number that goes into ${a} and ${b} is ${g}`, `Top: ${a} ÷ ${g} = ${a / g}. Bottom: ${b} ÷ ${g} = ${b / g}`]); }
    return null;
  });
  // fraction arithmetic a/b ± × ÷ c/d
  H.push((s) => {
    const m = s.match(/(\d+)\s*\/\s*(\d+)\s*([+\-*/])\s*(\d+)\s*\/\s*(\d+)/); if (!m) return null;
    const [a, b, o, c, d] = [+m[1], +m[2], m[3], +m[4], +m[5]]; let r, steps;
    if (o === '+' || o === '-') { const L = lcm(b, d), A = a * L / b, C = c * L / d; r = frac(o === '+' ? A + C : A - C, L);
      steps = [`Make the bottoms the same: ${L}`, `${a}/${b} = ${A}/${L} and ${c}/${d} = ${C}/${L}`, `${o === '+' ? 'Add' : 'Subtract'} the tops: ${A} ${o === '+' ? '+' : '−'} ${C} = ${o === '+' ? A + C : A - C}, so ${o === '+' ? A + C : A - C}/${L}`]; }
    else if (o === '*') { r = frac(a * c, b * d); steps = [`Multiply the tops: ${a} × ${c} = ${a * c}`, `Multiply the bottoms: ${b} × ${d} = ${b * d}`, `${a * c}/${b * d}`]; }
    else { r = frac(a * d, b * c); steps = [`Keep, change, flip: ${a}/${b} × ${d}/${c}`, `Tops: ${a} × ${d} = ${a * d}. Bottoms: ${b} × ${c} = ${b * c}`]; }
    steps.push(`Simplest form: ${fstr(r)}${Math.abs(r[0]) > r[1] && r[1] > 1 ? ` (= ${Math.trunc(r[0] / r[1])} and ${Math.abs(r[0] % r[1])}/${r[1]})` : ''}`);
    return out(`${a}/${b} ${o === '*' ? '×' : o === '/' ? '÷' : o} ${c}/${d}`, fstr(r), steps);
  });
  // HCF / LCM
  H.push((s) => {
    const m = s.match(/(hcf|highest common factor|greatest common|gcd|lcm|lowest common multiple|least common multiple)\D*?(\d+)\D+?(\d+)(?:\D+?(\d+))?/); if (!m) return null;
    const v = [m[2], m[3], m[4]].filter(Boolean).map(Number), h = /hcf|highest|greatest|gcd/.test(m[1]);
    if (h) { const g = v.reduce(gcd); const fl = (n) => { const r = []; for (let i = 1; i <= n; i++) if (n % i === 0) r.push(i); return r; };
      return out(`HCF of ${v.join(' and ')}`, String(g), [...v.map((n) => `Factors of ${n}: ${fl(n).join(', ')}`), `The biggest one in every list is ${g}`]); }
    const L = v.reduce(lcm); return out(`LCM of ${v.join(' and ')}`, String(L), [...v.map((n) => `Multiples of ${n}: ${[1, 2, 3, 4, 5, 6].map((k) => n * k).join(', ')}…`), `The first number in every list is ${L}`]);
  });
  // prime factors / factors / is prime
  H.push((s) => {
    let m = s.match(/(?:prime factors?|product of (?:its )?prime(?: factors)?|prime factori[sz]\w*)\D*(\d+)/) || s.match(/(\d+)\D*(?:as a product of prime|into prime factors)/);
    if (m) { let n = +m[1]; const f = [], steps = []; for (let p = 2; p * p <= n; p++) while (n % p === 0) { steps.push(`${n} = ${p} × ${n / p}`); f.push(p); n /= p; } if (n > 1) f.push(n);
      const cnt = {}; f.forEach((x) => cnt[x] = (cnt[x] || 0) + 1); const idx = Object.keys(cnt).map((k) => cnt[k] > 1 ? `${k}^${cnt[k]}` : k).join(' × ');
      return out(`${m[1]} as a product of prime factors`, f.join(' × ') + (idx !== f.join(' × ') ? `  (= ${idx})` : ''), [...steps, 'Keep splitting until every number is prime (a factor tree)']); }
    m = s.match(/is\s+(\d+)\s+(?:a\s+)?prime/); if (m) { const n = +m[1]; const d = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31].find((p) => p < n && n % p === 0);
      return out(`Is ${n} prime?`, isPrime(n) ? 'Yes' : 'No', [isPrime(n) ? `${n} only divides by 1 and ${n}, so it is prime` : n < 2 ? `${n} is not prime (primes start at 2)` : `${n} = ${d} × ${n / d}, so it has other factors — not prime`]); }
    m = s.match(/factors of (\d+)/); if (m) { const n = +m[1], p = []; for (let i = 1; i * i <= n; i++) if (n % i === 0) p.push(i + ' × ' + n / i);
      const all = []; for (let i = 1; i <= n; i++) if (n % i === 0) all.push(i); return out(`Factors of ${n}`, all.join(', '), [`Find pairs that multiply to ${n}: ${p.join(', ')}`]); }
    m = s.match(/multiples of (\d+)/); if (m) { const n = +m[1]; return out(`Multiples of ${n}`, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((k) => k * n).join(', ') + '…', ['Multiples are the times table of the number']); }
    return null;
  });
  // roots and powers
  H.push((s) => {
    let m = s.match(new RegExp(`(?:square root of|sqrt|√)\\s*${N}`)); if (m) { const n = +m[1], r = Math.sqrt(n); return out(`√${fm(n)}`, fm(r), [Number.isInteger(r) ? `${fm(r)} × ${fm(r)} = ${fm(n)}` : `Use the √ button: ${fm(r)} (to 3 d.p.)`]); }
    m = s.match(new RegExp(`(?:cube root of|∛)\\s*${N}`)); if (m) { const n = +m[1], r = Math.cbrt(n); return out(`∛${fm(n)}`, fm(r), [`${fm(r)} × ${fm(r)} × ${fm(r)} = ${fm(n)}`]); }
    m = s.match(new RegExp(`${N}\\s*(squared|cubed)`)); if (m) { const n = +m[1], k = m[2] === 'squared' ? 2 : 3; return out(`${fm(n)} ${m[2]}`, fm(n ** k), [`${Array(k).fill(fm(n)).join(' × ')} = ${fm(n ** k)}`, `(Not ${fm(n)} × ${k}!)`]); }
    return null;
  });
  // rounding
  H.push((s) => {
    const m = s.match(new RegExp(`round\\w*\\s+${N}\\s+to\\s+(?:the\\s+)?(?:nearest\\s+(\\d+|whole(?: number)?|integer|pound|penny)|(\\d+)\\s*(?:decimal places?|dp|d\\.p\\.?)|(\\d+)\\s*(?:significant figures?|sig figs?|sf|s\\.f\\.?))`)); if (!m) return null;
    const x = +m[1];
    if (m[2]) { const to = /whole|integer|pound/.test(m[2]) ? 1 : m[2] === 'penny' ? 0.01 : +m[2]; const r = Math.round(x / to) * to; return out(`Round ${fm(x)} to the nearest ${fm(to)}`, fm(r), [`It's between ${fm(Math.floor(x / to) * to)} and ${fm(Math.ceil(x / to) * to)}`, `It is closer to ${fm(r)} (5 or more rounds UP)`]); }
    if (m[3]) { const d = +m[3], r = Math.round(x * 10 ** d) / 10 ** d; return out(`Round ${fm(x)} to ${d} d.p.`, r.toFixed(d), [`Keep ${d} digit${d > 1 ? 's' : ''} after the decimal point`, `Look at the next digit: 5 or more → round up, 4 or less → round down`]); }
    const sf = +m[4], r = Number(x.toPrecision(sf)); return out(`Round ${fm(x)} to ${sf} s.f.`, fm(r), [`Start counting from the first non-zero digit`, `Keep ${sf} digit${sf > 1 ? 's' : ''}, look at the next one to round, then fill with zeros if needed`]);
  });
  // averages
  H.push((s) => {
    const m = s.match(/\b(mean|average|median|mode|range)\b/); if (!m) return null;
    const list = nums(s.slice(m.index)); if (list.length < 3) return null;
    const k = m[1] === 'average' ? 'mean' : m[1], sorted = list.slice().sort((a, b) => a - b), n = list.length, sum = list.reduce((a, b) => a + b, 0);
    if (k === 'mean') return out('Mean', fm(sum / n), [`Add them up: ${list.map(fm).join(' + ')} = ${fm(sum)}`, `Divide by how many there are (${n}): ${fm(sum)} ÷ ${n} = ${fm(sum / n)}`]);
    if (k === 'median') { const mid = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2; return out('Median', fm(mid), [`Put them in order: ${sorted.map(fm).join(', ')}`, n % 2 ? `The middle one (number ${(n + 1) / 2}) is ${fm(mid)}` : `Two middle numbers: ${fm(sorted[n / 2 - 1])} and ${fm(sorted[n / 2])} → halfway = ${fm(mid)}`]); }
    if (k === 'range') return out('Range', fm(sorted[n - 1] - sorted[0]), [`Biggest − smallest = ${fm(sorted[n - 1])} − ${fm(sorted[0])} = ${fm(sorted[n - 1] - sorted[0])}`]);
    const c = {}; list.forEach((x) => c[x] = (c[x] || 0) + 1); const mx = Math.max(...Object.values(c)); const modes = Object.keys(c).filter((x) => c[x] === mx);
    return out('Mode', mx === 1 ? 'No mode' : modes.join(' and '), [mx === 1 ? 'Every number appears once, so there is no mode' : `${modes.join(' and ')} appear${modes.length > 1 ? '' : 's'} most (${mx} times)`]);
  });
  // angles
  H.push((s) => {
    if (!/\bangles?\b|°/.test(s) || /area|hypotenuse|pythag|perimeter/.test(s)) return null;
    const ang = (s.match(/(\d+(?:\.\d+)?)\s*°/g) || []).map((x) => parseFloat(x));
    const list = ang.length ? ang : nums(s);
    if (/triangle/.test(s) && /isosceles/.test(s) && list.length === 1 && /base|bottom/.test(s) === false) { const t = list[0]; return out('Isosceles triangle', `${fm((180 - t) / 2)}° each`, [`Angles in a triangle add to 180°`, `180 − ${fm(t)} = ${fm(180 - t)}`, `The two base angles are equal: ${fm(180 - t)} ÷ 2 = ${fm((180 - t) / 2)}°`], { tip: 'If the angle you were given is a base angle instead, the other base angle is the same and the top is 180 − 2 × it.' }); }
    if (/triangle/.test(s) && list.length === 2) { const t = 180 - list[0] - list[1]; return out('Missing angle in a triangle', `${fm(t)}°`, [`Angles in a triangle add up to 180°`, `${fm(list[0])} + ${fm(list[1])} = ${fm(list[0] + list[1])}`, `180 − ${fm(list[0] + list[1])} = ${fm(t)}°`]); }
    if (/quadrilateral|four.sided|4.sided|rectangle|trapezium|kite|parallelogram/.test(s) && list.length === 3) { const t = 360 - list.reduce((a, b) => a + b); return out('Missing angle in a quadrilateral', `${fm(t)}°`, [`Angles in a quadrilateral add up to 360°`, `360 − (${list.map(fm).join(' + ')}) = ${fm(t)}°`]); }
    if (/straight line/.test(s) && list.length >= 1) { const t = 180 - list.reduce((a, b) => a + b); return out('Angles on a straight line', `${fm(t)}°`, [`Angles on a straight line add up to 180°`, `180 − ${list.map(fm).join(' − ')} = ${fm(t)}°`]); }
    if (/(around|round|about) a point|full turn/.test(s) && list.length >= 1) { const t = 360 - list.reduce((a, b) => a + b); return out('Angles around a point', `${fm(t)}°`, [`Angles around a point add up to 360°`, `360 − ${list.map(fm).join(' − ')} = ${fm(t)}°`]); }
    const m = s.match(/(?:interior|exterior)?\s*angles?.*?regular\s+(\w+)|regular\s+(\w+).*?angle/);
    if (m) { const nm = (m[1] || m[2]); const sides = { triangle: 3, square: 4, pentagon: 5, hexagon: 6, heptagon: 7, octagon: 8, nonagon: 9, decagon: 10 }[nm] || +nm; if (sides >= 3) { const ext = 360 / sides; return out(`Regular ${nm}`, `interior ${fm(180 - ext)}°, exterior ${fm(ext)}°`, [`Exterior angle = 360 ÷ ${sides} = ${fm(ext)}°`, `Interior angle = 180 − ${fm(ext)} = ${fm(180 - ext)}°`, `(Sum of interior angles = (${sides} − 2) × 180 = ${(sides - 2) * 180}°)`]); } }
    return null;
  });
  // Pythagoras
  H.push((s) => {
    if (!/hypotenuse|pythag|right.angled/.test(s)) return null;
    const v = nums(s).filter((x) => x > 0 && x !== 90); if (v.length < 2) return null;
    const hm = s.match(new RegExp(`hypotenuse\\s*(?:is|=|of|:)?\\s*${N}`)) || s.match(new RegExp(`${N}\\s*(?:cm|m|mm)?\\s*(?:is the |as the )?hypotenuse`));
    if (hm) { const h = +hm[1], a = v.find((x) => x !== h); const r = Math.sqrt(h * h - a * a); if (!isFinite(r)) return null;
      return out('Pythagoras — shorter side', fm(r), [`The hypotenuse is the longest side, so SUBTRACT`, `${fm(h)}² − ${fm(a)}² = ${fm(h * h)} − ${fm(a * a)} = ${fm(h * h - a * a)}`, `√${fm(h * h - a * a)} = ${fm(r)}`]); }
    const [a, b] = v; const r = Math.sqrt(a * a + b * b);
    return out('Pythagoras — hypotenuse', fm(r), [`a² + b² = c²`, `${fm(a)}² + ${fm(b)}² = ${fm(a * a)} + ${fm(b * b)} = ${fm(a * a + b * b)}`, `√${fm(a * a + b * b)} = ${fm(r)}`], { tip: 'If one of the numbers is the hypotenuse, tell me — then you subtract instead.' });
  });
  // circles
  H.push((s) => {
    if (!/circle|semi.?circle/.test(s)) return null;
    const rm = s.match(new RegExp(`radius\\s*(?:of|is|=)?\\s*${N}`)) || s.match(new RegExp(`${N}\\s*\\w*\\s*radius`)), dm = s.match(new RegExp(`diameter\\s*(?:of|is|=)?\\s*${N}`)) || s.match(new RegExp(`${N}\\s*\\w*\\s*diameter`));
    if (!rm && !dm) return null;
    const r = rm ? +rm[1] : +dm[1] / 2, semi = /semi/.test(s), wantA = /area/.test(s), wantC = /circumference|perimeter|around|round/.test(s);
    const A = Math.PI * r * r * (semi ? 0.5 : 1), C = 2 * Math.PI * r;
    const steps = [dm ? `Radius = diameter ÷ 2 = ${fm(r)}` : `Diameter = 2 × radius = ${fm(2 * r)}`];
    if (wantA || !wantC) steps.push(`Area = π × r² = π × ${fm(r)} × ${fm(r)} = ${fm(Math.PI * r * r)}${semi ? `, ÷ 2 for a semicircle = ${fm(A)}` : ''}`);
    if (wantC || !wantA) steps.push(`Circumference = π × d = π × ${fm(2 * r)} = ${fm(C)}`);
    const ans = [(wantA || !wantC) ? `Area ≈ ${r2(A).toFixed(2)}` : null, (wantC || !wantA) ? `Circumference ≈ ${r2(C).toFixed(2)}` : null].filter(Boolean).join(', ');
    return out(semi ? 'Semicircle' : 'Circle', ans, steps, { tip: 'Both circle formulas are on the exam formula sheet. Round at the very end.' });
  });
  // rectangles, triangles, cuboids
  H.push((s) => {
    const v = nums(s).filter((x) => x > 0);
    if (/cuboid|box/.test(s) && /volume/.test(s) && v.length >= 3) { const [a, b, c] = v; return out('Volume of a cuboid', fm(a * b * c), [`Volume = length × width × height`, `${fm(a)} × ${fm(b)} × ${fm(c)} = ${fm(a * b * c)}`]); }
    if (/triangle/.test(s) && /area/.test(s) && v.length >= 2) { const [a, b] = v; return out('Area of a triangle', fm(a * b / 2), [`Area = ½ × base × height`, `${fm(a)} × ${fm(b)} = ${fm(a * b)}`, `÷ 2 = ${fm(a * b / 2)}`]); }
    if (/trapezium/.test(s) && /area/.test(s) && v.length >= 3) { const [a, b, h] = v; return out('Area of a trapezium', fm((a + b) / 2 * h), [`Area = ½(a + b)h (on the formula sheet)`, `${fm(a)} + ${fm(b)} = ${fm(a + b)}`, `× ${fm(h)} = ${fm((a + b) * h)}`, `÷ 2 = ${fm((a + b) * h / 2)}`], { tip: 'This assumes the first two numbers are the parallel sides and the last is the height.' }); }
    if (/rectangle|square|oblong/.test(s) && /(area|perimeter)/.test(s) && v.length >= 1) {
      const [a, b] = v.length >= 2 ? v : [v[0], v[0]], st = [], ans = [];
      if (/area/.test(s)) { st.push(`Area = length × width = ${fm(a)} × ${fm(b)} = ${fm(a * b)}`); ans.push(`Area = ${fm(a * b)}`); }
      if (/perimeter/.test(s)) { st.push(`Perimeter = add all 4 sides = ${fm(a)} + ${fm(b)} + ${fm(a)} + ${fm(b)} = ${fm(2 * (a + b))}`); ans.push(`Perimeter = ${fm(2 * (a + b))}`); }
      return out(/square/.test(s) && v.length === 1 ? 'Square' : 'Rectangle', ans.join(', '), st);
    }
    return null;
  });
  // unit conversions
  H.push((s) => {
    const U = { mm: ['len', 0.001], cm: ['len', 0.01], m: ['len', 1], km: ['len', 1000], g: ['mass', 1], kg: ['mass', 1000], mg: ['mass', 0.001], tonnes: ['mass', 1e6], tonne: ['mass', 1e6], ml: ['vol', 0.001], cl: ['vol', 0.01], l: ['vol', 1], litres: ['vol', 1], litre: ['vol', 1], seconds: ['t', 1], minutes: ['t', 60], mins: ['t', 60], hours: ['t', 3600], days: ['t', 86400] };
    const re = new RegExp(`${N}\\s*(mm|cm|km|kg|mg|ml|cl|tonnes?|litres?|seconds|minutes|mins|hours|days|m|g|l)\\s+(?:in|into|to|as)\\s+(?:how many\\s+)?(mm|cm|km|kg|mg|ml|cl|tonnes?|litres?|seconds|minutes|mins|hours|days|m|g|l)\\b`);
    const m = s.match(re) || s.match(new RegExp(`how many\\s+(mm|cm|km|kg|mg|ml|cl|tonnes?|litres?|seconds|minutes|hours|days|m|g|l)\\s+(?:are\\s+)?in\\s+${N}\\s*(mm|cm|km|kg|mg|ml|cl|tonnes?|litres?|seconds|minutes|mins|hours|days|m|g|l)\\b`));
    if (!m) return null;
    let x, from, to; if (/^-?\d/.test(m[1])) { x = +m[1]; from = m[2]; to = m[3]; } else { to = m[1]; x = +m[2]; from = m[3]; }
    if (!U[from] || !U[to] || U[from][0] !== U[to][0]) return null;
    const k = U[from][1] / U[to][1], r = x * k;
    return out(`${fm(x)} ${from} → ${to}`, `${fm(r)} ${to}`, [k >= 1 ? `1 ${from} = ${fm(k)} ${to}, so MULTIPLY by ${fm(k)}` : `1 ${to} = ${fm(1 / k)} ${from}, so DIVIDE by ${fm(1 / k)}`, `${fm(x)} ${k >= 1 ? '×' : '÷'} ${fm(k >= 1 ? k : 1 / k)} = ${fm(r)} ${to}`]);
  });
  // sequences
  H.push((s) => {
    if (!/sequence|nth term|n th term|next (?:term|number)|term.to.term|pattern/.test(s)) return null;
    const tm = s.match(/(-?\d+(?:\.\d+)?(?:\s*,\s*-?\d+(?:\.\d+)?){2,})/); if (!tm) return null;
    const v = tm[1].split(',').map(Number), d = v[1] - v[0];
    if (!v.every((x, i) => i === 0 || Math.abs(x - v[i - 1] - d) < 1e-9)) {
      const r = v[1] / v[0]; if (v.every((x, i) => i === 0 || Math.abs(x / v[i - 1] - r) < 1e-9)) return out('Geometric sequence', `next term ${fm(v[v.length - 1] * r)}`, [`Each term is × ${fm(r)}`, `${fm(v[v.length - 1])} × ${fm(r)} = ${fm(v[v.length - 1] * r)}`]);
      const d2 = v.slice(1).map((x, i) => x - v[i]); return out('Sequence', 'not a simple pattern', [`The gaps are ${d2.join(', ')} — they change, so it isn't a "same jump" sequence`, `Look at the gaps between the gaps, or check for square numbers (1, 4, 9, 16…)`]);
    }
    const c = v[0] - d, nth = `${fm(d)}n ${c >= 0 ? '+ ' + fm(c) : '− ' + fm(-c)}`.replace(/^1n/, 'n').replace(/ \+ 0$/, '');
    const qm = s.match(/(\d+)(?:st|nd|rd|th)\s+term|term\s+(?:number\s+)?(\d+)/); const k = qm ? +(qm[1] || qm[2]) : null;
    const steps = [`The jump is ${fm(d)} each time → it starts ${fm(d)}n`, `${fm(d)}n gives ${[1, 2, 3].map((i) => fm(d * i)).join(', ')}… The real terms are ${fm(c) === '0' ? 'the same' : (c > 0 ? fm(c) + ' more' : fm(-c) + ' less')}`, `nth term = ${nth}`, `Next term: ${fm(v[v.length - 1])} ${d >= 0 ? '+' : '−'} ${fm(Math.abs(d))} = ${fm(v[v.length - 1] + d)}`];
    if (k) steps.push(`Term ${k}: ${fm(d)} × ${k} ${c >= 0 ? '+' : '−'} ${fm(Math.abs(c))} = ${fm(d * k + c)}`);
    return out('Linear sequence', k ? `term ${k} = ${fm(d * k + c)}` : `nth term = ${nth}; next term = ${fm(v[v.length - 1] + d)}`, steps);
  });
  // substitution: "if a = 3 and b = 5, work out 2a + b"
  H.push((s) => {
    const as = [...s.matchAll(new RegExp(`\\b([a-z])\\s*=\\s*${N}`, 'g'))]; if (!as.length) return null;
    const vars = {}; as.forEach((m) => vars[m[1]] = +m[2]);
    const em = s.match(/(?:work out|find|calculate|evaluate|what is|value of)\s+([a-z0-9+\-*/^().\s]+?)(?:[?,.]|$|\s+when|\s+if)/); if (!em) return null;
    try { const val = evalNum(em[1].trim(), vars); return out(`Substitute into ${em[1].trim()}`, fm(val), [`Swap each letter for its number: ${Object.keys(vars).map((k) => `${k} = ${fm(vars[k])}`).join(', ')}`, `${em[1].trim().replace(/([0-9])([a-z])/g, '$1 × $2').replace(/[a-z]/g, (L) => (L in vars ? `(${fm(vars[L])})` : L))}`, `Use BIDMAS: = ${fm(val)}`]); } catch (e) { return null; }
  });
  // linear equations
  H.push((s) => {
    if (!s.includes('=')) return null;
    const m = s.match(/([0-9a-z+\-*/^().\s]*[a-z][0-9a-z+\-*/^().\s]*)=([0-9a-z+\-*/^().\s]+)/); if (!m) return null;
    const clean = (t) => t.replace(/\b(solve|find|work out|what is|for|the|value of|if|when)\b/g, ' ').trim();
    const L = clean(m[1]), R = clean(m[2]);
    const letters = new Set((L + R).match(/[a-z]/g) || []); letters.delete('p'); if (letters.size !== 1) return null;
    const x = [...letters][0];
    let pl, pr; try { pl = parse(L, null, x); pr = parse(R, null, x); } catch (e) { return null; }
    const d = P.add(pl, pr, -1); if (P.deg(d) !== 1) return null;
    const a = d[1] || 0, b = d[0] || 0; if (Math.abs(a) < 1e-12) return null;
    const sol = -b / a, la = pl[1] || 0, lb = pl[0] || 0, ra = pr[1] || 0, rb = pr[0] || 0;
    const lin = (k, c) => `${k === 1 ? '' : k === -1 ? '−' : fm(k)}${x}${c ? (c > 0 ? ' + ' + fm(c) : ' − ' + fm(-c)) : ''}`;
    const steps = [];
    if (/[()]/.test(L + R)) steps.push(`Expand the brackets: ${la ? lin(la, lb) : fm(lb)} = ${ra ? lin(ra, rb) : fm(rb)}`);
    if (ra) steps.push(`Get the ${x}'s on one side (take ${fm(ra)}${x} from both sides): ${fm(la - ra)}${x} ${lb >= 0 ? '+ ' + fm(lb) : '− ' + fm(-lb)} = ${fm(rb)}`);
    if (lb) steps.push(`${lb > 0 ? 'Take ' + fm(lb) + ' from' : 'Add ' + fm(-lb) + ' to'} both sides: ${fm(a)}${x} = ${fm(-b)}`);
    if (a !== 1) steps.push(`Divide both sides by ${fm(a)}: ${x} = ${fm(-b)} ÷ ${fm(a)} = ${fm(sol)}${Number.isInteger(r3(sol)) ? '' : (niceFrac(sol) ? ` (= ${niceFrac(sol)})` : '')}`);
    steps.push(`Check: put ${x} = ${fm(sol)} back in — both sides equal ${fm(la * sol + lb)} ✓`);
    return out(`Solve ${L} = ${R}`, `${x} = ${fm(sol)}`, steps);
  });
  // plain arithmetic
  H.push((s) => {
    const cands = s.match(/[-(]*\s*(?:\d+(?:\.\d+)?|pi|sqrt)[\d.\s+\-*/^()pisqrt]*[\d)]/g); if (!cands) return null;
    const e = cands.map((c) => c.trim()).filter((c) => /\d.*[+\-*/^].*\d|sqrt|pi/.test(c)).sort((a, b) => b.length - a.length)[0]; if (!e) return null;
    let v; try { v = evalNum(e); } catch (err) { return null; } if (!isFinite(v)) return null;
    const pretty = e.replace(/\*/g, ' × ').replace(/\//g, ' ÷ ').replace(/\s+/g, ' ');
    const mixed = /[+\-]/.test(e.replace(/^-/, '')) && /[*/^]/.test(e);
    return out(pretty, fm(v), [mixed || /\(/.test(e) ? 'Use BIDMAS: Brackets, Indices (powers), Divide & Multiply, then Add & Subtract' : `Work it out: ${pretty} = ${fm(v)}`, ...(mixed || /\(/.test(e) ? [`${pretty} = ${fm(v)}`] : [])]);
  });

  function solve(text) {
    if (!text || !/\d/.test(text)) return null;
    const s = norm(text);
    for (const h of H) { try { const r = h(s); if (r) return r; } catch (e) { /* try the next one */ } }
    return null;
  }
  return { solve, _norm: norm, _eval: evalNum };
})();
if (typeof module !== 'undefined') module.exports = Solver;
