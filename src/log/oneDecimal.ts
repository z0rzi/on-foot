// The precision of a measured figure in the debug log.
export function toOneDecimal(n: number): number {
  return Math.round(n * 10) / 10
}
