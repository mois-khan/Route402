import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { StoreProvider, useStore } from './lib/store.js';
import { ConnectionPill } from './components/ConnectionPill.js';
import { Overview } from './pages/Overview.js';
import { Providers } from './pages/Providers.js';
import { Payments } from './pages/Payments.js';
import { HowItWorks } from './pages/HowItWorks.js';
import { FundWallets } from './pages/FundWallets.js';

/** DESIGN.md §5 — top bar, 56px, sticky, hairline bottom border. Text links only. */
function Nav() {
  const { connectionState } = useStore();
  const linkClass = ({ isActive }: { isActive: boolean }) => `text-sm transition-colors ${isActive ? 'text-ink font-medium' : 'text-ink-2 hover:text-ink'}`;

  return (
    <nav className="border-line bg-bg/90 sticky top-0 z-10 border-b backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-8 px-8">
        <span className="text-ink text-base font-semibold tracking-tight">Route402</span>
        <div className="flex items-center gap-6">
          <NavLink to="/" end className={linkClass}>
            Overview
          </NavLink>
          <NavLink to="/providers" className={linkClass}>
            Providers
          </NavLink>
          <NavLink to="/payments" className={linkClass}>
            Payments
          </NavLink>
          <NavLink to="/how" className={linkClass}>
            How it works
          </NavLink>
        </div>
        <div className="ml-auto">
          <ConnectionPill state={connectionState} />
        </div>
      </div>
    </nav>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <StoreProvider>
        <div className="min-h-screen">
          <Nav />
          <main className="mx-auto max-w-[1400px] px-8 py-6">
            <Routes>
              <Route path="/" element={<Overview />} />
              <Route path="/providers" element={<Providers />} />
              <Route path="/payments" element={<Payments />} />
              <Route path="/how" element={<HowItWorks />} />
              {/* Operator setup tool, not in Nav — see FundWallets.tsx. */}
              <Route path="/fund" element={<FundWallets />} />
            </Routes>
          </main>
        </div>
      </StoreProvider>
    </BrowserRouter>
  );
}
