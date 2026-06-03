// Base network JSON-RPC utilities for USDC tracking

const BASE_RPC_URL = 'https://mainnet.base.org';
const USDC_CONTRACT_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

/**
 * Polls Base RPC until a transaction receipt is available (confirmed on-chain).
 * Returns the receipt or null if it times out.
 * @param txHash - The transaction hash to poll
 * @param maxWaitMs - Maximum time to wait in milliseconds (default 90 seconds)
 * @param pollIntervalMs - How often to poll in milliseconds (default 3 seconds)
 */
async function waitForReceipt(
  txHash: string,
  maxWaitMs = 90_000,
  pollIntervalMs = 3_000
): Promise<any | null> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
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
      if (json.result) {
        return json.result; // Receipt found — tx is confirmed
      }
    } catch (e) {
      console.warn('Poll for receipt failed, retrying...', e);
    }
    // Wait before next poll
    await new Promise(r => setTimeout(r, pollIntervalMs));
  }
  console.warn(`waitForReceipt timed out after ${maxWaitMs}ms for tx: ${txHash}`);
  return null;
}

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
 * Polls until the transaction is confirmed on-chain (up to 90 seconds).
 */
export async function verifyBaseUSDCTransfer(
  txHash: string,
  expectedFrom: string,
  expectedTo: string,
  expectedAmount: number
): Promise<boolean> {
  if (!txHash || !txHash.startsWith('0x')) return false;
  try {
    // Poll until the tx is mined — fixes Warpcast pending tx issue
    const receipt = await waitForReceipt(txHash);
    if (!receipt) {
      console.error('USDC tx not confirmed within timeout:', txHash);
      return false;
    }

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

/**
 * Queries Base RPC to check if a transaction hash is a successful native ETH transfer
 * from `expectedFrom` to `expectedTo` for at least `expectedAmountETH`.
 * Polls until the transaction is confirmed on-chain (up to 90 seconds).
 */
export async function verifyBaseETHTransfer(
  txHash: string,
  expectedFrom: string,
  expectedTo: string,
  expectedAmountETH: number
): Promise<boolean> {
  if (!txHash || !txHash.startsWith('0x')) return false;
  try {
    // 1. Poll until the tx is mined — fixes Warpcast pending tx issue
    const receipt = await waitForReceipt(txHash);
    if (!receipt) {
      console.error('ETH tx not confirmed within timeout:', txHash);
      return false;
    }

    if (receipt.status !== '0x1') {
      console.warn('Base tx failed or reverted:', receipt.status);
      return false;
    }

    // 2. Fetch transaction details to verify addresses and value
    const resTx = await fetch(BASE_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getTransactionByHash',
        params: [txHash]
      })
    });
    const jsonTx = await resTx.json();
    if (jsonTx.error || !jsonTx.result) {
      console.error('Base RPC eth_getTransactionByHash error:', jsonTx.error || 'tx not found');
      return false;
    }
    const tx = jsonTx.result;

    // Verify sender and receiver match
    if (tx.from.toLowerCase() !== expectedFrom.toLowerCase() || tx.to.toLowerCase() !== expectedTo.toLowerCase()) {
      console.warn(`Address mismatch: expected from ${expectedFrom} to ${expectedTo}, got from ${tx.from} to ${tx.to}`);
      return false;
    }

    // Convert value from Wei to ETH
    const valueWei = BigInt(tx.value);
    const amountETH = Number(valueWei) / 1e18;

    // Allow a tiny margin for float precision issues
    if (amountETH < expectedAmountETH - 0.000000001) {
      console.warn(`Amount mismatch: expected ${expectedAmountETH} ETH, got ${amountETH} ETH`);
      return false;
    }

    return true;
  } catch (e) {
    console.error('Error verifying Base ETH transfer:', e);
    return false;
  }
}
