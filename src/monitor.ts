import { connection } from './swap';
import { openPositions, createSellTransaction } from './swap';
import { getAccount } from '@solana/spl-token';
import { PublicKey } from '@solana/web3.js';
import axios from 'axios';
import { API_URLS } from '@raydium-io/raydium-sdk-v2';

const STOP_LOSS = parseFloat(process.env.STOP_LOSS_PERCENT!) / 100;
const TAKE_PROFIT = parseFloat(process.env.TAKE_PROFIT_PERCENT!) / 100;
const CHECK_INTERVAL = parseInt(process.env.CHECK_INTERVAL!);

export async function startMonitoring() {
  setInterval(async () => {
    for (const position of openPositions) {
      try {
        const currentPrice = await getTokenPrice(position.mint);
        const priceChange = (currentPrice - position.entryPrice) / position.entryPrice;
        
        position.lastPrice = currentPrice;

        if (priceChange <= -STOP_LOSS || priceChange >= TAKE_PROFIT) {
          await executeSell(position);
        }
      } catch (error) {
        console.error(`Monitoring error for ${position.mint}:`, error);
      }
    }
  }, CHECK_INTERVAL);
}

async function getTokenPrice(mintAddress: string): Promise<number> {
  const { data } = await axios.get(
    `${API_URLS.PRICE_HOST}/coin/price?coin=${mintAddress}`
  );
  return data.data.price;
}

async function executeSell(position: TokenPosition) {
  try {
    const transactions = await createSellTransaction(position);
    
    for (const tx of transactions) {
      tx.sign([Keypair.fromSecretKey(Buffer.from(process.env.PRIVATE_KEY!, 'base64'))]);
      const txId = await connection.sendTransaction(tx, { skipPreflight: true });
      await connection.confirmTransaction(txId, 'confirmed');
    }

    // Remove position after successful sell
    openPositions.splice(openPositions.indexOf(position), 1);
  } catch (error) {
    console.error(`Sell execution error for ${position.mint}:`, error);
  }
}