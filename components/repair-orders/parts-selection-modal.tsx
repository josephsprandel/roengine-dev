'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, Check } from 'lucide-react'

interface PartWithPricing {
  description: string
  quantity: number
  unit: string
  notes?: string
  pricingOptions: Array<{
    partNumber: string
    description: string
    brand: string
    vendor: string
    cost: number
    retailPrice: number
    inStock: boolean
    quantity?: number
  }>
  selectedOption?: any
}

interface ServiceWithParts {
  serviceName: string
  parts: PartWithPricing[]
}

interface PartsSelectionModalProps {
  isOpen: boolean
  onClose: () => void
  servicesWithParts: ServiceWithParts[]
  onConfirm: (servicesWithSelectedParts: ServiceWithParts[]) => void
}

export function PartsSelectionModal({
  isOpen,
  onClose,
  servicesWithParts,
  onConfirm
}: PartsSelectionModalProps) {
  const [selectedParts, setSelectedParts] = useState<Record<string, any>>({})

  const handleSelectPart = (serviceIdx: number, partIdx: number, option: any) => {
    const key = `${serviceIdx}-${partIdx}`
    setSelectedParts(prev => ({ ...prev, [key]: option }))
  }

  const handleConfirm = () => {
    const servicesWithSelections = servicesWithParts.map((service, sIdx) => ({
      ...service,
      parts: service.parts.map((part, pIdx) => ({
        ...part,
        selectedOption: selectedParts[`${sIdx}-${pIdx}`] || part.pricingOptions[0]
      }))
    }))
    
    onConfirm(servicesWithSelections)
  }

  // Calculate total
  const calculateTotal = () => {
    let total = 0
    servicesWithParts.forEach((service, sIdx) => {
      service.parts.forEach((part, pIdx) => {
        const selected = selectedParts[`${sIdx}-${pIdx}`] || part.pricingOptions[0]
        if (selected) {
          total += selected.retailPrice * part.quantity
        }
      })
    })
    return total
  }

  const total = calculateTotal()

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Select Parts for Services</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Choose parts for each service. Default options are pre-selected.
          </p>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {servicesWithParts.map((service, sIdx) => (
            <div key={sIdx} className="border rounded-lg p-4 bg-card">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                {service.serviceName}
                <Badge variant="secondary" className="text-xs">
                  {service.parts.length} {service.parts.length === 1 ? 'part' : 'parts'}
                </Badge>
              </h3>
              
              <div className="space-y-4">
                {service.parts.map((part, pIdx) => (
                  <div key={pIdx} className="p-3 bg-muted/30 rounded-lg border border-border">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <p className="font-medium capitalize text-foreground">{part.description}</p>
                        <div className="flex gap-2 mt-1">
                          <p className="text-sm text-muted-foreground">
                            Qty: {part.quantity} {part.unit}
                          </p>
                          {part.notes && (
                            <p className="text-sm text-muted-foreground italic">• {part.notes}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {part.pricingOptions.length > 0 ? (
                      <div className="space-y-2">
                        {part.pricingOptions.map((option, oIdx) => {
                          const isSelected = selectedParts[`${sIdx}-${pIdx}`]?.partNumber === option.partNumber || (!selectedParts[`${sIdx}-${pIdx}`] && oIdx === 0)
                          
                          return (
                            <label
                              key={oIdx}
                              className={`flex items-center p-3 border rounded-lg cursor-pointer transition-all ${
                                isSelected 
                                  ? 'border-primary bg-primary/5 shadow-sm' 
                                  : 'border-border hover:border-primary/50 hover:bg-muted/50'
                              }`}
                            >
                              <div className="flex items-center mr-3">
                                <input
                                  type="radio"
                                  name={`part-${sIdx}-${pIdx}`}
                                  value={option.partNumber}
                                  checked={isSelected}
                                  onChange={() => handleSelectPart(sIdx, pIdx, option)}
                                  className="w-4 h-4 text-primary"
                                />
                                {isSelected && (
                                  <Check size={16} className="text-primary ml-1" />
                                )}
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start gap-4">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="font-medium text-foreground">{option.brand || option.vendor}</span>
                                      {option.inStock && (
                                        <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">
                                          ✓ In Stock
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-sm text-muted-foreground truncate">
                                      {option.partNumber}
                                    </p>
                                    {option.description && option.description !== part.description && (
                                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                        {option.description}
                                      </p>
                                    )}
                                  </div>
                                  
                                  <div className="text-right flex-shrink-0">
                                    <p className="font-semibold text-foreground text-lg">
                                      ${option.retailPrice.toFixed(2)}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      Cost: ${option.cost.toFixed(2)}
                                    </p>
                                    {part.quantity > 1 && (
                                      <p className="text-xs text-muted-foreground mt-1">
                                        Total: ${(option.retailPrice * part.quantity).toFixed(2)}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </label>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                        <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                            Pricing not available
                          </p>
                          <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                            This part will need to be manually priced when added to the RO.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="gap-2 mt-6 border-t pt-4">
          <div className="flex items-center justify-between w-full">
            <div className="text-left">
              <p className="text-sm text-muted-foreground">Estimated Parts Total</p>
              <p className="text-2xl font-bold text-foreground">${total.toFixed(2)}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={handleConfirm} className="min-w-[200px]">
                Add Services & Parts to RO
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
