import { AppColors } from '../theme/colors'

// `name` prefixes the accessibility labels of the controls built from this field.
export interface EnumField<T extends string> {
  name: string
  values: readonly T[]
  label: (value: T) => string
  color: (value: T, colors: AppColors) => string
}
