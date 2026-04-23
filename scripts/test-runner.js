#!/usr/bin/env node
// Parallel puppeteer test runner. Dispatches each test-*.js as a child
// process, capping concurrency at N workers. Aggregates PASS/FAIL
// counts, preserves per-test output order on completion, and exits
// non-zero if any suite fails.
//
// Why not one shared browser? Each test has its own setup script that
// navigates / mutates scene state via the probe. Sharing a browser
// across them would require refactoring all 20 tests — not worth it.
// Sharing a process pool instead gives 4-5x wall-clock speedup while
// keeping tests as standalone files.
//
// Usage:
//   node scripts/test-runner.js            # all test-*.js at repo root
//   node scripts/test-runner.js --workers=8
//   node scripts/test-runner.js --only=connector,snap
//   node scripts/test-runner.js --fast     # skip visual-only baseline
//                                          # tests (connector-visual)
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
const WORKERS = Number(
  (args.find((a) => a.startsWith("--workers=")) || "--workers=4").split("=")[1],
);
const ONLY = (args.find((a) => a.startsWith("--only=")) || "").split("=")[1] || "";
const FAST = args.includes("--fast");
const VERBOSE = args.includes("--verbose") || args.includes("-v");

// Post-phase-16 test suite — only files authored for the honest test
// protocol (each emits a final "PASS: N, FAIL: M" line). Legacy tests
// predating phase 16 use other output formats + different dev ports and
// are excluded so the runner doesn't flag stale noise as failures.
const SUITE = [
  "test-connector.js",
  "test-connector-real-drag.js",
  "test-connector-visual.js",
  "test-snap.js",
  "test-locked.js",
  "test-link.js",
  "test-laser.js",
  "test-measurements.js",
  "test-pdf.js",
  "test-text-consolidate.js",
  "test-png-metadata.js",
  "test-eraser.js",
  "test-flip.js",
  "test-shadow.js",
  "test-auto-advance.js",
  "test-embed.js",
  "test-frame.js",
  "test-lang-detect.js",
  "test-dark-mode.js",
  "test-smoke-buttons.js",
  "test-interactions.js",
];
const ALL_TESTS = SUITE.filter((f) =>
  fs.existsSync(path.join(ROOT, f)),
);

const TESTS = ALL_TESTS
  .filter((f) => !FAST || f !== "test-connector-visual.js")
  .filter((f) => !ONLY || ONLY.split(",").some((s) => f.includes(s)));

if (TESTS.length === 0) {
  console.log("no matching tests");
  process.exit(0);
}

console.log(
  `running ${TESTS.length} test file(s) with ${WORKERS} workers${FAST ? " (fast)" : ""}`,
);
const t0 = Date.now();

const runOne = (file) =>
  new Promise((resolve) => {
    const started = Date.now();
    const child = spawn("node", [path.join(ROOT, file)], {
      cwd: ROOT,
      env: { ...process.env },
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("close", (code) => {
      const passLine = (out.match(/^PASS:\s*(\d+),\s*FAIL:\s*(\d+)/m) || []);
      const pass = Number(passLine[1] || 0);
      const fail = Number(passLine[2] || 0);
      resolve({
        file,
        code: code ?? 1,
        pass,
        fail,
        ms: Date.now() - started,
        out,
        err,
      });
    });
  });

async function main() {
  const queue = [...TESTS];
  const results = [];
  const active = new Set();
  const runNext = async () => {
    const file = queue.shift();
    if (!file) return;
    const p = runOne(file).then((r) => {
      active.delete(p);
      results.push(r);
      // Stream completion as it happens so long suites don't look hung.
      const status =
        r.fail === 0 && r.code === 0
          ? `\x1b[32mOK\x1b[0m`
          : `\x1b[31mFAIL\x1b[0m`;
      const extra = r.fail > 0 ? ` (${r.fail} failing)` : "";
      process.stdout.write(
        `  ${status} ${r.file.padEnd(32)} ${r.pass}/${r.pass + r.fail} in ${r.ms}ms${extra}\n`,
      );
      if (VERBOSE || r.fail > 0 || r.code !== 0) {
        if (r.out.trim()) console.log(r.out.replace(/^/gm, "      "));
        if (r.err.trim())
          console.log(r.err.replace(/^/gm, "      "));
      }
      return runNext();
    });
    active.add(p);
    if (queue.length > 0 && active.size < WORKERS) return runNext();
  };
  // Kick off up to WORKERS workers.
  const starters = [];
  for (let i = 0; i < Math.min(WORKERS, TESTS.length); i++) starters.push(runNext());
  await Promise.all(starters);
  // Drain any still-active.
  while (active.size > 0) await Promise.race([...active]);

  const totalPass = results.reduce((s, r) => s + r.pass, 0);
  const totalFail = results.reduce((s, r) => s + r.fail, 0);
  const totalMs = Date.now() - t0;
  const failed = results.filter((r) => r.fail > 0 || r.code !== 0);
  console.log(
    `\n─────────────────────────────────────────────────────────`,
  );
  console.log(
    `${totalPass}/${totalPass + totalFail} assertions across ${results.length} files in ${totalMs}ms`,
  );
  if (failed.length > 0) {
    console.log(`\n${failed.length} failing file(s):`);
    for (const r of failed) {
      console.log(`  - ${r.file}: ${r.fail} failing, exit ${r.code}`);
    }
  }
  process.exit(totalFail > 0 || failed.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
