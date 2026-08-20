import { File } from 'expo-file-system'

export function readGpxFile(uri: string): Promise<string> {
  return new File(uri).text()
}
