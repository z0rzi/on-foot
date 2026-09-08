import { GradeBand } from './profile'

// Non-colour channel (accessibility): steeper UPHILL → thicker, higher-contrast line.
export function bandLineWidth(band: GradeBand): number {
  switch (band) {
    case 'steep': return 4.5
    case 'rough': return 3.5
    case 'uphill': return 2.5
    case 'flat': return 1
    case 'downhill': return 1
  }
}

export function bandLineContrast(band: GradeBand): number {
  switch (band) {
    case 'steep': return 1
    case 'rough': return 0.9
    case 'uphill': return 0.7
    case 'downhill': return 0.4
    case 'flat': return 0.35
  }
}
