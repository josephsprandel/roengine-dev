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
} from "lucide-react"
import type { ServiceData, LineItem } from "./ro-creation-wizard"
import { EditableServiceCard, createLineItem } from "./editable-service-card"

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

// Sample data with new structure
const createInitialServices = (): ServiceData[] => [
  {
    id: "svc-1",
    name: "Battery Diagnostic",
    description: "Complete battery system diagnostic and testing",
    estimatedCost: 450,
    estimatedTime: "1 hr",
    category: "Diagnostic",
    status: "completed",
    parts: [
      { id: "p1", description: "Battery terminal connectors", quantity: 2, unitPrice: 15, total: 30 },
    ],
    labor: [
      { id: "l1", description: "Diagnostic labor", quantity: 1, unitPrice: 150, total: 150 },
      { id: "l2", description: "Battery testing", quantity: 0.5, unitPrice: 150, total: 75 },
    ],
    sublets: [],
    hazmat: [{ id: "h1", description: "Battery disposal fee", quantity: 1, unitPrice: 25, total: 25 }],
    fees: [{ id: "f1", description: "Shop supplies", quantity: 1, unitPrice: 20, total: 20 }],
  },
  {
    id: "svc-2",
    name: "Software Update",
    description: "Vehicle computer software update and calibration",
    estimatedCost: 500,
    estimatedTime: "1.5 hrs",
    category: "Maintenance",
    status: "in_progress",
    parts: [],
    labor: [
      { id: "l3", description: "Software update labor", quantity: 1.5, unitPrice: 150, total: 225 },
      { id: "l4", description: "System calibration", quantity: 1, unitPrice: 175, total: 175 },
    ],
    sublets: [{ id: "s1", description: "OEM software license", quantity: 1, unitPrice: 75, total: 75 }],
    hazmat: [],
    fees: [{ id: "f2", description: "Data transfer fee", quantity: 1, unitPrice: 25, total: 25 }],
  },
  {
    id: "svc-3",
    name: "Calibration Service",
    description: "Sensor calibration and alignment",
    estimatedCost: 300,
    estimatedTime: "45 min",
    category: "Maintenance",
    status: "pending",
    parts: [
      { id: "p2", description: "Calibration targets", quantity: 1, unitPrice: 50, total: 50 },
    ],
    labor: [{ id: "l5", description: "Calibration labor", quantity: 1, unitPrice: 150, total: 150 }],
    sublets: [],
    hazmat: [],
    fees: [{ id: "f3", description: "Equipment usage", quantity: 1, unitPrice: 50, total: 50 }],
  },
]

interface WorkOrder {
  id: number
  ro_number: string
  customer_id: number
  vehicle_id: number
  customer_name: string
  phone_primary: string
  email: string | null
  year: number
  make: string
  model: string
  vin: string
  license_plate: string | null
  state: string
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
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [services, setServices] = useState<ServiceData[]>(() => createInitialServices())
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  useEffect(() => {
    const fetchWorkOrder = async () => {
      try {
        console.log('=== FETCHING WORK ORDER ===')
        console.log('roId:', roId)
        console.log('roId type:', typeof roId)
        
        setLoading(true)
        setError(null)
        
        const url = `/v0/api/work-orders/${roId}`
        console.log('Fetching URL:', url)
        
        const response = await fetch(url)
        console.log('Response status:', response.status)
        console.log('Response ok:', response.ok)
        
        if (!response.ok) {
          const errorText = await response.text()
          console.error('API Error Response:', errorText)
          throw new Error(`Failed to fetch work order: ${response.status}`)
        }
        
        const data = await response.json()
        console.log('API Response Data:', JSON.stringify(data, null, 2))
        console.log('work_order object:', data.work_order)
        
        if (!data.work_order) {
          console.error('No work_order in response!')
          throw new Error('No work order data returned')
        }
        
        setWorkOrder(data.work_order)
        console.log('Work order set successfully')
        console.log('==========================')
        
      } catch (err: any) {
        console.error('=== WORK ORDER FETCH ERROR ===')
        console.error('Error type:', err.constructor.name)
        console.error('Error message:', err.message)
        console.error('Error stack:', err.stack)
        console.error('==============================')
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    if (roId) {
      fetchWorkOrder()
    } else {
      console.warn('No roId provided to RODetailView')
    }
  }, [roId])

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

  const handleSave = useCallback(() => {
    setIsEditing(false)
  }, [])

  const updateService = useCallback((updated: ServiceData) => {
    setServices(prev => prev.map((s) => (s.id === updated.id ? updated : s)))
  }, [])

  const removeService = useCallback((id: string) => {
    setServices(prev => prev.filter((s) => s.id !== id))
  }, [])

  const addService = useCallback(() => {
    const newService: ServiceData = {
      id: `svc-${Date.now()}`,
      name: "New Service",
      description: "",
      estimatedCost: 0,
      estimatedTime: "TBD",
      category: "Custom",
      status: "pending",
      parts: [],
      labor: [],
      sublets: [],
      hazmat: [],
      fees: [],
    }
    setServices(prev => [...prev, newService])
  }, [])

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDragIndex(index)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (dragIndex !== null && dragIndex !== index) {
      setDragOverIndex(index)
    }
  }

  const handleDragEnd = useCallback(() => {
    if (dragIndex !== null && dragOverIndex !== null && dragIndex !== dragOverIndex) {
      setServices(prev => {
        const newServices = [...prev]
        const [removed] = newServices.splice(dragIndex, 1)
        newServices.splice(dragOverIndex, 0, removed)
        return newServices
      })
    }
    setDragIndex(null)
    setDragOverIndex(null)
  }, [dragIndex, dragOverIndex])

  const dragHandleProps = useMemo(() => ({
    onMouseDown: (e: React.MouseEvent) => e.stopPropagation(),
  }), [])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} className="text-muted-foreground">
              <ArrowLeft size={20} />
            </Button>
          )}
          <div>
            <h1 className="text-3xl font-bold text-foreground">{workOrder.ro_number}</h1>
            <p className="text-sm text-muted-foreground">
              {workOrder.customer_name} • {workOrder.year} {workOrder.make} {workOrder.model} • {workOrder.vin}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="outline" size="sm" className="gap-2 bg-transparent">
            <Printer size={16} />
            Print
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 bg-transparent"
            onClick={() => setIsEditing(!isEditing)}
          >
            {isEditing ? <X size={16} /> : <Edit2 size={16} />}
            {isEditing ? "Cancel" : "Edit"}
          </Button>
          {isEditing && (
            <Button size="sm" onClick={handleSave} className="gap-2">
              <Save size={16} />
              Save
            </Button>
          )}
        </div>
      </div>

      {/* Horizontal Status Workflow Bar */}
      <Card className="p-4 border-border">
        <div className="flex items-center justify-between overflow-x-auto">
          {WORKFLOW_STAGES.map((stage, idx) => {
            const Icon = stage.icon
            return (
              <div key={stage.id} className="flex items-center gap-3 flex-shrink-0">
                <div
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                    stage.completed
                      ? "bg-green-500/20 text-green-600 dark:text-green-400"
                      : stage.active
                        ? "bg-blue-500/20 text-blue-600 dark:text-blue-400"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Icon size={16} />
                  <span className="text-sm font-medium whitespace-nowrap">{stage.label}</span>
                </div>
                {idx < WORKFLOW_STAGES.length - 1 && <ChevronRight size={16} className="text-border" />}
              </div>
            )
          })}
        </div>
      </Card>

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
              >
                <option value="awaiting_approval">Awaiting Approval</option>
                <option value="in_progress">In Progress</option>
                <option value="ready">Ready</option>
                <option value="completed">Completed</option>
              </select>
            ) : (
              <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/20">
                Awaiting Approval
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
            <Button size="sm" variant="outline" className="gap-2 bg-transparent" onClick={addService}>
              <Plus size={16} />
              Add Service
            </Button>
          </div>

          <div className="space-y-3">
            {services.map((service) => (
              <Card key={service.id} className="p-4 border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{service.name}</h3>
                    <p className="text-sm text-muted-foreground">{service.description}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => removeService(service.id)}>
                    <X size={16} />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </Card>

        {/* Pricing Summary - Sticky Bottom */}
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

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Button className="gap-2">Approve & Complete</Button>
          <Button variant="outline" className="bg-transparent gap-2">
            Request More Info
          </Button>
          <Button
            variant="outline"
            className="bg-transparent text-destructive border-destructive/30 hover:bg-destructive/10 gap-2"
          >
            Cancel RO
          </Button>
        </div>

        {/* Contact Info - Compact Footer */}
        {!isEditing && (
          <div className="flex items-center gap-2 pt-2 border-t border-border">
            <span className="text-sm text-muted-foreground">
              {workOrder.customer_name} • {workOrder.email || "No email"} • {workOrder.phone_primary}
            </span>
            <Button size="sm" variant="ghost" className="gap-1 ml-auto">
              <MessageSquare size={14} />
              SMS
            </Button>
            <Button size="sm" variant="ghost" className="gap-1">
              <Phone size={14} />
              Call
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
