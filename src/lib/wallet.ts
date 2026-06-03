import sdk from "@farcaster/miniapp-sdk";

const BASE_CHAIN_ID_HEX = "0x2105";

export function hasFarcasterWallet(): boolean {
  return !!sdk.wallet?.ethProvider;
}

export async function getWalletAddress(): Promise<string | null> {
  const provider = sdk.wallet?.ethProvider;
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

/** Native ETH transfer on Base via Farcaster mini-app wallet (EIP-1193). */
export async function sendNativeEthOnBase(params: {
  to: string;
  valueWei: bigint;
  from?: string;
}): Promise<string> {
  const provider = sdk.wallet?.ethProvider;
  if (!provider) {
    throw new Error("Wallet not available. Open this app in a Farcaster client.");
  }

  const from = params.from ?? (await getWalletAddress());
  if (!from) {
    throw new Error("Wallet not connected. Allow wallet access and try again.");
  }

  const valueHex = `0x${params.valueWei.toString(16)}`;

  const txHash = (await provider.request({
    method: "eth_sendTransaction",
    params: [
      {
        from: from as `0x${string}`,
        to: params.to as `0x${string}`,
        value: valueHex as `0x${string}`,
        chainId: BASE_CHAIN_ID_HEX,
      },
    ],
  })) as string;

  if (!txHash || typeof txHash !== "string") {
    throw new Error("Transaction failed — no hash returned from wallet.");
  }

  return txHash;
}
