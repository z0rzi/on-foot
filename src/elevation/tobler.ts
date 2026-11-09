// Seconds to walk `meters` at `grade`, at Tobler's hiking speed (Tobler, 1993): the fastest walk is
// a slight descent, and both climbs and steep descents slow it.
export function toblerSeconds(meters: number, grade: number): number {
  const kmh = 6 * Math.exp(-3.5 * Math.abs(grade + 0.05))
  return (meters / 1000 / kmh) * 3600
}
