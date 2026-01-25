"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Check, ChevronRight, User, Car, Wrench, FileText, Loader2 } from "lucide-react"
import { CustomerSelectionStep } from "./steps/customer-selection-step"
import { VehicleSelectionStep } from "./steps/vehicle-selection-step"
import { ServicesStep } from "./steps/services-step"
import { ReviewStep } from "./steps/review-step"

const steps = [
  { id: 1, name: "Customer", icon: User },
  { id: 2, name: "Vehicle", icon: Car },
  { id: 3, name: "Services", icon: Wrench },
  { id: 4, name: "Review", icon: FileText },
]

export interface CustomerData {
  id?: string
  name: string
  phone: string
  email: string
  isNew?: boolean
}

export interface VehicleData {
  id?: string
  year: string
  make: string
  model: string
  trim?: string
  vin: string
  licensePlate: string
  color: string
  mileage: string
  isNew?: boolean
}

export interface LineItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
  total: number
}

export interface ServiceData {
  id: string
  name: string
  description: string
  estimatedCost: number
  estimatedTime: string
  category: string
  status?: "pending" | "in_progress" | "completed"
  technician?: string
  parts: LineItem[]
  labor: LineItem[]
  sublets: LineItem[]
  hazmat: LineItem[]
  fees: LineItem[]
}

export function ROCreationWizard() {
  const [currentStep, setCurrentStep] = useState(1)
  const [customerData, setCustomerData] = useState<CustomerData | null>(null)
  const [vehicleData, setVehicleData] = useState<VehicleData | null>(null)
  const [selectedServices, setSelectedServices] = useState<ServiceData[]>([])
  const [notes, setNotes] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const router = useRouter()

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return customerData !== null
      case 2:
        return vehicleData !== null
      case 3:
        return selectedServices.length > 0
      case 4:
        return true
      default:
        return false
    }
  }

  const handleNext = () => {
    if (currentStep < 4 && canProceed()) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleCreateRO = async () => {
    if (!customerData || !vehicleData) {
      alert("Customer and vehicle data are required")
      return
    }

    setIsCreating(true)
    
    try {
      console.log("[RO Wizard] Creating RO...", { customerData, vehicleData, selectedServices })

      // Step 1: Create customer if new
      let customerId = customerData.id
      if (customerData.isNew) {
        console.log("[RO Wizard] Creating new customer...")
        const customerResponse = await fetch('/v0/api/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customer_name: customerData.name,
            phone_primary: customerData.phone,
            email: customerData.email || null,
            customer_type: 'individual'
          })
        })

        if (!customerResponse.ok) {
          throw new Error('Failed to create customer')
        }

        const customerResult = await customerResponse.json()
        customerId = customerResult.customer.id
        console.log("[RO Wizard] Customer created:", customerId)
      }

      // Step 2: Create vehicle if new
      let vehicleId = vehicleData.id
      if (vehicleData.isNew) {
        console.log("[RO Wizard] Creating new vehicle...")
        const vehicleResponse = await fetch('/v0/api/vehicles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customer_id: customerId,
            year: vehicleData.year,
            make: vehicleData.make,
            model: vehicleData.model,
            trim: vehicleData.trim || null,
            vin: vehicleData.vin,
            license_plate: vehicleData.licensePlate || null,
            color: vehicleData.color || null,
            odometer: vehicleData.mileage ? parseInt(vehicleData.mileage.replace(/,/g, '')) : null
          })
        })

        if (!vehicleResponse.ok) {
          throw new Error('Failed to create vehicle')
        }

        const vehicleResult = await vehicleResponse.json()
        vehicleId = vehicleResult.vehicle.id
        console.log("[RO Wizard] Vehicle created:", vehicleId)
      }

      // Step 3: Create work order
      console.log("[RO Wizard] Creating work order...")
      const woResponse = await fetch('/v0/api/work-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: customerId,
          vehicle_id: vehicleId,
          state: 'estimate',
          date_opened: new Date().toISOString().slice(0, 10),
          customer_concern: notes || null,
          label: selectedServices.length > 0 ? selectedServices[0].name : null
        })
      })

      if (!woResponse.ok) {
        throw new Error('Failed to create work order')
      }

      const woResult = await woResponse.json()
      console.log("[RO Wizard] Work order created:", woResult.work_order.ro_number)

      // Success! Navigate to the new RO
      alert(`✅ Repair Order ${woResult.work_order.ro_number} created successfully!`)
      router.push(`/repair-orders/${woResult.work_order.id}`)

    } catch (error: any) {
      console.error("[RO Wizard] Error:", error)
      alert(`Failed to create repair order: ${error.message}`)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Create Repair Order</h1>
        <p className="text-muted-foreground mt-1">Fill in the details to create a new repair order</p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const Icon = step.icon
          const isCompleted = currentStep > step.id
          const isCurrent = currentStep === step.id
          
          return (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    isCompleted
                      ? "bg-green-500 text-white"
                      : isCurrent
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isCompleted ? <Check size={20} /> : <Icon size={20} />}
                </div>
                <div className="hidden sm:block">
                  <p className={`text-sm font-medium ${isCurrent ? "text-foreground" : "text-muted-foreground"}`}>
                    {step.name}
                  </p>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div className="flex-1 mx-4">
                  <div className={`h-0.5 ${isCompleted ? "bg-green-500" : "bg-border"}`} />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Step Content */}
      <Card className="p-6 border-border min-h-[500px]">
        {currentStep === 1 && (
          <CustomerSelectionStep
            selectedCustomer={customerData}
            onSelectCustomer={setCustomerData}
          />
        )}
        {currentStep === 2 && (
          <VehicleSelectionStep
            customerId={customerData?.id}
            selectedVehicle={vehicleData}
            onSelectVehicle={setVehicleData}
          />
        )}
        {currentStep === 3 && (
          <ServicesStep
            selectedServices={selectedServices}
            onUpdateServices={setSelectedServices}
            vehicleData={vehicleData}
          />
        )}
        {currentStep === 4 && (
          <ReviewStep
            customerData={customerData}
            vehicleData={vehicleData}
            selectedServices={selectedServices}
            notes={notes}
            onNotesChange={setNotes}
          />
        )}
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={currentStep === 1}
          className="bg-transparent"
        >
          Back
        </Button>
        
        <div className="flex items-center gap-3">
          {currentStep < 4 ? (
            <Button onClick={handleNext} disabled={!canProceed()} className="gap-2">
              Continue
              <ChevronRight size={16} />
            </Button>
          ) : (
            <Button 
              onClick={handleCreateRO} 
              disabled={isCreating}
              className="gap-2"
            >
              {isCreating ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  Create Repair Order
                  <Check size={16} />
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
