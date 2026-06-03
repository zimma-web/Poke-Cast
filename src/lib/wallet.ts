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

  await ensureBaseNetwork(provider);

  const accounts = (await provider.request({
    method: "eth_requestAccounts",
  })) as string[];
  const from = accounts?.[0];
  if (!from) {
    throw new Error("Wallet not connected. Allow wallet access and try again.");
  }

  const valueHex = `0x${params.valueWei.toString(16)}`;

  const txHash = (await withTimeout(
    provider.request({
      method: "eth_sendTransaction",
      params: [
        {
          from: from as `0x${string}`,
          to: params.to as `0x${string}`,
          value: valueHex as `0x${string}`,
          chainId: BASE_CHAIN_ID_HEX,
        },
      ],
    }),
    120_000,
    "Wallet confirmation timed out. If the tx went through, wait a moment and try again."
  )) as string;

  if (!txHash || typeof txHash !== "string") {
    throw new Error("Transaction failed — no hash returned from wallet.");
  }

  return { txHash, from };
}
