import { useEffect, useState } from 'react';

/**
 * Phase 0 shell. Proves the toolchain works and the proxy to the router is
 * wired — nothing more. The real dashboard (PRD §12) is Phase 5; design is
 * deliberately deferred, so resist styling this.
 */

interface RouterHealth {
  status: string;
  network: string;
  ledger: Record<string, number>;
  chainConfigMissing: string[];
}

export function App() {
  const [health, setHealth] = useState<RouterHealth | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/health')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setHealth)
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <main className="min-h-screen bg-neutral-950 p-10 font-mono text-sm text-neutral-300">
      <h1 className="mb-1 text-lg font-semibold text-neutral-100">Route402</h1>
      <p className="mb-8 text-neutral-500">Phase 0 — scaffold. Dashboard is Phase 5.</p>

      <div className="max-w-xl rounded-lg border border-neutral-800 bg-neutral-900 p-5">
        <div className="mb-3 text-xs tracking-widest text-neutral-500 uppercase">Router</div>
        {error && <div className="text-red-400">unreachable — {error}</div>}
        {!error && !health && <div className="text-neutral-500">checking…</div>}
        {health && (
          <pre className="overflow-x-auto whitespace-pre-wrap text-neutral-300">
            {JSON.stringify(health, null, 2)}
          </pre>
        )}
      </div>
    </main>
  );
}
