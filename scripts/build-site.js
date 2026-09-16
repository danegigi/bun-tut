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
    blurb: "Install, scaffold, run TS/JS natively, bunfig.toml, and env resolution order.",
    further: [
      ["Installation", "https://bun.com/docs/installation"],
      ["bunfig.toml reference", "https://bun.com/docs/runtime/bunfig"],
      ["Environment variables", "https://bun.com/docs/runtime/env"],
      ["TypeScript support", "https://bun.com/docs/runtime/typescript"],
    ] },
  { slug: "package-manager", title: "Package Manager", icon: "📦",
    doc: "https://bun.com/docs/cli/install",
    blurb: "install/add/remove, the binary lockfile, bun outdated, workspaces, overrides, bunx.",
    further: [
      ["bun install", "https://bun.com/docs/cli/install"],
      ["Lockfile", "https://bun.com/docs/install/lockfile"],
      ["Workspaces", "https://bun.com/docs/install/workspaces"],
      ["bunx", "https://bun.com/docs/cli/bunx"],
    ] },
  { slug: "cli-runtime", title: "CLI & Runtime", icon: "⚡",
    doc: "https://bun.com/docs/cli/run",
    blurb: "bun run, bunx, --watch/--hot semantics, --print, shebangs, the full flag set.",
    further: [
      ["bun run", "https://bun.com/docs/cli/run"],
      ["Hot reloading", "https://bun.com/docs/runtime/hot"],
      ["Debugger", "https://bun.com/docs/runtime/debugger"],
      ["Web APIs in Bun", "https://bun.com/docs/runtime/web-apis"],
    ] },
  { slug: "networking", title: "Networking", icon: "🌐",
    doc: "https://bun.com/docs/api/http",
    blurb: "Bun.serve routing, WebSockets + pub/sub, raw TCP/UDP, fetch extensions, Workers.",
    further: [
      ["HTTP server", "https://bun.com/docs/api/http"],
      ["WebSockets", "https://bun.com/docs/api/websockets"],
      ["TCP sockets", "https://bun.com/docs/api/tcp"],
      ["UDP sockets", "https://bun.com/docs/api/udp"],
      ["Workers", "https://bun.com/docs/api/workers"],
    ] },
  { slug: "file-io", title: "File I/O", icon: "📄",
    doc: "https://bun.com/docs/api/file-io",
    blurb: "Bun.file, Bun.write, incremental writers, streaming, and the s3:// protocol.",
    further: [
      ["File I/O", "https://bun.com/docs/api/file-io"],
      ["S3 & s3:// protocol", "https://bun.com/docs/api/s3"],
      ["Streams", "https://bun.com/docs/api/streams"],
    ] },
  { slug: "shell-terminal-cron", title: "Shell, Terminal, Spawn & Cron", icon: "🖥️",
    doc: "https://bun.com/docs/runtime/shell",
    blurb: "Bun.$ scripting, terminal width, Bun.Terminal PTY, Bun.spawn, Bun.cron, a real CLI.",
    further: [
      ["Bun Shell ($)", "https://bun.com/docs/runtime/shell"],
      ["Spawn", "https://bun.com/docs/api/spawn"],
      ["Cron", "https://bun.com/reference/bun/cron"],
      ["Terminal (PTY)", "https://bun.com/reference/bun/Terminal"],
    ] },
  { slug: "databases", title: "Databases: SQLite, SQL, Drizzle & MongoDB", icon: "🗄️",
    doc: "https://bun.com/docs/api/sql",
    blurb: "bun:sqlite, the unified Bun.sql client, Drizzle ORM (basic→advanced), and MongoDB.",
    further: [
      ["bun:sqlite", "https://bun.com/docs/api/sqlite"],
      ["Bun.sql (SQL)", "https://bun.com/docs/api/sql"],
      ["Drizzle + Bun SQLite", "https://orm.drizzle.team/docs/get-started/bun-sqlite-new"],
      ["Drizzle queries", "https://orm.drizzle.team/docs/rqb"],
      ["MongoDB + Bun (Mongoose)", "https://bun.com/docs/guides/ecosystem/mongoose"],
      ["MongoDB Node driver", "https://www.mongodb.com/docs/drivers/node/current/"],
    ] },
  { slug: "test-runner", title: "Test Runner", icon: "✅",
    doc: "https://bun.com/docs/cli/test",
    blurb: "bun test, matchers, mocks/spies, snapshots, lifecycle hooks, coverage, DOM testing.",
    further: [
      ["bun test", "https://bun.com/docs/cli/test"],
      ["Writing tests", "https://bun.com/docs/test/writing"],
      ["Mocks", "https://bun.com/docs/test/mocks"],
      ["Snapshots", "https://bun.com/docs/test/snapshots"],
      ["Coverage", "https://bun.com/docs/test/coverage"],
    ] },
  { slug: "security-crypto", title: "Security & Crypto", icon: "🔐",
    doc: "https://bun.com/docs/api/hashing",
    blurb: "Bun.password (argon2/bcrypt), Bun.hash, CryptoHasher + HMAC, Bun.CSRF, Bun.secrets.",
    further: [
      ["Hashing", "https://bun.com/docs/api/hashing"],
      ["CSRF", "https://bun.com/reference/bun/CSRF"],
      ["Secrets", "https://bun.com/reference/bun/secrets"],
      ["node:crypto", "https://bun.com/docs/runtime/nodejs-apis"],
    ] },
  { slug: "data-content", title: "Data, Content & Automation", icon: "🧩",
    doc: "https://bun.com/reference/bun",
    blurb: "JSON/YAML/TOML/JSONC/JSONL/XML, Markdown, Image pipeline, archives, Glob, WebView scraping.",
    further: [
      ["YAML", "https://bun.com/reference/bun/YAML"],
      ["TOML", "https://bun.com/reference/bun/TOML"],
      ["Markdown", "https://bun.com/reference/bun/markdown"],
      ["Image", "https://bun.com/reference/bun/Image"],
      ["Archive", "https://bun.com/reference/bun/Archive"],
      ["Glob", "https://bun.com/reference/bun/Glob"],
      ["WebView", "https://bun.com/reference/bun/WebView"],
    ] },
  { slug: "utilities", title: "Utilities", icon: "🛠️",
    doc: "https://bun.com/docs/api/utils",
    blurb: "Timing, which, escapeHTML, peek, deepEquals, compression, UUID v5/v7, ANSI helpers.",
    further: [
      ["Utilities", "https://bun.com/docs/api/utils"],
      ["Bun.color", "https://bun.com/reference/bun/color"],
      ["Compression (zlib/zstd)", "https://bun.com/reference/bun/gzipSync"],
    ] },
  { slug: "web-hono-auth", title: "Web Dev: Hono + Auth + Storage", icon: "🔑",
    doc: "https://hono.dev",
    blurb: "Hono app, JWT access + refresh rotation in HttpOnly cookies, OAuth2/OIDC SSO, Bun.s3.",
    further: [
      ["Hono docs", "https://hono.dev/docs/"],
      ["Hono JWT middleware", "https://hono.dev/docs/middleware/builtin/jwt"],
      ["Hono cookie helper", "https://hono.dev/docs/helpers/cookie"],
      ["OAuth 2.0 (RFC 6749)", "https://datatracker.ietf.org/doc/html/rfc6749"],
      ["OpenID Connect", "https://openid.net/developers/how-connect-works/"],
      ["Bun S3", "https://bun.com/docs/api/s3"],
    ] },
  { slug: "e2e-deploy", title: "E2E Testing & Deploying", icon: "🚢",
    doc: "https://bun.com/docs/bundler/executables",
    blurb: "Playwright E2E under Bun, bun build, --compile standalone binaries, Docker, production.",
    further: [
      ["Playwright", "https://playwright.dev/docs/intro"],
      ["Bundler", "https://bun.com/docs/bundler"],
      ["Standalone executables", "https://bun.com/docs/bundler/executables"],
      ["Bun Docker image", "https://hub.docker.com/r/oven/bun"],
    ] },
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
.further{margin-top:2.4em;background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:6px 20px 16px}
.further h2{border-top:none;color:var(--accent-2)}
.further-list{margin:0;padding-left:20px;columns:2;column-gap:28px}
.further-list li{margin:6px 0;break-inside:avoid}
@media(max-width:640px){.further-list{columns:1}}
`;

function furtherHtml(further) {
  if (!further || !further.length) return "";
  const items = further
    .map(([label, url]) => `<li><a href="${url}" target="_blank" rel="noopener">${label} ↗</a></li>`)
    .join("\n");
  return `<section class="further"><h2 id="further-reading">Further reading</h2>
<p>Official documentation for the APIs and tools covered on this page:</p>
<ul class="further-list">${items}</ul></section>`;
}

function pageShell({ title, icon, doc, bodyHtml, toc, prev, next, further }) {
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
${furtherHtml(further)}
<div class="pager">
${prev ? `<a class="prev" href="${prev.slug}.html"><small>Previous</small>${prev.icon} ${prev.title}</a>` : `<a class="prev" href="index.html"><small>Home</small>All sections</a>`}
${next ? `<a class="next" href="${next.slug}.html"><small>Next</small>${next.icon} ${next.title}</a>` : `<a class="next" href="index.html"><small>Done</small>Back to index</a>`}
</div>
</main>
<button type="button" class="fab try" id="fab-try">▶ Try in Bun</button>
<button type="button" class="fab top" id="fab-top">↑ Top</button>
<script>
document.getElementById('fab-try').addEventListener('click', function(){
  window.open('https://bun.com/repl', '_blank', 'noopener');
});
document.getElementById('fab-top').addEventListener('click', function(){
  var el = document.scrollingElement || document.documentElement || document.body;
  try {
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  } catch (e) {
    window.scrollTo(0, 0);
  }
  // Hard fallback if the smooth scroll was a no-op
  if (el.scrollTop > 0) el.scrollTop = 0;
});
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
<title>Bun Tutorial — built-in standard library reference</title>
<style>${STYLE}</style>
</head>
<body>
<header class="nav"><span class="brand">🥟 Bun Tutorial</span><a class="home" href="https://bun.com/docs" target="_blank" rel="noopener">bun.com/docs ↗</a></header>
<main class="wrap">
<div class="hero">
<div class="logo">🥟</div>
<h1>Bun Tutorial</h1>
<p>A practical, in-depth tour of Bun's built-in standard library — runnable, real-world examples for every builtin, each section carrying official reference links for further reading. Written for developers building production services who want the depth behind each API, not just its shape.</p>
</div>
<div class="grid">
${cards}
</div>
<p style="color:var(--muted);font-size:13px;text-align:center">Every builtin verified against the <a href="https://bun.com/reference/bun" target="_blank" rel="noopener">Bun 1.4.2 reference</a>.</p>
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
      prev: PAGES[i - 1], next: PAGES[i + 1], further: p.further,
    });
    fs.writeFileSync(path.join(OUT, `${p.slug}.html`), out);
    built++;
  });
  fs.writeFileSync(path.join(OUT, "index.html"), landing());
  console.log(`Built ${built}/${PAGES.length} pages -> ${OUT}`);
  if (missing.length) console.log("Missing supplements:", missing.join(", "));
}

build();
