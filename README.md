# 🥟 Bun Tutorial

A comprehensive but simplified tutorial of **Bun's built-in standard library**, pinned to **Bun 1.4.2**. Runnable examples for every builtin, each section carrying an official reference link. Aimed at junior→mid developers.

Live site (GitHub Pages): served from `main` `/docs`.

## Sections

1. Getting Started — install, `bun init`, running TS/JS, `bunfig.toml`, env
2. Package Manager — `install`/`add`/`remove`, `bun.lockb`, workspaces, `bunx`
3. CLI & Runtime — `bun run`, `--watch`/`--hot`, `--print`, shebang
4. Networking — `Bun.serve`, WebSockets, TCP, UDP, `fetch`, Workers
5. File I/O — `Bun.file`, `Bun.write`, `BunFile`, streams, `s3://`
6. Shell, Terminal, Spawn & Cron — `Bun.$`, terminal utils, `Bun.spawn`, `Bun.cron` + a CLI-app example
7. Databases — `bun:sqlite` + unified `Bun.sql` (Postgres/MySQL/SQLite)
8. Test Runner — `bun test`, matchers, mocks, snapshots, coverage
9. Security & Crypto — `Bun.password`, `Bun.hash`, `CryptoHasher`, `Bun.CSRF`, `Bun.secrets`
10. Data, Content & Automation — JSON/YAML/TOML/JSON5, `Bun.markdown`, `Bun.Image`, `Bun.Archive`, `Bun.Glob`, `Bun.color`, `Bun.WebView` scraping
11. Utilities — `Bun.sleep`, `which`, `escapeHTML`, `peek`, `deepEquals`, compression
12. Web Dev — Hono, JWT refresh tokens in HttpOnly cookies, SSO (OAuth2/OIDC), `Bun.s3`
13. E2E & Deploying — Playwright E2E, `bun build`, `--compile` executables, Docker, production

**Skipped by design:** FFI (`bun:ffi`) and deep bundler internals (plugins/loaders/code-splitting).

## Verification

Every API was verified against the published `bun-types@1.4.2` type definitions. First-party builtins confirmed real in 1.4.2 include: `Bun.cron`, `Bun.WebView`, `Bun.s3`/`S3Client`, `Bun.sql`/`SQL`, `Bun.markdown`, `Bun.Image`, `Bun.Archive`, `Bun.Glob`, `Bun.TOML`, `Bun.YAML`, `Bun.JSON5`, `Bun.CSRF`, `Bun.secrets`, `Bun.password`, `Bun.hash`, `Bun.CryptoHasher`, `Bun.color`, `Bun.stringWidth`, `Bun.spawn`.

Two APIs are marked **experimental** in the reference (noted inline): `Bun.WebView` and `Bun.secrets`.

## Build

```bash
bun run scripts/build-site.js     # or: bun run build
```

Reads hand-authored HTML from `scripts/supplements/*.html`, wraps each in a themed shell (sticky nav, auto-generated jump-link TOC, copy-to-clipboard, "Try in Bun" FAB), and emits `docs/*.html` + `docs/index.html` (card-grid landing) + `docs/.nojekyll`.

The build script runs under Bun or Node (no dependencies).

## Preview locally

```bash
bun run serve      # builds, then serves docs/ on http://127.0.0.1:8799
```

## Deploy (GitHub Pages)

1. Push to `main`.
2. Settings → Pages → Source: `main` branch, `/docs` folder.

## License

MIT
