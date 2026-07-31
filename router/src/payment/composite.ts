import algosdk from 'algosdk';
import { algodClient, agentAccount, sponsorAccount, currentUsdcAsaId } from './algorand.js';

/**
 * Phase 6 (US8) — one atomic group spanning two different providers' payTo
 * addresses, built and submitted directly with algosdk. This deliberately
 * does not go through @x402/avm's ExactAvmScheme or the facilitator: that
 * SDK path is built around one resource server verifying one payment
 * (docs/VERIFY.md), and there is no supported way to make two different
 * providers' independent verify/settle calls land in the same on-chain
 * group. The router submits the whole group itself, once, and each
 * provider independently confirms its own leg against algod
 * (providers/src/compositeProof.ts) instead of running its own settlement.
 */

export interface CompositeLeg {
  payTo: string;
  amountMicroUSDC: number;
}

export interface CompositeSettlement {
  groupId: string;
  /** Same order as the input legs. */
  txIds: string[];
  finalityMs: number;
}

export async function settleCompositeGroup(legs: CompositeLeg[]): Promise<CompositeSettlement> {
  const client = algodClient();
  const agent = agentAccount();
  const sponsor = sponsorAccount();
  const asaId = Number(currentUsdcAsaId());

  const suggestedParams = await client.getTransactionParams().do();

  // Agent's legs carry no fee of their own — the sponsor's leg pools enough
  // to cover the whole group. This is the fee-abstraction mechanic made
  // concrete: the agent never spends ALGO on a transaction fee, here or anywhere.
  const legTxns = legs.map((leg) =>
    algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      sender: agent.addr,
      receiver: leg.payTo,
      amount: leg.amountMicroUSDC,
      assetIndex: asaId,
      suggestedParams: { ...suggestedParams, flatFee: true, fee: 0 },
    })
  );

  const minFee = Number(suggestedParams.minFee);
  const feePayerTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: sponsor.addr,
    receiver: sponsor.addr,
    amount: 0,
    suggestedParams: { ...suggestedParams, flatFee: true, fee: minFee * (legs.length + 1) },
  });

  const grouped = algosdk.assignGroupID([...legTxns, feePayerTxn]);
  const groupIdBytes = grouped[0].group;
  if (!groupIdBytes) throw new Error('assignGroupID did not set a group id');
  const groupId = algosdk.bytesToBase64(groupIdBytes);

  const signedLegs = legTxns.map((_, i) => algosdk.signTransaction(grouped[i], agent.sk));
  const signedFeePayer = algosdk.signTransaction(grouped[legs.length], sponsor.sk);

  const started = Date.now();
  await client.sendRawTransaction([...signedLegs.map((s) => s.blob), signedFeePayer.blob]).do();
  // Any one confirmed txid proves the whole group confirmed — Algorand groups are all-or-nothing, same round.
  await algosdk.waitForConfirmation(client, signedFeePayer.txID, 6);
  const finalityMs = Date.now() - started;

  return { groupId, txIds: signedLegs.map((s) => s.txID), finalityMs };
}
