#!/usr/bin/env node
// Self-test for .github/build.mjs. The Pages workflow runs it before every deploy.
//
//   node .github/test-build.mjs
//
// It is hermetic on purpose: it builds throwaway fixture repos in the OS temp folder and never reads
// the app folders of this repo. An app changing its own pages or card.json can therefore never make
// this test fail and block the deploy of every other app. Only a change to build.mjs can.
// Built-in modules only (node:test); tested on Node 24, needs Node >= 20.
//
// Most tests run build.mjs as a CLI on a fixture repo. The rules that need names this OS cannot
// create (Windows device names, case-only differences, invalid UTF-8) are also unit-tested through
// the functions build.mjs exports; importing it builds nothing.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cmdEscape, decodeName, MAX_CARD_BYTES, MAX_PATH_BYTES, plainEscape, portablePathProblems, ROOT_FILES, show, SIZE_BUDGET, sizeWarning } from './build.mjs';

const BUILD = join(dirname(fileURLToPath(import.meta.url)), 'build.mjs');
/**
 * 2026-12-31T00:00:00Z: the builds under test get a fixed build date (footer year 2026). Every
 * fixture "since" is on or before it unless a test says otherwise.
 */
const EPOCH_2026 = '1798675200';
const OLD_DESCRIPTION = '<meta name="description" content="Atto Studio: privacy policy, terms of use and support for Tuckaway: Critter Logic (쉿! 숲속 하숙집).">';
const NEW_DESCRIPTION = '<meta name="description" content="Atto Studio: privacy policies, terms of use and support for Atto Studio apps.">';

/** The hand-written home page this repo had before the page was generated (commit 95a246e). */
const GOLDEN_INDEX = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>Atto Studio</title>
<meta name="description" content="Atto Studio: privacy policy, terms of use and support for Tuckaway: Critter Logic (쉿! 숲속 하숙집).">
<link rel="canonical" href="https://hootchi.github.io/">
<style>
  :root {
    color-scheme: light dark;
    --bg: #fbf8f1; --fg: #1f2233; --muted: #5b5f73; --line: #e3dccb; --accent: #9a5b12; --card: #ffffff;
  }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #1b1f3a; --fg: #eeeaf6; --muted: #b4b2c8; --line: #343a63; --accent: #ffd27a; --card: #232849; }
  }
  * { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
  body {
    margin: 0; background: var(--bg); color: var(--fg);
    font: 16px/1.65 -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", "Segoe UI", Roboto, sans-serif;
  }
  main { max-width: 760px; margin: 0 auto; padding: 24px 16px 64px; }
  header { padding-bottom: 8px; }
  h1 { font-size: 1.6rem; line-height: 1.3; margin: 0 0 4px; word-break: keep-all; }
  :lang(ko) { word-break: keep-all; }
  h2 { font-size: 1.3rem; margin: 40px 0 8px; padding-top: 8px; border-top: 1px solid var(--line); }
  h3 { font-size: 1.05rem; margin: 24px 0 4px; }
  p, li { overflow-wrap: anywhere; }
  ul, ol { padding-left: 1.3em; }
  ol > li + li { margin-top: 8px; }
  a { color: var(--accent); }
  .site { margin: 0 0 20px; }
  .site a { font-weight: 600; text-decoration: none; }
  .meta { color: var(--muted); margin: 0; }
  .toc { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 12px; }
  .toc a { display: inline-block; padding: 6px 14px; border: 1px solid var(--line); border-radius: 999px; background: var(--card); text-decoration: none; }
  .summary { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 12px 16px; }
  .card { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 16px 20px; margin-top: 24px; }
  .card h2 { margin: 0; padding: 0; border: 0; }
  .card ul { list-style: none; padding: 0; margin: 16px 0; }
  .card li { margin: 8px 0; }
  footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid var(--line); color: var(--muted); }
  footer nav { display: flex; flex-wrap: wrap; gap: 4px 20px; }
  footer p { margin: 8px 0 0; }
</style>
</head>
<body>
<main>
<header>
  <h1>Atto Studio</h1>
  <p class="meta">Apps by Atto Studio · <span lang="ko">Atto Studio의 앱</span></p>
</header>

<section class="card" aria-labelledby="tuckaway">
  <h2 id="tuckaway">Tuckaway: Critter Logic</h2>
  <p class="meta" lang="ko">쉿! 숲속 하숙집</p>
  <p>A logic puzzle game for iPhone, iPad and Android.<br><span lang="ko">iPhone·iPad·Android용 논리 퍼즐 게임입니다.</span></p>
  <ul>
    <li><a href="tuckaway/privacy/">Privacy Policy · <span lang="ko">개인정보 처리방침</span></a></li>
    <li><a href="tuckaway/terms/">Terms of Use · <span lang="ko">이용약관</span></a></li>
    <li><a href="tuckaway/support/">Support · <span lang="ko">고객 지원</span></a></li>
  </ul>
  <p>Contact · <span lang="ko">문의</span>: <a href="mailto:attostudio.support@gmail.com">attostudio.support@gmail.com</a></p>
</section>

<footer>
  <p>© 2026 Atto Studio</p>
</footer>
</main>
</body>
</html>
`;

/** tuckaway/card.json as published (a copy: the real file is never read here). */
const TUCKAWAY_CARD = `{
  "name": "Tuckaway: Critter Logic",
  "name_ko": "쉿! 숲속 하숙집",
  "summary": "A logic puzzle game for iPhone, iPad and Android.",
  "summary_ko": "iPhone·iPad·Android용 논리 퍼즐 게임입니다.",
  "since": "2026-09-29",
  "links": [
    { "label": "Privacy Policy", "label_ko": "개인정보 처리방침", "href": "privacy/" },
    { "label": "Terms of Use", "label_ko": "이용약관", "href": "terms/" },
    { "label": "Support", "label_ko": "고객 지원", "href": "support/" }
  ],
  "contact": "attostudio.support@gmail.com"
}
`;

/** A tuckaway/ folder like the real one: stub pages (CRLF and non-ASCII on purpose) plus the card. */
const TUCKAWAY = {
  'tuckaway/card.json': TUCKAWAY_CARD,
  'tuckaway/privacy/index.html': '<!doctype html>\r\n<title>Privacy · 개인정보 처리방침</title>\r\n',
  'tuckaway/terms/index.html': '<!doctype html>\n<title>Terms · 이용약관</title>\n',
  'tuckaway/support/index.html': '<!doctype html>\n<title>Support · 고객 지원</title>',
};
/** Studio root files as they are in the repo. */
const STUDIO = {
  '404.html': '<!doctype html>\n<title>Page not found</title>\n',
  '.nojekyll': '',
};

const split = (html) => {
  const i = html.indexOf('<body>');
  return { head: html.slice(0, i), body: html.slice(i) };
};
const sectionsOf = (html) => html.match(/<section class="card"[\s\S]*?<\/section>\n/g) ?? [];
const idsOf = (html) => [...html.matchAll(/<h2 id="([^"]*)">/g)].map((m) => m[1]);
const GOLDEN = split(GOLDEN_INDEX);
const TUCKAWAY_SECTION = sectionsOf(GOLDEN_INDEX)[0];
const card = (fields) => `${JSON.stringify(fields, null, 2)}\n`;

// ---------- fixture helpers ----------

const temps = [];
after(() => {
  for (const d of temps) rmSync(d, { recursive: true, force: true });
});
function tempDir(prefix) {
  const d = mkdtempSync(join(tmpdir(), prefix));
  temps.push(d);
  return d;
}

/** A throwaway repo with the given files and .github/build.mjs (plus .git/ and .github/ decoys). */
function makeRepo(files) {
  const repo = tempDir('atto-site-repo-');
  const all = {
    '.git/HEAD': 'ref: refs/heads/main\n',
    '.git/config': '[core]\n',
    '.github/workflows/pages.yml': 'name: decoy\n',
    '.github/README.md': '# decoy\n',
    ...files,
  };
  for (const [rel, content] of Object.entries(all)) {
    const p = join(repo, ...rel.split('/'));
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, content);
  }
  copyFileSync(BUILD, join(repo, '.github', 'build.mjs'));
  return repo;
}

/**
 * Runs the repo's build.mjs. `env` values of null remove that variable. The run summary goes to a
 * fresh file (never to the summary of a CI run of this self-test) and is returned as `summary`.
 */
function build(repo, { out, env = {}, nodeArgs = [] } = {}) {
  const outDir = out ?? join(tempDir('atto-site-out-'), 'site');
  const summaryFile = join(tempDir('atto-site-summary-'), 'summary.md');
  const fullEnv = { ...process.env, SOURCE_DATE_EPOCH: EPOCH_2026, GITHUB_STEP_SUMMARY: summaryFile };
  for (const [k, v] of Object.entries(env)) {
    if (v === null) delete fullEnv[k];
    else fullEnv[k] = v;
  }
  const r = spawnSync(process.execPath, [...nodeArgs, join(repo, '.github', 'build.mjs'), outDir], { encoding: 'utf8', env: fullEnv });
  const lines = r.stdout.split('\n');
  let index = null;
  try { index = readFileSync(join(outDir, 'index.html'), 'utf8'); } catch { /* not built */ }
  let summary = null;
  try { summary = readFileSync(summaryFile, 'utf8'); } catch { /* not written */ }
  return {
    status: r.status,
    stdout: r.stdout,
    stderr: r.stderr,
    out: outDir,
    index,
    summary,
    lines,
    warnings: lines.filter((l) => l.startsWith('::warning::')),
  };
}

/** The runner reads a workflow command from any line that starts with "::" after leading spaces. */
function assertOnlyWarningCommands(text, what) {
  for (const l of text.split('\n')) {
    if (l.trimStart().startsWith('::')) assert.ok(l.startsWith('::warning::'), `${what}: only ::warning:: command lines, got ${JSON.stringify(l)}`);
  }
}

/** Sorted posix paths of the regular files under dir (symlinks and skipped roots not included). */
function filesUnder(dir, skipRoot = new Set()) {
  const found = [];
  const walk = (abs, rel) => {
    for (const name of readdirSync(abs).sort()) {
      const r = rel ? `${rel}/${name}` : name;
      if (!rel && skipRoot.has(name)) continue;
      const st = lstatSync(join(abs, name));
      if (st.isDirectory()) walk(join(abs, name), r);
      else if (st.isFile()) found.push(r);
    }
  };
  walk(dir, '');
  return found;
}

/** (f) The output holds every published repo file byte for byte, plus index.html, and nothing else. */
function assertMirror(repo, out, extraSkip = []) {
  const skip = new Set(['.git', '.github', 'index.html', ...extraSkip]);
  const repoFiles = filesUnder(repo, skip);
  const outFiles = filesUnder(out);
  assert.deepEqual(outFiles, [...repoFiles, 'index.html'].sort(), 'output file list = repo files + index.html');
  for (const rel of repoFiles) {
    const a = readFileSync(join(repo, ...rel.split('/')));
    const b = readFileSync(join(out, ...rel.split('/')));
    assert.ok(a.equals(b), `${rel} is byte-identical`);
  }
  return repoFiles;
}

function assertOk(r) {
  assert.equal(r.status, 0, `build exits 0\n${r.stdout}\n${r.stderr}`);
  assert.ok(!r.lines.some((l) => l.startsWith('::error')), 'no ::error line');
  assert.ok(r.index, 'index.html written');
}

// ---------- tests ----------

test('(a) tuckaway only: body equals the old home page, head differs only in the description', () => {
  const repo = makeRepo({ ...STUDIO, ...TUCKAWAY });
  const r = build(repo);
  assertOk(r);
  assert.deepEqual(r.warnings, []);
  const got = split(r.index);
  assert.equal(got.body, GOLDEN.body);
  const oldHead = GOLDEN.head.split('\n');
  const newHead = got.head.split('\n');
  assert.equal(newHead.length, oldHead.length);
  const changed = oldHead.map((line, i) => (line === newHead[i] ? -1 : i)).filter((i) => i >= 0);
  assert.deepEqual(changed.map((i) => oldHead[i]), [OLD_DESCRIPTION]);
  assert.deepEqual(changed.map((i) => newHead[i]), [NEW_DESCRIPTION]);
  assert.equal(r.index, GOLDEN_INDEX.replace(OLD_DESCRIPTION, NEW_DESCRIPTION));
  assertMirror(repo, r.out);
  assert.match(r.stdout, /files copied: 6 /);
  assert.match(r.stdout, /cards rendered: 1 \(tuckaway\)/);
});

test('(a) footer year: UTC year of SOURCE_DATE_EPOCH, else of the current time', () => {
  const repo = makeRepo({ ...STUDIO, ...TUCKAWAY });
  assert.match(build(repo, { env: { SOURCE_DATE_EPOCH: '1956528000' } }).index, /<p>© 2032 Atto Studio<\/p>/);
  const now = build(repo, { env: { SOURCE_DATE_EPOCH: null } });
  assertOk(now);
  const year = new Date().getUTCFullYear();
  assert.ok(now.index.includes(`<p>© ${year} Atto Studio</p>`) || now.index.includes(`<p>© ${year + 1} Atto Studio</p>`));
});

test('(b) a new app is appended after tuckaway and leaves the page above it unchanged', () => {
  const zeta = { 'zeta/card.json': card({ name: 'Zeta', summary: 'Second game.', since: '2026-10-15' }) };
  const r = build(makeRepo({ ...STUDIO, ...TUCKAWAY, ...zeta }));
  assertOk(r);
  assert.deepEqual(r.warnings, []);
  const zetaSection = '<section class="card" aria-labelledby="zeta">\n  <h2 id="zeta">Zeta</h2>\n  <p>Second game.</p>\n</section>\n';
  const expectedBody = GOLDEN.body.replace('\n<footer>', `\n${zetaSection}\n<footer>`);
  assert.equal(split(r.index).body, expectedBody);
});

test('(b) order is since, then folder name; earlier apps go first; tuckaway section never changes', () => {
  const r = build(makeRepo({
    ...STUDIO,
    ...TUCKAWAY,
    'zeta/card.json': card({ name: 'Zeta', summary: 'Later.', since: '2026-10-15' }),
    'early/card.json': card({ name: 'Early', summary: 'Earlier.', since: '2026-01-01' }),
    'aaa-same/card.json': card({ name: 'Same day A', summary: 'Same day.', since: '2026-09-29' }),
    'zzz-same/card.json': card({ name: 'Same day Z', summary: 'Same day.', since: '2026-09-29' }),
    '2048/card.json': card({ name: 'Numbers', summary: 'Digits in the folder name.', since: '2027-01-01' }),
  }));
  assertOk(r);
  assert.deepEqual(idsOf(r.index), ['early', 'aaa-same', 'tuckaway', 'zzz-same', 'zeta', '2048']);
  assert.equal(sectionsOf(r.index)[2], TUCKAWAY_SECTION);
});

test('(c) broken cards and bad links are skipped with warnings; exit 0; other cards unchanged', () => {
  const repo = makeRepo({
    ...STUDIO,
    ...TUCKAWAY,
    'broken/card.json': '{ "name": "Broken", ',
    'broken/index.html': '<p>broken app page</p>\n',
    'noname/card.json': card({ summary: 'No name.', since: '2026-10-01' }),
    'baddate/card.json': card({ name: 'Bad date', summary: 'Feb 30.', since: '2026-02-30' }),
    'notobject/card.json': '["name"]\n',
    // JSON.parse echoes this text, newline included, in its error message.
    'inject/card.json': 'x\n::error::pwned\n',
    'badlinks/card.json': card({
      name: 'Bad links',
      summary: 'Some links are bad.',
      since: '2026-10-02',
      links: [
        { label: 'Up', href: '../x' },
        { label: 'Script', href: 'javascript:alert(1)' },
        { label: 'Protocol-relative', href: '//evil.example/' },
        { label: 'Rooted', href: '/tuckaway/privacy/' },
        { label: 'Backslash', href: 'ok\\..\\x' },
        { label: 'Encoded dots', href: '%2e%2e/tuckaway/' },
        { label: 'Tab dots', href: '.\t./x' },
        { label: 'Hidden', href: '.well-known/x' },
        { label: 'Fine', label_ko: '괜찮음', href: 'ok.html#top' },
        { label: 'External', href: 'https://example.com/help' },
      ],
    }),
    'badlinks/ok.html': 'ok\n',
    'badlinks/.well-known/x': 'hidden\n',
    'badlinks2/card.json': card({
      name: 'More bad links',
      summary: 'More links are bad.',
      since: '2026-10-02',
      links: [
        { label: 'Missing file', href: 'missing/' },
        { label: 'Folder without slash', href: 'faq' },
        { label: 'Injection', href: 'x\n::error::pwned' },
        { label: 'Http', href: 'http://example.com/' },
        { label: '', href: 'faq/' },
        'not an object',
        { label: 'Other app', href: 'tuckaway/privacy/' },
        { label: 'FAQ', href: 'faq/' },
      ],
    }),
    'badlinks2/faq/index.html': 'faq\n',
    'badtypes/card.json': card({
      name: 'Bad optional fields',
      name_ko: 42,
      summary: 'Optional fields are wrong.',
      summary_ko: 'x'.repeat(201),
      since: '2026-10-03',
      links: 'privacy/',
      contact: '<script>@example.com',
    }),
    'Bad_Name/card.json': card({ name: 'Bad folder', summary: 'Upper case and underscore.', since: '2026-10-04' }),
    'Bad_Name/page.html': 'still published\n',
    'nocard/page.html': 'no card here\n',
  });
  const r = build(repo);
  assertOk(r);
  assert.deepEqual(idsOf(r.index), ['tuckaway', 'badlinks', 'badlinks2', 'badtypes']);
  assert.equal(sectionsOf(r.index)[0], TUCKAWAY_SECTION);
  assert.equal(sectionsOf(r.index)[1], [
    '<section class="card" aria-labelledby="badlinks">',
    '  <h2 id="badlinks">Bad links</h2>',
    '  <p>Some links are bad.</p>',
    '  <ul>',
    '    <li><a href="badlinks/ok.html#top">Fine · <span lang="ko">괜찮음</span></a></li>',
    '    <li><a href="https://example.com/help">External</a></li>',
    '  </ul>',
    '</section>',
    '',
  ].join('\n'));
  assert.equal(sectionsOf(r.index)[2], [
    '<section class="card" aria-labelledby="badlinks2">',
    '  <h2 id="badlinks2">More bad links</h2>',
    '  <p>More links are bad.</p>',
    '  <ul>',
    '    <li><a href="badlinks2/faq/">FAQ</a></li>',
    '  </ul>',
    '</section>',
    '',
  ].join('\n'));
  assert.equal(sectionsOf(r.index)[3], '<section class="card" aria-labelledby="badtypes">\n  <h2 id="badtypes">Bad optional fields</h2>\n  <p>Optional fields are wrong.</p>\n</section>\n');
  const w = r.warnings.join('\n');
  for (const needle of [
    'broken/card.json: card.json is not valid JSON',
    'noname/card.json: invalid or missing "name"',
    'baddate/card.json: invalid or missing "since"',
    'notobject/card.json: card.json must be a JSON object',
    'inject/card.json: card.json is not valid JSON',
    'badlinks/card.json: links[0]: href must not contain ".."',
    'badlinks/card.json: links[1]: href must be a path inside the app folder or an https:// URL',
    'badlinks/card.json: links[2]: href must not start with "/"',
    'badlinks/card.json: links[3]: href must not start with "/"',
    'badlinks/card.json: links[4]: href must not contain "\\"',
    'badlinks/card.json: links[5]: href must not percent-encode',
    'badlinks/card.json: links[6]: href must not contain spaces or control characters',
    'badlinks/card.json: links[7]: href must not point into a hidden (dot) file or folder',
    'badlinks2/card.json: links[0]: target file badlinks2/missing/index.html does not exist',
    'badlinks2/card.json: links[1]: href points to a folder: write "faq/"',
    'badlinks2/card.json: links[2]: href must not contain spaces or control characters',
    'badlinks2/card.json: links[3]: href must be a path inside the app folder or an https:// URL',
    'badlinks2/card.json: links[4]: "label" must be text of 1-60 characters',
    'badlinks2/card.json: links[5] must be an object',
    'badlinks2/card.json: links[6]: target file badlinks2/tuckaway/privacy/index.html does not exist',
    'badtypes/card.json: "name_ko" must be text',
    'badtypes/card.json: "summary_ko" must be text',
    'badtypes/card.json: "links" must be an array',
    'badtypes/card.json: "contact" must be an email address',
    'Bad_Name/card.json: folder name is not a valid app folder name',
  ]) {
    assert.ok(w.includes(needle), `warning mentions: ${needle}\n--- warnings ---\n${w}`);
  }
  // A card can never start a workflow command of its own: every command line is a ::warning::, and
  // the newline that JSON.parse echoes from inject/card.json (Node 20+) is escaped as %0A.
  assertOnlyWarningCommands(r.stdout, 'log');
  assertOnlyWarningCommands(r.summary, 'run summary');
  if (r.stdout.includes('pwned')) assert.ok(r.stdout.includes('%0A::error::pwned'), 'echoed newline is escaped as %0A');
  assert.match(r.stdout, /cards skipped: 6\n/);
  assertMirror(repo, r.out);
});

test('(c) more than 10 links: the first 10 are used', () => {
  const links = Array.from({ length: 12 }, (_, i) => ({ label: `L${i}`, href: `p${i}.html` }));
  const files = Object.fromEntries(links.map((l) => [`many/${l.href}`, 'x']));
  const r = build(makeRepo({ ...files, 'many/card.json': card({ name: 'Many', summary: 'Many links.', since: '2026-10-01', links }) }));
  assertOk(r);
  assert.equal((r.index.match(/<li>/g) ?? []).length, 10);
  assert.ok(r.warnings.some((l) => l.includes('"links" has 12 entries; only the first 10 are used')));
});

test('(d) every card field is HTML-escaped', () => {
  const r = build(makeRepo({
    'xss/card.json': card({
      name: '<script>alert("n")</script>',
      name_ko: "'ko' & \"q\"",
      summary: "<b>s</b> & 'x'",
      summary_ko: '<i>"k"</i>',
      since: '2026-10-01',
      links: [
        { label: '<script>l</script>', label_ko: "'lk' \"<>\"", href: "page.html?a=1&b='2'#\"x\"" },
        { label: 'ext', href: "https://example.com/?q=<script>&r='1'\"" },
      ],
      contact: 'x+y@example.com',
    }),
    'xss/page.html': 'page\n',
  }));
  assertOk(r);
  assert.deepEqual(r.warnings, []);
  assert.equal(sectionsOf(r.index)[0], [
    '<section class="card" aria-labelledby="xss">',
    '  <h2 id="xss">&lt;script&gt;alert(&quot;n&quot;)&lt;/script&gt;</h2>',
    '  <p class="meta" lang="ko">&#39;ko&#39; &amp; &quot;q&quot;</p>',
    '  <p>&lt;b&gt;s&lt;/b&gt; &amp; &#39;x&#39;<br><span lang="ko">&lt;i&gt;&quot;k&quot;&lt;/i&gt;</span></p>',
    '  <ul>',
    '    <li><a href="xss/page.html?a=1&amp;b=&#39;2&#39;#&quot;x&quot;">&lt;script&gt;l&lt;/script&gt; · <span lang="ko">&#39;lk&#39; &quot;&lt;&gt;&quot;</span></a></li>',
    '    <li><a href="https://example.com/?q=&lt;script&gt;&amp;r=&#39;1&#39;&quot;">ext</a></li>',
    '  </ul>',
    '  <p>Contact · <span lang="ko">문의</span>: <a href="mailto:x+y@example.com">x+y@example.com</a></p>',
    '</section>',
    '',
  ].join('\n'));
  assert.ok(!r.index.includes('<script'), 'no raw <script in the page');
});

test('(e)(f) Jekyll-looking files, _folders, front matter, binaries and CRLF are copied byte for byte', () => {
  const binary = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0xff, 0xfe, 0x0d, 0x0a, 0x7b, 0x7b]);
  const repo = makeRepo({
    ...STUDIO,
    ...TUCKAWAY,
    'CNAME': 'example.com\n',
    'app-ads.txt': 'google.com, pub-0000000000000000, DIRECT, f08c47fec0942fa0\n',
    'jekyll/README.md': '# Readme\n\n{{ x }}\n\n{% raw %}{{ y }}{% endraw %}\n',
    'jekyll/front.html': '---\ntitle: Front matter\nlayout: default\n---\n<h1>{{ page.title }}</h1>\n',
    'jekyll/_layouts/default.html': '{{ content }}\n',
    '_underscore/index.html': '<p>underscore folder</p>\n',
    '_underscore/_config.yml': 'exclude: [everything]\n',
    'jekyll/crlf.txt': 'line 1\r\nline 2\r\n',
    'jekyll/bom.txt': '﻿bom first\n',
    'jekyll/image.png': binary,
    'jekyll/한글 이름.html': '<p>한글</p>\n',
    'jekyll/.hidden': 'dotfile\n',
    'jekyll/index.html': '<p>app index is not the root index</p>\n',
  });
  const r = build(repo);
  assertOk(r);
  // Only the portable-path rule complains (the files are still published byte for byte).
  assert.deepEqual(r.warnings.map((w) => w.slice(0, w.indexOf(')') + 1)), [
    '::warning::jekyll/.hidden: not a portable path (starts with ".")',
    '::warning::"jekyll/한글 이름.html": not a portable path (uses characters other than A-Z a-z 0-9 . _ -)',
  ]);
  const published = assertMirror(repo, r.out);
  for (const rel of ['CNAME', 'app-ads.txt', 'jekyll/README.md', 'jekyll/front.html', 'jekyll/_layouts/default.html', '_underscore/index.html', 'jekyll/image.png', 'jekyll/한글 이름.html', '.nojekyll']) {
    assert.ok(published.includes(rel), `${rel} is published`);
  }
  assert.equal(readFileSync(join(r.out, 'jekyll', 'README.md'), 'utf8'), '# Readme\n\n{{ x }}\n\n{% raw %}{{ y }}{% endraw %}\n');
  assert.ok(readFileSync(join(r.out, 'jekyll', 'image.png')).equals(binary));
  assert.deepEqual(idsOf(r.index), ['tuckaway']);
});

test('(f) .git/, .github/ and a committed root index.html are not published; the page is generated', () => {
  const repo = makeRepo({ ...STUDIO, ...TUCKAWAY, 'index.html': '<p>stale hand-written home page</p>\n' });
  const r = build(repo);
  assertOk(r);
  assert.ok(r.warnings.some((l) => l.includes('index.html at the repo root is ignored')));
  assert.equal(r.index, GOLDEN_INDEX.replace(OLD_DESCRIPTION, NEW_DESCRIPTION));
  assertMirror(repo, r.out);
  for (const p of ['.git', '.github']) assert.throws(() => lstatSync(join(r.out, p)), `${p} not in output`);
});

test('output folder inside the repo (a local _site/; CI builds outside the checkout) is skipped while copying', () => {
  const repo = makeRepo({ ...STUDIO, ...TUCKAWAY });
  const r = build(repo, { out: join(repo, '_site') });
  assertOk(r);
  assertMirror(repo, r.out, ['_site']);
  assert.throws(() => lstatSync(join(r.out, '_site')));
});

test('no valid card: header and footer only', () => {
  const r = build(makeRepo({ ...STUDIO, 'broken/card.json': '{' }));
  assertOk(r);
  assert.equal(split(r.index).body, GOLDEN.body.replace(TUCKAWAY_SECTION + '\n', ''));
  assert.deepEqual(sectionsOf(r.index), []);
});

test('the build is deterministic', () => {
  const repo = makeRepo({ ...STUDIO, ...TUCKAWAY, 'zeta/card.json': card({ name: 'Zeta', summary: 'Z.', since: '2026-10-15' }) });
  const a = build(repo);
  const b = build(repo);
  assertOk(a);
  assert.equal(a.index, b.index);
  assert.equal(a.stdout.replace(a.out, 'OUT'), b.stdout.replace(b.out, 'OUT'));
  assert.equal(a.summary, b.summary);
});

test('fatal errors only for the build itself: missing or non-empty output folder', () => {
  const repo = makeRepo({ ...STUDIO, ...TUCKAWAY });
  const busy = tempDir('atto-site-busy-');
  writeFileSync(join(busy, 'keep.txt'), 'x');
  const r = build(repo, { out: busy });
  assert.equal(r.status, 1);
  assert.ok(r.lines.some((l) => l.startsWith('::error::') && l.includes('is not empty')));
  assert.equal(readFileSync(join(busy, 'keep.txt'), 'utf8'), 'x', 'existing files are left alone');
  assert.match(r.summary, /^## Atto Studio site build failed\n[\s\S]*is not empty/);
  const noArg = spawnSync(process.execPath, [join(repo, '.github', 'build.mjs')], { encoding: 'utf8', env: { ...process.env, GITHUB_STEP_SUMMARY: '' } });
  assert.equal(noArg.status, 1);
  assert.match(noArg.stdout, /::error::usage/);
  const self = build(repo, { out: repo });
  assert.equal(self.status, 1);
});

test('symlinks are never followed (skipped with a warning)', (t) => {
  const repo = makeRepo({ ...STUDIO, ...TUCKAWAY, 'linky/page.html': 'real\n' });
  const secret = join(tempDir('atto-site-secret-'), 'secret.txt');
  writeFileSync(secret, 'SECRET\n');
  try {
    symlinkSync(secret, join(repo, 'linky', 'leak.txt'));
    symlinkSync(dirname(secret), join(repo, 'linky', 'leakdir'), 'dir');
  } catch (e) {
    t.skip(`cannot create symlinks here (${e.code})`);
    return;
  }
  const r = build(repo);
  assertOk(r);
  assert.ok(r.warnings.some((l) => l.includes('linky/leak.txt: symbolic link skipped')));
  assert.ok(r.warnings.some((l) => l.includes('linky/leakdir: symbolic link skipped')));
  assertMirror(repo, r.out);
  assert.throws(() => lstatSync(join(r.out, 'linky', 'leak.txt')));
  assert.equal(readFileSync(join(r.out, 'linky', 'page.html'), 'utf8'), 'real\n');
});

// ---------- card text and "since" ----------

test('(g) card text: control/format characters, 3+ combining marks and blank name/summary', () => {
  const r = build(makeRepo({
    ...STUDIO,
    ...TUCKAWAY,
    'zwsp/card.json': card({ name: 'Zero\u200bwidth', summary: 'Format character in the name.', since: '2026-10-01' }),
    'bell/card.json': card({ name: 'Bell', summary: 'Control \u0007 character.', since: '2026-10-01' }),
    'blank/card.json': card({ name: ' \u3000 ', summary: 'Blank name.', since: '2026-10-01' }),
    'blanksum/card.json': card({ name: 'Blank summary', summary: '   ', since: '2026-10-01' }),
    'zalgo/card.json': card({ name: 'Zalgo', summary: 'e\u0301\u0302\u0303 has three marks.', since: '2026-10-01' }),
    'optional/card.json': card({
      name: 'Optional fields',
      name_ko: '이름\u202e',
      summary: 'Optional text breaks the rules.',
      summary_ko: 'a\u0301\u0301\u0301',
      since: '2026-10-02',
      links: [
        { label: 'Bidi\u202eLabel', href: 'a.html' },
        { label: 'Good', label_ko: '좋음\u200d', href: 'a.html' },
        { label: 'Two marks', label_ko: 'e\u0301\u0301', href: 'a.html' },
      ],
    }),
    'optional/a.html': 'a\n',
    'marks2/card.json': card({ name: 'Cafe\u0301\u0301', summary: 'Two combining marks are fine.', since: '2026-10-03' }),
    'longrun/card.json': card({ name: 'A'.repeat(31), summary: 'A run of 31.', since: '2026-10-04' }),
    'run30/card.json': card({ name: `${'B'.repeat(30)} ${'C'.repeat(30)}`, summary: 'Runs of 30 are fine.', since: '2026-10-05' }),
  }));
  assertOk(r);
  assert.deepEqual(idsOf(r.index), ['tuckaway', 'optional', 'marks2', 'longrun', 'run30']);
  assert.equal(sectionsOf(r.index)[1], [
    '<section class="card" aria-labelledby="optional">',
    '  <h2 id="optional">Optional fields</h2>',
    '  <p>Optional text breaks the rules.</p>',
    '  <ul>',
    '    <li><a href="optional/a.html">Good</a></li>',
    '    <li><a href="optional/a.html">Two marks · <span lang="ko">e\u0301\u0301</span></a></li>',
    '  </ul>',
    '</section>',
    '',
  ].join('\n'));
  assert.ok(!/[\u200b\u200d\u202e\u0007]/.test(r.index), 'no rejected character reaches the page');
  assert.ok(!/[\u200b\u200d\u202e\u0007]/.test(r.stdout), 'warnings show rejected characters as \\uXXXX');
  const w = r.warnings.join('\n');
  for (const needle of [
    'zwsp/card.json: invalid or missing "name" (required: must not contain control or format characters (found U+200B))',
    'bell/card.json: invalid or missing "summary" (required: must not contain control or format characters (found U+0007))',
    'blank/card.json: invalid or missing "name" (required: must contain a character that is not a space)',
    'blanksum/card.json: invalid or missing "summary" (required: must contain a character that is not a space)',
    'zalgo/card.json: invalid or missing "summary" (required: must not contain 3 or more combining marks in a row)',
    'optional/card.json: "name_ko" must not contain control or format characters (found U+202E); ignored ("이름\\u202E")',
    'optional/card.json: "summary_ko" must not contain 3 or more combining marks in a row; ignored',
    'optional/card.json: links[0]: "label" must not contain control or format characters (found U+202E); link dropped',
    'optional/card.json: links[1]: "label_ko" must not contain control or format characters (found U+200D); ignored',
    'longrun/card.json: "name" has 31 characters in a row without a space (more than 30)',
  ]) {
    assert.ok(w.includes(needle), `warning mentions: ${needle}\n--- warnings ---\n${w}`);
  }
  assert.equal(r.warnings.length, 10, w);
  assert.match(r.stdout, /cards skipped: 5\n/);
});

test('(g) card text: lone surrogates are rejected; surrogate pairs (emoji) are fine', () => {
  // card() writes a lone surrogate as a JSON escape ("\ud800"): card.json itself is valid UTF-8.
  const r = build(makeRepo({
    ...STUDIO,
    ...TUCKAWAY,
    'lone/card.json': card({ name: 'Lone \ud800 high', summary: 'Lone surrogate in the name.', since: '2026-10-01' }),
    'lonesum/card.json': card({ name: 'Lone low', summary: 'Ends with a lone low surrogate \udfff', since: '2026-10-01' }),
    'loneopt/card.json': card({
      name: 'Lone optional',
      name_ko: '\udc00이름',
      summary: 'Optional text has lone surrogates.',
      summary_ko: '요약\ud83d',
      since: '2026-10-02',
      links: [
        { label: 'Cut \ud83d', href: 'a.html' },
        { label: 'Good', label_ko: '좋음\ud800', href: 'a.html' },
      ],
    }),
    'loneopt/a.html': 'a\n',
    'emoji/card.json': card({ name: 'Fox 🦊', name_ko: '여우 🦊', summary: 'Surrogate pairs are fine 😀.', since: '2026-10-03', links: [{ label: 'Page 📄', href: 'a.html' }] }),
    'emoji/a.html': 'a\n',
  }));
  assertOk(r);
  assert.deepEqual(idsOf(r.index), ['tuckaway', 'loneopt', 'emoji']);
  assert.equal(sectionsOf(r.index)[1], '<section class="card" aria-labelledby="loneopt">\n  <h2 id="loneopt">Lone optional</h2>\n  <p>Optional text has lone surrogates.</p>\n  <ul>\n    <li><a href="loneopt/a.html">Good</a></li>\n  </ul>\n</section>\n');
  assert.equal(sectionsOf(r.index)[2], [
    '<section class="card" aria-labelledby="emoji">',
    '  <h2 id="emoji">Fox 🦊</h2>',
    '  <p class="meta" lang="ko">여우 🦊</p>',
    '  <p>Surrogate pairs are fine 😀.</p>',
    '  <ul>',
    '    <li><a href="emoji/a.html">Page 📄</a></li>',
    '  </ul>',
    '</section>',
    '',
  ].join('\n'));
  const w = r.warnings.join('\n');
  for (const needle of [
    'lone/card.json: invalid or missing "name" (required: must not contain lone surrogates (found U+D800))',
    'lonesum/card.json: invalid or missing "summary" (required: must not contain lone surrogates (found U+DFFF))',
    'loneopt/card.json: "name_ko" must not contain lone surrogates (found U+DC00); ignored ("\\udc00이름")',
    'loneopt/card.json: "summary_ko" must not contain lone surrogates (found U+D83D); ignored',
    'loneopt/card.json: links[0]: "label" must not contain lone surrogates (found U+D83D); link dropped',
    'loneopt/card.json: links[1]: "label_ko" must not contain lone surrogates (found U+D800); ignored',
  ]) {
    assert.ok(w.includes(needle), `warning mentions: ${needle}\n--- warnings ---\n${w}`);
  }
  assert.equal(r.warnings.length, 6, w);
  assert.ok(!r.stdout.includes('�') && !r.summary.includes('�'), 'a lone surrogate is never printed raw');
  assert.ok(!r.index.includes('�'));
});

test('(h) a "since" after the build date (UTC) is a warning; the card is still shown', () => {
  const r = build(makeRepo({ ...STUDIO, ...TUCKAWAY, 'future/card.json': card({ name: 'Future', summary: 'Not yet.', since: '2027-01-01' }) }));
  assertOk(r);
  assert.deepEqual(idsOf(r.index), ['tuckaway', 'future']);
  assert.equal(r.warnings.length, 1);
  assert.ok(r.warnings[0].includes('future/card.json: "since" 2027-01-01 is after the build date 2026-12-31 (UTC); the card is still shown.'));
  const repo = makeRepo({ ...STUDIO, ...TUCKAWAY });
  const sameDay = build(repo, { env: { SOURCE_DATE_EPOCH: String(Date.UTC(2026, 8, 29) / 1000) } });
  assertOk(sameDay);
  assert.deepEqual(sameDay.warnings, [], 'since = build date is fine');
  const dayBefore = build(repo, { env: { SOURCE_DATE_EPOCH: String(Date.UTC(2026, 8, 28, 23, 59, 59) / 1000) } });
  assertOk(dayBefore);
  assert.deepEqual(idsOf(dayBefore.index), ['tuckaway']);
  assert.ok(dayBefore.warnings.some((l) => l.includes('tuckaway/card.json: "since" 2026-09-29 is after the build date 2026-09-28')));
});

test('(i) a deeply nested optional value drops only that field', () => {
  // 3 x 20000 bytes: deep enough for Node 24's JSON.stringify to give up, small enough for the
  // 64 KiB card.json limit.
  const deep = '['.repeat(10000) + ']'.repeat(10000);
  const r = build(makeRepo({
    'deep/card.json': `{"name": "Deep", "summary": "Deep optional values.", "since": "2026-10-01", "name_ko": ${deep},
      "links": [{"label": ${deep}, "href": "a.html"}, {"label": "Fine", "href": "a.html", "label_ko": ${deep}}]}`,
    'deep/a.html': 'a\n',
  }));
  assertOk(r);
  assert.equal(sectionsOf(r.index)[0], '<section class="card" aria-labelledby="deep">\n  <h2 id="deep">Deep</h2>\n  <p>Deep optional values.</p>\n  <ul>\n    <li><a href="deep/a.html">Fine</a></li>\n  </ul>\n</section>\n');
  // The quoted value is "<array>" where JSON.stringify and String() give up on the depth (Node 24),
  // a shortened "[[[[..." where they do not (newer V8): either way only the field is dropped.
  const w = r.warnings.join('\n');
  for (const needle of [
    'deep/card.json: "name_ko" must be text of at most 80 characters; ignored (',
    'deep/card.json: links[0]: "label" must be text of 1-60 characters; link dropped (',
    'deep/card.json: links[1]: "label_ko" must be text of at most 60 characters; ignored (',
  ]) {
    assert.ok(w.includes(needle), `warning mentions: ${needle}\n--- warnings ---\n${w}`);
  }
});

test('(i) a card.json over 64 KiB is not read: the card is skipped with a warning, the files are published', () => {
  assert.equal(MAX_CARD_BYTES, 64 * 1024);
  /** A card.json of exactly `size` bytes: the fields, padded with spaces before the closing brace. */
  const sized = (fields, size) => {
    const text = JSON.stringify(fields);
    return `${text.slice(0, -1)}${' '.repeat(size - Buffer.byteLength(text))}}`;
  };
  const repo = makeRepo({
    ...STUDIO,
    ...TUCKAWAY,
    'fits/card.json': sized({ name: 'Fits', summary: 'Exactly 64 KiB.', since: '2026-10-01' }, MAX_CARD_BYTES),
    'toobig/card.json': sized({ name: 'Too big', summary: 'One byte over 64 KiB.', since: '2026-10-01' }, MAX_CARD_BYTES + 1),
    'toobig/page.html': 'still published\n',
  });
  assert.equal(statSync(join(repo, 'fits', 'card.json')).size, 65536);
  assert.equal(statSync(join(repo, 'toobig', 'card.json')).size, 65537);
  const r = build(repo);
  assertOk(r);
  assert.deepEqual(idsOf(r.index), ['tuckaway', 'fits']);
  assert.deepEqual(r.warnings, [
    "::warning::toobig/card.json: card.json is 65537 bytes, larger than 64 KiB (65536 bytes); card skipped (the folder's files are still published)",
  ]);
  assert.match(r.stdout, /cards skipped: 1\n {4}- toobig: card\.json is 65537 bytes, larger than 64 KiB/);
  assertMirror(repo, r.out);
});

test('show(): JSON form, shortened, never throws', () => {
  // Values that make both JSON.stringify and String() throw, whatever the engine's depth limits.
  const fail = () => { throw new RangeError('Maximum call stack size exceeded'); };
  const arr = [];
  arr.toJSON = fail;
  arr.toString = fail;
  assert.equal(show(arr), '<array>');
  assert.equal(show({ toJSON: fail, toString: fail }), '<object>');
  assert.equal(show({ toJSON: fail }), '[object Object]', 'String() is the first fallback');
  let deep = [];
  for (let i = 0; i < 200000; i++) deep = [deep];
  const shown = show(deep);
  assert.ok(shown === '<array>' || shown === `${'['.repeat(117)}...`, shown.slice(0, 20));
  assert.equal(show('a\u202eb\nc'), '"a\\u202Eb\\nc"');
  assert.equal(show(42), '42');
  assert.equal(show(undefined), 'undefined');
  assert.equal(show('x'.repeat(200)), `"${'x'.repeat(116)}...`);
});

// ---------- repo layout rules ----------

test('(j) root files: the studio allowlist is quiet; any other root file is published with a warning', () => {
  assert.deepEqual([...ROOT_FILES].sort(), ['.gitattributes', '.gitignore', '.nojekyll', '404.html', 'CNAME', 'app-ads.txt']);
  const repo = makeRepo({
    ...STUDIO,
    ...TUCKAWAY,
    'CNAME': 'example.com\n',
    'app-ads.txt': 'x\n',
    '.gitignore': '_site/\n',
    '.gitattributes': '* -text\n',
    'README.md': '# app notes\n',
    'package.json': '{}\n',
    'notes.txt': 'x\n',
  });
  const r = build(repo);
  assertOk(r);
  assert.deepEqual(r.warnings.map((l) => l.slice(0, l.indexOf(' ('))), [
    '::warning::README.md: not a studio root file',
    '::warning::notes.txt: not a studio root file',
    '::warning::package.json: not a studio root file',
  ]);
  assertMirror(repo, r.out);
  assert.equal(r.index, GOLDEN_INDEX.replace(OLD_DESCRIPTION, NEW_DESCRIPTION));
});

test('(k) non-portable paths inside app folders: one warning each, still published', () => {
  const long = `${'a'.repeat(96)}.html`;
  const repo = makeRepo({
    ...STUDIO,
    ...TUCKAWAY,
    'port/card.json': card({ name: 'Port', summary: 'Portable path rules.', since: '2026-10-01' }),
    'port/Hello World.html': 'space\n',
    'port/한글.html': 'hangul\n',
    'port/.well-known/assetlinks.json': '[]\n',
    'port/Bad Dir/a.html': 'a\n',
    'port/Bad Dir/b.html': 'b\n',
    [`port/${long}`]: '101 bytes\n',
    [`port/${'b'.repeat(95)}.html`]: '100 bytes\n',
    'port/UPPER_lower-1.2.html': 'fine\n',
  });
  const r = build(repo);
  assertOk(r);
  assert.deepEqual(r.warnings.map((l) => l.slice(0, l.indexOf(')') + 1)), [
    '::warning::port/.well-known: not a portable path (starts with ".")',
    '::warning::"port/Bad Dir": not a portable path (uses characters other than A-Z a-z 0-9 . _ -)',
    '::warning::"port/Hello World.html": not a portable path (uses characters other than A-Z a-z 0-9 . _ -)',
    `::warning::port/${long}: not a portable path (is longer than 100 bytes)`,
    '::warning::"port/한글.html": not a portable path (uses characters other than A-Z a-z 0-9 . _ -)',
  ]);
  assert.ok(r.warnings.every((l) => l.endsWith("still published. Rename it: a path Windows cannot check out breaks every app's publish tool.")));
  assertMirror(repo, r.out);
  assert.deepEqual(idsOf(r.index), ['tuckaway', 'port']);
});

test('(k) device names, trailing dots and case-only differences, where the file system can hold them', (t) => {
  if (process.platform === 'win32') {
    t.skip('Windows cannot create these names (the checker test below covers them)');
    return;
  }
  let repo;
  try {
    repo = makeRepo({
      ...STUDIO,
      'dev/con': 'x\n',
      'dev/Aux.html': 'x\n',
      'dev/lpt9.tar.gz': 'x\n',
      'dev/com0.txt': 'fine\n',
      'dev/trail.': 'x\n',
      'dev/Page.html': 'upper\n',
      'dev/page.html': 'lower\n',
      'nul/index.html': 'x\n',
    });
  } catch (e) {
    t.skip(`cannot create these names here (${e.code})`);
    return;
  }
  if (readdirSync(join(repo, 'dev')).length !== 7) {
    t.skip('case-insensitive file system');
    return;
  }
  const r = build(repo);
  assertOk(r);
  assert.deepEqual(r.warnings.map((l) => l.slice(0, l.indexOf(')') + 1)), [
    '::warning::dev/Aux.html: not a portable path (is a Windows device name)',
    '::warning::dev/con: not a portable path (is a Windows device name)',
    '::warning::dev/lpt9.tar.gz: not a portable path (is a Windows device name)',
    '::warning::dev/page.html: not a portable path (dev/Page.html and dev/page.html differ only in letter case)',
    '::warning::dev/trail.: not a portable path (ends with ".")',
    '::warning::nul: not a portable path (is a Windows device name)',
  ]);
  assertMirror(repo, r.out);
});

test('portable paths: the checker (every rule, including names Windows cannot create)', () => {
  const CHARS = 'uses characters other than A-Z a-z 0-9 . _ -';
  const DEV = 'is a Windows device name';
  const LONG = 'is longer than 100 bytes';
  const got = portablePathProblems([
    'app/ok-1_2.v3.html', 'app/UPPER.html', 'app/_layouts/x.html',
    'app/con', 'app/CON.txt', 'app/aux.tar.gz', 'app/Nul', 'app/prn.', 'app/com1', 'app/COM9.x', 'app/lpt1.html',
    'app/com0.txt', 'app/lpt10', 'app/console.html', 'app/connection',
    'app/trail.', 'app/.dot', 'app/sp ace', 'app/tab\t', 'app/한', 'app/colon:x', 'app/back\\slash',
    `app/${'b'.repeat(100)}`, `app/${'a'.repeat(101)}`, `app/${'가'.repeat(34)}`,
    'app/Page.html', 'app/page.html', 'app/PAGE.html',
    'app/Dir/a', 'app/dir/a', 'app/dir/b', 'app/DIR/c',
    'app/deep/Bad Name/x/y.html', 'app/deep/Bad Name/z.html',
    'con/index.html',
  ]);
  assert.deepEqual(got, [
    { path: 'app/.dot', problems: ['starts with "."'] },
    { path: 'app/COM9.x', problems: [DEV] },
    { path: 'app/CON.txt', problems: [DEV] },
    { path: 'app/Dir', problems: ['app/DIR and app/Dir differ only in letter case'] },
    { path: 'app/Nul', problems: [DEV] },
    { path: 'app/Page.html', problems: ['app/PAGE.html and app/Page.html differ only in letter case'] },
    { path: `app/${'a'.repeat(101)}`, problems: [LONG] },
    { path: 'app/aux.tar.gz', problems: [DEV] },
    { path: 'app/back\\slash', problems: [CHARS] },
    { path: 'app/colon:x', problems: [CHARS] },
    { path: 'app/com1', problems: [DEV] },
    { path: 'app/con', problems: [DEV] },
    { path: 'app/deep/Bad Name', problems: [CHARS] },
    { path: 'app/dir', problems: ['app/DIR and app/dir differ only in letter case'] },
    { path: 'app/lpt1.html', problems: [DEV] },
    { path: 'app/page.html', problems: ['app/PAGE.html and app/page.html differ only in letter case'] },
    { path: 'app/prn.', problems: ['ends with "."', DEV] },
    { path: 'app/sp ace', problems: [CHARS] },
    { path: 'app/tab\t', problems: [CHARS] },
    { path: 'app/trail.', problems: ['ends with "."'] },
    { path: `app/${'가'.repeat(34)}`, problems: [CHARS, LONG] },
    { path: 'app/한', problems: [CHARS] },
    { path: 'con', problems: [DEV] },
  ]);
  assert.deepEqual(portablePathProblems(['tuckaway/card.json', 'tuckaway/privacy/index.html', 'tuckaway/terms/index.html']), []);
});

test('file names are decoded as UTF-8 or rejected', () => {
  assert.equal(decodeName(Buffer.from('한글 page.html')), '한글 page.html');
  assert.equal(decodeName(Buffer.from([0x62, 0x61, 0x64, 0xff])), null);
  assert.equal(decodeName(Buffer.from([0xed, 0xa0, 0x80])), null, 'an encoded surrogate');
  assert.equal(decodeName(Buffer.from([0xc0, 0xaf])), null, 'an overlong "/"');
});

test('(l) a name that is not valid UTF-8 is skipped with a warning', (t) => {
  const repo = makeRepo({ ...STUDIO, ...TUCKAWAY, 'raw/ok.html': 'ok\n' });
  const badName = Buffer.from([0x62, 0x61, 0x64, 0xff, 0x2e, 0x68, 0x74, 0x6d, 0x6c]);
  try {
    writeFileSync(Buffer.concat([Buffer.from(join(repo, 'raw') + sep), badName]), 'x\n');
  } catch (e) {
    t.skip(`cannot create a non-UTF-8 name here (${e.code})`);
    return;
  }
  if (!readdirSync(join(repo, 'raw'), { encoding: 'buffer' }).some((n) => n.equals(badName))) {
    t.skip('the file system does not keep non-UTF-8 names');
    return;
  }
  const r = build(repo);
  assertOk(r);
  assert.ok(r.warnings.some((l) => l.includes('name is not valid UTF-8 (bytes 626164ff2e68746d6c); skipped (not published)')), r.warnings.join('\n'));
  assert.deepEqual(readdirSync(join(r.out, 'raw')), ['ok.html']);
  assert.deepEqual(idsOf(r.index), ['tuckaway']);
});

test('(m) a folder name with a newline cannot start a workflow command', (t) => {
  let repo;
  try {
    repo = makeRepo({
      ...STUDIO,
      ...TUCKAWAY,
      'x\n::error::x/card.json': card({ name: 'Injected', summary: 'Newline in the folder name.', since: '2026-10-01' }),
      'x\n::error::x/page\n::error::y.html': 'x\n',
    });
  } catch (e) {
    t.skip(`cannot create a name with a newline here (${e.code})`);
    return;
  }
  const r = build(repo);
  assertOk(r);
  assertOnlyWarningCommands(r.stdout, 'log');
  assertOnlyWarningCommands(r.summary, 'run summary');
  assert.ok(r.warnings.some((l) => l.includes('not a portable path')));
  assert.ok(r.warnings.some((l) => l.includes('folder name is not a valid app folder name')));
  assert.match(r.stdout, /cards skipped: 1\n {4}- "x\\n::error::x": folder name is not a valid app folder name/);
  assert.deepEqual(idsOf(r.index), ['tuckaway']);
});

test('"##[" never survives escaping: "#%23[" in command data, "# #[" in plain log lines', () => {
  assert.equal(cmdEscape('a##[error]b'), 'a#%23[error]b');
  assert.equal(plainEscape('a##[error]b'), 'a# #[error]b');
  assert.equal(cmdEscape('###[##['), '##%23[#%23[');
  assert.equal(plainEscape('###[##['), '## #[# #[');
  assert.equal(cmdEscape('#%23[ 100%\r\n'), '#%2523[ 100%25%0D%0A');
  assert.equal(plainEscape('#%23[ 100%\r\n'), '#%2523[ 100%25%0D%0A');
  // Every string of up to 6 of the characters that matter: no "##[", CR or LF comes out.
  const alphabet = ['#', '[', '%', '2', '3', ' ', '\n'];
  let strings = [''];
  for (let n = 0; n < 6; n++) {
    strings = strings.flatMap((s) => alphabet.map((c) => s + c));
    for (const s of strings) {
      for (const out of [cmdEscape(s), plainEscape(s)]) {
        if (out.includes('##[') || /[\r\n]/.test(out)) assert.fail(`${JSON.stringify(s)} escapes to ${JSON.stringify(out)}`);
      }
    }
  }
});

test('(p) a path with "##[" anywhere is skipped with a warning, and no printed line contains "##["', () => {
  const repo = makeRepo({
    ...STUDIO,
    ...TUCKAWAY,
    '##[warning]root.txt': 'root file\n',
    '##[error]dir/page.html': 'root folder\n',
    'hash/ok.html': 'ok\n',
    'hash/##[group]page.html': 'nested file\n',
    'hash/sub##[x/inner.html': 'nested folder\n',
    // JSON.parse echoes this text in its error message; show() echoes the bad "name_ko".
    'hashcard/card.json': 'x##[error]boom\n',
    'hashtext/card.json': card({ name: 'Hash ##[text]', name_ko: '##[error]\u0007', summary: 'Card text may contain ##[: it is never printed as is.', since: '2026-10-01' }),
  });
  const r = build(repo);
  assertOk(r);
  assert.deepEqual(filesUnder(r.out).sort(), ['.nojekyll', '404.html', 'hash/ok.html', 'hashcard/card.json', 'hashtext/card.json', 'index.html', ...Object.keys(TUCKAWAY)].sort());
  const skipped = (p, dir) => `::warning::${p}: the name has "##" followed by "[", which the Actions runner reads as a command when the upload step lists the files; skipped (not published)${dir ? ' with everything in it' : ''}. Rename it.`;
  assert.deepEqual(r.warnings.filter((l) => l.includes('followed by')), [
    skipped('#%23[error]dir', true),
    skipped('#%23[warning]root.txt', false),
    skipped('hash/#%23[group]page.html', false),
    skipped('hash/sub#%23[x', true),
  ]);
  const w = r.warnings.join('\n');
  assert.ok(w.includes('hashcard/card.json: card.json is not valid JSON'), w);
  assert.ok(w.includes('hashtext/card.json: "name_ko" must not contain control or format characters (found U+0007); ignored ("#%23[error]\\u0007")'), w);
  assert.equal(r.warnings.length, 6, w);
  if (r.stdout.includes('boom')) {
    assert.ok(w.includes('"x#%23[error]boom'), 'command data: "#%23["');
    assert.ok(r.stdout.includes('    - hashcard: card.json is not valid JSON') && r.stdout.includes('"x# #[error]boom'), 'plain log line: "# #["');
  }
  for (const [what, text] of [['log', r.stdout], ['run summary', r.summary]]) {
    for (const l of text.split('\n')) assert.ok(!l.includes('##['), `${what}: no "##[" in ${JSON.stringify(l)}`);
  }
  assertOnlyWarningCommands(r.stdout, 'log');
  assert.deepEqual(idsOf(r.index), ['tuckaway', 'hashtext']);
  assert.ok(r.index.includes('<h2 id="hashtext">Hash ##[text]</h2>'), 'card text is not a path: shown as written');
  assert.match(r.stdout, /files copied: 9 of 9 /);
});

test('(q) a path longer than 200 bytes (UTF-8, from the repo root) is skipped with a warning', () => {
  assert.equal(MAX_PATH_BYTES, 200);
  const at200 = `len/${'a'.repeat(95)}/${'b'.repeat(100)}`;
  const over = `len/${'a'.repeat(96)}/${'c'.repeat(100)}`;
  const hangul = `len/${'가'.repeat(66)}.html`;
  const deepDir = `len/${'나'.repeat(33)}/${'다'.repeat(33)}`;
  const rootLong = 'r'.repeat(201);
  assert.deepEqual([at200, over, hangul, deepDir, rootLong].map((p) => Buffer.byteLength(p)), [200, 201, 207, 203, 201]);
  const repo = makeRepo({
    ...STUDIO,
    ...TUCKAWAY,
    [at200]: 'fits\n',
    [over]: 'one byte over\n',
    [hangul]: '75 characters, 207 bytes\n',
    [`${deepDir}/x.html`]: 'in a folder over the limit\n',
    [`${deepDir}/y/z.html`]: 'deeper still\n',
    [rootLong]: 'root counts too\n',
  });
  const r = build(repo);
  assertOk(r);
  const long = (p, n, dir) => `::warning::${p}: the path is ${n} bytes, longer than 200 (UTF-8, counted from the repo root); skipped (not published)${dir ? ' with everything in it' : ''}. Shorten it.`;
  assert.deepEqual(r.warnings, [
    long(over, 201, false),
    long(JSON.stringify(hangul), 207, false),
    long(JSON.stringify(deepDir), 203, true),
    long(rootLong, 201, false),
  ]);
  assert.deepEqual(filesUnder(r.out).sort(), ['.nojekyll', '404.html', 'index.html', at200, ...Object.keys(TUCKAWAY)].sort());
  assert.equal(readFileSync(join(r.out, ...at200.split('/')), 'utf8'), 'fits\n');
  assert.match(r.stdout, /files copied: 7 of 7 /);
  assert.equal(r.index, GOLDEN_INDEX.replace(OLD_DESCRIPTION, NEW_DESCRIPTION));
});

// ---------- copy failures ----------

/** A --require preload that makes copyFileSync fail for the paths in ATTO_TEST_COPY_FAIL. */
const FAIL_COPY_PRELOAD = [
  "const fs = require('node:fs');",
  "const { sep } = require('node:path');",
  "const { syncBuiltinESMExports } = require('node:module');",
  'const fail = JSON.parse(process.env.ATTO_TEST_COPY_FAIL);',
  'const copy = fs.copyFileSync;',
  'fs.copyFileSync = function (src, dest, mode) {',
  "  const s = String(src).split(sep).join('/');",
  "  const hit = Object.keys(fail).find((k) => s.endsWith('/' + k));",
  "  if (hit) { const e = new Error(fail[hit] + ': injected by the self-test'); e.code = fail[hit]; throw e; }",
  '  return copy.call(this, src, dest, mode);',
  '};',
  'syncBuiltinESMExports();',
  '',
].join('\n');

function buildFailingCopies(repo, fail) {
  const preload = join(tempDir('atto-site-preload-'), 'fail-copy.cjs');
  writeFileSync(preload, FAIL_COPY_PRELOAD);
  return build(repo, { nodeArgs: ['--require', preload], env: { ATTO_TEST_COPY_FAIL: JSON.stringify(fail) } });
}

test('(n) a file that cannot be copied is skipped with a warning; its card or links go with it', () => {
  const repo = makeRepo({
    ...STUDIO,
    ...TUCKAWAY,
    'fail/card.json': card({
      name: 'Fail',
      summary: 'Some files cannot be copied.',
      since: '2026-10-01',
      links: [{ label: 'Gone', href: 'gone.html' }, { label: 'Locked', href: 'locked.html' }, { label: 'Kept', href: 'kept.html' }],
    }),
    'fail/gone.html': 'gone\n',
    'fail/locked.html': 'locked\n',
    'fail/kept.html': 'kept\n',
    'lost/card.json': card({ name: 'Lost', summary: 'Its card cannot be copied.', since: '2026-10-01' }),
    'lost/page.html': 'page\n',
  });
  const r = buildFailingCopies(repo, { 'fail/gone.html': 'ENOENT', 'fail/locked.html': 'EACCES', 'lost/card.json': 'EACCES' });
  assertOk(r);
  assert.deepEqual(idsOf(r.index), ['tuckaway', 'fail']);
  assert.equal(sectionsOf(r.index)[1], '<section class="card" aria-labelledby="fail">\n  <h2 id="fail">Fail</h2>\n  <p>Some files cannot be copied.</p>\n  <ul>\n    <li><a href="fail/kept.html">Kept</a></li>\n  </ul>\n</section>\n');
  const w = r.warnings.join('\n');
  for (const needle of [
    'fail/gone.html: cannot be copied (ENOENT: injected by the self-test); skipped (not published)',
    'fail/locked.html: cannot be copied (EACCES: injected by the self-test); skipped (not published)',
    'lost/card.json: cannot be copied (EACCES: injected by the self-test); skipped (not published)',
    'fail/card.json: links[0]: target file fail/gone.html does not exist',
    'fail/card.json: links[1]: target file fail/locked.html does not exist',
    'lost/card.json: card.json could not be copied (see the warning above); no card for this folder',
  ]) {
    assert.ok(w.includes(needle), `warning mentions: ${needle}\n--- warnings ---\n${w}`);
  }
  assert.deepEqual(readdirSync(join(r.out, 'fail')).sort(), ['card.json', 'kept.html']);
  assert.deepEqual(readdirSync(join(r.out, 'lost')), ['page.html']);
  assert.match(r.stdout, /files copied: 9 of 12 /);
});

test('(n) a full or read-only disk while copying fails the build (never a partial site)', () => {
  const repo = makeRepo({ ...STUDIO, ...TUCKAWAY, 'big/full.bin': 'x' });
  for (const code of ['ENOSPC', 'EROFS']) {
    const r = buildFailingCopies(repo, { 'big/full.bin': code });
    assert.equal(r.status, 1);
    assert.ok(r.lines.some((l) => l.startsWith(`::error::cannot write the output folder (at big/full.bin): ${code}`)), r.stdout);
    assert.equal(r.index, null, 'no home page written');
  }
});

test('(n) unreadable files and folders are skipped with a warning (POSIX permissions)', (t) => {
  if (process.platform === 'win32' || process.getuid?.() === 0) {
    t.skip('needs POSIX permissions and a non-root user');
    return;
  }
  const repo = makeRepo({ ...STUDIO, ...TUCKAWAY, 'perm/open.html': 'open\n', 'perm/secret.html': 'secret\n', 'perm/closed/inner.html': 'inner\n' });
  chmodSync(join(repo, 'perm', 'secret.html'), 0o000);
  chmodSync(join(repo, 'perm', 'closed'), 0o000);
  try {
    const r = build(repo);
    assertOk(r);
    assert.ok(r.warnings.some((l) => l.startsWith('::warning::perm/secret.html: cannot be copied (EACCES')), r.warnings.join('\n'));
    assert.ok(r.warnings.some((l) => l.startsWith('::warning::perm/closed/: folder cannot be read (EACCES')), r.warnings.join('\n'));
    assert.deepEqual(readdirSync(join(r.out, 'perm')), ['open.html']);
    assert.deepEqual(idsOf(r.index), ['tuckaway']);
  } finally {
    chmodSync(join(repo, 'perm', 'closed'), 0o755);
    chmodSync(join(repo, 'perm', 'secret.html'), 0o644);
  }
});

// ---------- report ----------

test('(o) run summary: cards, skipped cards with reasons, every warning, total and per-folder bytes', () => {
  const repo = makeRepo({ ...STUDIO, ...TUCKAWAY, 'broken/card.json': '{', 'broken/page.html': 'page\n', 'README.md': '# x\n' });
  const r = build(repo);
  assertOk(r);
  const s = r.summary;
  assert.ok(s.startsWith('## Atto Studio site build\n'), s);
  assert.ok(s.includes('**Cards rendered: 1** (tuckaway)'), s);
  assert.ok(s.includes('**Cards skipped: 1**\n\n```text\nbroken: card.json is not valid JSON'), s);
  assert.equal(r.warnings.length, 2);
  assert.ok(s.includes(`**Warnings: 2**\n\n\`\`\`text\n${r.warnings.map((l) => l.slice('::warning::'.length)).join('\n')}\n\`\`\``), s);
  const size = (...rel) => statSync(join(r.out, ...rel)).size;
  const root = size('404.html') + size('.nojekyll') + size('README.md') + size('index.html');
  const tuck = size('tuckaway', 'card.json') + size('tuckaway', 'privacy', 'index.html') + size('tuckaway', 'terms', 'index.html') + size('tuckaway', 'support', 'index.html');
  const broken = size('broken', 'card.json') + size('broken', 'page.html');
  const total = root + tuck + broken;
  assert.ok(s.includes(`**Output: ${total} bytes (0.0 MB of the 800.0 MB budget)**`), s);
  assert.ok(s.endsWith(`| Top-level folder | Bytes |\n|---|---:|\n| &#40;root files&#41; | ${root} |\n| broken | ${broken} |\n| tuckaway | ${tuck} |\n`), s);
  assert.ok(r.stdout.includes(`  output size: ${total} bytes (0.0 MB; budget 800.0 MB)\n`), r.stdout);
  const quiet = build(repo, { env: { GITHUB_STEP_SUMMARY: null } });
  assertOk(quiet);
  assert.equal(quiet.summary, null, 'no summary without GITHUB_STEP_SUMMARY');
});

test('size budget: a warning above 800 MB', () => {
  assert.equal(SIZE_BUDGET, 800_000_000);
  assert.equal(sizeWarning(SIZE_BUDGET), '');
  assert.match(sizeWarning(SIZE_BUDGET + 1), /^the site is 800\.0 MB \(800000001 bytes\), above the 800\.0 MB budget/);
});
