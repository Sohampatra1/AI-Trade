import bs58 from "bs58";
import { Connection, Keypair, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js'
import { NATIVE_MINT, getAssociatedTokenAddress, getAccount } from '@solana/spl-token'
import axios from 'axios'
import { API_URLS } from '@raydium-io/raydium-sdk-v2'
import { TokenPosition } from './types';

const connection = new Connection(process.env.RPC_URL!);
const owner = Keypair.fromSecretKey(bs58.decode(process.env.PRIVATE_KEY!));
const slippage = 5;

// Track open positions
export const openPositions: TokenPosition[] = [];

export async function createSellTransaction(tokenPosition: TokenPosition) {
  const { data: feeData } = await axios.get<{
    data: { default: { h: number } }
  }>(`${API_URLS.BASE_HOST}${API_URLS.PRIORITY_FEE}`);

  const { data: swapResponse } = await axios.get(
    `${API_URLS.SWAP_HOST}/compute/swap-base-in?` +
    `inputMint=${tokenPosition.mint}&outputMint=${NATIVE_MINT}&` +
    `amount=${tokenPosition.amount}&slippageBps=${slippage * 100}&txVersion=V0`
  );

  const { data: swapTransactions } = await axios.post<{
    data: { transaction: string }[]
  }>(`${API_URLS.SWAP_HOST}/transaction/swap-base-in`, {
    computeUnitPriceMicroLamports: String(feeData.data.default.h),
    swapResponse,
    txVersion: 'V0',
    wallet: owner.publicKey.toBase58(),
    wrapSol: false,
    unwrapSol: true,
  });

  return swapTransactions.data.map(tx => 
    VersionedTransaction.deserialize(Buffer.from(tx.transaction, 'base64'))
  );
}

export async function swap(tokenAddress: string, amount: number) {
  try {
    const { data: feeData } = await axios.get<{
      data: { default: { h: number } }
    }>(`${API_URLS.BASE_HOST}${API_URLS.PRIORITY_FEE}`);

    const { data: swapResponse } = await axios.get(
      `${API_URLS.SWAP_HOST}/compute/swap-base-in?` +
      `inputMint=${NATIVE_MINT}&outputMint=${tokenAddress}&` +
      `amount=${amount}&slippageBps=${slippage * 100}&txVersion=V0`
    );

    const { data: swapTransactions } = await axios.post<{
      data: { transaction: string }[]
    }>(`${API_URLS.SWAP_HOST}/transaction/swap-base-in`, {
      computeUnitPriceMicroLamports: String(feeData.data.default.h),
      swapResponse,
      txVersion: 'V0',
      wallet: owner.publicKey.toBase58(),
      wrapSol: true,
      unwrapSol: false,
    });

    const transactions = swapTransactions.data.map(tx => 
      VersionedTransaction.deserialize(Buffer.from(tx.transaction, 'base64'))
    );

    for (const tx of transactions) {
      tx.sign([owner]);
      const txId = await connection.sendTransaction(tx, { skipPreflight: true });
      await confirmTransaction(txId);
    }

    // Record position after successful swap
    const ata = await getAssociatedTokenAddress(new PublicKey(tokenAddress), owner.publicKey);
    const accountInfo = await getAccount(connection, ata);
    
    openPositions.push({
      mint: tokenAddress,
      amount: Number(accountInfo.amount),
      entryPrice: amount / Number(accountInfo.amount),
      ata: ata.toString(),
      lastPrice: 0
    });

  } catch (error) {
    console.error('Swap error:', error);
  }
}

async function confirmTransaction(txId: string) {
  const { lastValidBlockHeight, blockhash } = await connection.getLatestBlockhash('finalized');
  return connection.confirmTransaction({
    blockhash,
    lastValidBlockHeight,
    signature: txId,
  }, 'confirmed');
}

/// sohAM
