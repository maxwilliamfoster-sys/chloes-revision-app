/* ============================================================
   CHLOE'S ASSISTANT — works with no internet.
   1. Maths solver (solver.js): exact answers with steps.
   2. Lesson search: finds the checked facts from this app's lessons.
   3. Offline brain: a small AI model (Qwen3.5 via WebLLM, WebGPU) that
      explains things, using 1 + 2 so it sticks to correct facts.
   4. Photo reader: Tesseract OCR reads the text in a photo.
   The model is downloaded once (on Wi-Fi) and cached on the device.
   ============================================================ */
const AI_MODELS = {
  lite: { name: 'Lite', f16: 'Qwen3.5-0.8B-q4f16_1-MLC', f32: 'Qwen3.5-0.8B-q4f32_1-MLC', size: '450 MB', note: 'Only if Standard will not load on an older phone. Less accurate.' },
  std: { name: 'Standard', f16: 'Qwen3.5-2B-q4f16_1-MLC', f32: 'Qwen3.5-2B-q4f32_1-MLC', size: '1.1 GB', note: 'Recommended. Much more accurate answers.' },
};
const AI = { status: 'off', progress: 0, text: '', engine: null, gpu: undefined, busy: false, err: '', lib: null };
const ASK_KEY = 'chloe-assist-v1';
let chat = [];
try { chat = JSON.parse(localStorage.getItem(ASK_KEY)) || []; } catch (e) { chat = []; }
const saveChat = () => { try { localStorage.setItem(ASK_KEY, JSON.stringify(chat.slice(-30).map((m) => Object.assign({}, m, { img: undefined })))); } catch (e) { /* full */ } };
let pendingPhoto = null; // { url, text }

/* ---------- lesson search (BM25 over every question, answer, explanation and tip) ---------- */
const STOP = new Set('a an the is are was were be been of to in on at for and or but if then so it its this that these those what which who whom how why when where do does did can could should would will i me my you your we our they them their he she his her with as by from about into than too very just also not no yes please explain tell help mean means meaning give example examples work out find some any more most name names list all main key thing things like know need about using use'.split(' '));
const stem = (w) => (w.length > 4 ? w.replace(/(ing|ed|es|s)$/, '').replace(/e$/, '') : w);
const toks = (t) => String(t).toLowerCase().replace(/[’']/g, '').split(/[^a-z0-9%]+/).filter((w) => w && !STOP.has(w) && !/^\d+$/.test(w)).map(stem);
let IDX = null;
function buildIndex() {
  const docs = [];
  for (const s of RC.subjects) for (const u of s.units) {
    (u.facts || []).forEach((t) => docs.push({ s, l: u.lessons[0], u: u.id, head: `${s.name} · ${u.title} (key facts)`, text: t, kind: 'fact' }));
    for (const l of u.lessons) {
    const head = `${s.name} · ${l.title}`;
    (l.tip || []).forEach((t) => docs.push({ s, l, u: u.id, head, text: t, kind: 'tip' }));
    (l.qs || []).forEach((q) => {
      const ans = q.t === 'tf' ? (q.a ? 'True' : 'False') : q.t === 'match' ? q.pairs.map((p) => p[0] + ' = ' + p[1]).join('; ') : q.t === 'order' ? q.items.join(' → ') : q.a;
      docs.push({ s, l, u: u.id, head, q, text: `${q.ex ? q.ex + ' ' : ''}${q.q} → ${ans}. ${q.why || ''}`, kind: 'q' });
    });
    }
  }
  docs.forEach((d) => { if (!d.u) d.u = d.l.unit.id; });
  for (const d of docs) { d.tk = toks(d.text + ' ' + d.l.title); d.len = d.tk.length; }
  const df = {}; docs.forEach((d) => new Set(d.tk).forEach((w) => { df[w] = (df[w] || 0) + 1; }));
  IDX = { docs, df, avg: docs.reduce((a, d) => a + d.len, 0) / docs.length, N: docs.length };
}
// if a question names a book, character, poem or subject, only search there
const SCOPES = [
  [/christmas carol|scrooge|cratchit|marley|tiny tim|fezziwig|ghost of christmas/, 'u', 'lACC', /christmas|carol/g],
  [/macbeth|banquo|duncan|macduff|birnam/, 'u', 'lMac', null],
  [/romeo|juliet|tybalt|mercutio|capulet|montague|friar laurence/, 'u', 'lRJ', null],
  [/jekyll|hyde|utterson|lanyon/, 'u', 'lJH', null],
  [/inspector calls|goole|birling|eva smith|gerald|sheila/, 'u', 'lAIC', /inspector calls|an inspector/g],
  [/ozymandias|prelude|last duchess|light brigade|storm on the island|bayonet charge|poppies|war photographer|emigr[eé]e|checking out me history|kamikaze|power and conflict/, 'u', 'lPC', /power and conflict/g],
  [/hospitality|catering/, 's', 'hosp', /hospitality|and|catering/g],
  [/health and social care|health & social care|hsc|btec/, 's', 'hsc', /health and social care|health & social care|hsc|btec/g],
];
function searchNotes(query, k) {
  if (!IDX) buildIndex();
  let q = String(query).toLowerCase(), scope = null;
  for (const [re, kind, id, strip] of SCOPES) if (re.test(q)) { scope = [kind, id]; if (strip) { const q2 = q.replace(strip, ' '); if (toks(q2).length) q = q2; } break; }
  const qt = [...new Set(toks(q))]; if (!qt.length) return [];
  const scored = [];
  for (const d of IDX.docs) {
    if (scope && (scope[0] === 'u' ? d.u !== scope[1] : d.s.id !== scope[1])) continue;
    let sc = 0;
    for (const w of qt) {
      const f = d.tk.filter((x) => x === w).length; if (!f) continue;
      const idf = Math.log(1 + (IDX.N - IDX.df[w] + 0.5) / (IDX.df[w] + 0.5));
      sc += idf * (f * 2.2) / (f + 1.2 * (0.25 + 0.75 * d.len / IDX.avg));
    }
    if (d.kind === 'fact') sc *= 1.3;
    if (sc > 0) scored.push({ d, sc });
  }
  scored.sort((a, b) => b.sc - a.sc);
  const best = scored[0] ? scored[0].sc : 0, out = [], per = {};
  for (const x of scored) {
    if (x.sc < Math.max(2.2, best * 0.45) || out.length >= (k || 4)) break;
    if ((per[x.d.l.id] = (per[x.d.l.id] || 0) + 1) > 2) continue;
    out.push(x.d);
  }
  return out;
}

/* ---------- offline brain (WebLLM) ---------- */
async function gpuInfo() {
  if (AI.gpu !== undefined) return AI.gpu;
  try { if (!navigator.gpu) return (AI.gpu = null); const a = await navigator.gpu.requestAdapter(); AI.gpu = a ? { f16: a.features.has('shader-f16') } : null; } catch (e) { AI.gpu = null; }
  return AI.gpu;
}
function modelId(key) { const m = AI_MODELS[key]; return AI.gpu && AI.gpu.f16 ? m.f16 : m.f32; }
async function aiLib() { if (!AI.lib) AI.lib = await import('./ai/webllm.js'); return AI.lib; }
function recommendModel() {
  const mob = /iphone|ipad|android|mobile/i.test(navigator.userAgent), mem = navigator.deviceMemory || 0;
  return mem && mem < 6 ? 'lite' : 'std'; // Standard is much more accurate; Lite is the fallback for older phones
}
async function aiRefresh() {
  const g = await gpuInfo();
  if (!g) { AI.status = 'nogpu'; return; }
  if (AI.engine) { AI.status = 'ready'; return; }
  if (AI.status === 'downloading' || AI.status === 'loading') return;
  const key = state.settings.aiModel;
  if (!key) { AI.status = 'off'; return; }
  try { const lib = await aiLib(); AI.status = (await lib.hasModelInCache(modelId(key))) ? 'cached' : 'off'; } catch (e) { AI.status = 'off'; }
}
async function aiStart(key) {
  const g = await gpuInfo(); if (!g) { AI.status = 'nogpu'; drawBrain(); return; }
  if (AI.engine && state.settings.aiModel === key) return;
  if (AI.engine) { try { await AI.engine.unload(); } catch (e) { /* ignore */ } AI.engine = null; }
  state.settings.aiModel = key; save();
  let cached = false; const lib = await aiLib();
  try { cached = await lib.hasModelInCache(modelId(key)); } catch (e) { /* ignore */ }
  if (!cached && !navigator.onLine) { AI.status = 'off'; AI.err = 'You need Wi-Fi for the one-time download. Try again at home!'; drawBrain(); return; }
  AI.status = cached ? 'loading' : 'downloading'; AI.progress = 0; AI.err = ''; drawBrain();
  try {
    const worker = new Worker(new URL('./ai/worker.js', location.href), { type: 'module' });
    AI.engine = await lib.CreateWebWorkerMLCEngine(worker, modelId(key), {
      initProgressCallback: (r) => { AI.progress = r.progress || 0; AI.text = r.text || ''; drawBrain(); },
    });
    AI.status = 'ready'; state.settings.aiReady = true; save(); drawBrain();
    if (!cached) { toast('🧠 Offline brain downloaded! It now works with no internet.'); Sound.win(); }
  } catch (e) {
    AI.engine = null; AI.status = 'error';
    const msg = String(e && e.message || e);
    AI.err = /memory|device.?lost|allocate|OOM|buffer/i.test(msg) ? 'This device ran out of memory. Try the Lite brain instead.' : /fetch|network|Failed to/i.test(msg) ? 'The download stopped (internet dropped?). Tap to try again — it carries on where it left off.' : 'Could not start: ' + msg.slice(0, 140);
    drawBrain();
  }
}
async function aiDelete() {
  const key = state.settings.aiModel; if (!key) return;
  try { if (AI.engine) await AI.engine.unload(); } catch (e) { /* ignore */ }
  AI.engine = null;
  try { const lib = await aiLib(); await lib.deleteModelAllInfoInCache(modelId(key)); } catch (e) { /* ignore */ }
  state.settings.aiModel = null; state.settings.aiReady = false; save(); AI.status = 'off'; drawBrain(); toast('Offline brain removed');
}

const SYSTEM = `You are "Chloe's Assistant", a kind tutor inside Chloe's GCSE revision app. Chloe is in Year 11 in England. Her courses: AQA GCSE Maths 8300 (Foundation tier), AQA GCSE English Language 8700, AQA GCSE English Literature 8702, Pearson BTEC Tech Award in Health and Social Care, and WJEC Level 1/2 Award in Hospitality and Catering.
Rules:
1. Answer the question in your first sentence.
2. Then explain in 2 to 4 short, simple sentences, or a few short bullet points. Stop as soon as the question is answered. Never repeat yourself.
3. For maths, show the working as short numbered steps.
4. NOTES and a WORKED ANSWER may be given. They are correct, so use them. Use exactly the numbers in a WORKED ANSWER. Ignore any note that is not about the question.
5. If you are not sure, say so and suggest she asks her teacher. Never make up facts, quotes, dates or laws.
6. For questions about a book, play or poem: only use facts that are in the NOTES. Do not name any character, event or quote that is not in the NOTES. If the notes don't cover it, say you're not sure and suggest checking with her teacher.
7. Use simple everyday words and British spelling. Be warm and encouraging.`;
function buildMessages(userText, notes, sol) {
  let sys = SYSTEM;
  if (notes.length) sys += '\n\nNOTES FROM CHLOE\'S COURSE (these are correct):\n' + notes.map((n) => `- ${n.head}: ${n.text.slice(0, 260)}`).join('\n');
  if (sol) sys += `\n\nWORKED ANSWER to her question (checked by a calculator, so use exactly these numbers):\n${sol.title}\n${sol.steps.map((x, i) => `${i + 1}. ${x}`).join('\n')}\nAnswer: ${sol.answer}\nExplain these steps simply.`;
  const msgs = [{ role: 'system', content: sys }];
  const hist = chat.filter((m) => (m.role === 'user' || m.role === 'ai') && m.text && !m.typing).slice(-5, -1);
  for (const m of hist) msgs.push({ role: m.role === 'ai' ? 'assistant' : 'user', content: String(m.text).slice(0, 400) });
  msgs.push({ role: 'user', content: userText });
  return msgs;
}

/* ---------- photo reader (Tesseract OCR) ---------- */
let ocrWorker = null;
function loadScript(src) { return new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s); }); }
async function readPhoto(file, onProg) {
  const abs = (p) => new URL(p, location.href).href;
  if (!window.Tesseract) await loadScript('ocr/tesseract.min.js');
  if (!ocrWorker) ocrWorker = await Tesseract.createWorker('eng', 1, { workerPath: abs('ocr/worker.min.js'), corePath: abs('ocr/core'), langPath: abs('ocr/lang'), gzip: true, workerBlobURL: false, logger: (m) => { if (m.status === 'recognizing text' && onProg) onProg(m.progress); } });
  // shrink big phone photos so it's quicker
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
  const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
  const g = cv.getContext('2d'); g.drawImage(bmp, 0, 0, cv.width, cv.height);
  const { data } = await ocrWorker.recognize(cv);
  return { text: (data.text || '').replace(/\n{3,}/g, '\n\n').trim(), conf: data.confidence || 0, url: cv.toDataURL('image/jpeg', 0.7) };
}

/* ---------- UI ---------- */
function mdLite(t) {
  const lines = esc(t).split('\n'); let html = '', list = null;
  for (let ln of lines) {
    ln = ln.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|\s)\*(\S[^*]*?)\*(?=\s|$|[.,!?])/g, '$1<i>$2</i>').replace(/^#{1,4}\s*/, '');
    const b = ln.match(/^\s*[-•*]\s+(.*)/), n = ln.match(/^\s*(\d+)[.)]\s+(.*)/);
    if (b || n) { const tag = b ? 'ul' : 'ol'; if (list !== tag) { if (list) html += `</${list}>`; html += `<${tag}>`; list = tag; } html += `<li>${(b || n)[b ? 1 : 2]}</li>`; }
    else { if (list) { html += `</${list}>`; list = null; } if (ln.trim()) html += `<p>${ln}</p>`; }
  }
  if (list) html += `</${list}>`;
  return html;
}
function brainPill() {
  const st = AI.status;
  const m = { nogpu: ['⚪', 'Brain not supported here'], off: ['⚪', 'Brain off'], cached: ['🟡', 'Brain asleep — tap to wake'], downloading: ['⬇️', `Downloading ${Math.round(AI.progress * 100)}%`], loading: ['🟡', `Waking up ${Math.round(AI.progress * 100)}%`], ready: ['🟢', 'Brain ready'], error: ['🔴', 'Brain problem'] }[st] || ['⚪', 'Brain off'];
  return `<button class="brainpill" data-act="brain">${m[0]} ${m[1]}</button>`;
}
function brainCard() {
  const st = AI.status;
  if (st === 'ready') return '';
  if (st === 'nogpu') return `<div class="tip" style="background:var(--blue-t)"><span class="emo">💡</span><p class="small">This device can't run the AI brain (it needs <b>WebGPU</b> — try Chrome, or update your phone). I can still <b>solve maths step by step</b>, <b>read photos</b> and <b>search your lessons</b> — all with no internet.</p></div>`;
  if (st === 'downloading' || st === 'loading') return `<div class="card stack"><b>${st === 'downloading' ? '⬇️ Downloading my offline brain…' : '🧠 Waking up my brain…'}</b><div class="bar"><i style="width:${Math.max(2, Math.round(AI.progress * 100))}%;background:var(--pink)"></i></div><p class="muted tiny">${st === 'downloading' ? 'Keep this screen open. This only happens once — after this it works at school with no Wi-Fi.' : 'This takes 10–40 seconds each time the app opens.'}</p></div>`;
  if (st === 'cached') return `<button class="btn full pink" data-act="ai-start" data-id="${state.settings.aiModel}">🧠 Wake up my brain</button>`;
  const rec = recommendModel();
  if (!AI.open && !AI.err) return `<button class="chip brainbar" data-act="brain-open">🧠 <b>Turn on my offline brain</b> — so I can explain anything ›</button>`;
  return `<div class="card stack"><div class="row"><b class="grow">🧠 Switch on my offline brain</b><button class="chip" data-act="brain-close">Hide</button></div><p class="small">Right now I can solve maths, read photos and search your lessons. Turn on the brain so I can <b>explain anything</b> in my own words — even with no internet.</p>
    <p class="small"><b>One-time download — do it at home on Wi-Fi.</b> Then it works at school offline.</p>
    ${AI.err ? `<p class="small" style="color:var(--red-d)">${esc(AI.err)}</p>` : ''}
    ${['lite', 'std'].map((k) => `<button class="btn full ${k === rec ? 'pink' : ''}" data-act="ai-start" data-id="${k}">${AI_MODELS[k].name} brain · ${AI_MODELS[k].size}${k === rec ? ' ⭐' : ''}</button><p class="muted tiny" style="margin-top:-6px">${AI_MODELS[k].note}</p>`).join('')}
  </div>`;
}
function drawBrain() {
  const p = $('#brainpill'); if (p) p.innerHTML = brainPill();
  const c = $('#braincard'); if (c) c.innerHTML = brainCard();
  if ($('#aistatus') && typeof fillOfflineStatus === 'function') fillOfflineStatus();
}
const STARTERS = ['What is 15% of £80?', 'What is a metaphor?', 'Solve 3x + 5 = 20', 'What does SMART stand for?', 'What temperature should a fridge be?', 'Who is Inspector Goole?'];
function msgHTML(m, i) {
  if (m.role === 'user') return `<div class="msg me">${m.img ? `<img src="${m.img}" alt="Your photo">` : ''}${m.photo ? `<p class="tiny muted">📷 Question from my photo</p>` : ''}<p>${esc(m.text)}</p></div>`;
  if (m.role === 'sol') return `<div class="msg sol"><div class="solh">✅ Worked answer <span class="tiny">(checked by the calculator)</span></div><b>${esc(m.sol.title)}</b><ol>${m.sol.steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol><div class="solans">Answer: ${esc(m.sol.answer)}</div>${m.sol.tip ? `<p class="tiny muted">💡 ${esc(m.sol.tip)}</p>` : ''}</div>`;
  if (m.role === 'ocr') return `<div class="msg bot"><p class="small"><b>📷 I read this from your photo.</b> Fix anything I got wrong, then ask your question:</p><textarea class="ocrbox" id="ocr${i}" rows="4">${esc(m.text)}</textarea>${m.conf < 60 ? '<p class="tiny muted">It was a bit hard to read — a closer, brighter photo helps. I can\'t understand drawings or graphs, so type any numbers from diagrams.</p>' : ''}<div class="wrap-row"><button class="btn sm pink" data-act="ocr-ask" data-i="${i}" data-q="How do I answer this question?">How do I answer this?</button><button class="btn sm" data-act="ocr-ask" data-i="${i}" data-q="Explain what this means in simple words.">Explain it simply</button></div></div>`;
  const links = (m.lessons || []).map((id) => LESSON[id] ? `<button class="chip" data-act="lesson-from-ask" data-id="${id}">${SUBJ[LESSON[id].subj].emoji} Practise: ${esc(LESSON[id].title)}</button>` : '').join('');
  return `<div class="msg bot">${m.html || mdLite(m.text || '')}${m.typing ? '<span class="dots"><i></i><i></i><i></i></span>' : ''}${m.notes && m.notes.length && !m.typing ? `<details class="notes"><summary>📘 Checked facts from your lessons</summary><ul>${m.notes.map((n) => `<li><b>${esc(n.head)}:</b> ${esc(n.text)}</li>`).join('')}</ul></details>` : ''}${links ? `<div class="wrap-row" style="margin-top:8px">${links}</div>` : ''}${!m.typing && m.text ? `<div class="msgtools"><button class="iconbtn sm" data-act="say-msg" data-i="${i}" aria-label="Read out loud">🔊</button>${m.ai ? '<span class="tiny muted">AI can make mistakes — check with your teacher if unsure.</span>' : ''}</div>` : ''}</div>`;
}
function drawChat(scroll) {
  const box = $('#chat'); if (!box) return;
  if (!chat.length) box.innerHTML = `<div class="msg bot"><p><b>Hi ${esc(state.name)}! 👋 I'm your assistant.</b></p><p>Stuck on something? Ask me anything about Maths, English, Health & Social Care or Hospitality — or tap 📷 to snap a question.</p><p class="small muted">I work with no internet 📴</p></div><div class="wrap-row">${STARTERS.map((s) => `<button class="chip" data-act="ask-chip" data-q="${esc(s)}">${esc(s)}</button>`).join('')}</div>`;
  else box.innerHTML = chat.map(msgHTML).join('') + (AI.busy ? '' : `<div class="wrap-row">${['Explain it more simply', 'Give me an example', 'Test me on this'].map((s) => `<button class="chip" data-act="ask-chip" data-q="${s}">${s}</button>`).join('')}<button class="chip" data-act="ask-clear">🧹 New chat</button></div>`);
  if (scroll !== false) box.scrollTop = box.scrollHeight;
}
function openAssist(prefill, autoSend) {
  let el = $('#ask');
  if (!el) { el = document.createElement('div'); el.id = 'ask'; el.className = 'ask'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', "Chloe's Assistant"); document.body.appendChild(el); }
  el.hidden = false; document.body.style.overflow = 'hidden';
  el.innerHTML = `<div class="ask-top"><button class="x" data-act="ask-close" aria-label="Close">✕</button><div class="grow"><b>🤖 Chloe's Assistant</b><div id="brainpill">${brainPill()}</div></div></div>
    <div class="ask-body" id="chat"></div>
    <div id="braincard" class="ask-brain">${brainCard()}</div>
    <div class="ask-foot"><label class="iconbtn" aria-label="Add a photo" title="Add a photo">📷<input type="file" accept="image/*" id="photoin" hidden></label>
      <textarea id="askbox" rows="1" placeholder="Ask me anything…" aria-label="Your question"></textarea>
      <button class="iconbtn send" data-act="ask-send" aria-label="Send">➤</button></div>
    <p class="tiny muted ask-hint">Tip: tap the 🎤 on your keyboard to talk instead of typing.</p>`;
  drawChat();
  const box = $('#askbox');
  box.addEventListener('input', () => { box.style.height = 'auto'; box.style.height = Math.min(140, box.scrollHeight) + 'px'; });
  box.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAsk(); } });
  $('#photoin').addEventListener('change', onPhoto);
  aiRefresh().then(() => { drawBrain(); if (AI.status === 'cached') aiStart(state.settings.aiModel); });
  if (prefill) { box.value = prefill; if (autoSend) sendAsk(); }
}
function closeAssist() { const el = $('#ask'); if (el) el.hidden = true; if ($('#session').hidden) document.body.style.overflow = ''; Speak.stop(); }
async function onPhoto(e) {
  const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
  const i = chat.length; chat.push({ role: 'ai', text: '📷 Reading your photo… 0%', typing: true }); drawChat();
  try {
    const r = await readPhoto(f, (p) => { chat[i].text = `📷 Reading your photo… ${Math.round(p * 100)}%`; drawChat(); });
    chat.splice(i, 1);
    chat.push({ role: 'user', text: '📷 (photo)', img: r.url });
    if (!r.text) chat.push({ role: 'ai', text: 'I couldn\'t find any words in that photo. Try a closer, brighter photo of the printed question — or type it in.' });
    else chat.push({ role: 'ocr', text: r.text, conf: r.conf });
  } catch (err) { chat[i] = { role: 'ai', text: 'Sorry — I couldn\'t read that photo. (' + String(err && err.message || err).slice(0, 80) + ')' }; }
  saveChat(); drawChat();
}
async function sendAsk(textIn, photoText) {
  const box = $('#askbox'); const text = (textIn != null ? textIn : box.value).trim(); if (!text || AI.busy) return;
  if (textIn == null) { box.value = ''; box.style.height = 'auto'; }
  const full = photoText ? `${photoText}\n\n${text}` : text;
  chat.push({ role: 'user', text: photoText ? `${text}\n\n“${photoText.slice(0, 300)}${photoText.length > 300 ? '…' : ''}”` : text, photo: !!photoText });
  // follow-ups like "explain it more simply" should use the earlier question too
  const lastQ = [...chat].reverse().find((m, j) => m.role === 'user' && j > 0);
  // short follow-ups ("give me an example", "I don't get it") build on the previous question
  const isFollow = !photoText && lastQ && text.length < 45 && /^(explain it more simply|give me an example|test me on this|what do you mean|i (still )?don.?t (get|understand)|again|why\??$|how\??$|explain (that|it)|tell me more|more)/i.test(text);
  const context = isFollow ? (lastQ.text + ' ' + text) : full;
  const sol = Solver.solve(photoText ? photoText + ' ' + text : (isFollow ? lastQ.text : text));
  let notes = searchNotes(context, 4);
  if (sol) notes = notes.filter((n) => n.s.id === 'maths'); // a worked maths answer only needs maths notes
  if (sol && !isFollow) chat.push({ role: 'sol', sol });
  const lessons = [...new Set(notes.map((n) => n.l.id))].slice(0, 2);
  if (!lessons.length && sol) { const m = LESSON_BY_SOLVE(sol.title); if (m) lessons.push(m); }
  saveChat(); drawChat();
  if (AI.status !== 'ready') {
    if (AI.status === 'loading' || AI.status === 'downloading') chat.push({ role: 'ai', text: '🧠 My brain is still waking up — here\'s what I know already:' });
    chat.push(fallbackAnswer(text, notes, sol, lessons)); saveChat(); drawChat(); return;
  }
  const m = { role: 'ai', text: '', typing: true, ai: true, lessons, notes: notes.slice(0, 3).map((n) => ({ head: n.head, text: n.text })) }; chat.push(m); AI.busy = true; drawChat();
  try {
    const stream = await AI.engine.chat.completions.create({ messages: buildMessages(full, notes, sol), stream: true, temperature: 0.3, top_p: 0.9, repetition_penalty: 1.05, max_tokens: 320, extra_body: { enable_thinking: false } });
    let raw = '', last = 0;
    for await (const ch of stream) {
      raw += (ch.choices[0] && ch.choices[0].delta && ch.choices[0].delta.content) || '';
      m.text = raw.replace(/<think>[\s\S]*?(<\/think>|$)/g, '').trim();
      // small models sometimes get stuck in a loop: stop as soon as a line repeats
      const lines = m.text.split('\n').map((x) => x.trim().replace(/^[-*•\d.)\s]+/, '')).filter((x) => x.length > 12);
      if (lines.length !== new Set(lines).size) { try { AI.engine.interruptGenerate(); } catch (e) { /* ignore */ } break; }
      if (performance.now() - last > 80) { last = performance.now(); drawChat(); }
    }
    const seen = new Set(); m.text = m.text.split('\n').filter((x) => { const k = x.trim().replace(/^[-*•\d.)\s]+/, ''); if (k.length > 12 && seen.has(k)) return false; seen.add(k); return true; }).join('\n').trim();
    if (!m.text) m.text = 'Hmm, I got a bit stuck. Could you ask that a different way?';
  } catch (err) { m.text = 'Sorry — my brain hiccuped. ' + (sol || notes.length ? 'The notes above are still correct though!' : 'Try asking again.'); m.ai = false; }
  m.typing = false; AI.busy = false; saveChat(); drawChat();
}
function LESSON_BY_SOLVE(title) {
  const t = title.toLowerCase(), map = [[/%|percent/, 'm-percent'], [/increase|decrease/, 'm-pchange'], [/ratio|share/, 'm-share'], [/solve/, 'm-eq'], [/mean|median|mode|range/, 'm-avg'], [/angle/, 'm-angles'], [/pythag/, 'm-pythag'], [/circle/, 'm-circles'], [/sequence/, 'm-seq'], [/prime|factor|hcf|lcm/, 'm-factors'], [/round/, 'm-round'], [/\//, 'm-fracof'], [/area|rectangle|triangle|trapezium/, 'm-area'], [/volume/, 'm-volume'], [/→/, 'm-units'], [/substitut/, 'm-subst']];
  for (const [re, id] of map) if (re.test(t)) return id; return null;
}
function fallbackAnswer(text, notes, sol, lessons) {
  if (sol && !notes.length) return { role: 'ai', text: 'That\'s the method above ☝️ — go through it one step at a time. Want to practise? Tap the lesson below.', lessons };
  if (notes.length) {
    const lines = notes.slice(0, 3).map((n) => `- **${n.head}:** ${n.kind === 'q' ? n.text.replace(/ → /, ' → **').replace(/\. /, '**. ') : n.text}`);
    return { role: 'ai', text: (sol ? 'The method is above ☝️. ' : '') + 'Here\'s what your lessons say:\n' + lines.join('\n'), lessons };
  }
  return { role: 'ai', text: AI.status === 'nogpu' ? 'I couldn\'t find that in your lessons. Try using different words — for example the name of the topic ("percentages", "metaphor", "care values").' : 'I couldn\'t find that in your lessons. Try different words — or switch on my offline brain (at the bottom) so I can explain anything.' };
}
/* clicks for the assistant */
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const act = b.dataset.act;
  if (act === 'ask') { e.preventDefault(); openAssist(); }
  else if (act === 'ask-close') closeAssist();
  else if (act === 'ask-send') sendAsk();
  else if (act === 'ask-chip') sendAsk(b.dataset.q);
  else if (act === 'ask-clear') { chat = []; saveChat(); drawChat(); }
  else if (act === 'ocr-ask') { const t = $('#ocr' + b.dataset.i).value.trim(); chat.splice(+b.dataset.i, 1); sendAsk(b.dataset.q, t); }
  else if (act === 'say-msg') { const m = chat[+b.dataset.i]; Speak.say(m.role === 'sol' ? m.sol.steps.join('. ') + '. Answer: ' + m.sol.answer : m.text); }
  else if (act === 'brain') { if (AI.status === 'cached') aiStart(state.settings.aiModel); else if (AI.status === 'off' || AI.status === 'error') { AI.open = true; drawBrain(); } }
  else if (act === 'ai-start') { AI.open = false; aiStart(b.dataset.id); }
  else if (act === 'brain-open') { AI.open = true; drawBrain(); }
  else if (act === 'brain-close') { AI.open = false; AI.err = ''; drawBrain(); }
  else if (act === 'ai-delete') { if (confirm('Delete the offline brain from this device? You can download it again later.')) aiDelete(); }
  else if (act === 'lesson-from-ask') { closeAssist(); if (!$('#session').hidden) return; lessonSheet(LESSON[b.dataset.id]); }
  else if (act === 'ask-about') {
    const q = sess && sess.qs[sess.i]; if (!q) return;
    const ans = q.t === 'tf' ? (q.a ? 'True' : 'False') : q.t === 'match' ? q.pairs.map((p) => p[0] + ' = ' + p[1]).join(', ') : q.t === 'order' ? q.items.join(', then ') : (q.pre || '') + q.a + (q.unit ? ' ' + q.unit : '');
    openAssist(`I got this wrong and I don't get it:\n${q.ex ? '"' + q.ex + '"\n' : ''}${q.q}\nThe answer is: ${ans}. Can you explain why?`, true);
  }
});

/* ---------- go ---------- */
applyLook();
route();
