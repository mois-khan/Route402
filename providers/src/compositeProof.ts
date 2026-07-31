import algosdk from 'algosdk';

/**
 * Phase 6 (US8) composite path. A composite request is paid as one
 * router-built atomic group (router/src/payment/composite.ts) rather than
 * through each provider's own x402 facilitator handshake — there's no
 * per-provider verify/settle call to make. Instead the router hands this
 * provider a specific confirmed txId and this file checks it directly
 * against algod: real receiver, real asset, real amount, really confirmed,
 * really grouped. Not a trust of the router's word — an independent check,
 * same spirit as the guard on the router side.
 */

let client: algosdk.Algodv2 | null = null;

function algodClient(): algosdk.Algodv2 | null {
  const server = process.env.ALGOD_SERVER_TESTNET;
  if (!server) return null;
  if (!client) client = new algosdk.Algodv2(process.env.ALGOD_TOKEN || '', server, '');
  return client;
}

export interface ProofCheck {
  ok: boolean;
  reason?: string;
}

export async function verifyCompositeProof(
  txId: string,
  expectedPayTo: string,
  expectedAmountMicroUSDC: number,
  expectedAsaId: number
): Promise<ProofCheck> {
  const algod = algodClient();
  if (!algod) return { ok: false, reason: 'provider has no algod access configured' };

  let info;
  try {
    info = await algod.pendingTransactionInformation(txId).do();
  } catch (err) {
    return { ok: false, reason: `could not look up transaction: ${err instanceof Error ? err.message : String(err)}` };
  }

  if (!info.confirmedRound || info.confirmedRound === 0n) {
    return { ok: false, reason: 'transaction is not yet confirmed' };
  }

  const txn = info.txn.txn;
  if (txn.type !== 'axfer' || !txn.assetTransfer) {
    return { ok: false, reason: 'transaction is not an asset transfer' };
  }
  if (Number(txn.assetTransfer.assetIndex) !== expectedAsaId) {
    return { ok: false, reason: `wrong asset (expected ${expectedAsaId})` };
  }
  if (txn.assetTransfer.receiver.toString() !== expectedPayTo) {
    return { ok: false, reason: 'wrong receiver' };
  }
  if (Number(txn.assetTransfer.amount) < expectedAmountMicroUSDC) {
    return { ok: false, reason: `amount too low (expected >= ${expectedAmountMicroUSDC})` };
  }
  if (!txn.group) {
    return { ok: false, reason: 'not part of an atomic group' };
  }

  return { ok: true };
}
