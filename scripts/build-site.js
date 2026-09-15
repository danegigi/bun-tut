#!/usr/bin/env bun
/*
 * build-site.js — Bun Tutorial static site generator
 *
 * Reads hand-authored HTML supplements from scripts/supplements/*.html,
 * wraps each in a themed page shell (sticky nav, auto-generated jump-link
 * TOC from <h2>/<h3>, copy-to-clipboard on <pre>, "Try in Bun" FAB),
 * and emits them plus a card-grid landing index.html + .nojekyll into docs/.
 *
 * Runs under bun (`bun run scripts/build-site.js`) or node — no deps.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SUPP = path.join(ROOT, "scripts", "supplements");
const OUT = path.join(ROOT, "docs");

// ---- Section registry (order matters; drives landing grid + prev/next) ----
const PAGES = [
  { slug: "getting-started", title: "Getting Started", icon: "🚀",
    doc: "https://bun.com/docs/installation",
    blurb: "Install Bun, scaffold a project, run TS/JS natively, bunfig.toml, env loading." },
  { slug: "package-manager", title: "Package Manager", icon: "📦",
    doc: "https://bun.com/docs/cli/install",
    blurb: "bun install/add/remove, bun.lockb, bun outdated, workspaces, bunx." },
  { slug: "cli-runtime", title: "CLI & Runtime", icon: "⚡",
    doc: "https://bun.com/docs/cli/run",
    blurb: "bun run, bunx, --watch/--hot, --print, shebang, command reference." },
  { slug: "networking", title: "Networking", icon: "🌐",
    doc: "https://bun.com/docs/api/http",
    blurb: "Bun.serve, WebSockets, TCP, UDP, fetch, and Workers." },
  { slug: "file-io", title: "File I/O", icon: "📄",
    doc: "https://bun.com/docs/api/file-io",
    blurb: "Bun.file, Bun.write, BunFile, streams, and the s3:// protocol." },
  { slug: "shell-terminal-cron", title: "Shell, Terminal, Spawn & Cron", icon: "🖥️",
    doc: "https://bun.com/reference/bun",
    blurb: "Bun.$, terminal utils, Bun.spawn, Bun.cron, and a CLI-app example." },
  { slug: "databases", title: "Databases: SQLite & SQL", icon: "🗄️",
    doc: "https://bun.com/docs/api/sql",
    blurb: "bun:sqlite plus the unified Bun.sql client (Postgres / MySQL / SQLite)." },
  { slug: "test-runner", title: "Test Runner", icon: "✅",
    doc: "https://bun.com/docs/cli/test",
    blurb: "bun test, matchers, mocks, snapshots, lifecycle hooks, coverage." },
  { slug: "security-crypto", title: "Security & Crypto", icon: "🔐",
    doc: "https://bun.com/docs/api/hashing",
    blurb: "Bun.password, Bun.hash, CryptoHasher, Bun.CSRF, and Bun.secrets." },
  { slug: "data-content", title: "Data, Content & Automation", icon: "🧩",
    doc: "https://bun.com/reference/bun",
    blurb: "JSON, YAML, TOML, Bun.Image, archives, Glob, and Bun.WebView scraping." },
  { slug: "utilities", title: "Utilities", icon: "🛠️",
    doc: "https://bun.com/docs/api/utils",
    blurb: "Bun.env, sleep, which, escapeHTML, peek, deepEquals, nanoseconds." },
  { slug: "web-hono-auth", title: "Web Dev: Hono + Auth + Storage", icon: "🔑",
    doc: "https://hono.dev",
    blurb: "Hono app, JWT refresh tokens in HttpOnly cookies, SSO, and Bun.s3 storage." },
  { slug: "e2e-deploy", title: "E2E Testing & Deploying", icon: "🚢",
    doc: "https://bun.com/docs/bundler/executables",
    blurb: "Playwright E2E, bun build, --compile executables, Docker, production." },
];

// ---- helpers ----
function slugifyHeading(text) {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z]+;/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

// Add id="" to every <h2>/<h3> that lacks one, and collect TOC entries.
function injectAnchorsAndToc(html) {
  const toc = [];
  const used = new Set();
  const out = html.replace(/<(h2|h3)([^>]*)>([\s\S]*?)<\/\1>/g, (m, tag, attrs, inner) => {
    let id = (attrs.match(/id=["']([^"']+)["']/) || [])[1];
    if (!id) {
      id = slugifyHeading(inner) || "section";
      let base = id, n = 2;
      while (used.has(id)) id = `${base}-${n++}`;
      attrs += ` id="${id}"`;
    }
    used.add(id);
    toc.push({ level: tag === "h2" ? 2 : 3, id, text: inner.replace(/<[^>]+>/g, "").trim() });
    return `<${tag}${attrs}>${inner}</${tag}>`;
  });
  return { html: out, toc };
}

function tocHtml(toc) {
  if (!toc.length) return "";
  return toc
    .map(
      (t) =>
        `<li class="lvl${t.level}"><a href="#${t.id}">${t.text}</a></li>`
    )
    .join("\n");
}

const STYLE = `
:root{
  --bg:#0d1117; --panel:#161b22; --panel2:#1c2230; --text:#e6edf3; --muted:#8b949e;
  --accent:#fbf0df; --accent-2:#f472b6; --code-bg:#0b0f14; --border:#30363d;
  --link:#f9a8d4;
}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;background:var(--bg);color:var(--text)}
a{color:var(--link);text-decoration:none}
a:hover{text-decoration:underline}
header.nav{position:sticky;top:0;z-index:20;background:rgba(13,17,23,.85);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:14px;padding:10px 20px}
header.nav .brand{font-weight:700;color:var(--accent);font-size:15px}
header.nav a.home{margin-left:auto;font-size:14px;color:var(--muted)}
.wrap{max-width:940px;margin:0 auto;padding:28px 20px 120px}
h1.page-title{font-size:2rem;margin:.2em 0 .3em;color:var(--accent);line-height:1.2}
h2{font-size:1.4rem;margin:2.2em 0 .5em;padding-top:.6em;border-top:1px solid var(--border);scroll-margin-top:70px}
h3{font-size:1.12rem;margin:1.6em 0 .4em;color:var(--accent);scroll-margin-top:70px}
p,li{color:var(--text)}
.verify{display:block;border-left:3px solid #d29922;background:#231f16;padding:10px 14px;border-radius:0 8px 8px 0;margin:1.2em 0;font-size:14px;color:#e3b341}
.note{border-left:3px solid var(--accent-2);background:var(--panel);padding:12px 16px;border-radius:0 8px 8px 0;margin:1.2em 0;font-size:14.5px}
.ref{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:.2em 0 1.4em;font-size:14px;background:var(--panel);border:1px solid var(--border);border-radius:8px;padding:9px 13px}
nav.toc{background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:14px 20px;margin:1.6em 0}
nav.toc strong{display:block;color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px}
nav.toc ul{margin:0;padding:0;list-style:none;column-gap:28px;columns:2}
nav.toc li{margin:5px 0;break-inside:avoid}
nav.toc li.lvl3{padding-left:14px;font-size:14px}
pre{position:relative;background:var(--code-bg);border:1px solid var(--border);border-radius:10px;padding:16px 18px;overflow:auto;font-size:13.5px;line-height:1.55}
code{font-family:"SF Mono",SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace}
:not(pre)>code{background:var(--panel2);padding:2px 6px;border-radius:5px;font-size:.9em;color:#ffd9ec}
table{border-collapse:collapse;width:100%;margin:1.2em 0;font-size:14px;display:block;overflow:auto}
th,td{border:1px solid var(--border);padding:8px 12px;text-align:left}
th{background:var(--panel);color:var(--accent)}
pre .copy{position:absolute;top:8px;right:8px;opacity:0;transition:.15s;background:var(--panel);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:4px 10px;font-size:12px;cursor:pointer}
pre:hover .copy{opacity:1}
.pager{display:flex;justify-content:space-between;gap:12px;margin-top:3em;border-top:1px solid var(--border);padding-top:1.4em}
.pager a{background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:12px 16px;flex:1;color:var(--text)}
.pager a.next{text-align:right}
.pager a small{display:block;color:var(--muted);font-size:12px;margin-bottom:2px}
.fab{position:fixed;right:20px;z-index:30;border:none;border-radius:24px;padding:10px 16px;font-weight:600;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.4);font-size:14px}
.fab.try{bottom:20px;background:var(--accent);color:#0d1117}
.fab.top{bottom:70px;background:var(--panel);color:var(--text);border:1px solid var(--border)}
/* landing */
.hero{text-align:center;padding:40px 0 10px}
.hero .logo{font-size:3rem}
.hero h1{font-size:2.4rem;margin:.1em 0;color:var(--accent)}
.hero p{color:var(--muted);max-width:640px;margin:0 auto}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;margin:32px 0}
.card{display:block;background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:18px;transition:.15s}
.card:hover{border-color:var(--accent-2);transform:translateY(-2px);text-decoration:none}
.card .n{color:var(--muted);font-size:12px}
.card h3{margin:.3em 0;color:var(--accent);font-size:1.1rem}
.card p{color:var(--muted);font-size:14px;margin:0}
@media(max-width:640px){nav.toc ul{columns:1}}
`;

function pageShell({ title, icon, doc, bodyHtml, toc, prev, next }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} — Bun Tutorial</title>
<style>${STYLE}</style>
</head>
<body>
<header class="nav"><span class="brand">🥟 Bun Tutorial</span><a class="home" href="index.html">← All sections</a></header>
<main class="wrap">
<h1 class="page-title">${icon} ${title}</h1>
<div class="ref">📖 Official reference: <a href="${doc}" target="_blank" rel="noopener">${doc.replace(/^https?:\/\//, "")}</a></div>
<nav class="toc"><strong>On this page</strong><ul>
${tocHtml(toc)}
</ul></nav>
${bodyHtml}
<div class="pager">
${prev ? `<a class="prev" href="${prev.slug}.html"><small>Previous</small>${prev.icon} ${prev.title}</a>` : `<a class="prev" href="index.html"><small>Home</small>All sections</a>`}
${next ? `<a class="next" href="${next.slug}.html"><small>Next</small>${next.icon} ${next.title}</a>` : `<a class="next" href="index.html"><small>Done</small>Back to index</a>`}
</div>
</main>
<button class="fab try" onclick="window.open('https://bun.com/repl','_blank')">▶ Try in Bun</button>
<button class="fab top" onclick="scrollTo({top:0,behavior:'smooth'})">↑ Top</button>
<script>
document.querySelectorAll('pre').forEach(function(pre){
  var b=document.createElement('button');b.className='copy';b.textContent='Copy';
  b.addEventListener('click',function(){
    var t=pre.querySelector('code')?pre.querySelector('code').innerText:pre.innerText;
    navigator.clipboard.writeText(t.replace(/Copy$/,''));
    b.textContent='Copied!';setTimeout(function(){b.textContent='Copy'},1500);
  });
  pre.appendChild(b);
});
</script>
</body>
</html>`;
}

function landing() {
  const cards = PAGES.map(
    (p, i) =>
      `<a class="card" href="${p.slug}.html"><div class="n">${String(i + 1).padStart(2, "0")}</div><h3>${p.icon} ${p.title}</h3><p>${p.blurb}</p></a>`
  ).join("\n");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bun Tutorial — builtins & standards, junior→mid</title>
<style>${STYLE}</style>
</head>
<body>
<header class="nav"><span class="brand">🥟 Bun Tutorial</span><a class="home" href="https://bun.com/docs" target="_blank" rel="noopener">bun.com/docs ↗</a></header>
<main class="wrap">
<div class="hero">
<div class="logo">🥟</div>
<h1>Bun Tutorial</h1>
<p>A comprehensive but approachable tour of Bun's built-in standard library — runnable examples for every builtin, with an official reference link in each section. Aimed at junior→mid developers.</p>
</div>
<div class="grid">
${cards}
</div>
<p style="color:var(--muted);font-size:13px;text-align:center">Built for the latest Bun. Sections marked with a ⚠️ note are pending verification against the live reference.</p>
</main>
</body>
</html>`;
}

// ---- build ----
function build() {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, ".nojekyll"), "");
  let built = 0, missing = [];
  PAGES.forEach((p, i) => {
    const src = path.join(SUPP, `${p.slug}.html`);
    if (!fs.existsSync(src)) { missing.push(p.slug); return; }
    const raw = fs.readFileSync(src, "utf8");
    const { html, toc } = injectAnchorsAndToc(raw);
    const out = pageShell({
      title: p.title, icon: p.icon, doc: p.doc, bodyHtml: html, toc,
      prev: PAGES[i - 1], next: PAGES[i + 1],
    });
    fs.writeFileSync(path.join(OUT, `${p.slug}.html`), out);
    built++;
  });
  fs.writeFileSync(path.join(OUT, "index.html"), landing());
  console.log(`Built ${built}/${PAGES.length} pages -> ${OUT}`);
  if (missing.length) console.log("Missing supplements:", missing.join(", "));
}

build();
