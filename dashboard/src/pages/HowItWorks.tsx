const STEPS = [
  { name: 'Ask', text: 'An agent sends one request — a job, and a budget it will not exceed. It never names a provider.' },
  { name: 'Compare', text: 'Every registered provider that can do the job is checked — price, typical speed, and how often it actually delivers.' },
  { name: 'Pick', text: 'The cheapest, fastest, or best-balanced option wins, depending on what the agent asked for. The reason is always in plain words.' },
  { name: 'Pay', text: 'Route402 pays the winner on Algorand — a real transaction, settled in a few seconds, fees covered so the agent never needs its own ALGO.' },
  { name: 'Deliver', text: 'The result is checked before the payment counts. An empty or broken result is never paid for — the request tries the next option instead.' },
];

const GLOSSARY: [string, string][] = [
  ['Paused', 'circuit breaker'],
  ['Score', 'composite score'],
  ['Receipt', 'Algorand transaction'],
  ['Paid together', 'atomic transaction group'],
  ['Fee covered', 'fee abstraction'],
  ['pay-per-request', 'x402'],
];

/** DESIGN.md §8.4 — one screen, no scrolling past two viewport heights. Cut first if time is short. */
export function HowItWorks() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-ink mb-4 text-2xl font-semibold">How it works</h1>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
          {STEPS.map((s) => (
            <div key={s.name} className="rounded-card border-line bg-surface border p-4">
              <h2 className="text-accent mb-1 text-sm font-semibold">{s.name}</h2>
              <p className="text-ink-2 text-sm">{s.text}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-ink mb-3 text-lg font-semibold">What we call it / what it actually is</h2>
        <div className="rounded-card border-line bg-surface overflow-hidden border">
          <table className="w-full text-sm">
            <tbody>
              {GLOSSARY.map(([plain, real], i) => (
                <tr key={plain} className={i > 0 ? 'border-line border-t' : ''}>
                  <td className="text-ink px-4 py-2 font-medium">{plain}</td>
                  <td className="text-muted px-4 py-2">{real}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-card border-accent-line bg-accent-soft border p-5">
        <p className="text-ink text-base leading-relaxed">
          This is not Algorand because we had to pick a chain. It is Algorand because a two-provider request is one atomic transaction
          group, and finality lands inside the HTTP request.
        </p>
      </div>
    </div>
  );
}
