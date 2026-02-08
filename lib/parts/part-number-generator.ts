/**
 * Part Number Generator
 * 
 * Generates intelligent part numbers when manufacturer PN is not visible on the bottle.
 * Format: BRAND + PRODUCTLINE + VISCOSITY + CONTAINERSIZE
 * Example: MBL1EXT0W205QT, CASTEDGE5W301QT
 */

import { query } from '@/lib/db'

interface ProductInfo {
  brand: string
  productName: string
  viscosity?: string | null
  containerSize?: string | null
  fluidType?: string | null
}

/**
 * Generate a unique part number from product information
 */
export async function generatePartNumber(info: ProductInfo): Promise<string> {
  // Brand abbreviation (first 3-4 letters, remove spaces/special chars)
  const brandAbbr = info.brand
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .substring(0, 4)

  // Product line identifier (look for key terms)
  let productAbbr = ''
  const nameUpper = info.productName.toUpperCase()

  if (nameUpper.includes('EDGE')) productAbbr = 'EDGE'
  else if (nameUpper.includes('EXTENDED') || nameUpper.includes('EXT PERF')) productAbbr = 'EXT'
  else if (nameUpper.includes('PREMIUM')) productAbbr = 'PREM'
  else if (nameUpper.includes('MAXLIFE') || nameUpper.includes('MAX LIFE')) productAbbr = 'MAXL'
  else if (nameUpper.includes('HIGH MILEAGE') || nameUpper.includes('HI-MILE')) productAbbr = 'HM'
  else if (nameUpper.includes('FULL SYNTHETIC') || nameUpper.includes('ADVANCED FULL')) productAbbr = 'SYN'
  else if (nameUpper.includes('SYNTHETIC BLEND') || nameUpper.includes('SYN BLEND')) productAbbr = 'BLD'
  else if (nameUpper.includes('CONVENTIONAL')) productAbbr = 'CONV'
  else if (nameUpper.includes('EURO')) productAbbr = 'EUR'
  else if (nameUpper.includes('DIESEL')) productAbbr = 'DSL'
  else if (nameUpper.includes('RACING') || nameUpper.includes('RACE')) productAbbr = 'RACE'
  else if (nameUpper.includes('GTX')) productAbbr = 'GTX'
  else if (nameUpper.includes('MAGNATEC')) productAbbr = 'MAG'
  else if (nameUpper.includes('POWER STEERING')) productAbbr = 'PS'
  else if (nameUpper.includes('BRAKE')) productAbbr = 'BRK'
  else if (nameUpper.includes('COOLANT') || nameUpper.includes('ANTIFREEZE')) productAbbr = 'CLT'
  else if (nameUpper.includes('TRANSMISSION') || nameUpper.includes('ATF')) productAbbr = 'ATF'
  else if (nameUpper.includes('GEAR') || nameUpper.includes('DIFFERENTIAL')) productAbbr = 'GEAR'

  // Viscosity (remove dashes and spaces, keep W)
  const viscAbbr = info.viscosity
    ? info.viscosity.replace(/[-\s]/g, '').toUpperCase()
    : ''

  // Container size (remove spaces, keep units)
  let sizeAbbr = ''
  if (info.containerSize) {
    const size = info.containerSize.toUpperCase()
    const num = parseFloat(size)
    if (!isNaN(num)) {
      if (size.includes('QUART') || size.includes('QT')) {
        sizeAbbr = `${num}QT`
      } else if (size.includes('GALLON') || size.includes('GAL')) {
        sizeAbbr = `${num}GAL`
      } else if (size.includes('LITER') || size.includes('L')) {
        sizeAbbr = `${num}L`
      } else if (size.includes('OZ')) {
        sizeAbbr = `${num}OZ`
      }
    }
  }

  // Combine parts
  const basePn = `${brandAbbr}${productAbbr}${viscAbbr}${sizeAbbr}`

  // Ensure uniqueness
  let finalPN = basePn
  let counter = 1

  while (await partNumberExists(finalPN)) {
    finalPN = `${basePn}-${counter}`
    counter++
  }

  return finalPN
}

/**
 * Check if a part number already exists in the database
 */
async function partNumberExists(partNumber: string): Promise<boolean> {
  const result = await query(
    'SELECT 1 FROM parts_inventory WHERE part_number = $1',
    [partNumber]
  )
  return result.rows.length > 0
}

/**
 * Convert container size string to quarts
 */
export function calculateBaseUnitQuantity(containerSize: string | null | undefined): number {
  if (!containerSize) return 1

  const size = containerSize.toLowerCase()
  const num = parseFloat(size)

  if (isNaN(num)) return 1

  if (size.includes('quart') || size.includes('qt')) {
    return num
  } else if (size.includes('gallon') || size.includes('gal')) {
    return num * 4
  } else if (size.includes('liter') || size.includes('l')) {
    return Math.round(num * 1.05669 * 1000) / 1000 // Round to 3 decimal places
  } else if (size.includes('ounce') || size.includes('oz')) {
    return Math.round((num / 32) * 1000) / 1000 // fl oz to quarts
  }

  return 1 // Default fallback
}
