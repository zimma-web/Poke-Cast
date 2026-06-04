import { createWalletClient, http, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

const privateKey = process.env.TREASURY_PRIVATE_KEY;

// Create account only if private key exists (to prevent build errors)
const account = privateKey ? privateKeyToAccount(privateKey.startsWith('0x') ? privateKey as `0x${string}` : `0x${privateKey}` as `0x${string}`) : null;

export const treasuryClient = account ? createWalletClient({
  account,
  chain: base,
  transport: http('https://mainnet.base.org')
}) : null;

// Base USDC Contract
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

const usdcAbi = [{ 
  type: 'function', 
  name: 'transfer', 
  inputs: [
    { name: 'recipient', type: 'address' }, 
    { name: 'amount', type: 'uint256' }
  ], 
  outputs: [{ type: 'bool' }] 
}] as const;

/**
 * Sends USDC from the Treasury wallet to any address.
 * Uses the TREASURY_PRIVATE_KEY stored in .env.local.
 * 
 * @param to recipient address
 * @param amount amount of USDC (e.g., 0.5 for 0.5 USDC)
 * @returns transaction hash if successful, null if failed
 */
export async function sendUSDCFromTreasury(to: string, amount: number): Promise<string | null> {
  if (!treasuryClient) {
    console.error("Missing TREASURY_PRIVATE_KEY in .env.local");
    return null;
  }
  
  if (!to || !to.startsWith('0x')) {
    console.error("Invalid recipient address:", to);
    return null;
  }

  try {
    const hash = await treasuryClient.writeContract({
      address: USDC_ADDRESS,
      abi: usdcAbi,
      functionName: 'transfer',
      args: [to as `0x${string}`, parseUnits(amount.toString(), 6)]
    });
    
    return hash;
  } catch (err) {
    console.error("Treasury transfer error:", err);
    return null;
  }
}
