#!/usr/bin/env node
// Builds the Atto Studio site https://hootchi.github.io/ from this repo (HootChi/HootChi.github.io).
//
//   node .github/build.mjs <outDir>
//
// .github/workflows/pages.yml runs it as `node .github/build.mjs "$RUNNER_TEMP/site"`, outside the
// checkout, and deploys that folder. Tested on Node 24 (the workflow's version); needs Node >= 20.
// Built-in modules only (this repo must never get a package.json). Importing this file builds
// nothing: the checks are exported for .github/test-build.mjs.
//
// What it does:
//   1. lists every file of the repo, except .git/, .github/, <outDir> itself and a root index.html
//      (the home page is always generated, a committed one is ignored). Symlinks, other non-regular
//      files and names that are not valid UTF-8 are skipped with a warning, so nothing outside the
//      repo can be published through a link. So is every file or folder whose repo-relative path
//      contains "##[" (the upload step's `tar -v` prints every path, and the Actions runner reads
//      "##[" anywhere in a log line as a command that can fail the step) or is longer than
//      MAX_PATH_BYTES (UTF-8 bytes; checked on folders too, so it also bounds the folder depth);
//   2. warns about root files that are not studio files and about non-portable paths inside app
//      folders (rules: .github/README.md). Both are still published;
//   3. copies the files byte for byte into <outDir>. A file that cannot be copied is skipped with a
//      warning;
//   4. writes <outDir>/index.html, the home page, with one card per app folder that has a valid
//      <app>/card.json (format: .github/README.md; a card.json over MAX_CARD_BYTES is not read).
//      Cards are ordered by "since", then folder name, so a new app is appended and never reorders
//      or changes the cards already there;
//   5. prints a report with the output size (a warning above the 800 MB budget) and, when
//      GITHUB_STEP_SUMMARY is set, appends it to the run summary with every warning.
//
// One app can never break the build for the others: a bad card.json only hides that app's card, a
// bad link or field only drops that link or field, a bad file only drops that file, and each problem
// is printed as a GitHub Actions ::warning:: line. The script fails (exit 1, ::error:: line) only for
// its own problems: a missing or non-empty <outDir>, a repo root that cannot be read, or an output
// folder that cannot be written. A full or read-only disk (ENOSPC, EDQUOT, EROFS, EIO) counts as the
// output folder failing, even mid-copy, so a partial site is never deployed.
//
// Everything printed goes through cmdEscape (workflow-command data and the run summary) or
// plainEscape (plain log lines), so no file name or card value can start a workflow command line of
// its own, or contain "##[" (written "#%23[" in command data, "# #[" in plain log lines).
//
// Output is deterministic. The only input besides the repo files is the build date (the footer year
// and the "since is in the future" check): SOURCE_DATE_EPOCH (seconds, UTC) when set, otherwise now.
import { appendFileSync, constants, copyFileSync, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
/** Never copied from the repo root. index.html is generated instead. */
const ROOT_SKIP = new Set(['.git', '.github']);
/** The studio's root files. Any other root file is still published, with a warning. */
export const ROOT_FILES = new Set(['404.html', '.nojekyll', 'app-ads.txt', 'CNAME', '.gitignore', '.gitattributes']);
const APP_FOLDER = /^[a-z0-9][a-z0-9-]*$/;
const MAX_LINKS = 10;
/** A name with a longer run of non-space characters may not wrap on a phone: warning only. */
const LONG_RUN = 30;
/** Size budget of the whole site (GitHub Pages sites are limited to 1 GB). */
export const SIZE_BUDGET = 800_000_000;
/** Longest repo-relative path copied ("tuckaway/privacy/index.html" is 27), in UTF-8 bytes. */
export const MAX_PATH_BYTES = 200;
/** Largest card.json read (64 KiB); a larger one is not read and its card is skipped. */
export const MAX_CARD_BYTES = 65_536;
/** The Actions runner reads this anywhere in a log line as a command (`##[error]...`). */
const RUNNER_COMMAND = '##[';
/** Copy errors that mean the output folder itself failed: fatal, never a skipped file. */
const OUTPUT_FATAL = new Set(['ENOSPC', 'EDQUOT', 'EROFS', 'EIO']);
const ROOT_BUCKET = '(root files)';
const DESCRIPTION = 'Atto Studio: privacy policies, terms of use and support for Atto Studio games.';

class FatalError extends Error {}

// ---------- output helpers ----------

const warnings = [];

/**
 * One output line: "%", CR and LF percent-encoded (GitHub workflow-command data escaping), so a value
 * can never start a command line of its own, and every "##[" replaced by `hashes`. One pass is
 * enough: neither replacement can form a new "##[" with the characters around it.
 */
const escapeLine = (s, hashes) => String(s).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A').replace(/##\[/g, hashes);
/** Workflow-command data (::warning::, ::error::) and run-summary lines: "##[" becomes "#%23[". */
export const cmdEscape = (s) => escapeLine(s, '#%23[');
/** Plain log lines: "##[" becomes "# #[". */
export const plainEscape = (s) => escapeLine(s, '# #[');
/** Every plain log line goes through here. */
function log(line) {
  console.log(plainEscape(line));
}
function warn(msg) {
  warnings.push(msg);
  console.log(`::warning::${cmdEscape(msg)}`);
}
const chars = (s) => [...s].length;
const hex = (c) => c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
/** JSON form of a string with every control, format and line-separator character as \uXXXX. */
function quote(s) {
  return JSON.stringify(s).replace(/[\p{Cc}\p{Cf}\u2028\u2029]/gu, (c) => `\\u${hex(c)}`);
}
/** A path as printed: as is when it is plain printable ASCII, else quoted. */
function pathText(p) {
  return /^[\x21-\x7e]+$/.test(p) ? p : quote(p);
}
/** A value quoted for a warning message: JSON form, shortened. Never throws. */
export function show(v) {
  let s;
  try {
    s = typeof v === 'string' ? quote(v) : JSON.stringify(v);
    if (s === undefined) s = String(v);
  } catch {
    // JSON.stringify throws on very deep nesting; String() does too for arrays.
    try { s = String(v); } catch { s = Array.isArray(v) ? '<array>' : '<object>'; }
  }
  const cps = [...s];
  return cps.length > 120 ? `${cps.slice(0, 117).join('')}...` : s;
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
const byCodeUnit = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const samePath = (a, b) => (process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b);
const mb = (n) => `${(n / 1e6).toFixed(1)} MB`;

// ---------- listing and copying ----------

/** A file name read as bytes: its text, or null when the bytes are not valid UTF-8. */
export function decodeName(buf) {
  const name = buf.toString('utf8');
  return Buffer.from(name, 'utf8').equals(buf) ? name : null;
}

/**
 * Lists the repo files to publish as sorted posix paths relative to ROOT. Only regular files and
 * directories with valid UTF-8 names are followed; everything else is skipped with a warning.
 */
function listFiles(outAbs) {
  const files = [];
  const walk = (absDir, relDir) => {
    let raw;
    try {
      raw = readdirSync(absDir, { withFileTypes: true, encoding: 'buffer' });
    } catch (e) {
      if (!relDir) throw new FatalError(`cannot read the repo folder: ${e.message}`);
      warn(`${pathText(relDir)}/: folder cannot be read (${e.message}); its files are skipped (not published)`);
      return;
    }
    const entries = [];
    for (const ent of raw) {
      const name = decodeName(ent.name);
      if (name === null) {
        const shown = pathText(relDir ? `${relDir}/${ent.name.toString('utf8')}` : ent.name.toString('utf8'));
        warn(`${shown}: name is not valid UTF-8 (bytes ${ent.name.toString('hex')}); skipped (not published). Rename it.`);
      } else {
        entries.push({ name, ent });
      }
    }
    entries.sort((a, b) => byCodeUnit(a.name, b.name));
    for (const { name, ent } of entries) {
      const rel = relDir ? `${relDir}/${name}` : name;
      const abs = join(absDir, name);
      if (!relDir && ROOT_SKIP.has(name)) continue;
      if (samePath(abs, outAbs)) continue;
      const skipped = `skipped (not published)${ent.isDirectory() ? ' with everything in it' : ''}`;
      if (rel.includes(RUNNER_COMMAND)) {
        // Not spelled out here: the message would print it (escaped) and read oddly.
        warn(`${pathText(rel)}: the name has "##" followed by "[", which the Actions runner reads as a command when the upload step lists the files; ${skipped}. Rename it.`);
        continue;
      }
      const bytes = Buffer.byteLength(rel, 'utf8');
      if (bytes > MAX_PATH_BYTES) {
        warn(`${pathText(rel)}: the path is ${bytes} bytes, longer than ${MAX_PATH_BYTES} (UTF-8, counted from the repo root); ${skipped}. Shorten it.`);
        continue;
      }
      if (!relDir && name.toLowerCase() === 'index.html') {
        warn(`${name} at the repo root is ignored: the home page is generated from the app cards (<app>/card.json). Delete the root ${name}.`);
        continue;
      }
      if (ent.isSymbolicLink()) {
        warn(`${pathText(rel)}: symbolic link skipped (not published). Commit the real file instead.`);
      } else if (ent.isDirectory()) {
        walk(abs, rel);
      } else if (ent.isFile()) {
        files.push(rel);
      } else {
        warn(`${pathText(rel)}: not a regular file, skipped (not published).`);
      }
    }
  };
  walk(ROOT, '');
  return files;
}

/** Copies the files into outAbs. Returns the paths that were copied, with their sizes. */
function copyFiles(files, outAbs) {
  const made = new Set();
  const sizes = new Map();
  for (const rel of files) {
    const dest = join(outAbs, ...rel.split('/'));
    const dir = dirname(dest);
    try {
      if (!made.has(dir)) {
        mkdirSync(dir, { recursive: true });
        made.add(dir);
      }
      copyFileSync(join(ROOT, ...rel.split('/')), dest, constants.COPYFILE_EXCL);
      sizes.set(rel, statSync(dest).size);
    } catch (e) {
      if (OUTPUT_FATAL.has(e.code)) throw new FatalError(`cannot write the output folder (at ${rel}): ${e.message}`);
      warn(`${pathText(rel)}: cannot be copied (${e.message}); skipped (not published)`);
    }
  }
  return sizes;
}

// ---------- repo layout rules ----------

const PORTABLE_NAME = /^[A-Za-z0-9._-]+$/;
const DEVICE_NAME = /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?$/i;
const MAX_NAME_BYTES = 100;

/** Why one file or folder name is not portable; [] when it is. */
function nameProblems(name) {
  const p = [];
  if (!PORTABLE_NAME.test(name)) p.push('uses characters other than A-Z a-z 0-9 . _ -');
  if (name.startsWith('.')) p.push('starts with "."');
  if (name.endsWith('.')) p.push('ends with "."');
  if (Buffer.byteLength(name, 'utf8') > MAX_NAME_BYTES) p.push(`is longer than ${MAX_NAME_BYTES} bytes`);
  if (DEVICE_NAME.test(name)) p.push('is a Windows device name');
  return p;
}

/**
 * Checks the portable-path rule on the files inside app folders ("app/sub/page.html", the app folder
 * name included). Each problem is reported once, on the path that has it: a bad folder name is
 * reported for the folder, not for every file in it, and so is a folder that differs from another
 * one only in letter case (that problem names both paths). Returns [{ path, problems }] sorted by
 * path; [] when all are portable.
 */
export function portablePathProblems(files) {
  const paths = new Set();
  for (const f of files) {
    const segs = f.split('/');
    for (let i = 1; i <= segs.length; i++) paths.add(segs.slice(0, i).join('/'));
  }
  const found = new Map();
  const add = (path, problem) => {
    if (!found.has(path)) found.set(path, []);
    found.get(path).push(problem);
  };
  const firstByFold = new Map();
  const collided = new Set();
  for (const path of [...paths].sort(byCodeUnit)) {
    const cut = path.lastIndexOf('/');
    for (const problem of nameProblems(path.slice(cut + 1))) add(path, problem);
    const fold = path.toLowerCase();
    const first = firstByFold.get(fold);
    if (first === undefined) {
      firstByFold.set(fold, path);
    } else {
      collided.add(path);
      // Below a folder that already collides, only that folder is reported.
      if (!collided.has(path.slice(0, Math.max(cut, 0)))) add(path, `${pathText(first)} and ${pathText(path)} differ only in letter case`);
    }
  }
  return [...found].map(([path, problems]) => ({ path, problems })).sort((a, b) => byCodeUnit(a.path, b.path));
}

/** The size-budget warning for a site of `total` bytes, or '' when it fits. */
export function sizeWarning(total) {
  if (total <= SIZE_BUDGET) return '';
  return `the site is ${mb(total)} (${total} bytes), above the ${mb(SIZE_BUDGET)} budget (GitHub Pages sites are limited to 1 GB). The run summary lists the size of each folder.`;
}

// ---------- cards ----------

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const absent = (v) => v === undefined || v === null;
const CONTROL_OR_FORMAT = /[\p{Cc}\p{Cf}]/u;
/** With the u flag, only a surrogate that is not half of a valid pair matches. */
const LONE_SURROGATE = /\p{Cs}/u;
const MARK_RUN = /\p{M}{3,}/u;

/**
 * Why `v` is not a valid card text value of min-max characters, or '' when it is. `nonSpace`: it must
 * contain a character that is not a space (name and summary).
 */
function textProblem(v, min, max, nonSpace = false) {
  if (typeof v !== 'string' || chars(v) < min || chars(v) > max) {
    return min > 0 ? `must be text of ${min}-${max} characters` : `must be text of at most ${max} characters`;
  }
  const cf = v.match(CONTROL_OR_FORMAT);
  if (cf) return `must not contain control or format characters (found U+${hex(cf[0])})`;
  const cs = v.match(LONE_SURROGATE);
  if (cs) return `must not contain lone surrogates (found U+${hex(cs[0])})`;
  if (MARK_RUN.test(v)) return 'must not contain 3 or more combining marks in a row';
  if (nonSpace && !/\S/.test(v)) return 'must contain a character that is not a space';
  return '';
}

function isDate(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

const EMAIL = /^[A-Za-z0-9._+-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;

/**
 * Checks one link href of app `folder`. Returns { href } (the value for the page) or { error }.
 * A relative href must stay inside the app folder even after a browser normalises it, and its
 * target file must be one of the files being published.
 */
function checkHref(folder, href, fileSet) {
  if (typeof href !== 'string' || href.length === 0) return { error: 'href must be a non-empty string' };
  if (href.length > 2048) return { error: 'href is longer than 2048 characters' };
  // Browsers drop tabs and newlines inside URLs and trim spaces and control characters around them.
  if (/[\u0000- \u007f]/.test(href)) return { error: 'href must not contain spaces or control characters (write a space as %20)' };
  if (/^https:\/\//i.test(href)) {
    let url;
    try { url = new URL(href); } catch { return { error: 'href is not a valid https:// URL' }; }
    if (url.protocol !== 'https:' || !url.hostname) return { error: 'href is not a valid https:// URL' };
    return { href };
  }
  const cut = href.search(/[?#]/);
  const path = cut === -1 ? href : href.slice(0, cut);
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(href)) return { error: 'href must be a path inside the app folder or an https:// URL' };
  if (path === '') return { error: 'href must name a file or a folder ending in "/"' };
  if (path.startsWith('/')) return { error: 'href must not start with "/" (write it relative to the app folder)' };
  if (path.includes('\\')) return { error: 'href must not contain "\\"' };
  if (path.includes('//')) return { error: 'href must not contain "//"' };
  if (path.includes('..')) return { error: 'href must not contain ".."' };
  if (/%(?:2e|2f|5c|00)/i.test(path)) return { error: 'href must not percent-encode ".", "/", "\\" or NUL' };
  if (path.split('/').some((seg) => seg.startsWith('.'))) return { error: 'href must not point into a hidden (dot) file or folder: those are not deployed' };
  let decoded;
  try { decoded = decodeURIComponent(path); } catch { return { error: 'href has invalid percent-encoding' }; }
  const target = `${folder}/${decoded}${decoded.endsWith('/') ? 'index.html' : ''}`;
  if (!fileSet.has(target)) {
    if (!decoded.endsWith('/') && fileSet.has(`${folder}/${decoded}/index.html`)) {
      return { error: `href points to a folder: write ${show(`${path}/`)}` };
    }
    return { error: `target file ${pathText(target)} does not exist` };
  }
  return { href: `${folder}/${href}` };
}

/**
 * Reads and validates <folder>/card.json. Returns { card } or { skip: reason }. Problems with
 * optional parts (a link, name_ko, contact, ...) are warned about and only that part is dropped.
 * `today` (YYYY-MM-DD, UTC) is the build date.
 */
function loadCard(folder, fileSet, today) {
  const where = `${folder}/card.json`;
  const file = join(ROOT, folder, 'card.json');
  let text;
  try {
    const { size } = statSync(file);
    if (size > MAX_CARD_BYTES) return { skip: `card.json is ${size} bytes, larger than 64 KiB (${MAX_CARD_BYTES} bytes)` };
    text = new TextDecoder('utf-8', { fatal: true }).decode(readFileSync(file));
  } catch (e) {
    return { skip: e instanceof TypeError ? 'card.json is not valid UTF-8' : `card.json cannot be read (${e.message})` };
  }
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  let data;
  try { data = JSON.parse(text); } catch (e) { return { skip: `card.json is not valid JSON (${e.message})` }; }
  if (!isObject(data)) return { skip: 'card.json must be a JSON object' };

  const bad = [];
  for (const [key, max] of [['name', 80], ['summary', 200]]) {
    const problem = textProblem(data[key], 1, max, true);
    if (problem) bad.push(`"${key}" (required: ${problem})`);
  }
  if (!isDate(data.since)) bad.push('"since" (required date "YYYY-MM-DD")');
  if (bad.length) return { skip: `invalid or missing ${bad.join(', ')}` };

  const card = { folder, name: data.name, summary: data.summary, since: data.since, name_ko: '', summary_ko: '', links: [], contact: '' };
  if (data.since > today) {
    warn(`${where}: "since" ${data.since} is after the build date ${today} (UTC); the card is still shown. "since" is the date the folder first appeared on the site.`);
  }
  const run = data.name.match(new RegExp(`\\S{${LONG_RUN + 1},}`, 'u'));
  if (run) {
    warn(`${where}: "name" has ${chars(run[0])} characters in a row without a space (more than ${LONG_RUN}); it may not wrap on small screens. The card is still shown.`);
  }
  for (const [key, max] of [['name_ko', 80], ['summary_ko', 200]]) {
    if (absent(data[key])) continue;
    const problem = textProblem(data[key], 0, max);
    if (problem) warn(`${where}: "${key}" ${problem}; ignored (${show(data[key])})`);
    else card[key] = data[key];
  }
  if (!absent(data.contact)) {
    if (typeof data.contact === 'string' && data.contact.length <= 254 && EMAIL.test(data.contact)) card.contact = data.contact;
    else warn(`${where}: "contact" must be an email address; ignored (${show(data.contact)})`);
  }
  if (!absent(data.links)) {
    if (!Array.isArray(data.links)) {
      warn(`${where}: "links" must be an array; ignored`);
    } else {
      let links = data.links;
      if (links.length > MAX_LINKS) {
        warn(`${where}: "links" has ${links.length} entries; only the first ${MAX_LINKS} are used`);
        links = links.slice(0, MAX_LINKS);
      }
      links.forEach((link, i) => {
        const at = `${where}: links[${i}]`;
        if (!isObject(link)) return warn(`${at} must be an object; link dropped`);
        const labelProblem = textProblem(link.label, 1, 60);
        if (labelProblem) return warn(`${at}: "label" ${labelProblem}; link dropped (${show(link.label)})`);
        const checked = checkHref(folder, link.href, fileSet);
        if (checked.error) return warn(`${at}: ${checked.error}; link dropped (${show(link.href)})`);
        let labelKo = '';
        if (!absent(link.label_ko)) {
          const problem = textProblem(link.label_ko, 0, 60);
          if (problem) warn(`${at}: "label_ko" ${problem}; ignored (${show(link.label_ko)})`);
          else labelKo = link.label_ko;
        }
        card.links.push({ label: link.label, label_ko: labelKo, href: checked.href });
      });
    }
  }
  return { card };
}

/** `fileSet` holds the files that were copied: a card or link never points to a file that was not. */
function collectCards(topDirs, fileSet, today) {
  const cards = [];
  const skipped = [];
  for (const folder of topDirs) {
    if (!fileSet.has(`${folder}/card.json`)) {
      let st = null;
      try { st = lstatSync(join(ROOT, folder, 'card.json')); } catch { /* no card.json: no card */ }
      if (st) {
        const reason = st.isFile() ? 'card.json could not be copied (see the warning above)' : 'card.json is not a regular file';
        skipped.push({ folder, reason });
        warn(`${pathText(folder)}/card.json: ${reason}; no card for this folder`);
      }
      continue;
    }
    if (!APP_FOLDER.test(folder)) {
      const reason = 'folder name is not a valid app folder name (lowercase letters, digits and "-", starting with a letter or digit)';
      skipped.push({ folder, reason });
      warn(`${pathText(folder)}/card.json: ${reason}; no card (the folder's files are still published)`);
      continue;
    }
    let result;
    try {
      result = loadCard(folder, fileSet, today);
    } catch (e) {
      result = { skip: `unexpected error (${e && e.message})` };
    }
    if (result.card) {
      cards.push(result.card);
    } else {
      skipped.push({ folder, reason: result.skip });
      warn(`${folder}/card.json: ${result.skip}; card skipped (the folder's files are still published)`);
    }
  }
  cards.sort((a, b) => byCodeUnit(a.since, b.since) || byCodeUnit(a.folder, b.folder));
  return { cards, skipped };
}

// ---------- home page ----------

function renderCard(c) {
  const f = esc(c.folder);
  const out = [
    `<section class="card" aria-labelledby="${f}">`,
    `  <h2 id="${f}">${esc(c.name)}</h2>`,
  ];
  if (c.name_ko) out.push(`  <p class="meta" lang="ko">${esc(c.name_ko)}</p>`);
  out.push(`  <p>${esc(c.summary)}${c.summary_ko ? `<br><span lang="ko">${esc(c.summary_ko)}</span>` : ''}</p>`);
  if (c.links.length) {
    out.push('  <ul>');
    for (const l of c.links) {
      out.push(`    <li><a href="${esc(l.href)}">${esc(l.label)}${l.label_ko ? ` · <span lang="ko">${esc(l.label_ko)}</span>` : ''}</a></li>`);
    }
    out.push('  </ul>');
  }
  if (c.contact) out.push(`  <p>Contact · <span lang="ko">문의</span>: <a href="mailto:${esc(c.contact)}">${esc(c.contact)}</a></p>`);
  out.push('</section>');
  return `${out.join('\n')}\n`;
}

function renderPage(cards, year) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>Atto Studio</title>
<meta name="description" content="${esc(DESCRIPTION)}">
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
  <p class="meta">Games by Atto Studio · <span lang="ko">Atto Studio의 게임</span></p>
</header>

${cards.map((c) => `${renderCard(c)}\n`).join('')}<footer>
  <p>© ${year} Atto Studio</p>
</footer>
</main>
</body>
</html>
`;
}

function buildDate() {
  const raw = process.env.SOURCE_DATE_EPOCH;
  if (raw !== undefined && raw !== '') {
    if (/^\d{1,12}$/.test(raw)) return new Date(Number(raw) * 1000);
    warn(`SOURCE_DATE_EPOCH=${show(raw)} is not a number of seconds; using the current time`);
  }
  return new Date();
}

// ---------- run summary ----------

/** Markdown code block that no content line can close (the fence is longer than any backtick run). */
function fence(lines) {
  const body = lines.join('\n');
  const longest = Math.max(0, ...(body.match(/`+/g) ?? []).map((r) => r.length));
  const f = '`'.repeat(Math.max(3, longest + 1));
  return `${f}text\n${body}\n${f}`;
}
/** Markdown table-cell text: every character markdown or HTML could act on becomes an entity. */
function mdText(s) {
  return String(s).replace(/[\p{Cc}]/gu, ' ').replace(/[\\`*_{}[\]()#+\-.!|~<>&@:]/g, (c) => `&#${c.charCodeAt(0)};`);
}
/** Keeps the step summary well under GitHub's 1 MiB limit; the log always has every warning. */
const SUMMARY_WARNING_BYTES = 600_000;

function summaryMarkdown({ cards, skipped, total, byTop }) {
  const out = ['## Atto Studio site build', ''];
  out.push(`**Cards rendered: ${cards.length}**${cards.length ? ` (${cards.map((c) => mdText(c.folder)).join(', ')})` : ''}`, '');
  out.push(`**Cards skipped: ${skipped.length}**`, '');
  if (skipped.length) out.push(fence(skipped.map((s) => cmdEscape(`${pathText(s.folder)}: ${s.reason}`))), '');
  out.push(`**Warnings: ${warnings.length}**`, '');
  if (warnings.length) {
    const lines = [];
    let bytes = 0;
    for (const w of warnings) {
      const line = cmdEscape(w);
      bytes += Buffer.byteLength(line) + 1;
      if (bytes > SUMMARY_WARNING_BYTES) {
        lines.push(`... and ${warnings.length - lines.length} more (see the build log)`);
        break;
      }
      lines.push(line);
    }
    out.push(fence(lines), '');
  }
  out.push(`**Output: ${total} bytes (${mb(total)} of the ${mb(SIZE_BUDGET)} budget)**`, '');
  out.push('| Top-level folder | Bytes |', '|---|---:|');
  for (const [name, n] of byTop) out.push(`| ${mdText(name)} | ${n} |`);
  return `${out.join('\n')}\n`;
}

function writeSummary(md) {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (!file) return;
  try {
    appendFileSync(file, md);
  } catch (e) {
    warn(`cannot write the run summary: ${e.message}`);
  }
}

// ---------- main ----------

/** True when `child` is `parent` or inside it. */
function isWithin(parent, child) {
  const rel = relative(parent, child);
  return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`));
}

function prepareOut(arg) {
  if (!arg) throw new FatalError('usage: node .github/build.mjs <outDir>');
  const outAbs = resolve(arg);
  if (isWithin(outAbs, ROOT)) throw new FatalError(`output folder ${outAbs} must not be the repo or contain it`);
  if (isWithin(ROOT, outAbs)) {
    const top = relative(ROOT, outAbs).split(sep)[0];
    if (ROOT_SKIP.has(top)) throw new FatalError(`output folder ${outAbs} must not be inside ${top}/`);
  }
  let st = null;
  try { st = lstatSync(outAbs); } catch { /* absent: created below */ }
  if (st) {
    if (!st.isDirectory()) throw new FatalError(`output ${outAbs} exists and is not a folder`);
    if (readdirSync(outAbs).length) throw new FatalError(`output folder ${outAbs} is not empty; remove it or pick a new one`);
  }
  try { mkdirSync(outAbs, { recursive: true }); } catch (e) { throw new FatalError(`cannot create ${outAbs}: ${e.message}`); }
  return outAbs;
}

function main() {
  const outAbs = prepareOut(process.argv[2]);
  const date = buildDate();
  const files = listFiles(outAbs);
  for (const f of files) {
    if (!f.includes('/') && !ROOT_FILES.has(f)) {
      warn(`${pathText(f)}: not a studio root file (${[...ROOT_FILES].join(', ')}); still published. App files belong in the app's folder, and root files change only through a studio edit.`);
    }
  }
  for (const { path, problems } of portablePathProblems(files.filter((f) => f.includes('/')))) {
    warn(`${pathText(path)}: not a portable path (${problems.join('; ')}); still published. Rename it: a path Windows cannot check out breaks every app's publish tool.`);
  }
  const sizes = copyFiles(files, outAbs);
  const topDirs = [...new Set(files.filter((f) => f.includes('/')).map((f) => f.slice(0, f.indexOf('/'))))].sort(byCodeUnit);
  const { cards, skipped } = collectCards(topDirs, new Set(sizes.keys()), date.toISOString().slice(0, 10));
  const page = renderPage(cards, date.getUTCFullYear());
  try {
    writeFileSync(join(outAbs, 'index.html'), page);
  } catch (e) {
    throw new FatalError(`cannot write index.html: ${e.message}`);
  }

  const byTop = new Map([[ROOT_BUCKET, Buffer.byteLength(page)]]);
  for (const [rel, n] of sizes) {
    const key = rel.includes('/') ? rel.slice(0, rel.indexOf('/')) : ROOT_BUCKET;
    byTop.set(key, (byTop.get(key) ?? 0) + n);
  }
  const total = [...byTop.values()].reduce((a, b) => a + b, 0);
  const tooBig = sizeWarning(total);
  if (tooBig) warn(tooBig);

  log('Atto Studio site build');
  log(`  source: ${ROOT}`);
  log(`  output: ${outAbs}`);
  log(`  files copied: ${sizes.size} of ${files.length} (+ generated index.html)`);
  log(`  cards rendered: ${cards.length}${cards.length ? ` (${cards.map((c) => c.folder).join(', ')})` : ''}`);
  log(`  cards skipped: ${skipped.length}`);
  for (const s of skipped) log(`    - ${pathText(s.folder)}: ${s.reason}`);
  log(`  output size: ${total} bytes (${mb(total)}; budget ${mb(SIZE_BUDGET)})`);
  log(`  warnings: ${warnings.length}`);
  writeSummary(summaryMarkdown({ cards, skipped, total, byTop }));
}

function run() {
  try {
    main();
  } catch (e) {
    const msg = e instanceof FatalError ? e.message : `build failed: ${e && e.stack ? e.stack : e}`;
    console.log(`::error::${cmdEscape(msg)}`);
    writeSummary(`## Atto Studio site build failed\n\n${fence([cmdEscape(msg)])}\n`);
    process.exitCode = 1;
  }
}

/** True when this file is the program being run, not a module imported by the self-test. */
function isCli() {
  if (typeof import.meta.main === 'boolean') return import.meta.main;
  try {
    return samePath(realpathSync(process.argv[1]), realpathSync(fileURLToPath(import.meta.url)));
  } catch {
    return false;
  }
}

if (isCli()) run();
