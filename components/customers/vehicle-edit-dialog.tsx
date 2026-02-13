"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2 } from "lucide-react"

interface Vehicle {
  id: string
  customer_id: string
  vin: string
  year: number
  make: string
  model: string
  submodel: string | null
  engine: string | null
  transmission: string | null
  color: string | null
  license_plate: string | null
  license_plate_state: string | null
  mileage: number | null
  manufacture_date: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

interface VehicleEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  vehicle?: Vehicle | null       // If provided, dialog is in edit mode
  customerId?: string            // Required for create mode
  onSuccess: (vehicle?: Vehicle) => void
}

export function VehicleEditDialog({ open, onOpenChange, vehicle, customerId, onSuccess }: VehicleEditDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEditMode = !!vehicle

  const getInitialFormData = () => {
    if (vehicle) {
      return {
        vin: vehicle.vin || "",
        year: vehicle.year?.toString() || "",
        make: vehicle.make || "",
        model: vehicle.model || "",
        submodel: vehicle.submodel || "",
        engine: vehicle.engine || "",
        transmission: vehicle.transmission || "",
        color: vehicle.color || "",
        license_plate: vehicle.license_plate || "",
        license_plate_state: vehicle.license_plate_state || "",
        mileage: vehicle.mileage?.toString() || "",
        manufacture_date: vehicle.manufacture_date || "",
        notes: vehicle.notes || "",
      }
    }
    return {
      vin: "",
      year: new Date().getFullYear().toString(),
      make: "",
      model: "",
      submodel: "",
      engine: "",
      transmission: "",
      color: "",
      license_plate: "",
      license_plate_state: "",
      mileage: "",
      manufacture_date: "",
      notes: "",
    }
  }

  const [formData, setFormData] = useState(getInitialFormData())

  // Reset form when vehicle changes
  useEffect(() => {
    setFormData(getInitialFormData())
    setError(null)
  }, [vehicle])

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate required fields
    if (!formData.vin.trim() || !formData.year.trim() || !formData.make.trim() || !formData.model.trim()) {
      setError("VIN, Year, Make, and Model are required")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const payload = {
        ...(isEditMode ? {} : { customer_id: customerId }),
        vin: formData.vin.toUpperCase().trim(),
        year: parseInt(formData.year),
        make: formData.make.trim(),
        model: formData.model.trim(),
        submodel: formData.submodel.trim() || null,
        engine: formData.engine.trim() || null,
        transmission: formData.transmission.trim() || null,
        color: formData.color.trim() || null,
        license_plate: formData.license_plate.trim() || null,
        license_plate_state: formData.license_plate_state.toUpperCase().trim() || null,
        mileage: formData.mileage ? parseInt(formData.mileage) : null,
        manufacture_date: formData.manufacture_date.trim() || null,
        notes: formData.notes.trim() || null,
      }

      const url = isEditMode ? `/api/vehicles/${vehicle.id}` : "/api/vehicles"
      const method = isEditMode ? "PATCH" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Failed to ${isEditMode ? 'update' : 'create'} vehicle`)
      }

      const data = await response.json()
      onSuccess(data.vehicle)
      onOpenChange(false)

      // Reset form only in create mode
      if (!isEditMode) {
        setFormData({
          vin: "",
          year: new Date().getFullYear().toString(),
          make: "",
          model: "",
          submodel: "",
          engine: "",
          transmission: "",
          color: "",
          license_plate: "",
          license_plate_state: "",
          mileage: "",
          manufacture_date: "",
          notes: "",
        })
      }
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
          <DialogTitle>{isEditMode ? 'Edit Vehicle' : 'Add New Vehicle'}</DialogTitle>
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
                onChange={(e) => handleChange("vin", e.target.value.toUpperCase())}
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
                  onChange={(e) => handleChange("year", e.target.value)}
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
                  onChange={(e) => handleChange("make", e.target.value)}
                  placeholder="Honda"
                  required
                />
              </div>

              <div>
                <Label htmlFor="model">Model *</Label>
                <Input
                  id="model"
                  value={formData.model}
                  onChange={(e) => handleChange("model", e.target.value)}
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
                  onChange={(e) => handleChange("submodel", e.target.value)}
                  placeholder="EX, LX, Sport, etc."
                />
              </div>

              <div>
                <Label htmlFor="color">Color</Label>
                <Input
                  id="color"
                  value={formData.color}
                  onChange={(e) => handleChange("color", e.target.value)}
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
                  onChange={(e) => handleChange("engine", e.target.value)}
                  placeholder="2.0L 4-Cyl"
                />
              </div>

              <div>
                <Label htmlFor="transmission">Transmission</Label>
                <Input
                  id="transmission"
                  value={formData.transmission}
                  onChange={(e) => handleChange("transmission", e.target.value)}
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
                  onChange={(e) => handleChange("license_plate", e.target.value.toUpperCase())}
                  placeholder="ABC-1234"
                  className="font-mono"
                />
              </div>

              <div>
                <Label htmlFor="license_plate_state">State</Label>
                <Input
                  id="license_plate_state"
                  value={formData.license_plate_state}
                  onChange={(e) => handleChange("license_plate_state", e.target.value.toUpperCase())}
                  placeholder="AR"
                  maxLength={2}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="mileage">Current Mileage</Label>
                <Input
                  id="mileage"
                  type="number"
                  value={formData.mileage}
                  onChange={(e) => handleChange("mileage", e.target.value)}
                  placeholder="50000"
                  min={0}
                />
              </div>

              <div>
                <Label htmlFor="manufacture_date">Production Date</Label>
                <Input
                  id="manufacture_date"
                  type="month"
                  value={formData.manufacture_date}
                  onChange={(e) => handleChange("manufacture_date", e.target.value)}
                  placeholder="YYYY-MM"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
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
              {isEditMode ? 'Save Changes' : 'Add Vehicle'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
