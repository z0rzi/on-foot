export interface MenuPlacementInput {
  anchorTop: number
  anchorBottom: number
  menuHeight: number
  windowHeight: number
  gap: number
  marginTop: number
  marginBottom: number
}

export interface MenuPlacement {
  top: number
}

// Upward when the whole menu fits above its button, downward when it fits below; fitting
// neither way, toward the side with more room, clamped so it starts on screen.
export function menuPlacement(input: MenuPlacementInput): MenuPlacement {
  const { anchorTop, anchorBottom, menuHeight, windowHeight, gap, marginTop, marginBottom } = input
  const upTop = anchorTop - gap - menuHeight
  const downTop = anchorBottom + gap
  const maxTop = windowHeight - marginBottom - menuHeight
  if (upTop >= marginTop) return { top: upTop }
  if (downTop <= maxTop) return { top: downTop }
  const roomAbove = anchorTop - gap - marginTop
  const roomBelow = windowHeight - marginBottom - downTop
  const clamp = (top: number) => Math.max(marginTop, Math.min(top, maxTop))
  return roomAbove > roomBelow
    ? { top: clamp(upTop) }
    : { top: clamp(downTop) }
}
