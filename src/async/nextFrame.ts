// Resolves at the next frame, so a long run of work leaves the frames between its steps to the UI.
export function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}
