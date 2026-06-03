/** Treasury on Base — native ETH fees (pack open, marketplace listing, etc.) */
export const TREASURY_ADDRESS = '0x330CDc1dB0899f8d5C7D0E0e261271D574b5952f' as const;

/** Per-pack opening fee on Base mainnet */
export const PACK_OPEN_FEE_ETH = 0.0000015;

export function packOpenFeeWei(packCount: number): bigint {
  const count = Math.max(1, Math.min(5, packCount));
  // 0.0000015 ETH = 1_500_000_000_000 wei per pack
  return BigInt(count) * BigInt(1_500_000_000_000);
}

export function packOpenFeeEth(packCount: number): number {
  const count = Math.max(1, Math.min(5, packCount));
  return count * PACK_OPEN_FEE_ETH;
}
