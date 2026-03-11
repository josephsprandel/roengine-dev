/**
 * ZPL template for oil change decal — 40mm × 58mm portrait label at 203 DPI
 * 40mm = 320 dots wide, 58mm = 464 dots tall
 * Target printer: Godex RT200i
 */
export function generateOilChangeZPL({
  shopName,
  nextMileage,
  nextDate,
}: {
  shopName: string
  nextMileage: string
  nextDate: string
}): string {
  // Sanitize inputs — ZPL uses ^ and ~ as control chars
  const clean = (s: string) => s.replace(/[\^~]/g, '')

  const name = clean(shopName)
  const mileage = clean(nextMileage)
  const date = clean(nextDate)

  return [
    '^XA',
    // Label setup: 320 dots wide, 464 dots tall (40mm × 58mm @ 203 DPI)
    '^PW320',
    '^LL464',
    // Encoding
    '^CI28',

    // --- Shop name at top ---
    '^FO0,30',
    '^FB320,1,0,C,0',       // field block: 320 wide, center-justified
    '^A0N,36,36',            // scalable font ~12pt
    `^FD${name}^FS`,

    // --- Horizontal rule ---
    '^FO40,80^GB240,2,2^FS',

    // --- "NEXT SERVICE" label ---
    '^FO0,110',
    '^FB320,1,0,C,0',
    '^A0N,24,24',            // ~8pt
    '^FDNEXT SERVICE^FS',

    // --- Mileage (large, centered) ---
    '^FO0,160',
    '^FB320,1,0,C,0',
    '^A0N,56,56',            // ~20pt — dominant element
    `^FD${mileage}^FS`,

    // --- "miles" suffix ---
    '^FO0,225',
    '^FB320,1,0,C,0',
    '^A0N,24,24',
    '^FDmiles^FS',

    // --- Horizontal rule ---
    '^FO40,270^GB240,2,2^FS',

    // --- Date ---
    '^FO0,300',
    '^FB320,1,0,C,0',
    '^A0N,36,36',            // ~12pt
    `^FD${date}^FS`,

    // --- Bottom padding / end ---
    '^XZ',
  ].join('\n')
}

/**
 * Generate ZPL from a saved designer layout + runtime field data.
 * Each element becomes a ZPL field block or graphic box (for rules).
 */
export function generateZPLFromLayout(
  elements: {
    id: string
    type: 'text' | 'rule' | 'image'
    field?: string
    content: string
    x: number
    y: number
    fontSize: number
    bold: boolean
    visible: boolean
    align?: 'left' | 'center' | 'right'
    style?: 'none' | 'outline' | 'inverted'
    imageWidth?: number
    imageHeight?: number
    zplGraphicData?: string
  }[],
  data: { shopName: string; nextMileage: string; nextDate: string }
): string {
  const clean = (s: string) => s.replace(/[\^~]/g, '')
  const LABEL_WIDTH = 320
  const BOX_PAD = 4  // dots padding inside style boxes

  const fieldMap: Record<string, string> = {
    shopName: data.shopName,
    nextMileage: data.nextMileage,
    nextDate: data.nextDate,
  }

  const lines: string[] = [
    '^XA',
    `^PW${LABEL_WIDTH}`,
    '^LL464',
    '^CI28',
  ]

  for (const el of elements) {
    if (!el.visible) continue

    if (el.type === 'rule') {
      const ruleWidth = LABEL_WIDTH - el.x * 2
      lines.push(`^FO${el.x},${el.y}^GB${ruleWidth > 0 ? ruleWidth : 240},2,2^FS`)
      continue
    }

    if (el.type === 'image') {
      if (el.zplGraphicData) {
        lines.push(`^FO${el.x},${el.y}`)
        lines.push(el.zplGraphicData + '^FS')
      }
      continue
    }

    // Text element
    const text = el.field ? clean(fieldMap[el.field] || '') : clean(el.content)
    if (!text) continue

    const fs = el.fontSize || 36
    const align = el.align || 'center'
    const style = el.style || 'none'

    // Box dimensions for outline/inverted styles
    const boxH = fs + BOX_PAD * 2
    const boxW = align === 'left'
      ? Math.min(text.length * Math.round(fs * 0.6) + BOX_PAD * 4, LABEL_WIDTH - el.x)
      : LABEL_WIDTH

    if (style === 'outline') {
      // Draw rounded outline box, then text on top
      const bx = align === 'left' ? el.x : 0
      lines.push(`^FO${bx},${el.y - BOX_PAD}^GB${boxW},${boxH},2,B,4^FS`)
    } else if (style === 'inverted') {
      // Draw filled black box, then reversed (white) text
      const bx = align === 'left' ? el.x : 0
      lines.push(`^FO${bx},${el.y - BOX_PAD}^GB${boxW},${boxH},${boxH},B,4^FS`)
    }

    if (align === 'left') {
      lines.push(`^FO${el.x},${el.y}`)
      lines.push(`^A0N,${fs},${fs}`)
      if (style === 'inverted') lines.push('^FR')
      lines.push(`^FD${text}^FS`)
    } else {
      const zplAlign = align === 'right' ? 'R' : 'C'
      lines.push(`^FO0,${el.y}`)
      lines.push(`^FB${LABEL_WIDTH},1,0,${zplAlign},0`)
      lines.push(`^A0N,${fs},${fs}`)
      if (style === 'inverted') lines.push('^FR')
      lines.push(`^FD${text}^FS`)
    }
  }

  lines.push('^XZ')
  return lines.join('\n')
}
