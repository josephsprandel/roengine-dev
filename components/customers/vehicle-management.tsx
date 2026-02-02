"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Clock, Loader2, Edit2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/contexts/auth-context"
import { VehicleCreateDialog } from "./vehicle-create-dialog"
import { VehicleEditDialog } from "./vehicle-edit-dialog"

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
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export function VehicleManagement({ customerId }: { customerId: string }) {
  const { hasPermission } = useAuth()
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null)

  const handleVehicleClick = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle)
    setEditDialogOpen(true)
  }

  const handleVehicleUpdated = (updatedVehicle: Vehicle) => {
    setVehicles((prev) =>
      prev.map((v) => (v.id === updatedVehicle.id ? updatedVehicle : v))
    )
    toast.success("Vehicle updated successfully")
  }

  const fetchVehicles = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/vehicles?customer_id=${customerId}`)
      if (!response.ok) {
        throw new Error("Failed to fetch vehicles")
      }

      const data = await response.json()
      setVehicles(data.vehicles)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchVehicles()
  }, [customerId])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Vehicles</h2>
        <Button size="sm" className="gap-2" onClick={() => setCreateDialogOpen(true)}>
          <Plus size={16} />
          Add Vehicle
        </Button>
      </div>

      <div className="space-y-3">
        {loading ? (
          <Card className="p-8 border-border text-center">
            <Loader2 className="mx-auto text-muted-foreground mb-2 animate-spin" size={24} />
            <p className="text-sm text-muted-foreground">Loading vehicles...</p>
          </Card>
        ) : error ? (
          <Card className="p-8 border-border text-center">
            <p className="text-destructive mb-2">Error loading vehicles</p>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button onClick={fetchVehicles} variant="outline" size="sm">
              Try Again
            </Button>
          </Card>
        ) : vehicles.length > 0 ? (
          vehicles.map((vehicle) => (
            <Card
              key={vehicle.id}
              className="p-4 border-border cursor-pointer hover:bg-muted/50 transition-colors group relative"
              onClick={() => handleVehicleClick(vehicle)}
            >
              {/* Actions on hover */}
              <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {hasPermission('delete_vehicle') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-red-600 hover:text-red-800 hover:bg-red-50"
                    onClick={async (e) => {
                      e.stopPropagation()
                      if (!confirm(`Delete ${vehicle.year} ${vehicle.make} ${vehicle.model}? It can be restored from the recycle bin.`)) return
                      
                      const res = await fetch(`/api/vehicles/${vehicle.id}/delete`, {
                        method: 'DELETE',
                        headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` }
                      })
                      
                      if (res.ok) {
                        toast.success('Vehicle deleted')
                        fetchVehicles()
                      } else {
                        const error = await res.json()
                        toast.error(error.error || 'Failed to delete')
                      }
                    }}
                  >
                    <Trash2 size={16} />
                  </Button>
                )}
                <Edit2 size={16} className="text-muted-foreground" />
              </div>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-foreground">
                      {vehicle.year} {vehicle.make} {vehicle.model}
                      {vehicle.submodel && ` ${vehicle.submodel}`}
                    </h3>
                    <Badge
                      variant="outline"
                      className="text-xs bg-green-500/10 text-green-700 dark:text-green-400"
                    >
                      Active
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mb-3">
                    <div>
                      <p className="font-medium">VIN</p>
                      <p className="font-mono">{vehicle.vin}</p>
                    </div>
                    {vehicle.license_plate && (
                      <div>
                        <p className="font-medium">License Plate</p>
                        <p className="font-mono">
                          {vehicle.license_plate}
                          {vehicle.license_plate_state && ` (${vehicle.license_plate_state})`}
                        </p>
                      </div>
                    )}
                    {vehicle.mileage && (
                      <div>
                        <p className="font-medium">Current Mileage</p>
                        <p>{vehicle.mileage.toLocaleString()} mi</p>
                      </div>
                    )}
                    {vehicle.color && (
                      <div>
                        <p className="font-medium">Color</p>
                        <p>{vehicle.color}</p>
                      </div>
                    )}
                  </div>

                  {(vehicle.engine || vehicle.transmission) && (
                    <div className="text-xs text-muted-foreground mb-2">
                      {vehicle.engine && <span>Engine: {vehicle.engine}</span>}
                      {vehicle.engine && vehicle.transmission && <span> • </span>}
                      {vehicle.transmission && <span>Trans: {vehicle.transmission}</span>}
                    </div>
                  )}

                  <div className="flex gap-4 text-sm flex-wrap">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock size={14} />
                      Added: {new Date(vehicle.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))
        ) : (
          <Card className="p-8 border-border text-center">
            <p className="text-muted-foreground mb-4">No vehicles found for this customer</p>
            <Button onClick={() => setCreateDialogOpen(true)} variant="outline" size="sm">
              <Plus size={16} className="mr-2" />
              Add First Vehicle
            </Button>
          </Card>
        )}
      </div>

      {/* Create Dialog */}
      <VehicleCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={fetchVehicles}
        customerId={customerId}
      />

      {/* Edit Dialog */}
      <VehicleEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        vehicle={selectedVehicle}
        onSuccess={handleVehicleUpdated}
      />
    </div>
  )
}
