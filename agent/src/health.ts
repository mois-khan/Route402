import 'dotenv/config';

/**
 * Preflight. Pings every service and reports what is up.
 *
 * This is the Phase 0 exit check, and it stays useful for the rest of the
 * build — "is anything actually running?" is the first question every time
 * something breaks, including on demo day.
 *
 *   npm run health
 */

interface Target {
  label: string;
  url: string;
}

const port = (key: string, fallback: number): number => Number(process.env[key]) || fallback;

const TARGETS: Target[] = [
  { label: 'router', url: `http://localhost:${port('ROUTER_PORT', 4000)}/health` },
  { label: 'alpha', url: `http://localhost:${port('PROVIDER_ALPHA_PORT', 4001)}/health` },
  { label: 'beta', url: `http://localhost:${port('PROVIDER_BETA_PORT', 4002)}/health` },
  { label: 'gamma', url: `http://localhost:${port('PROVIDER_GAMMA_PORT', 4003)}/health` },
  { label: 'dashboard', url: `http://localhost:${port('DASHBOARD_PORT', 5173)}/` },
];

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

async function check(t: Target): Promise<boolean> {
  const started = Date.now();
  // A manual controller + clearTimeout, rather than AbortSignal.timeout, so no
  // internal timer handle is left dangling at process.exit() — on Windows that
  // trips a libuv assertion on the way out even though the check itself passed.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(t.url, { signal: controller.signal });
    clearTimeout(timer);
    await res.arrayBuffer(); // drain the body so undici releases the socket cleanly
    const ms = Date.now() - started;
    if (!res.ok) {
      console.log(`${RED}  down${RESET}  ${t.label.padEnd(10)} HTTP ${res.status}  ${DIM}${t.url}${RESET}`);
      return false;
    }
    console.log(`${GREEN}  up  ${RESET}  ${t.label.padEnd(10)} ${String(ms).padStart(4)}ms  ${DIM}${t.url}${RESET}`);
    return true;
  } catch (err) {
    clearTimeout(timer);
    const detail = err instanceof Error ? err.message : String(err);
    console.log(`${RED}  down${RESET}  ${t.label.padEnd(10)} ${detail}  ${DIM}${t.url}${RESET}`);
    return false;
  }
}

console.log('\nRoute402 preflight\n');
const results = await Promise.all(TARGETS.map(check));
const up = results.filter(Boolean).length;
console.log(`\n${up}/${TARGETS.length} services up\n`);
// process.exitCode + natural return, not process.exit() — a forced exit can
// race in-flight socket teardown and trip a libuv assertion on Windows.
process.exitCode = up === TARGETS.length ? 0 : 1;
