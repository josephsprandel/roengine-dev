"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Search, Phone, Mail, Plus, Loader2, ChevronRight, ChevronLeft, Check } from "lucide-react"
import { CustomerCreateDialog } from "@/components/customers/customer-create-dialog"
import { VehicleEditDialog } from "@/components/customers/vehicle-edit-dialog"

interface Customer {
  id: string
  customer_name: string
  phone_primary: string
  email: string | null
}

interface Vehicle {
  id: string
  year: number
  make: string
  model: string
  submodel: string | null
  vin: string
  license_plate: string | null
  mileage: number | null
}

interface WorkOrderCreateWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (roNumber: string) => void
}

export function WorkOrderCreateWizard({ open, onOpenChange, onSuccess }: WorkOrderCreateWizardProps) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 1: Customer Selection
  const [customerSearch, setCustomerSearch] = useState("")
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loadingCustomers, setLoadingCustomers] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [showCustomerDialog, setShowCustomerDialog] = useState(false)

  // Step 2: Vehicle Selection
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loadingVehicles, setLoadingVehicles] = useState(false)
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null)
  const [showVehicleDialog, setShowVehicleDialog] = useState(false)

  // Step 3: RO Details
  const [roDetails, setRoDetails] = useState({
    customer_concern: "",
    date_promised: "",
    notes: "",
  })

  // Fetch customers with search
  useEffect(() => {
    if (step !== 1) return

    const debounce = setTimeout(async () => {
      setLoadingCustomers(true)
      try {
        const params = new URLSearchParams({ limit: "20" })
        if (customerSearch) params.set("search", customerSearch)

        const response = await fetch(`/api/customers?${params}`)
        const data = await response.json()
        setCustomers(data.customers || [])
      } catch (err) {
        console.error("Error fetching customers:", err)
      } finally {
        setLoadingCustomers(false)
      }
    }, 300)

    return () => clearTimeout(debounce)
  }, [customerSearch, step])

  // Fetch vehicles when customer selected
  useEffect(() => {
    if (step !== 2 || !selectedCustomer) return

    const fetchVehicles = async () => {
      setLoadingVehicles(true)
      try {
        const response = await fetch(`/api/vehicles?customer_id=${selectedCustomer.id}`)
        const data = await response.json()
        setVehicles(data.vehicles || [])
      } catch (err) {
        console.error("Error fetching vehicles:", err)
      } finally {
        setLoadingVehicles(false)
      }
    }

    fetchVehicles()
  }, [selectedCustomer, step])

  const handleCustomerCreated = () => {
    // Refresh customer list
    setCustomerSearch("")
  }

  const handleVehicleCreated = () => {
    // Refresh vehicle list
    if (selectedCustomer) {
      fetch(`/api/vehicles?customer_id=${selectedCustomer.id}`)
        .then(res => res.json())
        .then(data => setVehicles(data.vehicles || []))
    }
  }

  const handleNext = () => {
    if (step === 1 && selectedCustomer) {
      setStep(2)
      setError(null)
    } else if (step === 2 && selectedVehicle) {
      setStep(3)
      setError(null)
    }
  }

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1)
      setError(null)
    }
  }

  const handleSubmit = async () => {
    if (!selectedCustomer || !selectedVehicle) return

    setLoading(true)
    setError(null)

    try {
      const payload = {
        customer_id: selectedCustomer.id,
        vehicle_id: selectedVehicle.id,
        customer_concern: roDetails.customer_concern || null,
        date_promised: roDetails.date_promised || null,
        notes: roDetails.notes || null,
      }

      const response = await fetch("/api/work-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to create work order")
      }

      // Success!
      onSuccess(data.work_order.ro_number)
      onOpenChange(false)
      
      // Reset wizard
      setStep(1)
      setSelectedCustomer(null)
      setSelectedVehicle(null)
      setRoDetails({ customer_concern: "", date_promised: "", notes: "" })
      setCustomerSearch("")
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const resetAndClose = () => {
    setStep(1)
    setSelectedCustomer(null)
    setSelectedVehicle(null)
    setRoDetails({ customer_concern: "", date_promised: "", notes: "" })
    setCustomerSearch("")
    setError(null)
    onOpenChange(false)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={resetAndClose}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Repair Order</DialogTitle>
            <div className="flex items-center gap-2 mt-2">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <div
                    className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                      step > s
                        ? "bg-green-500 text-white"
                        : step === s
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {step > s ? <Check size={16} /> : s}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {s === 1 ? "Customer" : s === 2 ? "Vehicle" : "Details"}
                  </span>
                  {s < 3 && <ChevronRight size={16} className="text-muted-foreground" />}
                </div>
              ))}
            </div>
          </DialogHeader>

          <div className="space-y-6">
            {error && (
              <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Step 1: Customer Selection */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={18} />
                    <Input
                      placeholder="Search customers by name, phone, or email..."
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Button onClick={() => setShowCustomerDialog(true)} variant="outline">
                    <Plus size={16} className="mr-2" />
                    New Customer
                  </Button>
                </div>

                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {loadingCustomers ? (
                    <Card className="p-8 text-center">
                      <Loader2 className="mx-auto animate-spin mb-2" size={24} />
                      <p className="text-sm text-muted-foreground">Loading customers...</p>
                    </Card>
                  ) : customers.length > 0 ? (
                    customers.map((customer) => (
                      <Card
                        key={customer.id}
                        className={`p-4 cursor-pointer transition-colors ${
                          selectedCustomer?.id === customer.id
                            ? "border-primary bg-primary/5"
                            : "hover:bg-muted/30"
                        }`}
                        onClick={() => setSelectedCustomer(customer)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-semibold">{customer.customer_name}</h4>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                              <span className="flex items-center gap-1">
                                <Phone size={14} />
                                {customer.phone_primary}
                              </span>
                              {customer.email && (
                                <span className="flex items-center gap-1">
                                  <Mail size={14} />
                                  {customer.email}
                                </span>
                              )}
                            </div>
                          </div>
                          {selectedCustomer?.id === customer.id && (
                            <Badge className="bg-primary">Selected</Badge>
                          )}
                        </div>
                      </Card>
                    ))
                  ) : (
                    <Card className="p-8 text-center">
                      <p className="text-muted-foreground">No customers found</p>
                    </Card>
                  )}
                </div>
              </div>
            )}

            {/* Step 2: Vehicle Selection */}
            {step === 2 && selectedCustomer && (
              <div className="space-y-4">
                <Card className="p-4 bg-muted/30">
                  <p className="text-sm text-muted-foreground mb-1">Selected Customer</p>
                  <p className="font-semibold">{selectedCustomer.customer_name}</p>
                  <p className="text-sm text-muted-foreground">{selectedCustomer.phone_primary}</p>
                </Card>

                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Select Vehicle</h3>
                  <Button onClick={() => setShowVehicleDialog(true)} variant="outline" size="sm">
                    <Plus size={16} className="mr-2" />
                    Add Vehicle
                  </Button>
                </div>

                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {loadingVehicles ? (
                    <Card className="p-8 text-center">
                      <Loader2 className="mx-auto animate-spin mb-2" size={24} />
                      <p className="text-sm text-muted-foreground">Loading vehicles...</p>
                    </Card>
                  ) : vehicles.length > 0 ? (
                    vehicles.map((vehicle) => (
                      <Card
                        key={vehicle.id}
                        className={`p-4 cursor-pointer transition-colors ${
                          selectedVehicle?.id === vehicle.id
                            ? "border-primary bg-primary/5"
                            : "hover:bg-muted/30"
                        }`}
                        onClick={() => setSelectedVehicle(vehicle)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-semibold">
                              {vehicle.year} {vehicle.make} {vehicle.model}
                              {vehicle.submodel && ` ${vehicle.submodel}`}
                            </h4>
                            <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                              <p className="font-mono">VIN: {vehicle.vin}</p>
                              {vehicle.license_plate && <p>License: {vehicle.license_plate}</p>}
                              {vehicle.mileage && <p>Mileage: {vehicle.mileage.toLocaleString()} mi</p>}
                            </div>
                          </div>
                          {selectedVehicle?.id === vehicle.id && (
                            <Badge className="bg-primary">Selected</Badge>
                          )}
                        </div>
                      </Card>
                    ))
                  ) : (
                    <Card className="p-8 text-center">
                      <p className="text-muted-foreground mb-4">No vehicles found for this customer</p>
                      <Button onClick={() => setShowVehicleDialog(true)} variant="outline" size="sm">
                        <Plus size={16} className="mr-2" />
                        Add First Vehicle
                      </Button>
                    </Card>
                  )}
                </div>
              </div>
            )}

            {/* Step 3: RO Details */}
            {step === 3 && selectedCustomer && selectedVehicle && (
              <div className="space-y-4">
                <Card className="p-4 bg-muted/30 space-y-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Customer</p>
                    <p className="font-semibold">{selectedCustomer.customer_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Vehicle</p>
                    <p className="font-semibold">
                      {selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono">{selectedVehicle.vin}</p>
                  </div>
                </Card>

                <div>
                  <Label htmlFor="customer_concern">Customer Concern</Label>
                  <Textarea
                    id="customer_concern"
                    value={roDetails.customer_concern}
                    onChange={(e) => setRoDetails({ ...roDetails, customer_concern: e.target.value })}
                    placeholder="Describe the customer's concerns or reason for visit..."
                    rows={4}
                  />
                </div>

                <div>
                  <Label htmlFor="date_promised">Date Promised</Label>
                  <Input
                    id="date_promised"
                    type="date"
                    value={roDetails.date_promised}
                    onChange={(e) => setRoDetails({ ...roDetails, date_promised: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="notes">Additional Notes</Label>
                  <Textarea
                    id="notes"
                    value={roDetails.notes}
                    onChange={(e) => setRoDetails({ ...roDetails, notes: e.target.value })}
                    placeholder="Any additional information..."
                    rows={3}
                  />
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between pt-4 border-t">
              <Button
                variant="outline"
                onClick={step === 1 ? resetAndClose : handleBack}
                disabled={loading}
              >
                {step === 1 ? "Cancel" : <><ChevronLeft size={16} className="mr-2" /> Back</>}
              </Button>

              {step < 3 ? (
                <Button
                  onClick={handleNext}
                  disabled={(step === 1 && !selectedCustomer) || (step === 2 && !selectedVehicle)}
                >
                  Next <ChevronRight size={16} className="ml-2" />
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Repair Order
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sub-dialogs */}
      <CustomerCreateDialog
        open={showCustomerDialog}
        onOpenChange={setShowCustomerDialog}
        onSuccess={handleCustomerCreated}
      />

      {selectedCustomer && (
        <VehicleEditDialog
          open={showVehicleDialog}
          onOpenChange={setShowVehicleDialog}
          onSuccess={handleVehicleCreated}
          customerId={selectedCustomer.id}
        />
      )}
    </>
  )
}
