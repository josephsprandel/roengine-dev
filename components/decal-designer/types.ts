export type DynamicField = 'shopName' | 'nextMileage' | 'nextDate'

export type FontSize = 24 | 36 | 48 | 56 | 72

export type Align = 'left' | 'center' | 'right'

export type TextStyle = 'none' | 'outline' | 'inverted'

export const FONT_SIZES: FontSize[] = [24, 36, 48, 56, 72]

export const TEXT_STYLES: { value: TextStyle; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'outline', label: 'Outline Box' },
  { value: 'inverted', label: 'Inverted' },
]

export const LABEL_WIDTH = 320  // 40mm @ 203 DPI
export const LABEL_HEIGHT = 464 // 58mm @ 203 DPI
export const GRID_SIZE = 8      // snap grid in dots
export const DISPLAY_SCALE = 2.5 // dots → screen pixels

export interface DesignElement {
  id: string
  type: 'text' | 'rule' | 'image'
  /** For type=text with dynamic content */
  field?: DynamicField
  /** For type=text with static content, or unused for rules/images */
  content: string
  x: number  // dots
  y: number  // dots
  fontSize: FontSize
  bold: boolean
  visible: boolean
  align: Align
  /** Text decoration style */
  style?: TextStyle
  /** Image fields */
  imageUrl?: string
  imageWidth?: number   // dots
  imageHeight?: number  // dots
  zplGraphicData?: string // pre-converted ^GFA hex payload
}

export interface FieldData {
  shopName: string
  nextMileage: string
  nextDate: string
  logoUrl?: string
}

export const DEFAULT_ELEMENTS: DesignElement[] = [
  { id: 'shop-name', type: 'text', field: 'shopName', content: '', x: 0, y: 30, fontSize: 36, bold: true, visible: true, align: 'center' },
  { id: 'rule-1', type: 'rule', content: '', x: 40, y: 80, fontSize: 24, bold: false, visible: true, align: 'center' },
  { id: 'next-label', type: 'text', content: 'NEXT SERVICE', x: 0, y: 110, fontSize: 24, bold: false, visible: true, align: 'center' },
  { id: 'mileage', type: 'text', field: 'nextMileage', content: '', x: 0, y: 160, fontSize: 56, bold: true, visible: true, align: 'center' },
  { id: 'miles-label', type: 'text', content: 'miles', x: 0, y: 225, fontSize: 24, bold: false, visible: true, align: 'center' },
  { id: 'rule-2', type: 'rule', content: '', x: 40, y: 270, fontSize: 24, bold: false, visible: true, align: 'center' },
  { id: 'date', type: 'text', field: 'nextDate', content: '', x: 0, y: 300, fontSize: 36, bold: false, visible: true, align: 'center' },
]

export function snapToGrid(value: number): number {
  return Math.round(value / GRID_SIZE) * GRID_SIZE
}

export function dotsToMm(dots: number): number {
  return Math.round((dots / 8) * 10) / 10
}

export function mmToDots(mm: number): number {
  return Math.round(mm * 8)
}
