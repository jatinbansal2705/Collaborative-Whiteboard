const UNIT_MULTIPLIERS: Record<string, number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

const DURATION_PATTERN = /^(\d+)([smhd])$/;

export function parseDurationToMs(value: string): number {
  const match = DURATION_PATTERN.exec(value);
  if (match === null) {
    throw new Error(`Invalid duration format: "${value}"`);
  }
  const amount = Number(match[1]);
  const unit = match[2];
  return amount * UNIT_MULTIPLIERS[unit];
}
