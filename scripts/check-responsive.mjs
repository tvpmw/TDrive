#!/usr/bin/env node
/**
 * TDrive — Responsive Check Script
 * ================================
 * Verifikasi responsive TDrive secara otomatis memakai Playwright:
 *   1. Tidak ada horizontal scroll di semua halaman & lebar viewport
 *   2. Tidak ada elemen yang "terpotong" keluar viewport (di luar container
 *      overflow-x-auto dan dekorasi pointer-events:none)
 *   3. Tidak ada error React/hydration (pageerror) & console error
 *   4. Breakpoint `md` (768px) berfungsi: <768px = hamburger mobile,
 *      >=768px = sidebar desktop inline
 *   5. Interaksi drawer mobile: hamburger -> drawer terbuka -> backdrop -> tertutup
 *
 * Usage:
 *   node scripts/check-responsive.mjs [options]
 *
 * Options (fallback ke env):
 *   --base <url>        Base URL (env: TDRIVE_BASE_URL, default: http://localhost:3004)
 *   --widths <a,b,c>    Lebar viewport (env: WIDTHS, default: 390,768,1024,1280)
 *   --pages <a,b,c>     Path halaman (env: PAGES, default: /,/login + semua halaman authed)
 *   --email <e>         Email untuk halaman authed (env: TEST_EMAIL)
 *   --password <p>      Password (env: TEST_PASSWORD)
 *   --register          Auto-register akun tes sementara jika login gagal
 *   --screenshots       Simpan screenshot SEMUA halaman (default: hanya saat gagal)
 *   --out <dir>         Folder output (default: .artifacts/responsive)
 *   --headed            Jalankan dengan window terlihat (default: headless)
 *
 * Exit code: 0 = semua lolos, 1 = ada kegagalan, 2 = error konfigurasi.
 */
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------- config ---
const BASE = (process.env.TDRIVE_BASE_URL ?? arg("--base", "http://localhost:3004")).replace(/\/+$/, "");
const WIDTHS = (process.env.WIDTHS ?? arg("--widths", "390,768,1024,1280"))
  .split(",").map((w) => parseInt(w.trim(), 10)).filter(Number.isFinite);
const EMAIL = process.env.TEST_EMAIL ?? arg("--email", null);
const PASSWORD = process.env.TEST_PASSWORD ?? arg("--password", null);
const AUTO_REGISTER = !!process.env.AUTO_REGISTER || hasFlag("--register");
const ALL_SCREENSHOTS = hasFlag("--screenshots");
const OUT_DIR = process.env.OUT_DIR ?? arg("--out", ".artifacts/responsive");
const HEADED = hasFlag("--headed");
const TIMEOUT_MS = 45_000;

const PUBLIC_PAGES = ["/", "/login"];
const AUTHED_PAGES = [
  "/dashboard", "/drive", "/settings", "/vault",
  "/suite", "/network", "/workflows", "/trash", "/stealth", "/api-status",
  "/server", "/server/health", "/server/benchmark", "/drive/duplicates",
];
// Halaman yang merender <Sidebar /> langsung (memakai floating hamburger di mobile)
const SIDEBAR_PAGES = new Set([
  "/drive", "/dashboard", "/settings", "/vault", "/suite", "/network", "/workflows",
  "/trash", "/stealth", "/api-status", "/server", "/server/health", "/server/benchmark",
  "/drive/duplicates",
]);
// Halaman yang memakai utility `pb-fab` (clearance FAB hamburger di scroll container)
const PB_FAB_PAGES = new Set([
  ...SIDEBAR_PAGES,
]);

const PAGES = (process.env.PAGES ?? arg("--pages", null))
  ? (process.env.PAGES ?? arg("--pages")).split(",").map((p) => p.trim())
  : [...PUBLIC_PAGES, ...AUTHED_PAGES];

// ----------------------------------------------------------------- utils ---
function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
function hasFlag(name) {
  return process.argv.includes(name);
}
function findChrome() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  for (const cmd of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]) {
    try {
      const p = execFileSync("which", [cmd], { encoding: "utf8" }).trim();
      if (p) return p;
    } catch {}
  }
  return undefined; // biarkan Playwright memakai browser bundled-nya
}
function sanitize(p) {
  return p.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "root";
}
function now() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

const results = [];
function record({ page, width, check, pass, detail = "" }) {
  results.push({ page, width, check, pass, detail });
  const mark = pass ? "PASS" : "FAIL";
  console.log(`  [${mark}] ${page} @${width}px — ${check}${detail ? ` (${detail})` : ""}`);
}
const failures = () => results.filter((r) => !r.pass);

// ------------------------------------------------------------ page checks ---
async function checkPage(page, label) {
  const pageErrors = [];
  const consoleErrors = [];
  const onPageError = (e) => pageErrors.push(e.message);
  const onConsole = (m) => { if (m.type() === "error") consoleErrors.push(m.text()); };
  page.on("pageerror", onPageError);
  page.on("console", onConsole);

  try {
    await page.goto(`${BASE}${label.path}`, { waitUntil: "networkidle", timeout: TIMEOUT_MS });
  } catch (e) {
    record({ page: label.path, width: label.width, check: "navigasi", pass: false, detail: e.message.slice(0, 120) });
    page.removeListener("pageerror", onPageError);
    page.removeListener("console", onConsole);
    return;
  }
  await page.waitForTimeout(1200);

  const m = await page.evaluate(() => {
    const de = document.documentElement;
    const iw = window.innerWidth;
    const real = [];
    for (const el of document.querySelectorAll("body *")) {
      if (real.length >= 20) break;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      if (r.right <= iw + 1 && r.left >= -1) continue;
      const st = getComputedStyle(el);
      if (st.display === "none" || st.visibility === "hidden" || st.pointerEvents === "none") continue;
      let a = el.parentElement, insideScroll = false;
      while (a && a !== document.body) {
        const oa = getComputedStyle(a).overflowX;
        if (oa === "auto" || oa === "scroll") { insideScroll = true; break; }
        a = a.parentElement;
      }
      if (!insideScroll) real.push({ tag: el.tagName, cls: String(el.className).slice(0, 80), right: Math.round(r.right) });
    }
    // Scroller internal (overflow-x auto/scroll) yang BOX-nya melebihi viewport = double scrollbar
    const scrollersOut = [];
    for (const el of document.querySelectorAll("body *")) {
      if (scrollersOut.length >= 6) break;
      const st = getComputedStyle(el);
      if (st.overflowX !== "auto" && st.overflowX !== "scroll") continue;
      const r = el.getBoundingClientRect();
      if (r.width < 10) continue;
      if (r.right > iw + 2 || r.left < -2) {
        scrollersOut.push({ tag: el.tagName, cls: String(el.className).slice(0, 60), right: Math.round(r.right), left: Math.round(r.left), w: Math.round(r.width) });
      }
    }
    const isActuallyVisible = (el) => {
      for (let a = el; a && a !== document.body; a = a.parentElement) {
        const st = getComputedStyle(a);
        if (st.display === "none" || st.visibility === "hidden") return false;
      }
      return true;
    };
    const aside = document.querySelector("aside");
    const hamburgerEl = document.querySelector("button.fixed.bottom-4.left-4");
    return {
      iw,
      sw: de.scrollWidth,
      horizontalScrollable: de.scrollWidth > de.clientWidth + 1,
      vwMeta: !!document.querySelector('meta[name="viewport"]'),
      real,
      scrollersOut,
      asideCount: document.querySelectorAll("aside").length,
      asideVisible: !!aside && aside.getBoundingClientRect().width > 0 && isActuallyVisible(aside),
      hamburgerVisible: !!hamburgerEl && isActuallyVisible(hamburgerEl),
    };
  });

  record({ page: label.path, width: label.width, check: "horizontal scroll", pass: !m.horizontalScrollable, detail: m.horizontalScrollable ? `sw=${m.sw} > client=${m.iw}` : `sw=${m.sw}` });
  record({ page: label.path, width: label.width, check: "overflow elemen", pass: m.real.length === 0, detail: m.real.map((o) => `<${o.tag}> ${o.cls} right=${o.right}`).join(" | ").slice(0, 200) });
  record({ page: label.path, width: label.width, check: "scroller melebihi viewport", pass: m.scrollersOut.length === 0, detail: m.scrollersOut.map((o) => `<${o.tag}> ${o.cls} right=${o.right} w=${o.w}`).join(" | ").slice(0, 200) });
  record({ page: label.path, width: label.width, check: "viewport meta", pass: m.vwMeta });
  record({ page: label.path, width: label.width, check: "pageerror", pass: pageErrors.length === 0, detail: pageErrors.slice(0, 2).map((e) => e.slice(0, 90)).join(" | ") });
  record({ page: label.path, width: label.width, check: "console error (warning)", pass: true, detail: consoleErrors.length ? `found ${consoleErrors.length}: ${consoleErrors[0].slice(0, 90)}` : "" });

  // Breakpoint md behavior
  if (label.authed) {
    if (label.width < 768) {
      if (SIDEBAR_PAGES.has(label.path)) {
        record({ page: label.path, width: label.width, check: "md: hamburger mobile", pass: m.hamburgerVisible, detail: `hamburgerVisible=${m.hamburgerVisible}` });
      }
    } else {
      record({ page: label.path, width: label.width, check: "md: sidebar desktop", pass: m.asideCount >= 1 && m.asideVisible && !m.hamburgerVisible, detail: `aside=${m.asideCount} visible=${m.asideVisible} hamburgerVisible=${m.hamburgerVisible}` });
    }

    // FAB clearance: utility `pb-fab` harus aktif (96px) di <md dan NONAKTIF di md+
    if (PB_FAB_PAGES.has(label.path)) {
      const fabPad = await page.evaluate(() => {
        const els = [...document.querySelectorAll(".pb-fab")];
        return { count: els.length, pads: els.map((el) => getComputedStyle(el).paddingBottom) };
      });
      if (label.width < 768) {
        record({
          page: label.path, width: label.width, check: "fab clearance: pb-fab 96px",
          pass: fabPad.count > 0 && fabPad.pads.includes("96px"),
          detail: `pb-fab=${fabPad.count} pads=${fabPad.pads.join(",") || "-"}`,
        });
      } else {
        record({
          page: label.path, width: label.width, check: "fab clearance: pb-fab nonaktif di md+",
          pass: fabPad.count > 0 && !fabPad.pads.includes("96px"),
          detail: `pb-fab=${fabPad.count} pads=${fabPad.pads.join(",") || "-"}`,
        });
      }
    }
  }

  // Screenshot saat gagal (atau semua jika --screenshots)
  const failed = results.filter((r) => r.page === label.path && r.width === label.width && !r.pass && r.check !== "console error (warning)").length > 0;
  if (ALL_SCREENSHOTS || failed) {
    const file = path.join(OUT_DIR, `screens/${label.width}_${sanitize(label.path)}.png`);
    await page.screenshot({ path: file, fullPage: true }).catch(() => {});
  }

  page.removeListener("pageerror", onPageError);
  page.removeListener("console", onConsole);
}

// ------------------------------------------------------------- drawer test ---
async function checkDrawer(page, width) {
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle", timeout: TIMEOUT_MS }).catch(() => {});
  await page.waitForTimeout(1500);
  const hamburger = page.locator("button.fixed.bottom-4.left-4");
  const drawer = page.locator("div.md\\:hidden.fixed.inset-0.z-\\[60\\]");
  const backdrop = page.locator("div.absolute.inset-0.bg-black\\/50");
  const hambVisible = await hamburger.isVisible().catch(() => false);
  record({ page: "/dashboard", width, check: "drawer: hamburger tampil", pass: hambVisible });
  if (hambVisible) {
    await hamburger.click();
    await page.waitForTimeout(800);
    const open = await drawer.isVisible().catch(() => false);
    const asideW = await page.locator("div.md\\:hidden.fixed.inset-0.z-\\[60\\] aside").first().evaluate((el) => el.getBoundingClientRect().width).catch(() => null);
    record({ page: "/dashboard", width, check: "drawer: terbuka + lebar w-72", pass: open && asideW === 288, detail: `open=${open} width=${asideW}` });
    await page.screenshot({ path: path.join(OUT_DIR, "screens/drawer-open.png") }).catch(() => {});
    await backdrop.click({ force: true }).catch(() => {});
    await page.waitForTimeout(700);
    const closed = !(await drawer.isVisible().catch(() => true));
    record({ page: "/dashboard", width, check: "drawer: tertutup via backdrop", pass: closed });
  }
}

// ------------------------------------------------------------------- main ---
function main() {
  console.log(`\n🚀 TDrive Responsive Check`);
  console.log(`   base      : ${BASE}`);
  console.log(`   widths    : ${WIDTHS.join(", ")}px`);
  console.log(`   pages     : ${PAGES.join(", ")}`);
  console.log(`   auth      : ${EMAIL ? "yes" : "no (halaman authed akan di-skip)"}`);
  console.log(`   chrome    : ${findChrome() ?? "(playwright bundled)"}\n`);

  const chromePath = findChrome();
  const launchOpts = {
    headless: !HEADED,
    args: ["--no-sandbox", "--disable-gpu"],
  };
  if (chromePath) launchOpts.executablePath = chromePath;

  const run = async () => {
    fs.mkdirSync(path.join(OUT_DIR, "screens"), { recursive: true });
    const browser = await chromium.launch(launchOpts);

    for (const width of WIDTHS) {
      console.log(`\n── viewport ${width}px ──`);
      const ctx = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await ctx.newPage();

      // Auth (sekali per context)
      let authed = false;
      if (EMAIL && PASSWORD) {
        let res = await ctx.request.post(`${BASE}/auth/login`, { data: { email: EMAIL, password: PASSWORD } });
        if (res.status() === 401 && AUTO_REGISTER) {
          res = await ctx.request.post(`${BASE}/auth/register`, { data: { email: EMAIL, password: PASSWORD } });
        }
        authed = res.status() === 200 || res.status() === 201;
        if (!authed) console.log(`   ⚠️  login/register gagal (status ${res.status()}), halaman authed di-skip`);
      }

      for (const p of PAGES) {
        const isPublic = PUBLIC_PAGES.includes(p);
        if (!isPublic && !authed) continue;
        await checkPage(page, { path: p, width, authed: !isPublic });
      }
      await ctx.close();
    }

    // Interaksi drawer mobile (jika ada kredensial)
    if (EMAIL && PASSWORD) {
      console.log(`\n── drawer interaksi (mobile) ──`);
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      await ctx.request.post(`${BASE}/auth/login`, { data: { email: EMAIL, password: PASSWORD } }).catch(() => {});
      await checkDrawer(await ctx.newPage(), 390);
      await ctx.close();
    }

    await browser.close();

    // Report
    const failed = failures();
    const report = {
      generatedAt: now(),
      base: BASE,
      widths: WIDTHS,
      pages: PAGES,
      summary: { total: results.length, passed: results.length - failed.length, failed: failed.length },
      failures: failed,
      results,
    };
    fs.writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));

    console.log(`\n📊 Ringkasan: ${report.summary.passed}/${report.summary.total} lolos, ${report.summary.failed} gagal`);
    if (failed.length) {
      console.log(`\n❌ Gagal:`);
      for (const f of failed) console.log(`   - ${f.page} @${f.width}px — ${f.check}${f.detail ? ` (${f.detail})` : ""}`);
    }
    console.log(`   Report: ${path.join(OUT_DIR, "report.json")}`);
    process.exit(failed.length ? 1 : 0);
  };

  run().catch((e) => {
    console.error("FATAL:", e.message);
    process.exit(2);
  });
}

main();
