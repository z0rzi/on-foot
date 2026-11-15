import { createSerialQueue } from '../async/serialQueue'

// Every read-then-write of a session's track runs as one turn of this queue. The task manager awaits
// each delivery but does not queue them, and the gate reads the segment's last point and appends
// after it, so two deliveries must never interleave; nor may a delivery fall between the relaunch's
// read of the track and its hydration of the store, or the pill and the live track miss it.
export const deliveryQueue = createSerialQueue()
