import type { ColorSchemeName } from 'react-native'

export interface AppColors {
  background: string
  surface: string
  onSurface: string
  onSurfaceVariant: string
  trailLine: string
  trailEndpointStroke: string
  recordingLine: string
  onRecording: string
  // The Map's top pill over the map, and its paused tint of the recording colour.
  pillSurface: string
  pillPausedSurface: string
  activityLine: string
  // The overview's pins: the teardrop's border and centre, the cluster's border and count
  // (`pinInk`); the cluster's disc (`pinCluster`); the tag's text (`pinTagText`), dark on the
  // tag's white image in every theme.
  pinInk: string
  pinCluster: string
  pinTagText: string
  // The user's position, wherever it is drawn: the map provider's puck (its image bakes these in)
  // and the graph puck. Theme-independent, so every rendering reads as one position.
  userPuck: string
  userPuckRing: string
  panelBackground: string
  panelContent: string
  panelDivider: string
  controlSurface: string
  controlContent: string
  controlAccent: string
  onControlAccent: string
  intensityLow: string
  intensityMedium: string
  intensityHigh: string
  success: string
  warning: string
  danger: string
  slopeSteep: string
  slopeRough: string
  slopeUphill: string
  slopeDownhill: string
  slopeFlat: string
  // The flat band of the graph on the card: a grey that reads on the card's surface.
  slopeFlatOnPanel: string
}

export const lightColors: AppColors = {
  background: '#FAFAFA',
  surface: '#FFFFFF',
  onSurface: '#1C1B1F',
  onSurfaceVariant: '#49454F',
  trailLine: '#9C27B0',
  trailEndpointStroke: '#FFFFFF',
  recordingLine: '#FF5722',
  onRecording: '#FFFFFF',
  pillSurface: 'rgba(255, 255, 255, 0.70)',
  pillPausedSurface: 'rgba(255, 228, 218, 0.9)',
  activityLine: '#00897B',
  pinInk: '#FFFFFF',
  pinCluster: '#222222',
  pinTagText: '#222222',
  userPuck: '#2196F3',
  userPuckRing: '#FFFFFF',
  panelBackground: '#FFFFFF',
  panelContent: '#000000',
  panelDivider: '#D3D3D3',
  controlSurface: '#FFFFFF',
  controlContent: '#1C1B1F',
  controlAccent: '#2196F3',
  onControlAccent: '#FFFFFF',
  intensityLow: '#2E7D32',
  intensityMedium: '#F9A825',
  intensityHigh: '#C62828',
  success: '#2E7D32',
  warning: '#E65100',
  danger: '#C62828',
  slopeSteep: '#000000',
  slopeRough: '#D32F2F',
  slopeUphill: '#F57C00',
  slopeDownhill: '#43A047',
  slopeFlat: '#EEEEEE',
  slopeFlatOnPanel: '#BDBDBD',
}

export const darkColors: AppColors = {
  background: '#121212',
  surface: '#1E1E1E',
  onSurface: '#E1E1E1',
  onSurfaceVariant: '#B0B0B0',
  trailLine: '#9C27B0',
  trailEndpointStroke: '#FFFFFF',
  recordingLine: '#FF7043',
  onRecording: '#1E1E1E',
  pillSurface: 'rgba(30, 30, 30, 0.70)',
  pillPausedSurface: 'rgba(76, 46, 37, 0.9)',
  activityLine: '#4DB6AC',
  pinInk: '#FFFFFF',
  pinCluster: '#222222',
  pinTagText: '#222222',
  userPuck: '#2196F3',
  userPuckRing: '#FFFFFF',
  panelBackground: '#1E1E1E',
  panelContent: '#FFFFFF',
  panelDivider: '#424242',
  controlSurface: '#2D2D2D',
  controlContent: '#FFFFFF',
  controlAccent: '#42A5F5',
  onControlAccent: '#1E1E1E',
  intensityLow: '#66BB6A',
  intensityMedium: '#FFB300',
  intensityHigh: '#EF5350',
  success: '#66BB6A',
  warning: '#FFA726',
  danger: '#EF5350',
  slopeSteep: '#000000',
  slopeRough: '#EF5350',
  slopeUphill: '#FFB74D',
  slopeDownhill: '#66BB6A',
  slopeFlat: '#EEEEEE',
  slopeFlatOnPanel: '#616161',
}

export function getColors(scheme: ColorSchemeName): AppColors {
  return scheme === 'dark' ? darkColors : lightColors
}
