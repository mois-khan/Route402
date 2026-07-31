import { useMemo } from 'react';
import { formatMicroUSDC } from '@route402/shared';
import { useStore } from '../lib/store.js';
import { narrate } from '../lib/narrate.js';
import { formatMs } from '../lib/format.js';
import { HeroStat } from '../components/HeroStat.js';
import { StatTile } from '../components/StatTile.js';
import { NarrationPanel } from '../components/NarrationPanel.js';
import { ProviderCard } from '../components/ProviderCard.js';
import { DecisionRow } from '../components/DecisionRow.js';
import { PaymentRow } from '../components/PaymentRow.js';
import { EmptyState } from '../components/EmptyState.js';
import { SimPanel } from '../components/SimPanel.js';
import { WalletAssertion } from '../components/WalletAssertion.js';
import type { SparklinePoint } from '../components/Sparkline.js';

/** DESIGN.md §8.1 — the projector page. Everything the demo needs, in scroll order. */
export function Overview() {
  const { providers, decisions, payments, calls, stats, wallets, latestDecisionId, sendChaos, sendLoad } = useStore();

  const latestDecision = decisions.find((d) => d.id === latestDecisionId) ?? decisions[0];
  const liveSteps = useMemo(() => (latestDecision ? narrate({ decision: latestDecision, payments }) : []), [latestDecision, payments]);

  const earnedByProvider = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of payments) {
      if (p.status !== 'settled') continue;
      map.set(p.providerId, (map.get(p.providerId) ?? 0) + p.amountMicroUSDC);
    }
    return map;
  }, [payments]);

  const sparklineByProvider = useMemo(() => {
    const map = new Map<string, SparklinePoint[]>();
    for (const provider of providers) {
      const providerCalls = calls
        .filter((c) => c.providerId === provider.id)
        .slice(0, 20)
        .reverse();
      map.set(
        provider.id,
        providerCalls.map((c) => ({ value: c.latencyMs ?? provider.latencyP50Ms, failed: c.failed }))
      );
    }
    return map;
  }, [calls, providers]);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <HeroStat savedMicroUSDC={stats?.savedMicroUSDC ?? 0} savedPercent={stats?.savedPercent ?? 0} />
        <StatTile label="Requests" value={stats?.totalRequests ?? '—'} sub={stats && stats.requestsRerouted > 0 ? `${stats.requestsRerouted} routed around a failure` : undefined} />
        <StatTile
          label="Spent"
          value={formatMicroUSDC(stats?.totalSpentMicroUSDC ?? 0)}
          sub={stats && stats.paymentsRefused > 0 ? `${stats.paymentsRefused} payments withheld` : undefined}
        />
        <StatTile label="Settles in" value={stats?.avgSettlementMs ? formatMs(stats.avgSettlementMs) : '—'} sub="average" />
      </div>

      <NarrationPanel key={latestDecision?.id ?? 'idle'} steps={liveSteps} live requestId={latestDecision?.requestId} />

      <WalletAssertion wallets={wallets} />

      <section>
        <h2 className="text-ink mb-3 text-lg font-semibold">Providers</h2>
        {providers.length === 0 ? (
          <EmptyState>No providers registered yet.</EmptyState>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {providers.map((p) => (
              <ProviderCard key={p.id} provider={p} earnedMicroUSDC={earnedByProvider.get(p.id) ?? 0} sparklinePoints={sparklineByProvider.get(p.id) ?? []} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-ink mb-3 text-lg font-semibold">Recent requests</h2>
        <div className="rounded-card border-line bg-surface border px-4">
          {decisions.length === 0 ? <EmptyState>No requests yet.</EmptyState> : decisions.slice(0, 10).map((d) => <DecisionRow key={d.id} decision={d} payments={payments} />)}
        </div>
      </section>

      <section>
        <h2 className="text-ink mb-3 text-lg font-semibold">Recent payments</h2>
        <div className="rounded-card border-line bg-surface border px-4">
          {payments.length === 0 ? (
            <EmptyState>No payments yet.</EmptyState>
          ) : (
            payments.slice(0, 8).map((p) => <PaymentRow key={p.id} payment={p} providerName={providers.find((prov) => prov.id === p.providerId)?.name ?? p.providerId} />)
          )}
        </div>
      </section>

      <SimPanel providers={providers} onChaos={sendChaos} onSendLoad={sendLoad} />
    </div>
  );
}
