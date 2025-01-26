require("dotenv").config();
import { getTokenFromLLM } from "./get-token-from-llm";
import { getTweets } from "./get-tweets";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { swap } from "./swap";
import { startMonitoring } from "./monitor";

const SOL_AMOUNT = 0.001 * LAMPORTS_PER_SOL;

// Start monitoring when application starts
startMonitoring();

async function main(userName: string) {
  try {
    const newTweets = await getTweets(userName);
    console.log('New tweets:', newTweets.length);

    for (const tweet of newTweets) {
      try {
        const tokenAddress = await getTokenFromLLM(tweet.contents);
        if (tokenAddress !== "null") {
          console.log(`Executing trade for token: ${tokenAddress}`);
          await swap(tokenAddress, SOL_AMOUNT);
        }
      } catch (error) {
        console.error('Tweet processing error:', error);
      }
    }
  } catch (error) {
    console.error('Main execution error:', error);
  }
}

// Run main every minute
setInterval(() => main("BotChrome114342"), 60000);
main("BotChrome114342"); // Initial run