import { Card } from "@/components/ui/card"

interface PricingSummaryProps {
  totals: {
    parts: number
    labor: number
    sublets: number
    hazmat: number
    fees: number
    total: number
  }
}

export function PricingSummary({ totals }: PricingSummaryProps) {
  return (
    <Card className="p-4 border-border bg-muted/30">
      <div className="flex items-center justify-between gap-6">
        <div className="flex items-center gap-6 flex-1 overflow-x-auto pb-2">
          <div className="flex-shrink-0">
            <p className="text-xs text-muted-foreground">Parts</p>
            <p className="font-semibold text-foreground">${totals.parts.toFixed(2)}</p>
          </div>
          <div className="flex-shrink-0">
            <p className="text-xs text-muted-foreground">Labor</p>
            <p className="font-semibold text-foreground">${totals.labor.toFixed(2)}</p>
          </div>
          <div className="flex-shrink-0">
            <p className="text-xs text-muted-foreground">Sublets</p>
            <p className="font-semibold text-foreground">${totals.sublets.toFixed(2)}</p>
          </div>
          <div className="flex-shrink-0">
            <p className="text-xs text-muted-foreground">Hazmat</p>
            <p className="font-semibold text-foreground">${totals.hazmat.toFixed(2)}</p>
          </div>
          <div className="flex-shrink-0">
            <p className="text-xs text-muted-foreground">Fees</p>
            <p className="font-semibold text-foreground">${totals.fees.toFixed(2)}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 border-l border-border pl-6 flex-shrink-0">
          <div>
            <p className="text-xs text-muted-foreground text-right">Total Estimate</p>
            <p className="text-2xl font-bold text-foreground">${totals.total.toFixed(2)}</p>
          </div>
        </div>
      </div>
    </Card>
  )
}
