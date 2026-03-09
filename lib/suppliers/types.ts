/**
 * Supplier Adapter Type Definitions
 *
 * Shared interfaces for all parts supplier integrations.
 */

export interface SupplierCredentials {
  [key: string]: string
}

export interface PartSearchParams {
  vin?: string
  year?: number
  make?: string
  model?: string
  searchTerm?: string
  partType?: string
}

export interface SupplierPart {
  partNumber: string
  description: string
  brand: string
  price: number
  listPrice?: number
  coreCharge?: number
  availability: 'in_stock' | 'limited' | 'order' | 'unavailable'
  quantityAvailable?: number
  estimatedDelivery?: string
  imageUrl?: string
  supplier: string
  supplierPartId?: string
}

export interface SupplierOrderLine {
  partNumber: string
  description: string
  quantity: number
  unitPrice: number
  total: number
}

export interface SupplierOrder {
  orderId: string
  status: string
  parts: SupplierOrderLine[]
  total: number
  estimatedDelivery?: string
  rawResponse?: any
}

export interface PlaceOrderParams {
  parts: { partNumber: string; quantity: number; supplierPartId?: string }[]
  poNumber: string
  workOrderId?: number
  notes?: string
}

export interface ISupplierAdapter {
  name: string
  searchParts(params: PartSearchParams): Promise<SupplierPart[]>
  validateCredentials(): Promise<boolean>
  placeOrder?(params: PlaceOrderParams): Promise<SupplierOrder>
  getOrderStatus?(orderId: string): Promise<SupplierOrder>
}
