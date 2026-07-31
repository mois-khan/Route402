import algosdk from 'algosdk';
import {
  toClientAvmSigner,
  toFacilitatorAvmSigner,
  ALGORAND_TESTNET_CAIP2,
  ALGORAND_MAINNET_CAIP2,
  USDC_TESTNET_ASA_ID,
  USDC_MAINNET_ASA_ID,
  type ClientAvmSigner,
  type FacilitatorAvmSigner,
} from '@x402/avm';
import type { Network as X402Network } from '@x402/core/types';
import { config } from '../config.js';

/**
 * Algorand-specific wiring for the payment layer. Derives the base64 secret
 * keys @x402/avm's signer helpers require from our .env mnemonics, and
 * exposes the network's CAIP-2 id, USDC ASA id and explorer link as the
 * package's own verified constants (docs/VERIFY.md) — never hand-typed.
 *
 * Building or signing a transaction never happens here. That's entirely
 * inside @x402/avm's ExactAvmScheme (client and facilitator sides) — this
 * module only wires the signers up.
 */

function mnemonicToBase64Sk(mnemonic: string): string {
  const { sk } = algosdk.mnemonicToSecretKey(mnemonic.trim());
  return Buffer.from(sk).toString('base64');
}

export function currentNetworkCaip2(): X402Network {
  return config.network === 'mainnet' ? ALGORAND_MAINNET_CAIP2 : ALGORAND_TESTNET_CAIP2;
}

export function currentUsdcAsaId(): string {
  return config.network === 'mainnet' ? USDC_MAINNET_ASA_ID : USDC_TESTNET_ASA_ID;
}

export function explorerUrl(txId: string): string {
  return config.explorerTxTemplate.replace('{network}', config.network).replace('{txId}', txId);
}

let agentSignerCache: ClientAvmSigner | null = null;
/** The agent's signer for its own leg of the atomic group. Fails loudly at first use if AGENT_MNEMONIC is unset — never at import time (config.ts's convention). */
export function agentSigner(): ClientAvmSigner {
  if (!config.agentMnemonic) throw new Error('AGENT_MNEMONIC is not set — see .env.example');
  if (!agentSignerCache) agentSignerCache = toClientAvmSigner(mnemonicToBase64Sk(config.agentMnemonic));
  return agentSignerCache;
}

let sponsorSignerCache: FacilitatorAvmSigner | null = null;
/** Route402's self-hosted facilitator signs and submits with this — the wallet that visibly pays every group's fee. */
export function sponsorFacilitatorSigner(): FacilitatorAvmSigner {
  if (!config.sponsorMnemonic) throw new Error('SPONSOR_MNEMONIC is not set — see .env.example');
  if (!sponsorSignerCache) {
    sponsorSignerCache = toFacilitatorAvmSigner(mnemonicToBase64Sk(config.sponsorMnemonic), {
      testnetUrl: config.algod.serverTestnet || undefined,
    });
  }
  return sponsorSignerCache;
}

let algodClientCache: algosdk.Algodv2 | null = null;
/** Shared algod client — Phase 6's composite payment builds its own transaction group directly (payment/composite.ts), unlike the single-payment path which lets @x402/avm's ExactAvmScheme do it. */
export function algodClient(): algosdk.Algodv2 {
  if (!config.algod.serverTestnet) throw new Error('ALGOD_SERVER_TESTNET is not set — see .env.example');
  if (!algodClientCache) algodClientCache = new algosdk.Algodv2(config.algod.token, config.algod.serverTestnet, '');
  return algodClientCache;
}

let agentAccountCache: algosdk.Account | null = null;
/** Raw account for the agent — needed to sign a hand-built group directly (Phase 6 composite), not just via @x402/avm's wrapped ClientAvmSigner. */
export function agentAccount(): algosdk.Account {
  if (!config.agentMnemonic) throw new Error('AGENT_MNEMONIC is not set — see .env.example');
  if (!agentAccountCache) agentAccountCache = algosdk.mnemonicToSecretKey(config.agentMnemonic.trim());
  return agentAccountCache;
}

let sponsorAccountCache: algosdk.Account | null = null;
/** Raw account for the sponsor — signs the fee-payer leg of a hand-built composite group directly. */
export function sponsorAccount(): algosdk.Account {
  if (!config.sponsorMnemonic) throw new Error('SPONSOR_MNEMONIC is not set — see .env.example');
  if (!sponsorAccountCache) sponsorAccountCache = algosdk.mnemonicToSecretKey(config.sponsorMnemonic.trim());
  return sponsorAccountCache;
}
