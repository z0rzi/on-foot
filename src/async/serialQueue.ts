// One-at-a-time execution: each operation starts only once the previous one has settled, so two
// callers never interleave. A rejection reaches its own caller and leaves the queue usable. Each
// queue is independent — callers that must not wait behind each other create their own.
export function createSerialQueue() {
  let tail: Promise<unknown> = Promise.resolve()
  return <T>(operation: () => Promise<T>): Promise<T> => {
    const turn = tail.then(operation, operation)
    tail = turn.catch(() => {})
    return turn
  }
}
