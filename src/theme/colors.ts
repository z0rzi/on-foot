export interface AppColors {
  primary: string
  background: string
  surface: string
  onSurface: string
  onSurfaceVariant: string
  trailLine: string
  trailEndpointStroke: string
  recordingLine: string
  activityLine: string
  panelBackground: string
  panelContent: string
  panelDivider: string
  overlayScrim: string
  controlSurface: string
  controlContent: string
  controlAccent: string
  controlsText: string
  difficultyEasy: string
  difficultyMedium: string
  difficultyHard: string
  success: string
  warning: string
  danger: string
}

export const lightColors: AppColors = {
  primary: '#9C27B0',
  background: '#FAFAFA',
  surface: '#FFFFFF',
  onSurface: '#1C1B1F',
  onSurfaceVariant: '#49454F',
  trailLine: '#9C27B0',
  trailEndpointStroke: '#FFFFFF',
  recordingLine: '#FF5722',
  activityLine: '#00897B',
  panelBackground: '#FFFFFF',
  panelContent: '#000000',
  panelDivider: '#D3D3D3',
  overlayScrim: 'rgba(0,0,0,0.85)',
  controlSurface: '#FFFFFF',
  controlContent: '#1C1B1F',
  controlAccent: '#2196F3',
  controlsText: '#000000',
  difficultyEasy: '#2E7D32',
  difficultyMedium: '#F9A825',
  difficultyHard: '#C62828',
  success: '#2E7D32',
  warning: '#E65100',
  danger: '#C62828',
}

export const darkColors: AppColors = {
  primary: '#CE93D8',
  background: '#121212',
  surface: '#1E1E1E',
  onSurface: '#E1E1E1',
  onSurfaceVariant: '#B0B0B0',
  trailLine: '#9C27B0',
  trailEndpointStroke: '#FFFFFF',
  recordingLine: '#FF7043',
  activityLine: '#4DB6AC',
  panelBackground: '#1E1E1E',
  panelContent: '#FFFFFF',
  panelDivider: '#424242',
  overlayScrim: 'rgba(0,0,0,0.9)',
  controlSurface: '#2D2D2D',
  controlContent: '#FFFFFF',
  controlAccent: '#42A5F5',
  controlsText: '#FFFFFF',
  difficultyEasy: '#66BB6A',
  difficultyMedium: '#FFB300',
  difficultyHard: '#EF5350',
  success: '#66BB6A',
  warning: '#FFA726',
  danger: '#EF5350',
}

export function getColors(scheme: 'light' | 'dark' | null): AppColors {
  return scheme === 'dark' ? darkColors : lightColors
}
