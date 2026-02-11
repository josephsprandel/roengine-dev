"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Info } from "lucide-react"

interface InvoiceCalculationsProps {
  partsSubtotal: number
  laborSubtotal: number
  subletsSubtotal: number
  hazmatSubtotal: number
  feesSubtotal: number
  shopSupplies: number
  subtotalBeforeTax: number
  tax: number
  taxRate: number
  grandTotal: number
  ccSurchargeEnabled: boolean
  ccSurchargeRate: number
  taxExempt?: boolean
  taxOverride?: boolean
}

export function InvoiceCalculations({
  partsSubtotal,
  laborSubtotal,
  subletsSubtotal,
  hazmatSubtotal,
  feesSubtotal,
  shopSupplies,
  subtotalBeforeTax,
  tax,
  taxRate,
  grandTotal,
  ccSurchargeEnabled,
  ccSurchargeRate,
  taxExempt,
  taxOverride,
}: InvoiceCalculationsProps) {
  const estimatedCardSurcharge = ccSurchargeEnabled ? grandTotal * ccSurchargeRate : 0

  return (
    <Card className="p-6 border-border">
      <h3 className="font-semibold mb-4">Invoice Totals</h3>

      <div className="space-y-2">
        {/* Line item subtotals */}
        {partsSubtotal > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Parts</span>
            <span className="font-medium">${partsSubtotal.toFixed(2)}</span>
          </div>
        )}
        
        {laborSubtotal > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Labor</span>
            <span className="font-medium">${laborSubtotal.toFixed(2)}</span>
          </div>
        )}
        
        {subletsSubtotal > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Sublets</span>
            <span className="font-medium">${subletsSubtotal.toFixed(2)}</span>
          </div>
        )}
        
        {hazmatSubtotal > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Hazmat/Disposal</span>
            <span className="font-medium">${hazmatSubtotal.toFixed(2)}</span>
          </div>
        )}
        
        {feesSubtotal > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Fees</span>
            <span className="font-medium">${feesSubtotal.toFixed(2)}</span>
          </div>
        )}

        {/* Shop supplies */}
        {shopSupplies > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Shop Supplies</span>
            <span className="font-medium">${shopSupplies.toFixed(2)}</span>
          </div>
        )}

        {/* Subtotal before tax */}
        <div className="flex items-center justify-between text-sm pt-2 border-t border-border">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-medium">${subtotalBeforeTax.toFixed(2)}</span>
        </div>

        {/* Tax */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">
              Tax {!taxExempt && `(${(taxRate * 100).toFixed(2)}%)`}
            </span>
            {taxExempt && (
              <Badge variant="outline" className="text-xs">
                EXEMPT
              </Badge>
            )}
            {taxOverride && (
              <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-700 border-amber-500/20">
                OVERRIDE
              </Badge>
            )}
          </div>
          <span className="font-medium">${tax.toFixed(2)}</span>
        </div>

        {/* Grand total */}
        <div className="flex items-center justify-between text-lg font-bold pt-3 border-t-2 border-border">
          <span>Grand Total</span>
          <span className="text-xl">${grandTotal.toFixed(2)}</span>
        </div>

        {/* Card surcharge note */}
        {ccSurchargeEnabled && estimatedCardSurcharge > 0 && (
          <div className="mt-4 p-3 rounded-lg bg-muted/50 border border-border">
            <div className="flex items-start gap-2">
              <Info size={16} className="text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="text-xs text-muted-foreground">
                <p className="font-medium mb-1">Credit Card Processing Fee</p>
                <p>
                  A {(ccSurchargeRate * 100).toFixed(2)}% processing fee (${estimatedCardSurcharge.toFixed(2)}) will be added 
                  to credit/debit card payments. Cash, check, and ACH payments have no additional fees.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
