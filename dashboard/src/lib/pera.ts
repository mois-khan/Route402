import algosdk from 'algosdk';
import { PeraWalletConnect } from '@perawallet/connect';

/**
 * Setup-only wiring for the Fund Wallets tool (docs/VERIFY.md's confirmed
 * environment block) — this is an operator utility for topping up the
 * agent/sponsor TestNet accounts before a demo, not part of the live
 * payment path. The router still settles every routed request itself via
 * its own AGENT_MNEMONIC/SPONSOR_MNEMONIC (router/src/payment/algorand.ts).
 */

export const TESTNET_ALGOD_URL = 'https://testnet-api.4160.nodely.dev';
export const USDC_TESTNET_ASA_ID = 10458941;
export const TESTNET_CHAIN_ID = 416002;

export function explorerTxUrl(txId: string): string {
  return `https://lora.algokit.io/testnet/transaction/${txId}`;
}

let algodClientCache: algosdk.Algodv2 | null = null;
export function algodClient(): algosdk.Algodv2 {
  if (!algodClientCache) algodClientCache = new algosdk.Algodv2('', TESTNET_ALGOD_URL, '');
  return algodClientCache;
}

let peraWalletCache: PeraWalletConnect | null = null;
/** One shared instance — Pera Connect tracks its own session/reconnect state internally. */
export function peraWallet(): PeraWalletConnect {
  if (!peraWalletCache) peraWalletCache = new PeraWalletConnect({ chainId: TESTNET_CHAIN_ID });
  return peraWalletCache;
}
