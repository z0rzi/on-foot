const DELIVERY_WAITING_AFTER_MS = 10_000
const DELIVERY_WAITING_LOG_EVERY_MS = 30_000

// What to log when a delivery arrives behind deliveries that have not settled, or null. Deliveries
// overlap for a moment in normal running; one held for more than DELIVERY_WAITING_AFTER_MS means a
// turn of the queue is stuck, and every later delivery is silently held behind it. pendingSince
// holds the arrival times of the unsettled deliveries, oldest first, without the arriving one.
export function deliveryWaiting(
  pendingSince: readonly number[],
  now: number,
  lastLoggedAt: number | null,
): { waiting: number; oldestS: number } | null {
  if (pendingSince.length === 0) return null
  const oldestMs = now - pendingSince[0]
  if (oldestMs <= DELIVERY_WAITING_AFTER_MS) return null
  if (lastLoggedAt != null && now - lastLoggedAt < DELIVERY_WAITING_LOG_EVERY_MS) return null
  return { waiting: pendingSince.length, oldestS: Math.floor(oldestMs / 1000) }
}
