"use client"

import React from "react"

import { useState, useMemo, useEffect, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  ArrowLeft,
  Edit2,
  Save,
  X,
  Plus,
  Printer,
  MessageSquare,
  Phone,
  Check,
  Clock,
  AlertCircle,
  ChevronRight,
  User,
  Loader2,
  Sparkles,
  CheckCircle,
  FileText,
  Mail,
  MapPin,
  Car,
} from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import type { ServiceData, LineItem } from "./ro-creation-wizard"
import { EditableServiceCard, createLineItem } from "./editable-service-card"
import type { LineItemCategory } from "./editable-service-card"
import { PartsSelectionModal } from "./parts-selection-modal"
import { VehicleEditDialog } from "@/components/customers/vehicle-edit-dialog"
import { useAIRecommendations } from "./hooks/useAIRecommendations"
import { usePartsGeneration } from "./hooks/usePartsGeneration"
import { useServiceManagement } from "./hooks/useServiceManagement"
import { CustomerInfoCard } from "./ro-detail/CustomerInfoCard"
import { VehicleInfoCard } from "./ro-detail/VehicleInfoCard"
import { StatusWorkflow, WorkflowStage } from "./ro-detail/StatusWorkflow"
import { PricingSummary } from "./ro-detail/PricingSummary"
import { ActionButtons } from "./ro-detail/ActionButtons"

// Workflow stages - MOVED OUTSIDE to prevent re-creation on every render
const WORKFLOW_STAGES = [
  {
    id: "intake",
    label: "Intake",
    icon: AlertCircle,
    active: false,
    completed: true,
  },
  {
    id: "diagnostic",
    label: "Diagnostic",
    icon: Clock,
    active: true,
    completed: false,
  },
  {
    id: "approval",
    label: "Approval",
    icon: AlertCircle,
    active: false,
    completed: false,
  },
  {
    id: "service",
    label: "Service",
    icon: Clock,
    active: false,
    completed: false,
  },
  {
    id: "completion",
    label: "Complete",
    icon: Check,
    active: false,
    completed: false,
  },
]

/**
 * Convert database services with items to ServiceData format
 */
function convertDbServicesToServiceData(dbServices: any[]): ServiceData[] {
  return dbServices.map((svc) => {
    const items = svc.items || []

    const parts: LineItem[] = []
    const labor: LineItem[] = []
    const sublets: LineItem[] = []
    const hazmat: LineItem[] = []
    const fees: LineItem[] = []

    items.forEach((item: any) => {
      const lineItem: LineItem = {
        id: `${item.item_type?.[0] || 'i'}${item.id}`,
        description: item.description || '',
        quantity: parseFloat(item.item_type === 'labor' ? item.labor_hours || 0 : item.quantity || 1),
        unitPrice: parseFloat(item.item_type === 'labor' ? item.labor_rate || 160 : item.unit_price || 0), // TODO: Move default labor_rate 160 to shop settings
        total: parseFloat(item.line_total || 0),
      }

      switch (item.item_type) {
        case 'part':
          parts.push(lineItem)
          break
        case 'labor':
          labor.push(lineItem)
          break
        case 'sublet':
          sublets.push(lineItem)
          break
        case 'hazmat':
          hazmat.push(lineItem)
          break
        case 'fee':
          fees.push(lineItem)
          break
        default:
          parts.push(lineItem)
      }
    })

    const totalCost = parts.reduce((s, i) => s + i.total, 0)
      + labor.reduce((s, i) => s + i.total, 0)
      + sublets.reduce((s, i) => s + i.total, 0)
      + hazmat.reduce((s, i) => s + i.total, 0)
      + fees.reduce((s, i) => s + i.total, 0)

    return {
      id: `svc-${svc.id}`,
      name: svc.title || 'Unnamed Service',
      description: svc.description || '',
      estimatedCost: totalCost,
      estimatedTime: svc.labor_hours ? `${svc.labor_hours} hrs` : 'TBD',
      category: svc.category || svc.service_type || 'Service',
      status: svc.status === 'NOT_STARTED' ? 'pending' : svc.status === 'COMPLETED' ? 'completed' : 'in_progress',
      technician: undefined,
      parts,
      labor,
      sublets,
      hazmat,
      fees,
    }
  })
}

interface WorkOrder {
  id: number
  ro_number: string
  customer_id: number
  vehicle_id: number
  state: string
  customer_name: string
  phone_primary: string
  phone_secondary: string | null
  phone_mobile: string | null
  email: string | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  customer_state: string | null
  zip: string | null
  year: number
  make: string
  model: string
  submodel: string | null
  engine: string | null
  transmission: string | null
  color: string | null
  vin: string
  license_plate: string | null
  license_plate_state: string | null
  mileage: number | null
  manufacture_date: string | null
  date_opened: string
  date_promised: string | null
  date_closed: string | null
  customer_concern: string | null
  label: string | null
  needs_attention: boolean
  labor_total: string
  parts_total: string
  sublets_total: string
  tax_amount: string
  total: string
  payment_status: string
  amount_paid: string
  created_at: string
  updated_at: string
}

export function RODetailView({ roId, onClose }: { roId: string; onClose?: () => void }) {
  // ALL HOOKS MUST BE AT THE TOP - BEFORE ANY EARLY RETURNS!
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [statusSaving, setStatusSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null)
  
  // Customer and Vehicle edit states
  const [customerEditOpen, setCustomerEditOpen] = useState(false)
  const [vehicleEditOpen, setVehicleEditOpen] = useState(false)
  const [customerFormData, setCustomerFormData] = useState({
    customer_name: "",
    phone_primary: "",
    phone_secondary: "",
    phone_mobile: "",
    email: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    zip: "",
  })
  
  const handleSave = useCallback(() => {
    setIsEditing(false)
  }, [])

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }, [])

  // Service Management hook - handles services CRUD, drag & drop, expanded state
  const {
    services,
    dragIndex,
    dragOverIndex,
    dragEnabledIndex,
    expandedServices,
    updateService,
    removeService,
    addService,
    reloadServices,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    createDragHandleProps,
    toggleServiceExpanded,
  } = useServiceManagement({
    workOrderId: workOrder?.id,
    convertDbServicesToServiceData,
  })

  // ALL useMemo and useCallback MUST ALSO BE AT THE TOP
  const totals = useMemo(() => {
    const initial = { parts: 0, labor: 0, sublets: 0, hazmat: 0, fees: 0, total: 0 }
    return services.reduce((acc, svc) => {
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
  }, [services])

  // AI Recommendations hook
  const aiRecommendations = useAIRecommendations(workOrder)

  // Parts Generation hook
  const partsGeneration = usePartsGeneration(
    workOrder?.id,
    aiRecommendations.selectedAiServices,
    services.length,
    workOrder ? { year: workOrder.year, make: workOrder.make, model: workOrder.model, vin: workOrder.vin } : null,
    reloadServices,
    showToast
  )

  const updateStatus = useCallback(
    async (nextStatus: string, options?: { successMessage?: string }) => {
      if (!workOrder) return
      const previousStatus = workOrder.state

      setWorkOrder({ ...workOrder, state: nextStatus })
      setStatusSaving(true)

      try {
        const response = await fetch(`/api/work-orders/${workOrder.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus }),
        })

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(errorText || "Failed to update status")
        }

        const data = await response.json()
        setWorkOrder((prev) => (prev ? { ...prev, state: data.work_order.state } : prev))
        showToast(options?.successMessage || "Status updated", "success")
      } catch (err: any) {
        setWorkOrder((prev) => (prev ? { ...prev, state: previousStatus } : prev))
        showToast(err.message || "Failed to update status", "error")
      } finally {
        setStatusSaving(false)
      }
    },
    [workOrder, showToast]
  )

  const handleStatusChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      updateStatus(event.target.value)
    },
    [updateStatus]
  )

  const handleApprove = useCallback(async () => {
    if (!workOrder) return
    if (!window.confirm("Approve this repair order?")) return
    await updateStatus("approved", { successMessage: "Repair order approved" })
  }, [workOrder, updateStatus])

  const handleComplete = useCallback(async () => {
    if (!workOrder) return
    if (!window.confirm("Mark this repair order as complete?")) return
    await updateStatus("completed", { successMessage: "Repair order completed" })
  }, [workOrder, updateStatus])

  const handleCancel = useCallback(async () => {
    if (!workOrder) return
    const confirmed = window.confirm(
      "Are you sure you want to cancel this repair order? This action cannot be undone."
    )
    if (!confirmed) return
    await updateStatus("cancelled", { successMessage: "Repair order cancelled" })
  }, [workOrder, updateStatus])

  const handleOpenCustomerEdit = useCallback(() => {
    if (!workOrder) return
    setCustomerFormData({
      customer_name: workOrder.customer_name || "",
      phone_primary: workOrder.phone_primary || "",
      phone_secondary: workOrder.phone_secondary ?? "",
      phone_mobile: workOrder.phone_mobile ?? "",
      email: workOrder.email ?? "",
      address_line1: workOrder.address_line1 ?? "",
      address_line2: workOrder.address_line2 ?? "",
      city: workOrder.city ?? "",
      state: workOrder.state ?? "",
      zip: workOrder.zip ?? "",
    })
    setCustomerEditOpen(true)
  }, [workOrder])

  const handleSaveCustomer = useCallback(async () => {
    if (!workOrder) return
    const previousWorkOrder = workOrder
    
    // Optimistically update
    setWorkOrder({ ...workOrder, ...customerFormData })
    
    try {
      const response = await fetch(`/api/customers/${workOrder.customer_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: customerFormData.customer_name,
          phone_primary: customerFormData.phone_primary,
          phone_secondary: customerFormData.phone_secondary || null,
          phone_mobile: customerFormData.phone_mobile || null,
          email: customerFormData.email || null,
          address_line1: customerFormData.address_line1 || null,
          address_line2: customerFormData.address_line2 || null,
          city: customerFormData.city || null,
          state: customerFormData.state || null,
          zip: customerFormData.zip || null,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to update customer")
      }

      setCustomerEditOpen(false)
      showToast("Customer updated successfully", "success")
    } catch (err: any) {
      setWorkOrder(previousWorkOrder)
      showToast(err.message || "Failed to update customer", "error")
    }
  }, [workOrder, customerFormData, showToast])

  const handleVehicleUpdateSuccess = useCallback((updatedVehicle: any) => {
    if (!workOrder) return
    
    // Update work order with new vehicle data
    setWorkOrder({
      ...workOrder,
      year: updatedVehicle.year,
      make: updatedVehicle.make,
      model: updatedVehicle.model,
      submodel: updatedVehicle.submodel,
      engine: updatedVehicle.engine,
      transmission: updatedVehicle.transmission,
      color: updatedVehicle.color,
      vin: updatedVehicle.vin,
      license_plate: updatedVehicle.license_plate,
      license_plate_state: updatedVehicle.license_plate_state,
      mileage: updatedVehicle.mileage,
      manufacture_date: updatedVehicle.manufacture_date,
    })
    showToast("Vehicle updated successfully", "success")
  }, [workOrder, showToast])

  // Load work order and items from database
  useEffect(() => {
    const fetchWorkOrder = async () => {
      try {
        console.log('=== FETCHING WORK ORDER ===')
        console.log('roId:', roId)
        
        setLoading(true)
        setError(null)
        
        // Fetch work order
        const woResponse = await fetch(`/api/work-orders/${roId}`)
        if (!woResponse.ok) {
          throw new Error(`Failed to fetch work order: ${woResponse.status}`)
        }
        
        const woData = await woResponse.json()
        if (!woData.work_order) {
          throw new Error('No work order data returned')
        }
        
        setWorkOrder(woData.work_order)
        console.log('✓ Work order loaded')
        
        // Services are loaded automatically by useServiceManagement hook
        
      } catch (err: any) {
        console.error('=== WORK ORDER FETCH ERROR ===')
        console.error('Error:', err.message)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    if (roId) {
      fetchWorkOrder()
    }
  }, [roId])

  // NOW we can do early returns - ALL HOOKS are called above
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-muted-foreground" size={32} />
      </div>
    )
  }

  if (error || !workOrder) {
    return (
      <Card className="p-12 text-center">
        <p className="text-destructive mb-2">Error loading work order</p>
        <p className="text-sm text-muted-foreground mb-4">{error || "Work order not found"}</p>
        {onClose && <Button onClick={onClose} variant="outline">Go Back</Button>}
      </Card>
    )
  }

  const statusLabelMap: Record<string, string> = {
    draft: "Draft",
    open: "Open",
    in_progress: "In Progress",
    waiting_approval: "Waiting Approval",
    approved: "Approved",
    completed: "Completed",
    cancelled: "Cancelled",
  }

  const statusBadgeMap: Record<string, string> = {
    draft: "bg-muted text-muted-foreground border-border",
    open: "bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/20",
    in_progress: "bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/20",
    waiting_approval: "bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/20",
    approved: "bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/20",
    completed: "bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/20",
    cancelled: "bg-muted text-muted-foreground border-border",
  }

  const isApproved = workOrder.state === "approved"
  const isCompleted = workOrder.state === "completed"
  const isCancelled = workOrder.state === "cancelled"

  // Parts Generation Loader Component
  function PartsGenerationLoader({ 
    isOpen, 
    currentStep 
  }: { 
    isOpen: boolean; 
    currentStep: string;
  }) {
    return (
      <Dialog open={isOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          <DialogHeader className="sr-only">
            <DialogTitle>Generating Parts List</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <div className="text-center space-y-2">
              <p className="text-lg font-medium">Generating Parts List</p>
              <p className="text-sm text-muted-foreground">{currentStep}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Build full address
  const fullAddress = [
    workOrder.address_line1,
    workOrder.address_line2,
    [workOrder.city, workOrder.customer_state, workOrder.zip].filter(Boolean).join(", ")
  ].filter(Boolean).join(", ")

  return (
    <div className="space-y-4">
      {/* Header with RO Number and Actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} className="text-muted-foreground">
              <ArrowLeft size={20} />
            </Button>
          )}
          <h1 className="text-3xl font-bold text-foreground">{workOrder.ro_number}</h1>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="outline" size="sm" className="gap-2 bg-transparent">
            <Printer size={16} />
            Print
          </Button>
        </div>
      </div>

      {/* Customer and Vehicle Cards - Horizontal Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CustomerInfoCard
          customerName={workOrder.customer_name}
          phonePrimary={workOrder.phone_primary}
          phoneSecondary={workOrder.phone_secondary}
          phoneMobile={workOrder.phone_mobile}
          email={workOrder.email}
          address={fullAddress}
          onEdit={handleOpenCustomerEdit}
        />

        <VehicleInfoCard
          year={workOrder.year}
          make={workOrder.make}
          model={workOrder.model}
          vin={workOrder.vin}
          manufactureDate={workOrder.manufacture_date}
          engine={workOrder.engine}
          licensePlate={workOrder.license_plate}
          color={workOrder.color}
          mileage={workOrder.mileage}
          onEdit={() => setVehicleEditOpen(true)}
        />
      </div>

      <StatusWorkflow stages={WORKFLOW_STAGES as WorkflowStage[]} />

      {/* Main Content - Full Width */}
      <div className="space-y-4">
        {/* Top Info Row - Condensed */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Card className="p-3 border-border">
            <p className="text-xs text-muted-foreground mb-1">Status</p>
            {isEditing ? (
              <select 
                id="ro_status"
                name="ro_status"
                className="w-full px-2 py-1 text-sm rounded-md bg-card border border-border text-foreground"
                value={workOrder.state}
                onChange={handleStatusChange}
                disabled={statusSaving}
              >
                <option value="draft">Draft</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="waiting_approval">Waiting Approval</option>
                <option value="approved">Approved</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            ) : (
              <Badge className={statusBadgeMap[workOrder.state] || "bg-muted text-muted-foreground border-border"}>
                {statusLabelMap[workOrder.state] || workOrder.state}
              </Badge>
            )}
          </Card>

          <Card className="p-3 border-border">
            <p className="text-xs text-muted-foreground mb-1">Created</p>
            <p className="text-sm font-medium text-foreground">{new Date(workOrder.date_opened).toLocaleDateString()}</p>
          </Card>

          <Card className="p-3 border-border">
            <p className="text-xs text-muted-foreground mb-1">Due Date</p>
            <p className="text-sm font-medium text-foreground">
              {workOrder.date_promised ? new Date(workOrder.date_promised).toLocaleDateString() : "TBD"}
            </p>
          </Card>

          <Card className="p-3 border-border">
            <p className="text-xs text-muted-foreground mb-1">Customer Concern</p>
            <p className="text-sm font-medium text-foreground italic line-clamp-2">
              {workOrder.customer_concern || "None specified"}
            </p>
          </Card>

          <Card className="p-3 border-border">
            <p className="text-xs text-muted-foreground mb-1">License Plate</p>
            <p className="text-sm font-medium text-foreground">
              {workOrder.license_plate || "N/A"}
            </p>
          </Card>
        </div>

        {/* Services Section - Takes Full Width */}
        <Card className="p-6 border-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground">Services ({services.length})</h2>
            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant="default" 
                className="gap-2"
                onClick={aiRecommendations.fetchRecommendations}
              >
                <Sparkles size={16} />
                AI Recommend Services
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                className="gap-2 bg-transparent" 
                onClick={addService}
              >
                <Plus size={16} />
                Add Service
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {services.map((service, index) => (
              <div
                key={service.id}
                draggable={dragEnabledIndex === index}
                onDragStart={(e) => {
                  if (dragEnabledIndex === index) {
                    handleDragStart(e, index)
                  }
                }}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={`transition-all ${dragOverIndex === index ? "border-t-2 border-primary" : ""}`}
              >
                <EditableServiceCard
                  service={service}
                  onUpdate={updateService}
                  onRemove={() => removeService(service.id)}
                  isDragging={dragIndex === index}
                  roTechnician="Unassigned"
                  dragHandleProps={createDragHandleProps(index)}
                />
              </div>
            ))}
          </div>
        </Card>

        <PricingSummary totals={totals} />

        <ActionButtons
          onApprove={handleApprove}
          onComplete={handleComplete}
          onCancel={handleCancel}
          isApproved={isApproved}
          isCompleted={isCompleted}
          isCancelled={isCancelled}
          isSaving={statusSaving}
        />

      </div>

      {/* Customer Edit Dialog */}
      <Dialog open={customerEditOpen} onOpenChange={setCustomerEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Customer</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Customer Name</Label>
              <Input
                value={customerFormData.customer_name}
                onChange={(e) => setCustomerFormData({ ...customerFormData, customer_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                value={customerFormData.email}
                onChange={(e) => setCustomerFormData({ ...customerFormData, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Primary Phone</Label>
              <Input
                value={customerFormData.phone_primary}
                onChange={(e) => setCustomerFormData({ ...customerFormData, phone_primary: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Secondary Phone</Label>
              <Input
                value={customerFormData.phone_secondary || ""}
                onChange={(e) => setCustomerFormData({ ...customerFormData, phone_secondary: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Mobile Phone</Label>
              <Input
                value={customerFormData.phone_mobile || ""}
                onChange={(e) => setCustomerFormData({ ...customerFormData, phone_mobile: e.target.value })}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Address Line 1</Label>
              <Input
                value={customerFormData.address_line1 || ""}
                onChange={(e) => setCustomerFormData({ ...customerFormData, address_line1: e.target.value })}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Address Line 2</Label>
              <Input
                value={customerFormData.address_line2 || ""}
                onChange={(e) => setCustomerFormData({ ...customerFormData, address_line2: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>City</Label>
              <Input
                value={customerFormData.city || ""}
                onChange={(e) => setCustomerFormData({ ...customerFormData, city: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>State</Label>
              <Input
                value={customerFormData.state || ""}
                onChange={(e) => setCustomerFormData({ ...customerFormData, state: e.target.value })}
                maxLength={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Zip</Label>
              <Input
                value={customerFormData.zip || ""}
                onChange={(e) => setCustomerFormData({ ...customerFormData, zip: e.target.value })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setCustomerEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveCustomer}>
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Vehicle Edit Dialog */}
      <VehicleEditDialog
        open={vehicleEditOpen}
        onOpenChange={setVehicleEditOpen}
        vehicle={workOrder ? {
          id: workOrder.vehicle_id.toString(),
          customer_id: workOrder.customer_id.toString(),
          vin: workOrder.vin,
          year: workOrder.year,
          make: workOrder.make,
          model: workOrder.model,
          submodel: workOrder.submodel,
          engine: workOrder.engine,
          transmission: workOrder.transmission,
          color: workOrder.color,
          license_plate: workOrder.license_plate,
          license_plate_state: workOrder.license_plate_state,
          mileage: workOrder.mileage,
          manufacture_date: workOrder.manufacture_date,
          notes: null,
          is_active: true,
          created_at: workOrder.created_at,
          updated_at: workOrder.updated_at,
        } : null}
        onSuccess={handleVehicleUpdateSuccess}
      />

      {toast && (
        <div
          className={`fixed top-6 right-6 z-50 rounded-md px-4 py-3 text-sm shadow-lg border ${
            toast.type === "success"
              ? "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20"
              : "bg-destructive/10 text-destructive border-destructive/20"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* AI Recommendations Dialog */}
      <Dialog open={aiRecommendations.dialogOpen} onOpenChange={aiRecommendations.setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>AI Maintenance Recommendations</DialogTitle>
            <p className="text-sm text-muted-foreground">
              {workOrder.year} {workOrder.make} {workOrder.model}
            </p>
          </DialogHeader>

          {aiRecommendations.aiLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-3">Analyzing maintenance schedule...</span>
            </div>
          )}

          {!aiRecommendations.aiLoading && aiRecommendations.aiSource && (
            <div className="mb-4">
              {aiRecommendations.aiSource === "database" && (
                <div className="flex items-center gap-2 text-green-600 text-sm">
                  <CheckCircle className="h-4 w-4" />
                  <span>Found in database (instant)</span>
                </div>
              )}
              {aiRecommendations.aiSource === "vehicle_databases_api" && (
                <div className="flex items-center gap-2 text-blue-600 text-sm">
                  <FileText className="h-4 w-4" />
                  <span>Extracted from owner's manual - Saved to database</span>
                </div>
              )}
            </div>
          )}

          {!aiRecommendations.aiLoading && aiRecommendations.aiServices.length > 0 && (
            <>
              <div className="space-y-2">
                {aiRecommendations.aiServices.map((service: any, i: number) => (
                  <div
                    key={i}
                    className="border rounded p-3 flex items-start gap-3 hover:bg-accent cursor-pointer"
                    onClick={() => aiRecommendations.toggleService(service)}
                  >
                    <Checkbox
                      checked={aiRecommendations.selectedAiServices.includes(service)}
                      onCheckedChange={() => aiRecommendations.toggleService(service)}
                    />
                    <div className="flex-1">
                      <div className="font-medium">{service.service_name}</div>
                      <div className="text-sm text-muted-foreground">
                        {service.service_description}
                      </div>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          Due: {service.mileage_interval?.toLocaleString()} mi
                        </Badge>
                        {service.driving_condition && (
                          <Badge variant="secondary" className="text-xs">
                            {service.driving_condition}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 mt-4">
                <Button onClick={() => { aiRecommendations.setDialogOpen(false); partsGeneration.generateParts(); }} className="flex-1" disabled={partsGeneration.generating}>
                  {partsGeneration.generating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating parts list...
                    </>
                  ) : (
                    <>Add {aiRecommendations.selectedAiServices.length} Service{aiRecommendations.selectedAiServices.length !== 1 ? 's' : ''} to RO</>
                  )}
                </Button>
                <Button variant="outline" onClick={() => aiRecommendations.setDialogOpen(false)} disabled={partsGeneration.generating}>
                  Cancel
                </Button>
              </div>
            </>
          )}

          {!aiRecommendations.aiLoading && aiRecommendations.aiServices.length === 0 && aiRecommendations.aiSource === 'not_found' && (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-2">
                No maintenance data available for this vehicle.
              </p>
              <p className="text-sm text-muted-foreground">
                Try uploading the owner's manual or check back later.
              </p>
            </div>
          )}
          
          {!aiRecommendations.aiLoading && aiRecommendations.aiServices.length === 0 && aiRecommendations.aiSource && aiRecommendations.aiSource !== 'not_found' && (
            <div className="text-center text-muted-foreground py-8">
              No maintenance items found for this vehicle at this mileage.
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Parts Selection Modal */}
      <PartsSelectionModal
        isOpen={partsGeneration.dialogOpen}
        onClose={() => partsGeneration.setDialogOpen(false)}
        servicesWithParts={partsGeneration.servicesWithParts}
        onConfirm={partsGeneration.confirmPartsSelection}
      />

      {/* Parts Generation Loading Dialog */}
      <PartsGenerationLoader 
        isOpen={partsGeneration.generating}
        currentStep={partsGeneration.loadingStep}
      />

      {/* Variant Selector Dialog */}
      <Dialog open={aiRecommendations.variantDialogOpen} onOpenChange={aiRecommendations.setVariantDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Select Engine Variant</DialogTitle>
            <p className="text-sm text-muted-foreground">
              This vehicle has multiple engine options. Select the one that matches your vehicle:
            </p>
          </DialogHeader>

          <div className="space-y-3 mt-4">
            {aiRecommendations.availableVariants.map((variant: any, index: number) => (
              <div
                key={index}
                className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                  aiRecommendations.selectedVariant === variant
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50 hover:bg-accent/50'
                }`}
                onClick={() => aiRecommendations.setSelectedVariant(variant)}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-1">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      aiRecommendations.selectedVariant === variant
                        ? 'border-primary bg-primary'
                        : 'border-muted-foreground'
                    }`}>
                      {aiRecommendations.selectedVariant === variant && (
                        <div className="w-2.5 h-2.5 rounded-full bg-white" />
                      )}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-lg mb-2">
                      {variant.engine_displacement} {variant.engine_type}
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-muted-foreground">Transmission:</span>
                        <span className="ml-2 font-medium">{variant.transmission_type || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Services:</span>
                        <span className="ml-2 font-medium">{variant.services?.length || 0} maintenance items</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2 mt-6">
            <Button
              onClick={async () => {
                if (!aiRecommendations.selectedVariant) {
                  showToast('Please select an engine variant', 'error')
                  return
                }
                await aiRecommendations.confirmVariantSelection()
              }}
              className="flex-1"
              disabled={!aiRecommendations.selectedVariant}
            >
              Continue with Selected Variant
            </Button>
            <Button
              variant="outline"
              onClick={aiRecommendations.cancelVariantSelection}
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
