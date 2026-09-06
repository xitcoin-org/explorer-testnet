/** CometBFT VoteSet.BitArrayString: the fraction printed by RPC is rounded. */
export function prevoteParticipation(raw: unknown): string {
  if (typeof raw !== 'string') return 'Unavailable';
  const match = /^BA\{\d+:[x_]+\}\s+(\d+)\/(\d+)\s+=\s+[\d.]+$/.exec(raw);
  if (!match) return 'Unavailable';
  const voted = BigInt(match[1]), total = BigInt(match[2]);
  if (total === 0n || voted > total) return 'Unavailable';
  if (voted === 0n) return '0 %';
  const basisPoints = (voted * 10000n + total / 2n) / total;
  return basisPoints === 0n ? '< 0.01 %' : `${Number(basisPoints) / 100} %`;
}
export function consensusStep(value: string): string {
  const names: Record<string, string> = { '1': 'NewHeight — waiting for the next block', '2': 'NewRound', '3': 'Propose', '4': 'Prevote', '5': 'PrevoteWait', '6': 'Precommit', '7': 'PrecommitWait', '8': 'Commit' };
  return names[value] ? `${value} · ${names[value]}` : 'Unavailable';
}
