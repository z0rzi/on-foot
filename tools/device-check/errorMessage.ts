// What a caught value says: an Error's message, anything else as a string.
export const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error))
