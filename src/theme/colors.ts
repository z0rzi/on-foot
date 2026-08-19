export interface AppColors {
  primary: string
  background: string
  surface: string
  onSurface: string
  onSurfaceVariant: string
  trailLine: string
  panelBackground: string
  panelContent: string
  panelDivider: string
  overlayScrim: string
  controlSurface: string
  controlContent: string
  controlAccent: string
  controlsText: string
}

export const lightColors: AppColors = {
  primary: '#9C27B0',
  background: '#FAFAFA',
  surface: '#FFFFFF',
  onSurface: '#1C1B1F',
  onSurfaceVariant: '#49454F',
  trailLine: '#9C27B0',
  panelBackground: '#FFFFFF',
  panelContent: '#000000',
  panelDivider: '#D3D3D3',
  overlayScrim: 'rgba(0,0,0,0.85)',
  controlSurface: '#FFFFFF',
  controlContent: '#1C1B1F',
  controlAccent: '#2196F3',
  controlsText: '#000000',
}

export const darkColors: AppColors = {
  primary: '#CE93D8',
  background: '#121212',
  surface: '#1E1E1E',
  onSurface: '#E1E1E1',
  onSurfaceVariant: '#B0B0B0',
  trailLine: '#9C27B0',
  panelBackground: '#1E1E1E',
  panelContent: '#FFFFFF',
  panelDivider: '#424242',
  overlayScrim: 'rgba(0,0,0,0.9)',
  controlSurface: '#2D2D2D',
  controlContent: '#FFFFFF',
  controlAccent: '#42A5F5',
  controlsText: '#FFFFFF',
}

export function getColors(scheme: 'light' | 'dark' | null | 'unspecified'): AppColors {
  return scheme === 'dark' ? darkColors : lightColors
}
