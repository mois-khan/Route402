import { useEffect, useState } from 'react';
import algosdk from 'algosdk';
import { useStore } from '../lib/store.js';
import { formatAlgo, truncateAddress } from '../lib/format.js';
import { algodClient, explorerTxUrl, peraWallet, USDC_TESTNET_ASA_ID } from '../lib/pera.js';

type Asset = 'ALGO' | 'USDC';
type LogEntry = { text: string; href?: string; ok: boolean };

/**
 * Operator-only setup tool: connect a personal Pera wallet (QR on desktop,
 * tap-to-approve on mobile) and send TestNet ALGO/USDC to the agent or
 * sponsor account so the demo has funds to route with. Not linked from Nav
 * and not part of the live routing demo — the router pays with its own
 * AGENT_MNEMONIC/SPONSOR_MNEMONIC, never a human's wallet (CLAUDE.md rule 8).
 */
export function FundWallets() {
  const { wallets } = useStore();
  const [address, setAddress] = useState<string | null>(null);
  const [connectedVia, setConnectedVia] = useState<'saved-session' | 'fresh-qr' | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [recipient, setRecipient] = useState<'agent' | 'sponsor' | 'custom'>('agent');
  const [customAddress, setCustomAddress] = useState('');
  const [asset, setAsset] = useState<Asset>('ALGO');
  const [amount, setAmount] = useState('1');
  const [usdcDecimals, setUsdcDecimals] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);

  useEffect(() => {
    // WalletConnect v1 persists sessions in localStorage — if a prior tab
    // already paired, this resolves instantly with the same address and
    // no QR, which is real (same wallet, already approved) but easy to
    // mistake for a fake connect. connectedVia makes the two paths visible.
    peraWallet()
      .reconnectSession()
      .then((accounts) => {
        if (accounts.length > 0) {
          setAddress(accounts[0]);
          setConnectedVia('saved-session');
        }
      })
      .catch(() => {});
    peraWallet().connector?.on('disconnect', () => {
      setAddress(null);
      setConnectedVia(null);
    });

    algodClient()
      .getAssetByID(USDC_TESTNET_ASA_ID)
      .do()
      .then((info) => setUsdcDecimals(Number(info.params?.decimals ?? 6)))
      .catch(() => {});
  }, []);

  const connect = async () => {
    setConnecting(true);
    try {
      const accounts = await peraWallet().connect();
      setAddress(accounts[0] ?? null);
      setConnectedVia('fresh-qr');
    } catch (err) {
      // User closed the QR modal — not an error worth logging.
      if (!(err instanceof Error && /closed/i.test(err.message))) {
        setLog((prev) => [{ text: `Connect failed: ${(err as Error).message}`, ok: false }, ...prev]);
      }
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = async () => {
    await peraWallet().disconnect();
    setAddress(null);
    setConnectedVia(null);
  };

  /** Ends any saved session first so the next Connect click is guaranteed to show a fresh QR. */
  const forgetAndReconnect = async () => {
    try {
      await peraWallet().disconnect();
    } catch {
      // No live session to close — fine, localStorage entry still gets cleared below.
    }
    setAddress(null);
    setConnectedVia(null);
    window.localStorage.removeItem('walletconnect');
    await connect();
  };

  const resolvedRecipient =
    recipient === 'agent' ? wallets?.agent?.address : recipient === 'sponsor' ? wallets?.sponsor?.address : customAddress.trim();

  const send = async () => {
    if (!address || !resolvedRecipient) return;
    setSending(true);
    try {
      const client = algodClient();
      const suggestedParams = await client.getTransactionParams().do();
      const amountUnits = Math.round(Number(amount) * 1_000_000);
      if (!Number.isFinite(amountUnits) || amountUnits <= 0) throw new Error('Enter a positive amount');

      const txn =
        asset === 'ALGO'
          ? algosdk.makePaymentTxnWithSuggestedParamsFromObject({
              sender: address,
              receiver: resolvedRecipient,
              amount: amountUnits,
              suggestedParams,
            })
          : algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
              sender: address,
              receiver: resolvedRecipient,
              amount: amountUnits,
              assetIndex: USDC_TESTNET_ASA_ID,
              suggestedParams,
            });

      const [signed] = await peraWallet().signTransaction([[{ txn }]]);
      const { txid } = await client.sendRawTransaction(signed).do();
      await algosdk.waitForConfirmation(client, txid, 4);
      setLog((prev) => [{ text: `Sent ${amount} ${asset} to ${truncateAddress(resolvedRecipient)}`, href: explorerTxUrl(txid), ok: true }, ...prev]);
    } catch (err) {
      setLog((prev) => [{ text: (err as Error).message, ok: false }, ...prev]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-[720px] px-8 py-10">
      <div className="border-warn/30 bg-warn/10 text-warn rounded-card mb-6 border p-3 text-sm">
        Setup utility, not part of the live demo. The router always pays with its own agent/sponsor keys — this page only tops up
        their TestNet balances from your personal wallet.
      </div>

      <h1 className="text-ink mb-1 text-xl font-semibold">Fund wallets</h1>
      <p className="text-ink-2 mb-6 text-sm">Connect a Pera wallet on TestNet and send ALGO or USDC to the agent or sponsor account.</p>

      <div className="rounded-card border-line bg-surface mb-6 border p-4">
        {address ? (
          <div>
            <div className="flex items-center justify-between">
              <span className="text-ink-2 text-sm">
                Connected <span className="text-ink font-mono">{truncateAddress(address)}</span>
              </span>
              <button onClick={disconnect} className="text-ink-2 hover:text-ink text-sm underline">
                Disconnect
              </button>
            </div>
            <p className="text-faint mt-1 text-xs">
              {connectedVia === 'saved-session'
                ? "Restored from a saved WalletConnect session — this page reconnected automatically without a new QR because you (or someone on this browser) approved it before."
                : 'Approved just now via the QR/Pera app.'}{' '}
              {connectedVia === 'saved-session' && (
                <button onClick={forgetAndReconnect} className="text-accent underline">
                  Forget it and show a fresh QR
                </button>
              )}
            </p>
          </div>
        ) : (
          <button
            onClick={connect}
            disabled={connecting}
            className="rounded-control bg-accent text-accent-ink px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {connecting ? 'Waiting for approval in Pera…' : 'Connect Pera Wallet'}
          </button>
        )}
      </div>

      <div className="rounded-card border-line bg-surface space-y-4 border p-4">
        <div>
          <label className="text-ink-2 mb-1 block text-xs">Recipient</label>
          <select
            value={recipient}
            onChange={(e) => setRecipient(e.target.value as typeof recipient)}
            className="border-line bg-surface-2 text-ink rounded-control w-full border px-3 py-2 text-sm"
          >
            <option value="agent" disabled={!wallets?.agent}>
              Agent {wallets?.agent ? `— ${truncateAddress(wallets.agent.address)} (${formatAlgo(wallets.agent.algoMicroAlgos)})` : '(unavailable)'}
            </option>
            <option value="sponsor" disabled={!wallets?.sponsor}>
              Sponsor {wallets?.sponsor ? `— ${truncateAddress(wallets.sponsor.address)} (${formatAlgo(wallets.sponsor.algoMicroAlgos)})` : '(unavailable)'}
            </option>
            <option value="custom">Custom address</option>
          </select>
          {recipient === 'custom' && (
            <input
              value={customAddress}
              onChange={(e) => setCustomAddress(e.target.value)}
              placeholder="Algorand address"
              className="border-line bg-surface-2 text-ink rounded-control mt-2 w-full border px-3 py-2 font-mono text-sm"
            />
          )}
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label className="text-ink-2 mb-1 block text-xs">Asset</label>
            <select
              value={asset}
              onChange={(e) => setAsset(e.target.value as Asset)}
              className="border-line bg-surface-2 text-ink rounded-control w-full border px-3 py-2 text-sm"
            >
              <option value="ALGO">ALGO</option>
              <option value="USDC">USDC (ASA {USDC_TESTNET_ASA_ID}{usdcDecimals !== null ? `, ${usdcDecimals} decimals` : ''})</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="text-ink-2 mb-1 block text-xs">Amount</label>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              className="border-line bg-surface-2 text-ink rounded-control w-full border px-3 py-2 text-sm"
            />
          </div>
        </div>

        {asset === 'USDC' && (
          <p className="text-faint text-xs">
            Both your wallet and the recipient must already be opted in to ASA {USDC_TESTNET_ASA_ID} — this tool only sends, it
            doesn't opt in on the recipient's behalf.
          </p>
        )}

        <button
          onClick={send}
          disabled={!address || !resolvedRecipient || sending}
          className="rounded-control bg-accent text-accent-ink w-full px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {sending ? 'Sending…' : `Send ${asset}`}
        </button>
      </div>

      {log.length > 0 && (
        <div className="mt-6 space-y-2">
          {log.map((entry, i) => (
            <div key={i} className={`rounded-card border p-3 text-sm ${entry.ok ? 'border-accent-line text-accent' : 'border-bad/30 text-bad'}`}>
              {entry.text}
              {entry.href && (
                <a href={entry.href} target="_blank" rel="noreferrer" className="ml-2 underline">
                  View on Lora
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
