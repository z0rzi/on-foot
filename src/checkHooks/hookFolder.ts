import { hookFolder } from '../../modules/check-hooks'

// The hook folder's path, as adb reads it; a hook that needs it is refused while shared storage is
// unmounted.
export function hookFolderPath(): string {
  const folder = hookFolder()
  if (folder === null) throw new Error('the hook folder is unavailable: shared storage is not mounted')
  return folder
}

// expo-file-system takes a file:// URI; the module gives the folder as a path.
export const fileUri = (path: string) => `file://${path}`
