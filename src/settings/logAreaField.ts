import { EnumField } from '../components/enumField'
import { LOG_AREAS, LogArea } from '../data/log/types'

export const logAreaField: EnumField<LogArea> = {
  name: 'Area',
  values: LOG_AREAS,
  label: (area) => area,
  color: (_area, colors) => colors.onSurfaceVariant,
}
