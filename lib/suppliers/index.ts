/**
 * Supplier Adapter Registry
 *
 * Central registry for all parts supplier integrations.
 * Import adapters here and register them by name.
 */

import type { ISupplierAdapter } from './types'
import { worldpacAdapter } from './adapters/worldpac'

const suppliers = new Map<string, ISupplierAdapter>()

// Register adapters
suppliers.set('worldpac', worldpacAdapter)

export function getSupplier(name: string): ISupplierAdapter | undefined {
  return suppliers.get(name)
}

export function listSuppliers(): string[] {
  return Array.from(suppliers.keys())
}

export { type ISupplierAdapter, type SupplierPart, type PartSearchParams } from './types'
