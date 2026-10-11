import { File } from 'expo-file-system'

export class GpxReadError extends Error {
  constructor(cause: unknown) {
    super('GPX file could not be read', { cause })
    this.name = 'GpxReadError'
  }
}

export async function readGpxFile(uri: string): Promise<string> {
  try {
    return await new File(uri).text()
  } catch (err) {
    throw new GpxReadError(err)
  }
}
