import sdk from "@farcaster/miniapp-sdk";

const BASE_CHAIN_ID_HEX = "0x2105";
const BASE_CHAIN_ADD_PARAMS = {
  chainId: BASE_CHAIN_ID_HEX,
  chainName: "Base",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: ["https://mainnet.base.org"],
  blockExplorerUrls: ["https://basescan.org"],
};

type EthProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

async function getEthProvider(): Promise<EthProvider | null> {
  if (sdk.wallet?.getEthereumProvider) {
    const provider = await sdk.wallet.getEthereumProvider();
    if (provider) return provider as EthProvider;
  }
  return (sdk.wallet?.ethProvider as EthProvider | undefined) ?? null;
}

export function hasFarcasterWallet(): boolean {
  return !!(sdk.wallet?.ethProvider || sdk.wallet?.getEthereumProvider);
}

export async function getWalletAddress(): Promise<string | null> {
  const provider = await getEthProvider();
  if (!provider) return null;

  try {
    const accounts = (await provider.request({
      method: "eth_requestAccounts",
    })) as string[];
    return accounts?.[0] ?? null;
  } catch {
    try {
      const accounts = (await provider.request({
        method: "eth_accounts",
      })) as string[];
      return accounts?.[0] ?? null;
    } catch {
      return null;
    }
  }
}

async function ensureBaseNetwork(provider: EthProvider): Promise<void> {
  const current = (await provider.request({ method: "eth_chainId" })) as string;
  if (current?.toLowerCase() === BASE_CHAIN_ID_HEX) return;

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: BASE_CHAIN_ID_HEX }],
    });
  } catch (err: unknown) {
    const code = (err as { code?: number })?.code;
    if (code === 4902) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [BASE_CHAIN_ADD_PARAMS],
      });
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: BASE_CHAIN_ID_HEX }],
      });
      return;
    }
    throw err;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(message)), ms)
    ),
  ]);
}

/**
 * Native ETH on Base via Farcaster wallet.
 * Do not pass `from` — Warpcast must pick the active connected wallet.
 */
export async function sendNativeEthOnBase(params: {
  to: string;
  valueWei: bigint;
}): Promise<{ txHash: string; from: string }> {
  const provider = await getEthProvider();
  if (!provider) {
    throw new Error("Wallet not available. Open this app in a Farcaster client.");
  }

  console.log("[wallet] requesting accounts...");
  const accounts = (await provider.request({
    method: "eth_requestAccounts",
  })) as string[];
  const from = accounts?.[0];
  if (!from) {
    throw new Error("Wallet not connected. Allow wallet access and try again.");
  }
  console.log("[wallet] connected account:", from);

  const valueHex = `0x${params.valueWei.toString(16)}`;

  console.log("[wallet] sending transaction to", params.to, "value", valueHex);
  
  // Use minimal transaction params - let Warpcast handle gas estimation
  const txHash = (await withTimeout(
    provider.request({
      method: "eth_sendTransaction",
      params: [
        {
          from: from as `0x${string}`,
          to: params.to as `0x${string}`,
          value: valueHex as `0x${string}`,
        },
      ],
    }),
    30_000,
    "Wallet took too long. Close modal and tap 'Open Pack' again."
  )) as string;

  console.log("[wallet] transaction sent, txHash:", txHash);
  if (!txHash || typeof txHash !== "string") {
    throw new Error("Transaction failed — no hash returned from wallet.");
  }

  return { txHash, from };
}

/**
 * Send USDC on Base via Farcaster wallet.
 */
export async function sendUSDCOnBase(params: {
  to: string;
  amount: number;
}): Promise<{ txHash: string; from: string }> {
  const provider = await getEthProvider();
  if (!provider) {
    throw new Error("Wallet not available. Open this app in a Farcaster client.");
  }

  console.log("[wallet] requesting accounts for USDC...");
  const accounts = (await provider.request({
    method: "eth_requestAccounts",
  })) as string[];
  const from = accounts?.[0];
  if (!from) {
    throw new Error("Wallet not connected. Allow wallet access and try again.");
  }

  // USDC contract address on Base
  const USDC_CONTRACT = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
  
  // Create transfer payload: transfer(address,uint256) -> 0xa9059cbb
  const amountUnits = BigInt(Math.floor(params.amount * 1_000_000));
  const toPadded = params.to.toLowerCase().replace('0x', '').padStart(64, '0');
  const amountPadded = amountUnits.toString(16).padStart(64, '0');
  const data = `0xa9059cbb${toPadded}${amountPadded}`;

  console.log("[wallet] sending USDC to", params.to, "amount", params.amount);

  const txHash = (await withTimeout(
    provider.request({
      method: "eth_sendTransaction",
      params: [
        {
          from: from as `0x${string}`,
          to: USDC_CONTRACT as `0x${string}`,
          data: data,
        },
      ],
    }),
    60_000,
    "Wallet took too long to confirm USDC transfer."
  )) as string;

  if (!txHash || typeof txHash !== "string") {
    throw new Error("Transaction failed — no hash returned from wallet.");
  }

  return { txHash, from };
}
