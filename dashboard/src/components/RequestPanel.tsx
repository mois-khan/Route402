import { useMemo, useState } from 'react';
import type { Priority, Provider } from '@route402/shared';
import { formatMicroUSDC } from '@route402/shared';
import type { WalletBalances } from '../lib/types.js';
import { capabilityLabel, priorityLabel } from '../lib/labels.js';
import { Chip } from './Chip.js';

const PRIORITIES: Priority[] = ['cost', 'speed', 'balanced'];

/** Known order; anything registered later falls back to alphabetical. */
const CAPABILITY_ORDER = ['text.summarize', 'text.translate', 'db.provision', 'cloud.provision', 'email.provision'];

const SAMPLE_TEXTS = [
  'The quarterly report needs a shorter version for the board.',
  'This customer email thread is too long to read before the call.',
  'The onboarding doc needs a plain-language version for new hires.',
];

/** Builds the request body an agent asking for this job would send — never shown to the viewer (DESIGN.md §4.2 bans "payload"). */
function buildPayload(capability: string): Record<string, unknown> {
  const text = SAMPLE_TEXTS[Math.floor(Math.random() * SAMPLE_TEXTS.length)];
  switch (capability) {
    case 'text.summarize':
      return { text, maxWords: 40 };
    case 'text.translate':
      return { text };
    case 'db.provision':
      return { engine: 'postgres' };
    case 'cloud.provision':
      return { region: 'us-east-1' };
    default:
      return {};
  }
}

/**
 * DESIGN.md §7/§8.1 — the entry point for the demo: connect the agent's
 * wallet, then send one real agent request and watch it live in "Right now"
 * below. Replaces the standalone wallet strip as the primary CTA; "Send 20
 * requests" stays inside the dashed Simulation panel for background traffic.
 *
 * The form is always visible — only its controls are disabled before
 * connecting — so there is never a moment where "New agent request" isn't
 * on screen. "Connect wallet" doesn't negotiate a session — Route402 has no
 * accounts (CLAUDE.md rule 2). It reveals the agent wallet GET /v1/wallets
 * already loaded. A human fills in exactly what a real agent would supply —
 * job, budget, priority — and never picks the provider (CLAUDE.md rule 8).
 */
export function RequestPanel({
  providers,
  wallets,
  onSend,
}: {
  providers: Provider[];
  wallets: WalletBalances | null;
  onSend: (capability: string, constraints: { maxPriceMicroUSDC: number; priority: Priority }, payload: Record<string, unknown>) => Promise<void>;
}) {
  const [connected, setConnected] = useState(false);
  const [priority, setPriority] = useState<Priority>('balanced');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const capabilities = useMemo(() => {
    const known = new Set(providers.flatMap((p) => p.capabilities));
    const ordered = CAPABILITY_ORDER.filter((c) => known.has(c));
    const rest = [...known].filter((c) => !ordered.includes(c)).sort();
    return [...ordered, ...rest];
  }, [providers]);

  const [capability, setCapability] = useState('');
  const activeCapability = capability && capabilities.includes(capability) ? capability : (capabilities[0] ?? '');

  const maxAdvertised = useMemo(() => {
    const prices = providers.filter((p) => p.capabilities.includes(activeCapability)).map((p) => p.advertisedPriceMicroUSDC);
    return prices.length > 0 ? Math.max(...prices) : 0;
  }, [providers, activeCapability]);

  const [budgetOverride, setBudgetOverride] = useState<number | null>(null);
  const budgetMicroUSDC = budgetOverride ?? maxAdvertised;
  const locked = !connected;

  const handleSend = async () => {
    if (!activeCapability || sending || locked) return;
    setSending(true);
    setError(null);
    try {
      await onSend(activeCapability, { maxPriceMicroUSDC: budgetMicroUSDC, priority }, buildPayload(activeCapability));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reach the router.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-card border-line bg-surface flex flex-col gap-4 border p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-ink text-lg font-semibold">New agent request</h2>
        {connected ? (
          <Chip variant="info">Wallet connected</Chip>
        ) : (
          <button
            onClick={() => setConnected(true)}
            disabled={!wallets?.agent}
            className="border-accent-line bg-accent-soft text-accent rounded-control border px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            Connect wallet
          </button>
        )}
      </div>

      {locked && <p className="text-muted -mt-2 text-sm">Connect the agent&apos;s wallet to send a request.</p>}

      <fieldset disabled={locked} className={`flex flex-wrap items-end gap-4 ${locked ? 'opacity-40' : ''}`}>
        <label className="flex flex-col gap-1.5">
          <span className="text-muted text-xs tracking-wide uppercase">Service</span>
          <select
            value={activeCapability}
            onChange={(e) => {
              setCapability(e.target.value);
              setBudgetOverride(null);
            }}
            className="border-line-2 bg-surface-2 text-ink rounded-control border px-3 py-2 text-sm"
          >
            {capabilities.map((c) => (
              <option key={c} value={c}>
                {capabilityLabel(c)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-muted text-xs tracking-wide uppercase">Budget</span>
          <div className="border-line-2 bg-surface-2 flex items-center gap-1.5 rounded-control border px-3 py-2">
            <input
              type="number"
              min={0}
              step={0.001}
              value={(budgetMicroUSDC / 1_000_000).toFixed(3)}
              onChange={(e) => setBudgetOverride(Math.max(0, Math.round(Number(e.target.value) * 1_000_000)))}
              className="text-ink w-20 bg-transparent text-sm outline-none"
            />
            <span className="text-muted text-xs">USDC</span>
          </div>
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="text-muted text-xs tracking-wide uppercase">Priority</span>
          <div className="flex gap-1.5">
            {PRIORITIES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={`rounded-control border px-3 py-2 text-sm transition-colors ${
                  priority === p ? 'border-accent-line bg-accent-soft text-accent' : 'border-line-2 text-ink-2 hover:text-ink'
                }`}
              >
                {priorityLabel(p)}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={handleSend}
          disabled={sending || !activeCapability}
          className="border-accent-line bg-accent-soft text-accent ml-auto rounded-control border px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? 'Sending…' : 'Send request'}
        </button>
      </fieldset>

      <p className="text-faint text-xs">Budget {formatMicroUSDC(budgetMicroUSDC)} · providers over budget won&apos;t be considered.</p>
      {error && <p className="text-bad text-xs">{error}</p>}
    </div>
  );
}
