/** Treasury on Base — native ETH fees (pack open, marketplace listing, etc.) */
export const TREASURY_ADDRESS = '0xe251A3a0D23859157ef8041394279f7Ba46C90e3' as const;

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
