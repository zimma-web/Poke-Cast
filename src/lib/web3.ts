// Base network JSON-RPC utilities for USDC tracking

const BASE_RPC_URL = 'https://mainnet.base.org';
const USDC_CONTRACT_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

/**
 * Queries Base RPC to fetch the live USDC balance for a given address
 */
export async function getBaseUSDCBalance(address: string): Promise<number> {
  if (!address || !address.startsWith('0x')) return 0;
  try {
    const cleanAddress = address.toLowerCase().replace('0x', '');
    // Selector for balanceOf(address) is 0x70a08231
    const data = '0x70a08231' + cleanAddress.padStart(64, '0');

    const res = await fetch(BASE_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [
          {
            to: USDC_CONTRACT_BASE,
            data: data
          },
          'latest'
        ]
      })
    });

    const json = await res.json();
    if (json.error) {
      console.error('Base RPC eth_call error:', json.error);
      return 0;
    }

    const hexResult = json.result;
    if (!hexResult || hexResult === '0x') return 0;

    const rawVal = BigInt(hexResult);
    // USDC has 6 decimals on Base
    return Number(rawVal) / 1_000_000;
  } catch (e) {
    console.error('Error fetching Base USDC balance:', e);
    return 0;
  }
}

/**
 * Queries Base RPC to check if a transaction hash is a successful USDC transfer
 * from `expectedFrom` to `expectedTo` for at least `expectedAmount`.
 */
export async function verifyBaseUSDCTransfer(
  txHash: string,
  expectedFrom: string,
  expectedTo: string,
  expectedAmount: number
): Promise<boolean> {
  if (!txHash || !txHash.startsWith('0x')) return false;
  try {
    const res = await fetch(BASE_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getTransactionReceipt',
        params: [txHash]
      })
    });

    const json = await res.json();
    if (json.error || !json.result) {
      console.error('Base RPC getTransactionReceipt error or missing tx:', json.error || 'tx not found');
      return false;
    }

    const receipt = json.result;
    // Check receipt status is '0x1' (success)
    if (receipt.status !== '0x1') {
      console.warn('Base tx failed or reverted status:', receipt.status);
      return false;
    }

    // Lookup logs for Transfer event: Transfer(address indexed from, address indexed to, uint256 value)
    // Transfer topic: 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef
    const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
    const usdc = USDC_CONTRACT_BASE.toLowerCase();
    const fromPadded = '0x' + expectedFrom.toLowerCase().replace('0x', '').padStart(64, '0');
    const toPadded = '0x' + expectedTo.toLowerCase().replace('0x', '').padStart(64, '0');

    const logs = receipt.logs || [];
    for (const log of logs) {
      if (log.address.toLowerCase() === usdc && log.topics[0] === transferTopic) {
        const logFrom = log.topics[1]?.toLowerCase();
        const logTo = log.topics[2]?.toLowerCase();
        
        if (logFrom === fromPadded && logTo === toPadded) {
          const rawVal = BigInt(log.data);
          const amountTransferred = Number(rawVal) / 1_000_000;
          
          // Tolerate minor rounding/gas differences but must match or exceed the expected price
          if (amountTransferred >= expectedAmount - 0.01) {
            return true;
          }
        }
      }
    }

    console.warn(`No matching USDC transfer found in receipt logs from ${expectedFrom} to ${expectedTo}`);
    return false;
  } catch (e) {
    console.error('Error verifying Base USDC transfer:', e);
    return false;
  }
}
