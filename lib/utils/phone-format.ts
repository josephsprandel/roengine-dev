/**
 * Format phone number to (555) 123-4567 format while typing
 * Handles partial input gracefully
 */
export function formatPhoneNumber(value: string): string {
  // Remove all non-digit characters
  const digits = value.replace(/\D/g, '')
  
  // Apply formatting based on length
  if (digits.length === 0) return ''
  if (digits.length <= 3) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`
}

/**
 * Extract just the digits from a formatted phone number
 * Useful for saving to database
 */
export function unformatPhoneNumber(value: string): string {
  return value.replace(/\D/g, '')
}
