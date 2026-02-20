"use client"

import { useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { User, Car, Wrench, Clock, DollarSign, FileText, Phone, Mail } from "lucide-react"
import { formatPhoneNumber } from "@/lib/utils/phone-format"
import type { CustomerData, VehicleData, ServiceData } from "../ro-creation-wizard"

interface ReviewStepProps {
  customerData: CustomerData | null
  vehicleData: VehicleData | null
  selectedServices: ServiceData[]
  notes: string
  onNotesChange: (notes: string) => void
}

export function ReviewStep({
  customerData,
  vehicleData,
  selectedServices,
  notes,
  onNotesChange,
}: ReviewStepProps) {
  const totals = useMemo(() => {
    const initial = { parts: 0, labor: 0, sublets: 0, hazmat: 0, fees: 0, total: 0 }
    return selectedServices.reduce((acc, svc) => {
      const partsSum = svc.parts.reduce((sum, item) => sum + item.total, 0)
      const laborSum = svc.labor.reduce((sum, item) => sum + item.total, 0)
      const subletsSum = svc.sublets.reduce((sum, item) => sum + item.total, 0)
      const hazmatSum = svc.hazmat.reduce((sum, item) => sum + item.total, 0)
      const feesSum = svc.fees.reduce((sum, item) => sum + item.total, 0)
      return {
        parts: acc.parts + partsSum,
        labor: acc.labor + laborSum,
        sublets: acc.sublets + subletsSum,
        hazmat: acc.hazmat + hazmatSum,
        fees: acc.fees + feesSum,
        total: acc.total + partsSum + laborSum + subletsSum + hazmatSum + feesSum,
      }
    }, initial)
  }, [selectedServices])

  const totalEstimate = totals.total

  const totalTime = useMemo(() => {
    let totalMinutes = 0
    selectedServices.forEach((svc) => {
      const time = svc.estimatedTime.toLowerCase()
      if (time.includes("hr")) {
        const hours = parseFloat(time)
        totalMinutes += hours * 60
      } else if (time.includes("min")) {
        totalMinutes += parseFloat(time)
      }
    })
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    if (hours > 0 && minutes > 0) return `${hours} hr ${minutes} min`
    if (hours > 0) return `${hours} hr`
    return `${minutes} min`
  }, [selectedServices])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-1">Review Repair Order</h2>
        <p className="text-sm text-muted-foreground">
          Review all details before creating the repair order
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Customer */}
          <Card className="p-5 border-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <User size={16} className="text-primary" />
              </div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground">Customer</h3>
                {customerData?.isNew && (
                  <Badge variant="secondary" className="text-xs">New</Badge>
                )}
              </div>
            </div>
            {customerData && (
              <div className="space-y-2">
                <p className="text-lg font-medium text-foreground">{customerData.name}</p>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Phone size={14} />
                    {formatPhoneNumber(customerData.phone)}
                  </span>
                  {customerData.email && (
                    <span className="flex items-center gap-1">
                      <Mail size={14} />
                      {customerData.email}
                    </span>
                  )}
                </div>
              </div>
            )}
          </Card>

          {/* Vehicle */}
          <Card className="p-5 border-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Car size={16} className="text-primary" />
              </div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground">Vehicle</h3>
                {vehicleData?.isNew && (
                  <Badge variant="secondary" className="text-xs">New</Badge>
                )}
              </div>
            </div>
            {vehicleData && (
              <div className="space-y-3">
                <p className="text-lg font-medium text-foreground">
                  {vehicleData.year} {vehicleData.make} {vehicleData.model}
                  {vehicleData.trim && ` ${vehicleData.trim}`}
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">VIN</p>
                    <p className="font-mono text-foreground">{vehicleData.vin}</p>
                  </div>
                  {vehicleData.licensePlate && (
                    <div>
                      <p className="text-muted-foreground">License Plate</p>
                      <p className="font-medium text-foreground">{vehicleData.licensePlate}</p>
                    </div>
                  )}
                  {vehicleData.color && (
                    <div>
                      <p className="text-muted-foreground">Color</p>
                      <p className="font-medium text-foreground">{vehicleData.color}</p>
                    </div>
                  )}
                  {vehicleData.mileage && (
                    <div>
                      <p className="text-muted-foreground">Mileage</p>
                      <p className="font-medium text-foreground">{vehicleData.mileage}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>

          {/* Services */}
          <Card className="p-5 border-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Wrench size={16} className="text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">
                Services ({selectedServices.length})
              </h3>
            </div>
            <div className="space-y-2">
              {selectedServices.map((service) => (
                <div
                  key={service.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border"
                >
                  <div>
                    <p className="font-medium text-foreground">{service.name}</p>
                    <p className="text-sm text-muted-foreground">{service.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-foreground">${service.estimatedCost.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">{service.estimatedTime}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Notes */}
          <Card className="p-5 border-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <FileText size={16} className="text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">Additional Notes</h3>
            </div>
            <Textarea
              placeholder="Add any additional notes, customer concerns, or special instructions..."
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              className="min-h-[100px] bg-card border-border resize-none"
            />
          </Card>
        </div>

        {/* Summary Sidebar */}
        <div className="space-y-4">
          <Card className="p-5 border-border sticky top-4">
            <h3 className="font-semibold text-foreground mb-4">Order Summary</h3>
            
            <div className="space-y-4">
              {/* Estimate */}
              <div className="p-4 rounded-lg bg-muted/30 border border-border">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <DollarSign size={16} />
                  <span className="text-sm">Estimated Total</span>
                </div>
                <p className="text-3xl font-bold text-foreground">${totalEstimate.toFixed(2)}</p>
              </div>

              {/* Time */}
              <div className="p-4 rounded-lg bg-muted/30 border border-border">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Clock size={16} />
                  <span className="text-sm">Estimated Time</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{totalTime}</p>
              </div>

              {/* Breakdown */}
              <div className="pt-4 border-t border-border">
                <p className="text-sm font-medium text-muted-foreground mb-3">Cost Breakdown</p>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Parts</span>
                    <span className="font-medium text-foreground">${totals.parts.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Labor</span>
                    <span className="font-medium text-foreground">${totals.labor.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Sublets</span>
                    <span className="font-medium text-foreground">${totals.sublets.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Hazmat</span>
                    <span className="font-medium text-foreground">${totals.hazmat.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Fees</span>
                    <span className="font-medium text-foreground">${totals.fees.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm pt-2 border-t border-border">
                    <span className="font-medium text-foreground">Total</span>
                    <span className="font-bold text-foreground">${totalEstimate.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
