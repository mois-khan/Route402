import 'dotenv/config';
import algosdk from 'algosdk';
import { config } from './config.js';
import { currentUsdcAsaId } from './payment/algorand.js';

/**
 * Phase 3 pre-flight (PRD §15 risk mitigation, brought forward from Phase 8
 * because Phase 3's exit criterion needs it now): reports every wallet's
 * ALGO balance and USDC opt-in status, and opts in any wallet that's funded
 * with ALGO but hasn't opted into the USDC asset yet.
 *
 * The opt-in transaction itself needs no browser — it's an ordinary signed
 * transaction, and this script holds every wallet's mnemonic already (all
 * TestNet, all in .env, never committed). Only getting real ALGO/USDC into
 * these addresses in the first place needs a human at the dispenser.
 *
 *   npm run preflight --workspace router
 */

interface WalletCheck {
  label: string;
  address: string;
  /** Present only for wallets this script can sign an opt-in for itself. */
  mnemonic?: string;
  /**
   * Only the agent (sender) and the three providers (recipients) ever touch
   * the USDC asset — the sponsor's leg of the group is a plain ALGO fee
   * payment, so it never needs to opt in and this script shouldn't burn a
   * transaction (and lock 0.1 ALGO of min-balance) making it.
   */
  needsUsdcOptIn: boolean;
}

const WALLETS: WalletCheck[] = [
  { label: 'agent', address: process.env.AGENT_ADDRESS || '', mnemonic: process.env.AGENT_MNEMONIC, needsUsdcOptIn: true },
  { label: 'sponsor', address: process.env.SPONSOR_ADDRESS || '', mnemonic: process.env.SPONSOR_MNEMONIC, needsUsdcOptIn: false },
  {
    label: 'prov_alpha',
    address: process.env.PROVIDER_ALPHA_ADDRESS || '',
    mnemonic: process.env.PROVIDER_ALPHA_MNEMONIC,
    needsUsdcOptIn: true,
  },
  {
    label: 'prov_beta',
    address: process.env.PROVIDER_BETA_ADDRESS || '',
    mnemonic: process.env.PROVIDER_BETA_MNEMONIC,
    needsUsdcOptIn: true,
  },
  {
    label: 'prov_gamma',
    address: process.env.PROVIDER_GAMMA_ADDRESS || '',
    mnemonic: process.env.PROVIDER_GAMMA_MNEMONIC,
    needsUsdcOptIn: true,
  },
];

/** 0.2 ALGO — Algorand's ~0.1 base minimum balance plus ~0.1 per opted-in asset, with headroom for the opt-in fee. */
const MIN_ALGO_FOR_OPTIN = 200_000;

function algod(): algosdk.Algodv2 {
  return new algosdk.Algodv2(config.algod.token, config.algod.serverTestnet, '');
}

async function optIn(client: algosdk.Algodv2, address: string, mnemonic: string, asaId: number): Promise<string> {
  const { sk } = algosdk.mnemonicToSecretKey(mnemonic.trim());
  const suggestedParams = await client.getTransactionParams().do();
  // An opt-in is an ordinary 0-amount asset transfer from an account to itself.
  const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: address,
    receiver: address,
    amount: 0,
    assetIndex: asaId,
    suggestedParams,
  });
  const { txID, blob } = algosdk.signTransaction(txn, sk);
  await client.sendRawTransaction(blob).do();
  await algosdk.waitForConfirmation(client, txID, 4);
  return txID;
}

const algoStr = (microAlgos: number) => (microAlgos / 1e6).toFixed(3);
const usdcStr = (microUsdc: number) => (microUsdc / 1e6).toFixed(3);

async function main() {
  const client = algod();
  const asaId = Number(currentUsdcAsaId());
  console.log(`\nRoute402 preflight — network=${config.network}, USDC ASA=${asaId}\n`);

  for (const w of WALLETS) {
    if (!w.address) {
      console.log(`  ${w.label.padEnd(12)} — no address configured`);
      continue;
    }

    const info = await client.accountInformation(w.address).do();
    const algoBalance = Number(info.amount);
    const usdcHolding = info.assets?.find((a) => Number(a.assetId) === asaId);
    const optedIn = usdcHolding !== undefined;

    let note: string;
    if (!w.needsUsdcOptIn) {
      note = 'fee-only wallet — no USDC opt-in needed';
    } else if (optedIn) {
      note = 'opted in';
    } else if (w.mnemonic && algoBalance >= MIN_ALGO_FOR_OPTIN) {
      try {
        const txId = await optIn(client, w.address, w.mnemonic, asaId);
        note = `opted in just now (${txId})`;
      } catch (err) {
        note = `opt-in FAILED: ${err instanceof Error ? err.message : String(err)}`;
      }
    } else {
      note = `NOT opted in — needs ≥${algoStr(MIN_ALGO_FOR_OPTIN)} ALGO first`;
    }

    console.log(
      `  ${w.label.padEnd(12)} ${w.address}  algo=${algoStr(algoBalance).padStart(9)}  usdc=${
        usdcHolding ? usdcStr(Number(usdcHolding.amount)).padStart(9) : '—'.padStart(9)
      }  ${note}`
    );
  }
  console.log('');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
