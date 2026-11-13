// An error as the log may hold it: its class, never its message, which can quote the data at fault.
export function errorClass(error: unknown): string {
  return error instanceof Error ? error.name : typeof error
}
