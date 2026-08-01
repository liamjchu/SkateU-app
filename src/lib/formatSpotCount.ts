export function formatSpotCount(count: number): string {
  if (count < 1000) {
    return count.toString();
  }

  if (count < 1_000_000) {
    return `${Math.floor(count / 100) / 10}K`;
  }

  return `${Math.floor(count / 100_000) / 10}M`;
}
