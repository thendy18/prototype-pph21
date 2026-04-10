const DECIMAL_SCALE = 1_000_000;

export function floorDecimalProduct(
  value: number,
  factor: number,
  scale: number = DECIMAL_SCALE
): number {
  if (!Number.isFinite(value) || !Number.isFinite(factor)) return 0;

  const scaledFactor = Math.round(factor * scale);
  return Math.floor((value * scaledFactor) / scale);
}
