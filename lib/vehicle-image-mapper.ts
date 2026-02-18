export const VALID_COLORS = [
  'white', 'black', 'silver', 'gray',
  'red', 'blue', 'bronze', 'green',
  'beige', 'orange', 'yellow', 'purple',
  'lightblue', 'darkblue', 'burgundy', 'tan',
] as const

export const VALID_BODY_STYLES = [
  'sedan', 'mid_suv', 'full_suv', 'mid_truck', 'full_truck',
] as const

export type VehicleColor = (typeof VALID_COLORS)[number]
export type BodyStyle = (typeof VALID_BODY_STYLES)[number]

export function getVehicleImagePath(
  bodyStyle: string,
  color: string
): string {
  const normalizedColor = color?.toLowerCase() || 'silver'
  const normalizedBodyStyle = bodyStyle?.toLowerCase() || 'mid_suv'

  const finalColor = (VALID_COLORS as readonly string[]).includes(normalizedColor)
    ? normalizedColor
    : 'silver'

  const finalBodyStyle = (VALID_BODY_STYLES as readonly string[]).includes(normalizedBodyStyle)
    ? normalizedBodyStyle
    : 'mid_suv'

  return `/images/vehicles/${finalBodyStyle}_${finalColor}.png`
}
