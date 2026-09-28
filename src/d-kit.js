/* Tiny helpers for writing quiz questions.  d = difficulty: 1 basics, 2 getting there, 3 stretch */
const mc = (d, q, a, w, why, hint) => ({ t: 'mc', d, q, a, w, why, hint });
const tf = (d, q, a, why) => ({ t: 'tf', d, q, a, why });
const mt = (d, q, pairs) => ({ t: 'match', d, q, pairs });
const od = (d, q, items, why) => ({ t: 'order', d, q, items, why });
const xq = (d, extract, q, a, w, why) => ({ t: 'mc', d, ex: extract, q, a, w, why });
const LS = (id, title, emoji, tip, qs) => ({ id, title, emoji, tip, qs });
