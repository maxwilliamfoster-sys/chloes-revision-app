# Chloe's Revision App

Bite-size, quiz-first GCSE revision for Chloe (Comberton Village College, Year 11, exams 2027).
Designed to be easy to read and easy to focus on: 3-minute lessons, one question at a time, read-aloud on every question,
Lexend font, tinted backgrounds, no timers, gentle levels (Level 1 → 2 → 3).

**Open it:** https://maxwilliamfoster-sys.github.io/chloes-revision-app/

| Subject | Qualification (checked against Comberton's course pages + official specs, Sept 2026) |
|---|---|
| Maths | AQA GCSE Mathematics 8300, Foundation tier. Questions are generated fresh every time, starting from times tables |
| English Language | AQA GCSE English Language 8700 |
| English Literature | AQA GCSE English Literature 8702. Chloe picks her set texts: Macbeth, R&J, A Christmas Carol, J&H, An Inspector Calls, Power & Conflict |
| Health & Social Care | Pearson BTEC Tech Award in Health and Social Care (2022). The Component 3 exam is in May |
| Hospitality & Catering | WJEC Level 1/2 Vocational Award in Hospitality and Catering (Technical Award). Unit 2 is the Year 11 controlled assessment and Unit 1 is the exam |

There's no log-in. The app is always signed in as Chloe, and progress saves in the browser (localStorage).
Settings → *Back up my progress* gives a code she can use to restore or move to another device.

## Editing
- The content is in `src/d-*.js` (maths generators in `d-maths.js`) and the engine and UI are in `src/app.js`.
- Run `py build.py` to rebuild `docs/index.html`, then commit and push. GitHub Pages serves `/docs`.
