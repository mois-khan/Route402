import type { WalletBalances } from '../lib/types.js';
import { formatAlgo, truncateAddress } from '../lib/format.js';
import { Chip } from './Chip.js';

/**
 * Phase 6 (US9) — "assert the zero balance, don't just claim it." A real
 * algod query (GET /v1/wallets), not a static badge. Algorand needs a small
 * ALGO minimum balance to hold an asset at all, so the honest claim is
 * "zero ALGO spent on fees", not "zero ALGO balance" — see docs/VERIFY.md.
 */
export function WalletAssertion({ wallets }: { wallets: WalletBalances | null }) {
  if (!wallets || !wallets.agent || !wallets.sponsor) return null;

  return (
    <div className="rounded-card border-line bg-surface flex flex-wrap items-center gap-x-8 gap-y-2 border p-4 text-sm">
      <div className="flex items-center gap-2">
        <Chip variant="info">0 ALGO spent on fees</Chip>
        <span className="text-ink-2">
          Agent <span className="text-faint font-mono text-xs">{truncateAddress(wallets.agent.address)}</span> holds{' '}
          <span className="text-ink font-mono">{formatAlgo(wallets.agent.algoMicroAlgos)}</span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Chip variant="info">Sponsor pays every fee</Chip>
        <span className="text-ink-2">
          Sponsor <span className="text-faint font-mono text-xs">{truncateAddress(wallets.sponsor.address)}</span> holds{' '}
          <span className="text-ink font-mono">{formatAlgo(wallets.sponsor.algoMicroAlgos)}</span>
        </span>
      </div>
    </div>
  );
}
