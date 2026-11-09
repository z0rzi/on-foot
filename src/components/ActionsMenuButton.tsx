import { useRef } from 'react'
import type { View } from 'react-native'
import { useTheme } from '../theme/useTheme'
import { IconButton } from './IconButton'
import type { MenuAnchor } from './ActionsMenu'

// The ⋮ that opens an entity's ActionsMenu, reporting its own window frame.
export function ActionsMenuButton({
  accessibilityLabel,
  onOpen,
}: {
  accessibilityLabel: string
  onOpen: (anchor: MenuAnchor) => void
}) {
  const c = useTheme()
  const ref = useRef<View>(null)
  const open = () => {
    ref.current?.measureInWindow((x, y, width, height) => onOpen({ right: x + width, top: y, bottom: y + height }))
  }
  return (
    <IconButton
      ref={ref}
      icon="ellipsis-vertical"
      color={c.onSurfaceVariant}
      accessibilityLabel={accessibilityLabel}
      onPress={open}
    />
  )
}
