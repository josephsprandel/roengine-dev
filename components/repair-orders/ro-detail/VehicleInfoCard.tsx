import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Edit2, Car } from "lucide-react"

interface VehicleInfoCardProps {
  year: number
  make: string
  model: string
  vin: string
  manufactureDate?: string | null
  engine?: string | null
  licensePlate?: string | null
  color?: string | null
  mileage?: number | null
  onEdit: () => void
}

export function VehicleInfoCard({
  year,
  make,
  model,
  vin,
  manufactureDate,
  engine,
  licensePlate,
  color,
  mileage,
  onEdit,
}: VehicleInfoCardProps) {
  return (
    <Card className="p-6 border-border">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white flex-shrink-0">
            <Car size={24} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {year} {make} {model}
            </h2>
            <p className="text-xs text-muted-foreground">Vehicle Information</p>
          </div>
        </div>
        <Button size="sm" variant="ghost" onClick={onEdit} className="gap-2">
          <Edit2 size={14} />
        </Button>
      </div>

      <div className="space-y-2.5">
        {/* Row 1: VIN and Prod. Date */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">VIN:</p>
            <p className="text-sm font-medium text-foreground font-mono leading-tight">{vin}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Prod. Date:</p>
            <p className="text-sm font-medium text-foreground leading-tight">
              {manufactureDate 
                ? (() => {
                    // Parse YYYY-MM format manually to avoid timezone issues
                    const [year, month] = manufactureDate.split('-')
                    return `${parseInt(month)}/${year}`
                  })()
                : '—'
              }
            </p>
          </div>
        </div>

        {/* Row 2: Engine */}
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Engine:</p>
          <p className="text-sm font-medium text-foreground leading-tight">{engine || '—'}</p>
        </div>

        {/* Row 3: Plate and Color */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Plate:</p>
            <p className="text-sm font-medium text-foreground leading-tight">
              {licensePlate || '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Color:</p>
            <p className="text-sm font-medium text-foreground leading-tight">{color || '—'}</p>
          </div>
        </div>

        {/* Row 4: Odometer In and Out */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Odometer In:</p>
            <p className="text-sm font-medium text-foreground leading-tight">
              {mileage ? mileage.toLocaleString() : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Out:</p>
            <p className="text-sm font-medium text-foreground leading-tight">—</p>
          </div>
        </div>
      </div>
    </Card>
  )
}
