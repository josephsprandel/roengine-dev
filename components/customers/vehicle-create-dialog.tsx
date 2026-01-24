"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2 } from "lucide-react"

interface VehicleCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  customerId: string
}

export function VehicleCreateDialog({ open, onOpenChange, onSuccess, customerId }: VehicleCreateDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    vin: "",
    year: new Date().getFullYear(),
    make: "",
    model: "",
    submodel: "",
    engine: "",
    transmission: "",
    color: "",
    license_plate: "",
    license_plate_state: "",
    mileage: "",
    notes: "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const payload = {
        customer_id: customerId,
        vin: formData.vin.toUpperCase(),
        year: parseInt(formData.year.toString()),
        make: formData.make,
        model: formData.model,
        submodel: formData.submodel || null,
        engine: formData.engine || null,
        transmission: formData.transmission || null,
        color: formData.color || null,
        license_plate: formData.license_plate || null,
        license_plate_state: formData.license_plate_state.toUpperCase() || null,
        mileage: formData.mileage ? parseInt(formData.mileage) : null,
        notes: formData.notes || null,
      }

      const response = await fetch("/v0/api/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to create vehicle")
      }

      // Success!
      onSuccess()
      onOpenChange(false)
      
      // Reset form
      setFormData({
        vin: "",
        year: new Date().getFullYear(),
        make: "",
        model: "",
        submodel: "",
        engine: "",
        transmission: "",
        color: "",
        license_plate: "",
        license_plate_state: "",
        mileage: "",
        notes: "",
      })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Vehicle</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* VIN & Basic Info */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground">Vehicle Information</h3>
            
            <div>
              <Label htmlFor="vin">VIN (Vehicle Identification Number) *</Label>
              <Input
                id="vin"
                value={formData.vin}
                onChange={(e) => setFormData({ ...formData, vin: e.target.value.toUpperCase() })}
                placeholder="1HGBH41JXMN109186"
                maxLength={17}
                required
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground mt-1">17 characters</p>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="year">Year *</Label>
                <Input
                  id="year"
                  type="number"
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) || new Date().getFullYear() })}
                  min={1900}
                  max={new Date().getFullYear() + 2}
                  required
                />
              </div>

              <div>
                <Label htmlFor="make">Make *</Label>
                <Input
                  id="make"
                  value={formData.make}
                  onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                  placeholder="Honda"
                  required
                />
              </div>

              <div>
                <Label htmlFor="model">Model *</Label>
                <Input
                  id="model"
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  placeholder="Civic"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="submodel">Submodel / Trim</Label>
                <Input
                  id="submodel"
                  value={formData.submodel}
                  onChange={(e) => setFormData({ ...formData, submodel: e.target.value })}
                  placeholder="EX, LX, Sport, etc."
                />
              </div>

              <div>
                <Label htmlFor="color">Color</Label>
                <Input
                  id="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  placeholder="Silver"
                />
              </div>
            </div>
          </div>

          {/* Engine & Transmission */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground">Technical Details</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="engine">Engine</Label>
                <Input
                  id="engine"
                  value={formData.engine}
                  onChange={(e) => setFormData({ ...formData, engine: e.target.value })}
                  placeholder="2.0L 4-Cyl"
                />
              </div>

              <div>
                <Label htmlFor="transmission">Transmission</Label>
                <Input
                  id="transmission"
                  value={formData.transmission}
                  onChange={(e) => setFormData({ ...formData, transmission: e.target.value })}
                  placeholder="Automatic, Manual, CVT"
                />
              </div>
            </div>
          </div>

          {/* License & Mileage */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground">Registration & Mileage</h3>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <Label htmlFor="license_plate">License Plate</Label>
                <Input
                  id="license_plate"
                  value={formData.license_plate}
                  onChange={(e) => setFormData({ ...formData, license_plate: e.target.value.toUpperCase() })}
                  placeholder="ABC-1234"
                  className="font-mono"
                />
              </div>

              <div>
                <Label htmlFor="license_plate_state">State</Label>
                <Input
                  id="license_plate_state"
                  value={formData.license_plate_state}
                  onChange={(e) => setFormData({ ...formData, license_plate_state: e.target.value.toUpperCase() })}
                  placeholder="AR"
                  maxLength={2}
                />
              </div>
            </div>

            <div className="w-1/2">
              <Label htmlFor="mileage">Current Mileage</Label>
              <Input
                id="mileage"
                type="number"
                value={formData.mileage}
                onChange={(e) => setFormData({ ...formData, mileage: e.target.value })}
                placeholder="50000"
                min={0}
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional vehicle information..."
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Vehicle
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
