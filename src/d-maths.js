/* ============================================================
   MATHS — AQA GCSE Mathematics 8300, Foundation tier.
   Comberton teaches it as a spiral (Sparx "Alpha"→"D" schemes).
   This path starts right at the bottom (Alpha scheme: place value,
   times tables) and climbs slowly to Foundation grade 4–5 topics.
   Every question is generated fresh, so she can repeat forever.
   Level 1 = 3 choices, Level 2 = 4 choices, Level 3 = type the answer.
   ============================================================ */
const R = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const P = (a) => a[Math.floor(Math.random() * a.length)];
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
const F = (n) => (typeof n === 'number' ? (Math.round(n * 1000) / 1000).toLocaleString('en-GB', { maximumFractionDigits: 3 }) : String(n));
const money = (n) => '£' + (Math.round(n * 100) / 100).toFixed(2);
const neg = (n) => (n < 0 ? '−' + F(-n) : F(n));
/* one maths question: typed at level 3 (if numeric), multiple choice otherwise */
function MQ(o) {
  const f = o.fmt || F, wrap = (s) => (o.pre || '') + s + (o.unit ? ' ' + o.unit : '');
  if (o.lv >= 3 && !o.mc && typeof o.a === 'number') return { t: 'num', q: o.q, ex: o.ex, a: o.a, pre: o.pre, unit: o.unit, why: o.why, hint: o.hint, tol: o.tol };
  const A = f(o.a), ws = [];
  const pad = typeof o.a === 'number' ? [o.a + 1, o.a - 1, o.a + 10, o.a * 2, o.a + 2, o.a - 2, o.a + 5] : [];
  for (const w of (o.w || []).concat(pad)) {
    if (w == null || (typeof w === 'number' && (!isFinite(w) || (o.pos !== false && w < 0 && o.a >= 0)))) continue;
    const s = f(w); if (s !== A && !ws.includes(s)) ws.push(s);
  }
  return { t: 'mc', q: o.q, ex: o.ex, a: wrap(A), w: ws.slice(0, o.lv === 1 ? 2 : 3).map(wrap), why: o.why, hint: o.hint };
}
const TF = (q, a, why) => ({ t: 'tf', q, a, why });
const boxes = (n, d) => '🟪'.repeat(n) + '⬜'.repeat(d - n);

const G = {
  /* ---------- A. Number basics ---------- */
  place(lv) {
    if (lv === 1) { const n = R(102, 987), s = String(n), i = R(0, 2), dg = s[i]; if (dg === '0') return G.place(lv); const v = +dg * [100, 10, 1][i];
      return MQ({ lv, q: `What is the ${dg} worth in ${n}?`, a: v, w: [+dg * 10, +dg * 100, +dg, +dg * 1000].filter((x) => x !== v), why: `${n} = ${s[0]} hundreds, ${s[1]} tens, ${s[2]} ones. The ${dg} is in the ${['hundreds', 'tens', 'ones'][i]} column, so it's worth ${F(v)}.`, hint: 'Read the columns from the right: ones, tens, hundreds.' }); }
    if (lv === 2) { const n = R(1203, 98760), s = String(n), i = R(0, s.length - 3), dg = s[i]; if (dg === '0') return G.place(lv); const v = +dg * 10 ** (s.length - 1 - i);
      return MQ({ lv, q: `What is the ${dg} worth in ${F(n)}?`, a: v, w: [v / 10, v * 10, +dg].filter((x) => x !== v), why: `Counting columns from the right (ones, tens, hundreds, thousands, ten-thousands), the ${dg} is worth ${F(v)}.` }); }
    const w = R(1, 9), a = R(1, 9), b = R(1, 9), which = R(0, 1), n = `${w}.${a}${b}`, v = which ? b / 100 : a / 10;
    return MQ({ lv, mc: true, q: `What is the ${which ? b : a} worth in ${n}?`, a: which ? `${b} hundredths` : `${a} tenths`, w: which ? [`${b} tenths`, `${b} tens`, `${b} ones`] : [`${a} hundredths`, `${a} tens`, `${a} ones`], why: `After the decimal point: first column = tenths, second = hundredths. So it's worth ${F(v)}.` });
  },
  addsub(lv) {
    const add = Math.random() < 0.5;
    const [a, b] = lv === 1 ? [R(11, 60), R(3, 29)] : lv === 2 ? [R(120, 800), R(35, 199)] : [R(100, 999), R(100, 499)];
    if (add) return MQ({ lv, q: `${a} + ${b} = ?`, a: a + b, w: [a + b + 10, a + b - 10, a + b + 1], why: `Add the ones, then the tens${lv > 1 ? ', then the hundreds' : ''}. Carry when a column goes over 9. ${a} + ${b} = ${a + b}.`, hint: 'Line them up in columns. Start with the ones.' });
    const [x, y] = a > b ? [a, b] : [b, a];
    return MQ({ lv, q: `${x} − ${y} = ?`, a: x - y, w: [x - y + 10, x - y - 10, x + y], why: `Take away column by column, starting with the ones. Borrow from the next column if you need to. ${x} − ${y} = ${x - y}. Check: ${x - y} + ${y} = ${x}.`, hint: 'Check a subtraction by adding back: answer + smaller number should = bigger number.' });
  },
  tables(lv) {
    const t = lv === 1 ? P([2, 5, 10, 3]) : lv === 2 ? P([3, 4, 6, 11]) : P([6, 7, 8, 9, 12]), n = R(2, 12);
    if (lv >= 2 && Math.random() < 0.35) return MQ({ lv, q: `${t * n} ÷ ${t} = ?`, a: n, w: [n + 1, n - 1, t], why: `Division is times tables backwards: ${n} × ${t} = ${t * n}, so ${t * n} ÷ ${t} = ${n}.`, hint: `What times ${t} makes ${t * n}?` });
    return MQ({ lv, q: `${n} × ${t} = ?`, a: n * t, w: [n * t + t, n * t - t, n * (t + 1), n + t], why: `${n} × ${t} = ${n * t}. ${t === 9 ? 'Nine trick: 10 × ' + n + ' = ' + n * 10 + ', take away ' + n + '.' : t === 5 ? 'Five trick: half of 10 × ' + n + '.' : t === 4 ? 'Four trick: double, then double again.' : t === 8 ? 'Eight trick: double, double, double.' : t === 11 ? 'Eleven trick: 10 × ' + n + ' + ' + n + '.' : 'Keep practising the ' + t + ' times table!'}`, hint: `Count up in ${t}s, or use a times-table fact you know.` });
  },
  tens(lv) {
    const p = lv === 1 ? P([10, 100]) : P([10, 100, 1000]), mult = lv === 1 ? true : Math.random() < 0.5;
    const n = lv === 1 ? R(2, 95) : lv === 2 ? (mult ? R(3, 99) / 10 : R(40, 980)) : R(12, 999) / 10;
    const a = mult ? n * p : n / p, zeros = String(p).length - 1;
    return MQ({ lv, q: `${F(n)} ${mult ? '×' : '÷'} ${F(p)} = ?`, a, w: [mult ? n * p * 10 : a * 10, mult ? n * p / 10 : a / 10, mult ? n + p : n - p], why: `${mult ? '×' : '÷'} ${p} moves every digit ${zeros} place${zeros > 1 ? 's' : ''} to the ${mult ? 'LEFT (bigger)' : 'RIGHT (smaller)'}. So ${F(n)} → ${F(a)}.`, hint: `${mult ? 'Multiplying' : 'Dividing'} by ${p}: the number gets ${mult ? 'bigger' : 'smaller'}. Move the digits ${zeros} place${zeros > 1 ? 's' : ''}.` });
  },
  round(lv) {
    if (lv === 1) { const n = R(11, 989); if (n % 10 === 0) return G.round(lv); const a = Math.round(n / 10) * 10;
      return MQ({ lv, q: `Round ${n} to the nearest 10.`, a, w: [a + 10, a - 10, Math.floor(n / 10) * 10 === a ? a + 10 : Math.floor(n / 10) * 10], why: `Look at the ones digit (${n % 10}). ${n % 10 >= 5 ? '5 or more → round UP' : '4 or less → round DOWN'}. So ${n} → ${a}.`, hint: 'Look at the digit after the one you round to. 5 or more: up. 4 or less: down.' }); }
    if (lv === 2) { const to = P([100, 1000]), n = to === 100 ? R(110, 9890) : R(1100, 98900); const a = Math.round(n / to) * to; if (n % to === 0) return G.round(lv);
      return MQ({ lv, q: `Round ${F(n)} to the nearest ${F(to)}.`, a, w: [a + to, a - to, Math.round(n / 10) * 10], why: `Look at the ${to === 100 ? 'tens' : 'hundreds'} digit. ${Math.floor(n / (to / 10)) % 10 >= 5 ? '5 or more → up' : '4 or less → down'}. ${F(n)} → ${F(a)}.` }); }
    const n = R(1001, 9999) / 100, a = Math.round(n * 10) / 10;
    return MQ({ lv, q: `Round ${n.toFixed(2)} to 1 decimal place.`, a, w: [Math.round(n), Math.floor(n * 10) / 10 === a ? a + 0.1 : Math.floor(n * 10) / 10], why: `1 decimal place = keep 1 digit after the point. Look at the 2nd digit after the point: ${n.toFixed(2).slice(-1)}. ${+n.toFixed(2).slice(-1) >= 5 ? 'Round up' : 'Round down'} → ${a.toFixed(1)}.`, hint: 'Keep one digit after the point, and look at the next digit to decide.' });
  },
  negatives(lv) {
    if (lv === 1) { const t = R(-6, 5), ch = R(2, 9), up = Math.random() < 0.5, a = up ? t + ch : t - ch;
      return MQ({ lv, pos: false, fmt: neg, q: `It is ${neg(t)}°C. The temperature ${up ? 'goes up' : 'drops'} by ${ch}°C. What is it now?`, a, unit: '°C', w: [up ? t - ch : t + ch, -a, a + 1], why: `Imagine a thermometer. Start at ${neg(t)} and move ${ch} ${up ? 'up' : 'down'}: you land on ${neg(a)}.`, hint: 'Picture a number line. Up = right, down = left.' }); }
    if (lv === 2) { const a = R(-9, 9), b = R(1, 9), op = P(['+', '−', '− −', '+ −']);
      const ans = op === '+' ? a + b : op === '−' ? a - b : op === '− −' ? a + b : a - b;
      const txt = op === '− −' ? `${neg(a)} − (−${b})` : op === '+ −' ? `${neg(a)} + (−${b})` : `${neg(a)} ${op} ${b}`;
      return MQ({ lv, pos: false, fmt: neg, q: `${txt} = ?`, a: ans, w: [-ans, op === '− −' || op === '+' ? a - b : a + b, ans + 1], why: op === '− −' ? `Two minuses next to each other make a plus: ${neg(a)} + ${b} = ${neg(ans)}.` : op === '+ −' ? `Plus a minus is the same as take away: ${neg(a)} − ${b} = ${neg(ans)}.` : `Use a number line from ${neg(a)}: ${neg(ans)}.`, hint: 'Two signs touching: same signs → +, different signs → −.' }); }
    const a = R(2, 9) * P([1, -1]), b = R(2, 9) * P([1, -1]), div = Math.random() < 0.4;
    const ans = div ? a : a * b, q = div ? `${neg(a * b)} ÷ ${b < 0 ? '(' + neg(b) + ')' : b} = ?` : `${neg(a)} × ${b < 0 ? '(' + neg(b) + ')' : b} = ?`;
    return MQ({ lv, pos: false, fmt: neg, q, a: ans, why: `Same signs → positive answer. Different signs → negative answer. So the answer is ${neg(ans)}.`, hint: 'Do the numbers first, then decide the sign: same signs = +, different = −.' });
  },
  bidmas(lv) {
    if (lv === 1) { const a = R(2, 9), b = R(2, 6), c = R(2, 6);
      return MQ({ lv, q: `${a} + ${b} × ${c} = ?`, a: a + b * c, w: [(a + b) * c, a + b + c], why: `BIDMAS: multiply before adding. ${b} × ${c} = ${b * c}, then ${a} + ${b * c} = ${a + b * c}.`, hint: 'Do × and ÷ before + and −.' }); }
    if (lv === 2) { const a = R(2, 9), b = R(2, 9), c = R(2, 5); if (Math.random() < 0.5)
        return MQ({ lv, q: `(${a} + ${b}) × ${c} = ?`, a: (a + b) * c, w: [a + b * c, a * c + b], why: `Brackets first: ${a} + ${b} = ${a + b}. Then × ${c} = ${(a + b) * c}.`, hint: 'B for Brackets comes first.' });
      const d = R(2, 6), e = d * R(2, 5), f = R(12, 30);
      return MQ({ lv, q: `${f} − ${e} ÷ ${d} = ?`, a: f - e / d, w: [(f - e) / d, f - e], pos: false, why: `Divide first: ${e} ÷ ${d} = ${e / d}. Then ${f} − ${e / d} = ${f - e / d}.` }); }
    const a = R(2, 9), b = R(2, 5), c = R(2, 4);
    return MQ({ lv, q: `${a} + ${b}² × ${c} = ?`, a: a + b * b * c, w: [(a + b) ** 2 * c, a + b * 2 * c], why: `Indices (powers) first: ${b}² = ${b * b}. Then × ${c} = ${b * b * c}. Then + ${a} = ${a + b * b * c}.`, hint: 'B, I (powers), then D M, then A S.' });
  },
  factors(lv) {
    if (lv === 1) { const t = P([2, 5, 10, 3]), yes = t * R(2, 12), no = [yes + 1, yes + 2, yes - 1].filter((x) => x % t);
      return MQ({ lv, mc: true, q: `Which number is a multiple of ${t}?`, a: yes, w: no, why: `${yes} = ${t} × ${yes / t}, so it's in the ${t} times table. Multiples = the times table.`, hint: t === 2 ? 'Multiples of 2 are even.' : t === 5 ? 'Multiples of 5 end in 0 or 5.' : t === 10 ? 'Multiples of 10 end in 0.' : 'Add the digits: multiples of 3 add up to a multiple of 3.' }); }
    if (lv === 2) { if (Math.random() < 0.5) { const n = P([12, 18, 20, 24, 30, 36, 40]), fs = []; for (let i = 2; i < n; i++) if (n % i === 0) fs.push(i); const f = P(fs), nf = [7, 9, 11, 13, 14, 16].filter((x) => n % x);
        return MQ({ lv, mc: true, q: `Which of these is a FACTOR of ${n}?`, a: f, w: nf, why: `${f} × ${n / f} = ${n}, so ${f} goes into ${n} exactly. Factors divide in with no remainder.`, hint: 'A factor goes INTO the number exactly.' }); }
      const pr = P([2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37]), np = P([9, 15, 21, 27, 33, 39, 49, 51, 1]);
      return MQ({ lv, mc: true, q: 'Which of these is a PRIME number?', a: pr, w: [np, P([4, 6, 8, 10, 12, 14]), P([25, 35, 45, 57])], why: `${pr} has exactly 2 factors: 1 and itself. ${np === 1 ? '1 is NOT prime (only 1 factor).' : np + ' is not prime — it divides by ' + [3, 5, 7, 17].find((x) => np % x === 0) + '.'}`, hint: 'A prime has exactly two factors: 1 and itself. 1 is not prime!' }); }
    const [a, b] = P([[12, 18], [8, 12], [15, 20], [6, 9], [16, 24], [10, 25], [14, 21]]), hcf = gcd(a, b), lcm = a * b / hcf, h = Math.random() < 0.5;
    return MQ({ lv, q: h ? `What is the HCF (highest common factor) of ${a} and ${b}?` : `What is the LCM (lowest common multiple) of ${a} and ${b}?`, a: h ? hcf : lcm, why: h ? `Factors of ${a} and ${b} — the biggest one in both lists is ${hcf}.` : `Multiples of ${a}: ${a}, ${2 * a}, ${3 * a}… Multiples of ${b}: ${b}, ${2 * b}, ${3 * b}… The first one in both is ${lcm}.`, hint: h ? 'List the factors of both. Find the biggest one they share.' : 'List the times tables of both. Find the first one they share.' });
  },
  powers(lv) {
    if (lv === 1) { const n = R(1, 10); return MQ({ lv, q: `${n}² = ?  (${n} squared)`, a: n * n, w: [n * 2, n + 2, n * n + n], why: `Squared means times by itself: ${n} × ${n} = ${n * n}. NOT ${n} × 2!`, hint: `${n}² means ${n} × ${n}.` }); }
    if (lv === 2) { if (Math.random() < 0.5) { const n = R(2, 12); return MQ({ lv, q: `√${n * n} = ?  (square root)`, a: n, w: [n * n / 2, n + 1, n - 1], why: `Square root is the opposite of squaring. ${n} × ${n} = ${n * n}, so √${n * n} = ${n}.`, hint: 'What number times itself makes this?' }); }
      const n = P([2, 3, 4, 5, 10]); return MQ({ lv, q: `${n}³ = ?  (${n} cubed)`, a: n ** 3, w: [n * 3, n * n, n ** 3 + n], why: `Cubed = times by itself 3 times: ${n} × ${n} × ${n} = ${n ** 3}.`, hint: `${n}³ = ${n} × ${n} × ${n}` }); }
    const t = R(0, 2);
    if (t === 0) { const n = R(11, 15); return MQ({ lv, q: `${n}² = ?`, a: n * n, why: `${n} × ${n} = ${n * n}. Learn the squares up to 15² = 225.` }); }
    if (t === 1) { const n = P([2, 3, 4, 5, 10]); return MQ({ lv, q: `∛${n ** 3} = ?  (cube root)`, a: n, why: `${n} × ${n} × ${n} = ${n ** 3}, so the cube root is ${n}.` }); }
    const a = R(2, 6), b = R(2, 5); return MQ({ lv, q: `${a}² + ${b}² = ?`, a: a * a + b * b, why: `${a}² = ${a * a} and ${b}² = ${b * b}. Add: ${a * a + b * b}.` });
  },

  /* ---------- B. Fractions, decimals, percentages ---------- */
  fracs(lv) {
    if (lv === 1) { const d = R(3, 8), n = R(1, d - 1);
      return MQ({ lv, mc: true, q: `What fraction is purple?\n${boxes(n, d)}`, a: `${n}/${d}`, w: [`${d - n}/${d}`, `${n}/${d - n}`, `${d}/${n}`].filter((x) => x !== `${n}/${d}`), why: `Count the purple squares (${n}) → top number. Count ALL the squares (${d}) → bottom number. So ${n}/${d}.`, hint: 'Top = how many shaded. Bottom = how many altogether.' }); }
    if (lv === 2) { const b = P([[1, 2], [1, 3], [2, 3], [1, 4], [3, 4], [2, 5], [3, 5], [1, 5]]), k = R(2, 6), n = b[0] * k, d = b[1] * k;
      return MQ({ lv, mc: true, q: `Simplify ${n}/${d}`, a: `${b[0]}/${b[1]}`, w: [`${n / 2 | 0 || 1}/${d}`, `${b[1]}/${b[0]}`, `${b[0] + 1}/${b[1] + 1}`, `${n - 1}/${d - 1}`].filter((x) => x !== `${b[0]}/${b[1]}`), why: `Divide top AND bottom by ${k}: ${n} ÷ ${k} = ${b[0]}, ${d} ÷ ${k} = ${b[1]}. So ${b[0]}/${b[1]}.`, hint: 'Find a number that goes into BOTH the top and the bottom.' }); }
    const b = P([[1, 2], [2, 3], [3, 4], [2, 5], [3, 5], [4, 5], [5, 6], [3, 8]]), k = R(2, 8);
    return MQ({ lv, q: `${b[0]}/${b[1]} = ?/${b[1] * k}   What number goes on top?`, a: b[0] * k, why: `The bottom was × ${k} (${b[1]} → ${b[1] * k}), so the top is × ${k} too: ${b[0]} × ${k} = ${b[0] * k}.`, hint: `What did the bottom get multiplied by? Do the same to the top.` });
  },
  fracof(lv) {
    if (lv === 1) { const d = P([2, 4, 2, 10]), a = R(2, 12), n = a * d;
      return MQ({ lv, q: `${d === 2 ? 'Half' : d === 4 ? 'A quarter' : 'One tenth'} of ${n} = ?`, a, w: [n - a, a * 2, n * 2], why: `${d === 2 ? 'Half' : d === 4 ? 'A quarter' : 'A tenth'} means ÷ ${d}. ${n} ÷ ${d} = ${a}.`, hint: `Divide by ${d}.` }); }
    const d = lv === 2 ? P([3, 5, 10, 4]) : P([3, 4, 5, 8, 10]), num = lv === 2 ? 1 : R(2, d - 1), unit = R(2, 12), n = d * unit, a = unit * num;
    if (num > 1 && gcd(num, d) > 1) return G.fracof(lv);
    return MQ({ lv, pre: lv === 3 && Math.random() < 0.5 ? '£' : '', q: `${num}/${d} of ${lv === 3 && Math.random() < 0.5 ? '£' + n : n} = ?`, a, w: [unit, n / num, a + unit], why: `Divide by the bottom, times by the top. ${n} ÷ ${d} = ${unit}${num > 1 ? `, then × ${num} = ${a}` : ''}.`, hint: '"Divide by the bottom, times by the top."' });
  },
  percent(lv) {
    const p = lv === 1 ? P([50, 10]) : lv === 2 ? P([25, 20, 5, 75]) : P([15, 35, 30, 45, 12, 60]);
    const n = lv === 1 ? R(2, 20) * 10 : lv === 2 ? R(2, 20) * 20 : R(2, 20) * 20;
    const a = n * p / 100, ten = n / 10;
    const how = { 50: `50% = half. ${n} ÷ 2 = ${F(a)}.`, 10: `10% = ÷ 10. ${n} ÷ 10 = ${F(a)}.`, 25: `25% = a quarter. ${n} ÷ 4 = ${F(a)}.`, 75: `75% = 3 quarters. ${n} ÷ 4 = ${F(n / 4)}, × 3 = ${F(a)}.`, 20: `10% = ${F(ten)}, so 20% = ${F(ten)} × 2 = ${F(a)}.`, 5: `10% = ${F(ten)}, so 5% = half of that = ${F(a)}.`, 15: `10% = ${F(ten)}, 5% = ${F(ten / 2)}. 15% = ${F(ten)} + ${F(ten / 2)} = ${F(a)}.`, 35: `10% = ${F(ten)} → 30% = ${F(ten * 3)}. 5% = ${F(ten / 2)}. Total ${F(a)}.`, 30: `10% = ${F(ten)}, × 3 = ${F(a)}.`, 45: `10% = ${F(ten)} → 40% = ${F(ten * 4)}. 5% = ${F(ten / 2)}. Total ${F(a)}.`, 12: `10% = ${F(ten)}, 1% = ${F(n / 100)} → 2% = ${F(n / 50)}. 12% = ${F(a)}.`, 60: `10% = ${F(ten)}, × 6 = ${F(a)}.` };
    return MQ({ lv, pre: '£', q: `Find ${p}% of £${n}.`, a, w: [a * 2, ten, n - a, p], fmt: (x) => (Math.round(x * 100) % 100 ? (Math.round(x * 100) / 100).toFixed(2) : F(x)), why: how[p], hint: 'Start with 10% (divide by 10). Build the rest from that.' });
  },
  fdp(lv) {
    const bank = lv === 1 ? [['1/2', '0.5', '50%'], ['1/4', '0.25', '25%'], ['1/10', '0.1', '10%'], ['3/4', '0.75', '75%']]
      : lv === 2 ? [['1/5', '0.2', '20%'], ['3/10', '0.3', '30%'], ['2/5', '0.4', '40%'], ['1/100', '0.01', '1%'], ['3/4', '0.75', '75%'], ['7/10', '0.7', '70%']]
        : [['3/5', '0.6', '60%'], ['0.35', '0.35', '35%'], ['1/8', '0.125', '12.5%'], ['9/20', '0.45', '45%'], ['4/5', '0.8', '80%'], ['0.05', '0.05', '5%']];
    const r = P(bank), from = R(0, 2), to = (from + R(1, 2)) % 3;
    if (r[0] === r[1] && (from === 0 || to === 0)) return G.fdp(lv);
    const names = ['fraction', 'decimal', 'percentage'];
    const others = bank.filter((x) => x !== r).map((x) => x[to]);
    const trick = to === 1 ? [r[2].replace('%', ''), '0.0' + r[2].replace('%', '').replace('.', '')] : to === 2 ? [r[1] + '%', F(parseFloat(r[1]) * 10) + '%'] : [];
    return MQ({ lv, mc: true, q: `Write ${r[from]} as a ${names[to]}.`, a: r[to], w: shuffleData(trick.concat(others)).filter((x) => x !== r[to]), why: `${r[0]} = ${r[1]} = ${r[2]}. Decimal → % : × 100. % → decimal : ÷ 100.`, hint: 'Percent means "out of 100".' });
  },
  money(lv) {
    if (lv === 1) { const note = P([5, 10, 20]), cost = R(105, note * 100 - 50) / 100;
      return MQ({ lv, pre: '£', fmt: (x) => x.toFixed(2), q: `You buy something for £${cost.toFixed(2)} and pay with a £${note} note. How much change?`, a: Math.round((note - cost) * 100) / 100, w: [Math.round((note - cost) * 100) / 100 + 1, Math.round((note - cost - 0.1) * 100) / 100], why: `Change = what you paid − the cost. £${note} − £${cost.toFixed(2)} = £${(note - cost).toFixed(2)}. Check by counting up from £${cost.toFixed(2)}.`, hint: 'Count up from the price to the note.' }); }
    if (lv === 2) { const h = R(8, 16), m = P([0, 15, 20, 30, 40, 45]), dur = P([25, 35, 40, 45, 50, 55, 70, 85]); const end = h * 60 + m + dur, eh = Math.floor(end / 60), em = end % 60;
      const t = (H, M) => `${String(H).padStart(2, '0')}:${String(M).padStart(2, '0')}`;
      return MQ({ lv, q: `A film starts at ${t(h, m)} and ends at ${t(eh, em)}. How many minutes long is it?`, a: dur, unit: 'minutes', w: [dur + 40, dur - 10, eh * 100 + em - (h * 100 + m)], why: `Count up: ${t(h, m)} → ${t(h + (m ? 1 : 0), 0)} is ${m ? 60 - m : 0} min, then on to ${t(eh, em)}. Total ${dur} minutes. (Don't take away times like normal numbers — an hour is 60 min, not 100!)`, hint: 'Count up to the next o\'clock first, then add the rest.' }); }
    const a = R(2, 6), pa = R(30, 90) / 100 * 10, b = R(3, 8); const tot = Math.round((a * pa + b * 0.85) * 100) / 100;
    return MQ({ lv, pre: '£', fmt: (x) => x.toFixed(2), q: `Pens cost £${pa.toFixed(2)} each and rulers cost 85p each. How much for ${a} pens and ${b} rulers?`, a: tot, why: `${a} × £${pa.toFixed(2)} = £${(a * pa).toFixed(2)}. ${b} × £0.85 = £${(b * 0.85).toFixed(2)}. Add: £${tot.toFixed(2)}.`, hint: 'Work out each item separately, then add. 85p = £0.85.', tol: 0.005 });
  },

  /* ---------- C. Algebra ---------- */
  subst(lv) {
    if (lv === 1) { const m = R(2, 5), ad = R(1, 9), x = R(1, 10);
      return MQ({ lv, q: `Function machine: IN → × ${m} → + ${ad} → OUT.\nThe input is ${x}. What comes out?`, a: x * m + ad, w: [(x + ad) * m, x + m + ad], why: `Follow the arrows in order: ${x} × ${m} = ${x * m}, then + ${ad} = ${x * m + ad}.`, hint: 'Do the steps in the order the arrows go.' }); }
    if (lv === 2) { const a = R(2, 6), b = R(2, 9), k = R(2, 5);
      return MQ({ lv, q: `If a = ${a} and b = ${b}, work out ${k}a + b.`, a: k * a + b, w: [Number(String(k) + a) + b, k * (a + b), k + a + b], why: `${k}a means ${k} × a = ${k} × ${a} = ${k * a}. Then + b: ${k * a} + ${b} = ${k * a + b}.`, hint: `${k}a means ${k} × a (not ${k}${a}!).` }); }
    if (Math.random() < 0.5) { const m = R(2, 6), ad = R(1, 9), out = R(2, 10) * m + ad;
      return MQ({ lv, q: `IN → × ${m} → + ${ad} → OUT.\nThe OUTPUT is ${out}. What was the input?`, a: (out - ad) / m, why: `Work backwards with the opposite steps: ${out} − ${ad} = ${out - ad}, then ÷ ${m} = ${(out - ad) / m}.`, hint: 'Go backwards: undo + with −, undo × with ÷.' }); }
    const x = R(-5, -1), y = R(2, 6);
    return MQ({ lv, q: `If x = ${neg(x)} and y = ${y}, work out 3x + 2y.`, a: 3 * x + 2 * y, why: `3 × (${neg(x)}) = ${neg(3 * x)}. 2 × ${y} = ${2 * y}. ${neg(3 * x)} + ${2 * y} = ${neg(3 * x + 2 * y)}.`, hint: 'Put the numbers in brackets. Careful with the minus!' });
  },
  simplify(lv) {
    const L = P(['a', 'x', 'y', 'm', 'p']), L2 = L === 'y' ? 'x' : 'y';
    if (lv === 1) { const n = R(2, 5);
      return MQ({ lv, mc: true, q: `Simplify: ${Array(n).fill(L).join(' + ')}`, a: `${n}${L}`, w: [`${L}${n}`, `${L}^${n}`, `${n + 1}${L}`], why: `${n} lots of ${L} = ${n}${L}. (We write the number first.)`, hint: `How many ${L}'s are there?` }); }
    if (lv === 2) { const a = R(2, 7), b = R(1, 5), c = R(2, 6), d = R(1, 4);
      const x = a + b, y = c - d;
      const ans = `${x}${L} ${y >= 0 ? '+' : '−'} ${Math.abs(y) === 1 ? '' : Math.abs(y)}${L2}`;
      return MQ({ lv, mc: true, q: `Simplify: ${a}${L} + ${c}${L2} + ${b}${L} − ${d}${L2}`, a: ans, w: [`${a + b + c - d}${L}${L2}`, `${x}${L} + ${c + d}${L2}`, `${a + c}${L} + ${b - d}${L2}`].filter((s) => s !== ans), why: `Collect like terms. ${L}'s: ${a} + ${b} = ${x}${L}. ${L2}'s: ${c} − ${d} = ${y}${L2}. Answer: ${ans}.`, hint: `Group the ${L}'s together and the ${L2}'s together.` }); }
    const a = R(2, 6), b = R(2, 6);
    if (Math.random() < 0.5) return MQ({ lv, mc: true, q: `Simplify: ${a}${L} × ${b}${L2}`, a: `${a * b}${L}${L2}`, w: [`${a + b}${L}${L2}`, `${a}${b}${L}${L2}`, `${a * b}${L} + ${L2}`], why: `Multiply the numbers (${a} × ${b} = ${a * b}) and write the letters together: ${a * b}${L}${L2}.` });
    return MQ({ lv, mc: true, q: `Simplify: ${L} × ${L} × ${a}`, a: `${a}${L}²`, w: [`${a + 2}${L}`, `${a}${L}2`, `2${a}${L}`], why: `${L} × ${L} = ${L}². Number goes first: ${a}${L}².` });
  },
  equations(lv) {
    const x = R(2, 12);
    if (lv === 1) { const b = R(2, 15), t = Math.random() < 0.5;
      return MQ({ lv, q: t ? `Solve: x + ${b} = ${x + b}` : `Solve: x − ${b} = ${x}`.replace(`= ${x}`, `= ${x}`), a: t ? x : x + b, w: t ? [x + 2 * b, x + b, b] : [x, x - b, b], pre: 'x = ', why: t ? `Do the opposite: take ${b} from both sides. x = ${x + b} − ${b} = ${x}.` : `Do the opposite: add ${b} to both sides. x = ${x} + ${b} = ${x + b}.`, hint: 'Do the OPPOSITE to get x on its own.' }); }
    if (lv === 2) { const a = R(2, 6), b = R(1, 12);
      return MQ({ lv, q: `Solve: ${a}x + ${b} = ${a * x + b}`, a: x, pre: 'x = ', w: [(a * x + b + b) / a, a * x, x + b], why: `Step 1: − ${b} from both sides → ${a}x = ${a * x}. Step 2: ÷ ${a} → x = ${x}.`, hint: 'Undo the + first, then undo the ×.' }); }
    if (Math.random() < 0.5) { const a = R(2, 7), b = R(1, 12);
      return MQ({ lv, q: `Solve: ${a}x − ${b} = ${a * x - b}`, a: x, pre: 'x = ', why: `+ ${b} both sides → ${a}x = ${a * x}. ÷ ${a} → x = ${x}.`, hint: 'Undo the − first (add), then divide.' }); }
    const a = R(2, 5), b = R(1, 6);
    return MQ({ lv, q: `Solve: ${a}(x + ${b}) = ${a * (x + b)}`, a: x, pre: 'x = ', why: `÷ ${a} both sides → x + ${b} = ${x + b}. − ${b} → x = ${x}.`, hint: 'Divide both sides by the number outside the bracket first.' });
  },
  sequences(lv) {
    if (lv === 1) { const s = R(1, 20), d = R(2, 10), t = [0, 1, 2, 3].map((i) => s + i * d);
      return MQ({ lv, q: `What comes next?\n${t.join(',  ')},  …`, a: s + 4 * d, w: [s + 3 * d + d + 1, s + 5 * d, t[3] + 1], why: `It goes up by ${d} each time. ${t[3]} + ${d} = ${s + 4 * d}.`, hint: 'What is added each time?' }); }
    if (lv === 2) { const s = R(30, 60), d = R(3, 9), t = [0, 1, 2, 3].map((i) => s - i * d);
      if (Math.random() < 0.5) return MQ({ lv, mc: true, q: `What is the term-to-term rule?\n${t.join(',  ')}`, a: `Subtract ${d}`, w: [`Add ${d}`, `Subtract ${d + 1}`, `Divide by ${d}`], why: `Each term is ${d} less than the one before.` });
      return MQ({ lv, q: `What comes next?\n${t.join(',  ')},  …`, a: s - 4 * d, w: [s - 3 * d + d, s - 5 * d], pos: false, why: `It goes DOWN by ${d}. ${t[3]} − ${d} = ${s - 4 * d}.` }); }
    const d = R(2, 7), c = R(-3, 6), t = [1, 2, 3, 4].map((n) => d * n + c);
    if (Math.random() < 0.5) return MQ({ lv, mc: true, q: `Find the nth term rule:\n${t.join(',  ')}`, a: `${d}n ${c >= 0 ? '+ ' + c : '− ' + -c}`, w: [`${c + d}n + ${d}`, `n + ${d}`, `${d}n`, `${d}n ${c >= 0 ? '− ' + c : '+ ' + -c}`].filter((x) => x !== `${d}n ${c >= 0 ? '+ ' + c : '− ' + -c}`), why: `It goes up by ${d}, so start with ${d}n (${d}, ${2 * d}, ${3 * d}…). Compare: ${t[0]} − ${d} = ${c}. So ${d}n ${c >= 0 ? '+ ' + c : '− ' + -c}.`, hint: 'The jump size goes in front of n. Then fix it to match the first term.' });
    const n = R(8, 20);
    return MQ({ lv, q: `The nth term is ${d}n ${c >= 0 ? '+ ' + c : '− ' + -c}. What is term number ${n}?`, a: d * n + c, why: `Put n = ${n}: ${d} × ${n} = ${d * n}, ${c >= 0 ? '+ ' + c : '− ' + -c} = ${d * n + c}.`, hint: `Replace n with ${n}.` });
  },
  brackets(lv) {
    const a = R(2, 6), b = R(1, 9), L = P(['x', 'a', 'y']);
    if (lv === 1) return MQ({ lv, mc: true, q: `Expand: ${a}(${L} + ${b})`, a: `${a}${L} + ${a * b}`, w: [`${a}${L} + ${b}`, `${L} + ${a * b}`, `${a + b}${L}`], why: `Multiply EVERYTHING inside by ${a}: ${a} × ${L} = ${a}${L}, ${a} × ${b} = ${a * b}.`, hint: 'The number outside multiplies every term inside.' });
    if (lv === 2) { const c = R(2, 5);
      return MQ({ lv, mc: true, q: `Expand: ${a}(${c}${L} − ${b})`, a: `${a * c}${L} − ${a * b}`, w: [`${a * c}${L} − ${b}`, `${a + c}${L} − ${a * b}`, `${a * c}${L} + ${a * b}`], why: `${a} × ${c}${L} = ${a * c}${L}. ${a} × ${b} = ${a * b}. Keep the minus: ${a * c}${L} − ${a * b}.` }); }
    if (Math.random() < 0.5) { const k = R(2, 5), p = R(2, 5), q2 = R(1, 7); if (gcd(p, q2) !== 1) return G.brackets(lv);
      return MQ({ lv, mc: true, q: `Factorise: ${k * p}${L} + ${k * q2}`, a: `${k}(${p}${L} + ${q2})`, w: [`${k * p}(${L} + ${k * q2})`, `${k}(${p}${L} + ${k * q2})`, `${p}(${k}${L} + ${q2})`], why: `The biggest number that goes into ${k * p} and ${k * q2} is ${k}. Put it outside: ${k}(${p}${L} + ${q2}). Check by expanding!`, hint: 'Factorising is expanding backwards. What goes into both numbers?' }); }
    return MQ({ lv, mc: true, q: `Expand: ${L}(${L} + ${b})`, a: `${L}² + ${b}${L}`, w: [`${L}² + ${b}`, `2${L} + ${b}${L}`, `${L} + ${b}${L}`], why: `${L} × ${L} = ${L}². ${L} × ${b} = ${b}${L}. So ${L}² + ${b}${L}.` });
  },

  /* ---------- D. Shape & measures ---------- */
  angles(lv) {
    if (lv === 1) { if (Math.random() < 0.4) { const a = P([35, 90, 120, 200, 180, 75, 150, 300]), n = a < 90 ? 'Acute' : a === 90 ? 'Right angle' : a < 180 ? 'Obtuse' : a === 180 ? 'Straight line' : 'Reflex';
        return MQ({ lv, mc: true, q: `What type of angle is ${a}°?`, a: n, w: ['Acute', 'Obtuse', 'Reflex', 'Right angle'].filter((x) => x !== n), why: 'Acute: less than 90°. Right: exactly 90°. Obtuse: 90°–180°. Reflex: more than 180°.', hint: 'Is it smaller than 90°? Between 90° and 180°? Bigger than 180°?' }); }
      const a = R(20, 160); return MQ({ lv, q: `Two angles sit on a straight line. One is ${a}°. What is the other?`, a: 180 - a, unit: '°', w: [360 - a, 90 - a > 0 ? 90 - a : a + 10, 180 + a - 2 * a + 10], why: `Angles on a straight line add up to 180°. 180 − ${a} = ${180 - a}°.`, hint: 'Straight line = 180°.' }); }
    if (lv === 2) { if (Math.random() < 0.5) { const a = R(30, 80), b = R(30, 80);
        return MQ({ lv, q: `A triangle has angles ${a}° and ${b}°. What is the third angle?`, a: 180 - a - b, unit: '°', w: [360 - a - b, a + b, 90 - Math.abs(a - b)], why: `Angles in a triangle add to 180°. ${a} + ${b} = ${a + b}. 180 − ${a + b} = ${180 - a - b}°.`, hint: 'Triangle angles add up to 180°.' }); }
      const a = R(60, 150), b = R(60, 150); return MQ({ lv, q: `Three angles meet at a point: ${a}°, ${b}° and x. Find x.`, a: 360 - a - b, unit: '°', w: [180 - a - b + 360 - 180 + 10, a + b], why: `Angles around a point add up to 360°. 360 − ${a} − ${b} = ${360 - a - b}°.`, hint: 'All the way round = 360°.' }); }
    const t = R(0, 2);
    if (t === 0) { const top = R(20, 100); return MQ({ lv, q: `An isosceles triangle has a top angle of ${top}°. The two base angles are equal. What is ONE base angle?`, a: (180 - top) / 2, unit: '°', why: `180 − ${top} = ${180 - top}. Split between 2 equal angles: ${180 - top} ÷ 2 = ${(180 - top) / 2}°.`, hint: 'Take the top angle from 180, then halve it.' }); }
    if (t === 1) { const a = R(60, 120), b = R(60, 120), c = R(60, 110); if (a + b + c >= 340) return G.angles(lv);
      return MQ({ lv, q: `A quadrilateral has angles ${a}°, ${b}° and ${c}°. What is the fourth angle?`, a: 360 - a - b - c, unit: '°', why: `Angles in a quadrilateral add to 360°. 360 − ${a + b + c} = ${360 - a - b - c}°.`, hint: '4-sided shapes: angles add to 360°.' }); }
    const a = R(25, 155); return MQ({ lv, q: `Two straight lines cross. One angle is ${a}°. What is the angle vertically OPPOSITE it?`, a, unit: '°', why: 'Vertically opposite angles are equal — they are the same size.', hint: 'Opposite angles in an X are equal.' });
  },
  shapes(lv) {
    const S = [['Triangle', 3], ['Quadrilateral', 4], ['Pentagon', 5], ['Hexagon', 6], ['Heptagon', 7], ['Octagon', 8], ['Decagon', 10]];
    if (lv === 1) { const [n, s] = P(S.slice(0, 6)); return MQ({ lv, q: `How many sides does a ${n.toLowerCase()} have?`, a: s, w: [s + 1, s - 1, s + 2], why: `A ${n.toLowerCase()} has ${s} sides. ${{ 3: 'Tri = 3 (like tricycle).', 4: 'Quad = 4.', 5: 'Pent = 5 (like the Pentagon building).', 6: 'Hex = 6 (think "six" and "hex" both have an x).', 7: 'Hept = 7.', 8: 'Oct = 8 (like an octopus).' }[s]}`, hint: 'The start of the word gives it away!' }); }
    const F2 = [
      ['Which shape has 4 equal sides and 4 right angles?', 'Square', ['Rhombus', 'Rectangle', 'Kite'], 'A square: 4 equal sides AND 4 right angles. A rhombus has 4 equal sides but no right angles.'],
      ['Which shape has 2 pairs of parallel sides, but no right angles?', 'Parallelogram', ['Trapezium', 'Kite', 'Square'], 'A parallelogram is like a pushed-over rectangle: 2 pairs of parallel sides.'],
      ['Which shape has exactly ONE pair of parallel sides?', 'Trapezium', ['Parallelogram', 'Rhombus', 'Rectangle'], 'A trapezium has exactly one pair of parallel sides.'],
      ['Which triangle has all 3 sides the same length?', 'Equilateral', ['Isosceles', 'Scalene', 'Right-angled'], 'Equilateral = all sides equal (and all angles 60°).'],
      ['Which triangle has exactly 2 equal sides?', 'Isosceles', ['Equilateral', 'Scalene', 'Obtuse'], 'Isosceles = 2 equal sides and 2 equal angles.'],
      ['Which triangle has NO equal sides?', 'Scalene', ['Isosceles', 'Equilateral', 'Regular'], 'Scalene = all sides different.'],
      ['How many lines of symmetry does a rectangle have?', '2', ['4', '1', '0'], 'A rectangle folds in half 2 ways (not along the diagonals!).'],
      ['How many lines of symmetry does a square have?', '4', ['2', '1', '8'], 'A square: 2 through the middles of the sides + 2 diagonals = 4.'],
      ['What do we call a shape with all sides and all angles equal?', 'Regular', ['Irregular', 'Parallel', 'Congruent'], 'Regular polygons have all sides equal and all angles equal.'],
      ['How many faces does a cube have?', '6', ['8', '12', '4'], 'A cube has 6 faces, 12 edges and 8 vertices (corners).'],
    ];
    const pool = lv === 2 ? F2.slice(0, 6) : F2;
    const [q, a, w, why] = P(pool); return { t: 'mc', q, a, w, why };
  },
  area(lv) {
    if (lv === 1) { const w = R(2, 9), h = R(2, 9), per = Math.random() < 0.5;
      return MQ({ lv, q: `A rectangle is ${w} cm long and ${h} cm wide. What is its ${per ? 'PERIMETER' : 'AREA'}?`, a: per ? 2 * (w + h) : w * h, unit: per ? 'cm' : 'cm²', w: per ? [w * h, w + h] : [2 * (w + h), w + h], why: per ? `Perimeter = distance all the way round: ${w} + ${h} + ${w} + ${h} = ${2 * (w + h)} cm.` : `Area = length × width = ${w} × ${h} = ${w * h} cm².`, hint: per ? 'Perimeter: add up ALL the sides (there are 4!).' : 'Area of a rectangle = length × width.' }); }
    if (lv === 2) { const b = R(2, 10) * 2, h = R(3, 12);
      return MQ({ lv, q: `A triangle has base ${b} cm and height ${h} cm. What is its area?`, a: b * h / 2, unit: 'cm²', w: [b * h, b + h, b * h * 2], why: `Area of a triangle = ½ × base × height = ${b} × ${h} ÷ 2 = ${b * h / 2} cm². (A triangle is half a rectangle!)`, hint: 'Triangle = half of base × height.' }); }
    const a = R(3, 9), b = a + R(2, 7), h = R(2, 8) * 2;
    return MQ({ lv, q: `A trapezium has parallel sides ${a} cm and ${b} cm, and height ${h} cm. Find the area.\n(The exam formula sheet gives: ½(a + b)h)`, a: (a + b) * h / 2, unit: 'cm²', why: `Add the parallel sides: ${a} + ${b} = ${a + b}. Times the height: ${(a + b) * h}. Halve: ${(a + b) * h / 2} cm².`, hint: 'Add the two parallel sides, × height, ÷ 2.' });
  },
  units(lv) {
    const C = lv === 1 ? [['m', 'cm', 100], ['kg', 'g', 1000], ['cm', 'mm', 10]] : lv === 2 ? [['km', 'm', 1000], ['l', 'ml', 1000], ['m', 'cm', 100], ['kg', 'g', 1000]] : [['hours', 'minutes', 60], ['km', 'm', 1000], ['l', 'ml', 1000], ['m', 'mm', 1000]];
    const [big, small, k] = P(C), up = lv === 1 ? true : Math.random() < 0.5;
    const n = lv === 1 ? R(2, 9) : lv === 2 ? (up ? R(15, 95) / 10 : R(2, 95) * (k / 10)) : (big === 'hours' ? P([1.5, 2.5, 0.25, 0.75, 3.5]) : R(125, 4750) / 100);
    const a = up ? n * k : n / k;
    return MQ({ lv, q: `${F(n)} ${up ? big : small} = ? ${up ? small : big}`, a, unit: up ? small : big, w: [up ? n * k / 10 : n / k * 10, up ? n * k * 10 : n / k / 10, up ? n + k : n * k], why: `1 ${big} = ${k} ${small}. Going to ${up ? 'smaller units → × ' + k : 'bigger units → ÷ ' + k}. ${F(n)} ${up ? '×' : '÷'} ${k} = ${F(a)}.`, hint: `1 ${big} = ${k} ${small}.` });
  },
  circles(lv) {
    if (lv === 1) { if (Math.random() < 0.5) { const r = R(2, 15); return MQ({ lv, q: `A circle has a radius of ${r} cm. What is its diameter?`, a: 2 * r, unit: 'cm', w: [r / 2, r * r, r + 2], why: 'Diameter = 2 × radius (all the way across). Radius = centre to the edge.', hint: 'The diameter goes all the way across — it\'s two radiuses.' }); }
      const [q, a, w, why] = P([['The distance all the way round a circle is called the…', 'Circumference', ['Diameter', 'Radius', 'Area'], 'Circumference = the perimeter of a circle.'], ['A line from the centre to the edge of a circle is the…', 'Radius', ['Diameter', 'Chord', 'Arc'], 'Radius: centre → edge.'], ['A line straight across a circle through the centre is the…', 'Diameter', ['Radius', 'Tangent', 'Sector'], 'Diameter: edge → edge through the centre.'], ['A "slice of pizza" part of a circle is a…', 'Sector', ['Segment', 'Chord', 'Tangent'], 'Sector = pizza slice. Segment = the bit cut off by a chord.']]);
      return { t: 'mc', q, a, w, why }; }
    const r = R(2, 12), dia = Math.random() < 0.5;
    if (lv === 2) { const c = Math.round((dia ? Math.PI * 2 * r : 2 * Math.PI * r) * 10) / 10;
      return MQ({ lv, q: `${dia ? 'Diameter' : 'Radius'} = ${dia ? 2 * r : r} cm. Find the circumference to 1 decimal place. (Use the π button.)`, a: c, unit: 'cm', fmt: (x) => x.toFixed(1), w: [Math.round(Math.PI * r * r * 10) / 10, Math.round(Math.PI * r * 10) / 10, c + 1], why: `Circumference = π × diameter = π × ${2 * r} = ${c.toFixed(1)} cm. (Given on the formula sheet: C = πd.)`, hint: 'C = π × d. If you have the radius, double it first.' }); }
    const A = Math.round(Math.PI * r * r * 10) / 10;
    return MQ({ lv, q: `A circle has radius ${r} cm. Find its area to 1 decimal place.`, a: A, unit: 'cm²', tol: 0.15, why: `Area = π × r² = π × ${r} × ${r} = ${A.toFixed(1)} cm². (Formula sheet: A = πr².)`, hint: 'Square the radius FIRST, then × π.' });
  },
  volume(lv) {
    if (lv <= 2) { const a = R(2, lv === 1 ? 5 : 9), b = R(2, lv === 1 ? 5 : 9), c = R(2, lv === 1 ? 4 : 10);
      return MQ({ lv, q: `A cuboid is ${a} cm × ${b} cm × ${c} cm. What is its volume?`, a: a * b * c, unit: 'cm³', w: [a + b + c, a * b + c, 2 * (a * b + b * c + a * c)], why: `Volume of a cuboid = length × width × height = ${a} × ${b} × ${c} = ${a * b * c} cm³.`, hint: 'Multiply all three measurements.' }); }
    const A = R(5, 30), L = R(3, 12);
    return MQ({ lv, q: `A prism has a cross-section area of ${A} cm² and a length of ${L} cm. Find the volume.\n(Formula sheet: volume = area of cross-section × length)`, a: A * L, unit: 'cm³', why: `${A} × ${L} = ${A * L} cm³.`, hint: 'Area of the end face × how long it is.' });
  },
  pythag(lv) {
    if (lv === 1) { const [q, a, w, why] = P([['In a right-angled triangle, the longest side is called the…', 'Hypotenuse', ['Diagonal', 'Radius', 'Perimeter'], 'The hypotenuse is always the longest side, opposite the right angle.'], ['Where is the hypotenuse?', 'Opposite the right angle', ['Next to the right angle', 'At the bottom', 'The shortest side'], 'The hypotenuse is opposite (across from) the right angle.'], ['Pythagoras only works on…', 'Right-angled triangles', ['All triangles', 'Circles', 'Squares'], 'You need a 90° angle for Pythagoras.'], ['Pythagoras: a² + b² = …', 'c²', ['c', '2c', 'ab'], 'a² + b² = c², where c is the hypotenuse. (It\'s on the formula sheet.)']]);
      return { t: 'mc', q, a, w, why }; }
    if (lv === 2) { const [a, b, c] = P([[3, 4, 5], [6, 8, 10], [5, 12, 13], [9, 12, 15], [8, 15, 17]]);
      return MQ({ lv, q: `A right-angled triangle has short sides ${a} cm and ${b} cm. How long is the hypotenuse?`, a: c, unit: 'cm', w: [a + b, a * a + b * b, c + 1], why: `${a}² + ${b}² = ${a * a} + ${b * b} = ${c * c}. √${c * c} = ${c} cm.`, hint: 'Square both, add, then square root.' }); }
    const a = R(3, 12), b = R(3, 12), c = Math.round(Math.sqrt(a * a + b * b) * 10) / 10;
    if (Number.isInteger(Math.sqrt(a * a + b * b))) return G.pythag(lv);
    return MQ({ lv, q: `Short sides ${a} cm and ${b} cm. Find the hypotenuse to 1 decimal place.`, a: c, unit: 'cm', tol: 0.051, why: `${a}² + ${b}² = ${a * a + b * b}. √${a * a + b * b} = ${c} cm.`, hint: 'Square, square, add, square root.' });
  },

  /* ---------- E. Data & chance ---------- */
  averages(lv) {
    const n = lv === 1 ? 5 : lv === 2 ? 5 : 6, d = Array.from({ length: n }, () => R(1, lv === 3 ? 20 : 12));
    const s = d.slice().sort((a, b) => a - b), sum = d.reduce((a, b) => a + b, 0);
    const kind = lv === 1 ? P(['mode', 'range']) : lv === 2 ? P(['median', 'mean', 'range']) : P(['median', 'mean']);
    const counts = {}; d.forEach((x) => { counts[x] = (counts[x] || 0) + 1; });
    const max = Math.max(...Object.values(counts)), modes = Object.keys(counts).filter((k) => counts[k] === max);
    if (kind === 'mode' && (max === 1 || modes.length > 1)) { d[R(0, n - 1)] = d[0]; return G.averages(lv); }
    if (kind === 'mean' && sum % n) return G.averages(lv);
    const med = n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
    const ans = { mode: +modes[0], range: s[n - 1] - s[0], median: med, mean: sum / n }[kind];
    const why = { mode: `Mode = the MOST common. ${modes[0]} appears ${max} times.`, range: `Range = biggest − smallest = ${s[n - 1]} − ${s[0]} = ${s[n - 1] - s[0]}.`, median: `Put them in order: ${s.join(', ')}. Median = the middle${n % 2 ? '' : ' (halfway between the middle two)'} = ${F(med)}.`, mean: `Mean = add them all up ÷ how many. ${sum} ÷ ${n} = ${sum / n}.` }[kind];
    const hint = { mode: 'Mode = Most.', range: 'Biggest take away smallest.', median: 'Order them first! Then find the middle.', mean: 'Add them up, then share them out.' }[kind];
    return MQ({ lv, q: `Find the ${kind.toUpperCase()} of:\n${d.join(',  ')}`, a: ans, w: [{ mode: s[n - 1], range: s[n - 1], median: d[(n - 1) >> 1], mean: sum }[kind], { mode: s[0], range: sum / n | 0, median: sum / n | 0, mean: med }[kind], s[0] + 1], why, hint });
  },
  prob(lv) {
    if (lv === 1) { const [q, a, w, why] = P([['How likely is it that the sun rises tomorrow?', 'Certain', ['Impossible', 'Unlikely', 'Even chance'], 'Something that will definitely happen is CERTAIN (probability 1).'], ['A coin lands on heads. How likely?', 'Even chance', ['Certain', 'Unlikely', 'Impossible'], 'Heads or tails: 1 out of 2 = even chance (½).'], ['Rolling a 7 on a normal dice (1–6). How likely?', 'Impossible', ['Unlikely', 'Even chance', 'Likely'], 'There is no 7 on the dice, so it is IMPOSSIBLE (probability 0).'], ['Rolling a number less than 6 on a dice. How likely?', 'Likely', ['Unlikely', 'Impossible', 'Certain'], '1, 2, 3, 4 or 5 = 5 out of 6. That\'s likely (but not certain).'], ['What is the probability of something impossible?', '0', ['1', '½', '−1'], 'Impossible = 0. Certain = 1. Everything else is in between.'], ['What is the probability of something certain?', '1', ['0', '100', '½'], 'Certain = 1 (or 100%).']]);
      return { t: 'mc', q, a, w, why }; }
    if (lv === 2) { const r = R(1, 6), b = R(1, 6), g = R(1, 5), t = r + b + g, col = P([['red', r], ['blue', b], ['green', g]]);
      return MQ({ lv, mc: true, q: `A bag has ${r} red, ${b} blue and ${g} green counters. You pick one without looking. What is the probability it is ${col[0]}?`, a: `${col[1]}/${t}`, w: [`1/${t}`, `${col[1]}/${t - col[1]}`, `${t}/${col[1]}`, `1/3`].filter((x) => x !== `${col[1]}/${t}`), why: `Probability = how many ${col[0]} ÷ how many altogether = ${col[1]}/${t}.`, hint: 'Top: the ones you want. Bottom: total counters.' }); }
    if (Math.random() < 0.5) { const p = R(1, 19) * 5 / 100;
      return MQ({ lv, q: `The probability it rains tomorrow is ${F(p)}. What is the probability it does NOT rain?`, a: Math.round((1 - p) * 100) / 100, why: `Probabilities add up to 1. 1 − ${F(p)} = ${F(1 - p)}.`, hint: 'Happens + doesn\'t happen = 1.' }); }
    const p = P([[1, 4], [1, 5], [1, 10], [3, 10], [2, 5]]), tries = P([20, 40, 60, 100, 200]);
    return MQ({ lv, q: `The probability of winning a game is ${p[0]}/${p[1]}. You play ${tries} times. How many times would you expect to win?`, a: tries * p[0] / p[1], why: `Expected = probability × number of goes. ${tries} ÷ ${p[1]} × ${p[0]} = ${tries * p[0] / p[1]}.`, hint: 'Find that fraction of the number of goes.' });
  },
  charts(lv) {
    if (lv === 1) { const k = P([2, 4, 5, 10]), n = R(2, 6), half = k % 2 === 0 && Math.random() < 0.5;
      return MQ({ lv, q: `Pictogram key: 🍎 = ${k} apples.\nThis row shows: ${'🍎'.repeat(n)}${half ? ' + half an apple' : ''}\nHow many apples?`, a: n * k + (half ? k / 2 : 0), w: [n, n * k, n + k], why: `Each 🍎 = ${k}. ${n} × ${k} = ${n * k}${half ? ` + half of ${k} (${k / 2}) = ${n * k + k / 2}` : ''}.`, hint: 'Check the key! Each picture stands for more than 1.' }); }
    const items = ['Dogs', 'Cats', 'Fish', 'Rabbits'], f = items.map(() => R(2, 15)), tot = f.reduce((a, b) => a + b, 0), i = R(0, 3);
    const table = items.map((x, j) => `${x}: ${f[j]}`).join('   ');
    if (lv === 2) { if (Math.random() < 0.5) return MQ({ lv, q: `Favourite pets (frequency table):\n${table}\nHow many people were asked altogether?`, a: tot, why: `Add all the frequencies: ${f.join(' + ')} = ${tot}.`, hint: 'Frequency = how many. Add them all.' });
      const mx = f.indexOf(Math.max(...f)); if (f.filter((x) => x === f[mx]).length > 1) return G.charts(lv);
      return MQ({ lv, mc: true, q: `Favourite pets:\n${table}\nWhat is the MODE?`, a: items[mx], w: items.filter((x) => x !== items[mx]), why: `The mode is the most popular: ${items[mx]} (${f[mx]}).` }); }
    const t2 = P([12, 18, 24, 30, 36, 20, 40, 60]), g = [R(1, t2 / 3)]; g.push(R(1, t2 - g[0] - 1)); g.push(t2 - g[0] - g[1]);
    return MQ({ lv, q: `A pie chart shows ${t2} people. ${g[0]} chose tea. What angle is the tea slice?`, a: g[0] * 360 / t2, unit: '°', tol: 0.51, why: `Each person gets 360 ÷ ${t2} = ${F(360 / t2)}°. ${g[0]} × ${F(360 / t2)} = ${F(g[0] * 360 / t2)}°.`, hint: 'The whole circle is 360°. Work out the angle for ONE person first.' });
  },

  /* ---------- F. Ratio & proportion ---------- */
  ratio(lv) {
    if (lv <= 2) { const a = R(1, 5), b = R(1, 6); if (gcd(a, b) !== 1 || a === b) return G.ratio(lv); const k = lv === 1 ? P([2, 3, 5, 10]) : R(3, 9);
      return MQ({ lv, mc: true, q: `Simplify the ratio ${a * k} : ${b * k}`, a: `${a} : ${b}`, w: [`${b} : ${a}`, `${a * k / gcd(a * k, 2) | 0 || a} : ${b * k}`, `${a + 1} : ${b + 1}`, `${a * k - 1} : ${b * k - 1}`].filter((x) => x !== `${a} : ${b}`), why: `Divide both sides by ${k}: ${a * k} ÷ ${k} = ${a}, ${b * k} ÷ ${k} = ${b}. So ${a} : ${b}.`, hint: 'Just like fractions: divide both sides by the same number.' }); }
    const a = R(1, 5), b = R(1, 6); if (gcd(a, b) !== 1) return G.ratio(lv);
    return MQ({ lv, mc: true, q: `Boys to girls is ${a} : ${b}. What FRACTION of the class are girls?`, a: `${b}/${a + b}`, w: [`${b}/${a}`, `${a}/${a + b}`, `1/${b}`], why: `Total parts = ${a} + ${b} = ${a + b}. Girls are ${b} of those parts → ${b}/${a + b}.`, hint: 'Add the parts to get the bottom of the fraction.' });
  },
  share(lv) {
    const [a, b] = lv === 1 ? P([[1, 1], [1, 2], [1, 3], [2, 3]]) : P([[2, 3], [3, 5], [1, 4], [3, 4], [2, 7], [5, 3]]), part = R(2, lv === 1 ? 6 : 12), tot = (a + b) * part;
    if (lv <= 2) return MQ({ lv, pre: '£', q: `Share £${tot} in the ratio ${a} : ${b}. How much is the SMALLER share?`, a: Math.min(a, b) * part, w: [tot / 2, Math.max(a, b) * part, part], why: `Total parts = ${a} + ${b} = ${a + b}. One part = £${tot} ÷ ${a + b} = £${part}. Smaller share = ${Math.min(a, b)} × £${part} = £${Math.min(a, b) * part}.`, hint: 'Add the ratio numbers. Divide the money by that. Then multiply.' });
    return MQ({ lv, q: `Sweets are shared ${a} : ${b} between Amy and Ben. Amy gets ${a * part}. How many does Ben get?`, a: b * part, why: `Amy's ${a} parts = ${a * part}, so 1 part = ${part}. Ben has ${b} parts = ${b * part}.`, hint: 'Find what ONE part is worth first.' });
  },
  proportion(lv) {
    const R2 = P([['flour', 'g', 200], ['milk', 'ml', 300], ['sugar', 'g', 150], ['butter', 'g', 100]]);
    if (lv === 1) { const k = P([2, 3]); return MQ({ lv, q: `A recipe for 4 people uses ${R2[2]} ${R2[1]} of ${R2[0]}. How much for ${4 * k} people?`, a: R2[2] * k, unit: R2[1], w: [R2[2] + 4 * k, R2[2] * k * 2, R2[2] / 2], why: `${4 * k} people is ${k} × as many, so ${k} × ${R2[2]} = ${R2[2] * k} ${R2[1]}.`, hint: 'How many times bigger is the new number of people?' }); }
    if (lv === 2) { const to = P([2, 6, 10]); return MQ({ lv, q: `A recipe for 4 people uses ${R2[2]} ${R2[1]} of ${R2[0]}. How much for ${to} people?`, a: R2[2] / 4 * to, unit: R2[1], w: [R2[2] + to - 4, R2[2] * to, R2[2] / to], why: `For 1 person: ${R2[2]} ÷ 4 = ${R2[2] / 4}. For ${to}: ${R2[2] / 4} × ${to} = ${R2[2] / 4 * to} ${R2[1]}.`, hint: 'Work out ONE person first (the unitary method).' }); }
    const n1 = P([4, 5, 6, 8]), c1 = R(20, 60) / 10 * n1 / 4, n2 = P([3, 7, 9, 12]);
    const each = Math.round(c1 / n1 * 100) / 100, ans = Math.round(each * n2 * 100) / 100;
    if (Math.abs(each * n1 - c1) > 0.001) return G.proportion(lv);
    return MQ({ lv, pre: '£', q: `${n1} cans cost £${c1.toFixed(2)}. How much do ${n2} cans cost?`, a: ans, tol: 0.005, fmt: (x) => x.toFixed(2), why: `1 can = £${c1.toFixed(2)} ÷ ${n1} = £${each.toFixed(2)}. ${n2} cans = ${n2} × £${each.toFixed(2)} = £${ans.toFixed(2)}.`, hint: 'Find the price of ONE can first.' });
  },
  pchange(lv) {
    if (lv === 1) { const n = R(2, 20) * 10, up = Math.random() < 0.5;
      return MQ({ lv, pre: '£', q: `A price of £${n} ${up ? 'goes UP' : 'goes DOWN'} by 10%. What is the new price?`, a: up ? n * 1.1 : n * 0.9, w: [n / 10, up ? n * 0.9 : n * 1.1, up ? n + 10 : n - 10], why: `10% of £${n} = £${n / 10}. ${up ? 'Add' : 'Take away'}: £${n} ${up ? '+' : '−'} £${n / 10} = £${F(up ? n * 1.1 : n * 0.9)}.`, hint: 'Find 10% first, then add it on (or take it off).' }); }
    if (lv === 2) { const n = R(2, 20) * 20, p = P([20, 25, 50, 30]);
      return MQ({ lv, pre: '£', q: `A £${n} coat is in a ${p}% OFF sale. What is the sale price?`, a: n * (100 - p) / 100, w: [n * p / 100, n - p, n * (100 + p) / 100], why: `${p}% of £${n} = £${F(n * p / 100)}. £${n} − £${F(n * p / 100)} = £${F(n * (100 - p) / 100)}.`, hint: '"Off" means take away. Find the % first.' }); }
    const o = R(2, 10) * 10, p = P([10, 20, 25, 50, 5, 30]), nw = o * (100 + p) / 100;
    return MQ({ lv, q: `A price goes from £${o} to £${F(nw)}. What is the percentage increase?`, a: p, unit: '%', why: `Increase = £${F(nw - o)}. As a % of the ORIGINAL: ${F(nw - o)} ÷ ${o} × 100 = ${p}%.`, hint: 'Change ÷ original × 100.' });
  },
};
function shuffleData(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/* warm-up drills (Practice tab) */
RC.drills = {
  tables: (lv) => G.tables(Math.min(lv, 3) === 3 ? 2 : lv),
  bonds(lv) {
    if (lv === 1) { const a = R(1, 9); return MQ({ lv, q: `${a} + ? = 10`, a: 10 - a, why: `${a} + ${10 - a} = 10.` }); }
    if (lv === 2) { const a = R(1, 19) * 5; return MQ({ lv, q: `${a} + ? = 100`, a: 100 - a, why: `${a} + ${100 - a} = 100.` }); }
    return G.money(1);
  },
  fdp: (lv) => (Math.random() < 0.5 ? G.fdp(Math.min(lv, 2)) : G.percent(Math.min(lv, 2))),
};

const L = (id, title, emoji, gen, tip) => ({ id: 'm-' + id, title, emoji, gen: [].concat(gen), tip });
RC.subjects.push({
  id: 'maths', name: 'Maths', emoji: '🔢',
  board: 'AQA GCSE Maths 8300 · Foundation tier',
  exam: '3 papers, 1 h 30 m each (Paper 1 = no calculator) · May–June 2027 · a formula sheet is given',
  intro: 'Start at the top and go slowly. Level 1 = pick from 3. Level 2 = pick from 4. Level 3 = type the answer yourself. Stuck? Tap 💡 Help me.',
  units: [
    { id: 'mA', title: 'Number basics', emoji: '🧱', blurb: 'The building blocks. Everything else uses these!', tag: 'exam', tagText: 'All 3 papers', lessons: [
      L('place', 'Place value', '🔟', G.place, ['Columns from the right: ones, tens, hundreds, thousands.', 'After the point: tenths, then hundredths.']),
      L('tables', 'Times tables', '✖️', G.tables, ['Knowing your tables makes EVERY topic easier.', 'Division is just a times table backwards.']),
      L('addsub', 'Adding & taking away', '➕', G.addsub, ['Line numbers up in columns. Start with the ones.', 'Check a take-away by adding back.']),
      L('tens', '× and ÷ by 10, 100, 1000', '🚀', G.tens, ['× 10: digits move 1 place left (bigger).', '÷ 10: digits move 1 place right (smaller).']),
      L('round', 'Rounding', '🎯', G.round, ['Look at the next digit.', '5 or more → round up. 4 or less → round down.']),
      L('neg', 'Negative numbers', '🌡️', G.negatives, ['Think of a thermometer or number line.', 'Two signs touching: same → +, different → −.']),
      L('bidmas', 'Order of operations', '🧮', G.bidmas, ['BIDMAS: Brackets, Indices, Divide/Multiply, Add/Subtract.', '× and ÷ come before + and −.']),
      L('factors', 'Factors, multiples & primes', '🔍', G.factors, ['Multiples = the times table (5, 10, 15…).', 'Factors go INTO a number exactly.', 'Primes have exactly 2 factors. 1 is NOT prime.']),
      L('powers', 'Squares, cubes & roots', '🟩', G.powers, ['5² = 5 × 5 = 25 (not 10!).', '√25 = 5 because 5 × 5 = 25.']),
    ] },
    { id: 'mB', title: 'Fractions, decimals & %', emoji: '🍕', blurb: 'Loads of marks come from these — and you use them in real life.', tag: 'exam', tagText: 'Big marks', lessons: [
      L('fracs', 'What is a fraction?', '🍰', G.fracs, ['Top = the parts you have. Bottom = parts altogether.', 'Simplify: divide top AND bottom by the same number.']),
      L('fracof', 'Fraction of an amount', '🍫', G.fracof, ['Divide by the bottom, times by the top.', '¾ of 20: 20 ÷ 4 = 5, then × 3 = 15.']),
      L('percent', 'Percentages of amounts', '💯', G.percent, ['10% = divide by 10.', '50% = half. 25% = a quarter. 5% = half of 10%.']),
      L('fdp', 'Fractions ↔ decimals ↔ %', '🔄', G.fdp, ['½ = 0.5 = 50%.  ¼ = 0.25 = 25%.', 'Decimal → %: × 100.']),
      L('money', 'Money & time', '💷', G.money, ['Change: count up from the price.', 'An hour is 60 minutes — not 100!']),
    ] },
    { id: 'mC', title: 'Algebra starters', emoji: '🔤', blurb: 'Letters are just numbers in disguise.', tag: 'exam', tagText: 'All 3 papers', lessons: [
      L('subst', 'Function machines & substituting', '⚙️', G.subst, ['Swap the letter for its number.', '3a means 3 × a.']),
      L('simplify', 'Simplifying', '🧹', G.simplify, ['Collect like terms: x\'s with x\'s, y\'s with y\'s.', 'a + a + a = 3a.']),
      L('eq', 'Solving equations', '⚖️', G.equations, ['Do the OPPOSITE to get x on its own.', 'Whatever you do to one side, do to the other.']),
      L('seq', 'Sequences', '🪜', G.sequences, ['Find what\'s added (or taken away) each time.', 'nth term: the jump goes in front of n.']),
      L('brackets', 'Expanding brackets', '🎁', G.brackets, ['The number outside multiplies EVERYTHING inside.', '3(x + 2) = 3x + 6.']),
    ] },
    { id: 'mD', title: 'Shape & measures', emoji: '📐', blurb: 'Angles, area and circles. Remember: a formula sheet is given in the exam.', tag: 'exam', tagText: 'All 3 papers', lessons: [
      L('angles', 'Angle facts', '📐', G.angles, ['Straight line = 180°.  Around a point = 360°.', 'Triangle = 180°.  Quadrilateral = 360°.']),
      L('shapes', 'Shapes & their names', '🔷', G.shapes, ['Tri = 3, Quad = 4, Pent = 5, Hex = 6, Oct = 8.']),
      L('area', 'Perimeter & area', '🟦', G.area, ['Perimeter = all the way round (add the sides).', 'Area of a rectangle = length × width.']),
      L('units', 'Converting units', '📏', G.units, ['1 m = 100 cm.  1 kg = 1000 g.  1 litre = 1000 ml.', 'Big unit → small unit: multiply.']),
      L('volume', 'Volume', '📦', G.volume, ['Cuboid: length × width × height.', 'Volume is in cm³ (cubed).']),
      L('circles', 'Circles', '⭕', G.circles, ['Diameter = 2 × radius.', 'Circumference = π × d.  Area = π × r².']),
      L('pythag', 'Pythagoras', '📐', G.pythag, ['Only for right-angled triangles.', 'Longest side² = short² + short².']),
    ] },
    { id: 'mE', title: 'Data & chance', emoji: '🎲', blurb: 'Averages, charts and probability — often easier marks!', tag: 'exam', tagText: 'All 3 papers', lessons: [
      L('avg', 'Mean, median, mode & range', '📊', G.averages, ['Mode = Most. Median = Middle (put in order first!).', 'Mean = add up ÷ how many. Range = biggest − smallest.']),
      L('charts', 'Charts & tables', '📈', G.charts, ['Always check the KEY on a pictogram.', 'Pie chart: whole circle = 360°.']),
      L('prob', 'Probability', '🎲', G.prob, ['Impossible = 0.  Certain = 1.', 'Probability = what you want ÷ total.']),
    ] },
    { id: 'mF', title: 'Ratio & proportion', emoji: '⚖️', blurb: 'Sharing, recipes and sales — real-life maths.', tag: 'exam', tagText: 'All 3 papers', lessons: [
      L('ratio', 'Simplifying ratios', '🍹', G.ratio, ['Divide both sides by the same number.', '2 : 4 = 1 : 2.']),
      L('share', 'Sharing in a ratio', '🍬', G.share, ['Add the parts. Divide the total by that. Multiply.']),
      L('prop', 'Recipes & best buys', '🧁', G.proportion, ['Find ONE first, then multiply (the unitary method).']),
      L('pchange', 'Percentage increase & decrease', '🏷️', G.pchange, ['Find the % of the amount, then add it or take it away.']),
    ] },
  ],
});
