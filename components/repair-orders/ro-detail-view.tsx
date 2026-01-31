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
} from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import type { ServiceData, LineItem } from "./ro-creation-wizard"
import { EditableServiceCard, createLineItem } from "./editable-service-card"
import type { LineItemCategory } from "./editable-service-card"
import { PartsSelectionModal } from "./parts-selection-modal"

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
        unitPrice: parseFloat(item.item_type === 'labor' ? item.labor_rate || 160 : item.unit_price || 0),
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
  // ALL HOOKS MUST BE AT THE TOP - BEFORE ANY EARLY RETURNS!
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [statusSaving, setStatusSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null)
  const [services, setServices] = useState<ServiceData[]>([])
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set())
  const [dragEnabledIndex, setDragEnabledIndex] = useState<number | null>(null)
  
  // AI Recommendation states
  const [aiDialogOpen, setAiDialogOpen] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiServices, setAiServices] = useState<any[]>([])
  const [selectedAiServices, setSelectedAiServices] = useState<any[]>([])
  const [aiSource, setAiSource] = useState<string | null>(null)

  // Parts generation states
  const [partsDialogOpen, setPartsDialogOpen] = useState(false)
  const [servicesWithParts, setServicesWithParts] = useState<any[]>([])
  const [generatingParts, setGeneratingParts] = useState(false)

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

  const handleSave = useCallback(() => {
    setIsEditing(false)
  }, [])

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }, [])

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

  const updateService = useCallback(async (updated: ServiceData) => {
    if (!workOrder?.id) {
      setServices(prev => prev.map((s) => (s.id === updated.id ? updated : s)))
      return
    }

    const previous = services.find((s) => s.id === updated.id)
    setServices(prev => prev.map((s) => (s.id === updated.id ? updated : s)))

    if (!previous) return

    // Extract database service_id from the service id (e.g., "svc-123" -> 123)
    const dbServiceId = parseInt(updated.id.replace('svc-', ''), 10)

    // Update the service record itself (title, description)
    await fetch(`/api/work-orders/${workOrder.id}/services`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: dbServiceId,
        title: updated.name,
        description: updated.description,
      }),
    })

    const categories: LineItemCategory[] = ["parts", "labor", "sublets", "hazmat", "fees"]
    const categoryTypeMap: Record<LineItemCategory, string> = {
      parts: "part",
      labor: "labor",
      sublets: "sublet",
      hazmat: "hazmat",
      fees: "fee",
    }
    const categoryPrefixMap: Record<LineItemCategory, string> = {
      parts: "p",
      labor: "l",
      sublets: "s",
      hazmat: "h",
      fees: "f",
    }

    const parseDbId = (id: string) => {
      const match = id.match(/^[a-z](\d+)$/)
      return match ? parseInt(match[1], 10) : null
    }

    const updatedWithIds: ServiceData = { ...updated }

    for (const category of categories) {
      const prevItems = previous[category] || []
      const nextItems = updated[category] || []
      const nextIds = new Set(nextItems.map((item) => item.id))

      for (const prevItem of prevItems) {
        if (!nextIds.has(prevItem.id)) {
          const dbId = parseDbId(prevItem.id)
          if (dbId) {
            await fetch(`/api/work-orders/${workOrder.id}/items?item_id=${dbId}`, {
              method: "DELETE",
            })
          }
        }
      }

      const syncedItems: LineItem[] = []
      for (const item of nextItems) {
        const dbId = parseDbId(item.id)
        const payload: Record<string, any> = {
          item_type: categoryTypeMap[category],
          description: item.description,
          notes: updated.description || null,
          quantity: item.quantity || 1,
          unit_price: item.unitPrice || 0,
          labor_hours: category === "labor" ? item.quantity || 0 : null,
          labor_rate: category === "labor" ? item.unitPrice || 0 : null,
          is_taxable: true,
          display_order: 0,
          service_id: dbServiceId,
        }

        if (dbId) {
          await fetch(`/api/work-orders/${workOrder.id}/items`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ item_id: dbId, ...payload }),
          })
          syncedItems.push(item)
        } else {
          const response = await fetch(`/api/work-orders/${workOrder.id}/items`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
          if (response.ok) {
            const data = await response.json()
            const prefix = categoryPrefixMap[category]
            syncedItems.push({ ...item, id: `${prefix}${data.item.id}` })
          } else {
            syncedItems.push(item)
          }
        }
      }

      updatedWithIds[category] = syncedItems
    }

    setServices(prev => prev.map((s) => (s.id === updated.id ? updatedWithIds : s)))
  }, [services, workOrder])

  const removeService = useCallback(async (id: string) => {
    if (!workOrder?.id) return

    console.log('=== DELETING SERVICE ===')
    console.log('Service ID:', id)

    // Extract database service ID from the service id
    const dbServiceId = id.replace('svc-', '')

    try {
      const response = await fetch(`/api/work-orders/${workOrder.id}/services?service_id=${dbServiceId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        console.log('✓ Deleted from database')
        // Remove from local state
        setServices((prev) => prev.filter((s) => s.id !== id))
      } else {
        console.error('✗ Failed to delete from database')
      }
    } catch (error) {
      console.error('Error deleting service:', error)
    }
  }, [workOrder])

  const addService = useCallback(async () => {
    if (!workOrder?.id) return

    console.log('=== ADDING NEW SERVICE ===')

    try {
      const response = await fetch(`/api/work-orders/${workOrder.id}/services`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'New Service',
          description: '',
          display_order: services.length,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        console.log('✓ Saved to database - ID:', data.service?.id)

        // Reload services from database
        const servicesResponse = await fetch(`/api/work-orders/${workOrder.id}/services`)
        if (servicesResponse.ok) {
          const servicesData = await servicesResponse.json()
          const loadedServices = convertDbServicesToServiceData(servicesData.services || [])
          setServices(loadedServices)
        }
      } else {
        console.error('✗ Failed to save to database')
      }
    } catch (error) {
      console.error('Error adding service:', error)
    }
  }, [workOrder, services.length])

  const handleAIRecommend = useCallback(async () => {
    console.log('[DEBUG] AI Recommend clicked')
    
    if (!workOrder) {
      console.log('[DEBUG] No workOrder available')
      return
    }
    
    setAiDialogOpen(true)
    setAiLoading(true)
    setAiServices([])
    setAiSource(null)

    try {
      // Get current mileage from user
      const mileage = prompt("Enter current mileage:")
      console.log('[DEBUG] Mileage entered:', mileage)
      
      if (!mileage) {
        console.log('[DEBUG] No mileage provided, aborting')
        setAiLoading(false)
        return
      }

      const requestBody = {
        year: workOrder.year,
        make: workOrder.make,
        model: workOrder.model,
        mileage: parseInt(mileage),
        vin: workOrder.vin
      }
      console.log('[DEBUG] Request body:', requestBody)

      const url = "/api/maintenance-recommendations"
      console.log('[DEBUG] Calling API:', url)

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      })

      console.log('[DEBUG] Response status:', response.status)
      console.log('[DEBUG] Response ok:', response.ok)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[DEBUG] Error response text:', errorText)
        throw new Error(`API error: ${response.status}`)
      }

      const data = await response.json()
      console.log('[DEBUG] Response data:', data)
      
      /**
       * MULTIPLE VARIANTS HANDLING
       * 
       * Some vehicles (like 2020 Honda Accord) have multiple engine options:
       * - 1.5L Turbo I4 with CVT
       * - 2.0L Turbo I4 with 10-speed Automatic
       * 
       * Strategy: Show variant selector BEFORE saving to database
       * Why: Don't save irrelevant data (2.0L recommendations for 1.5L car)
       * 
       * TODO: Implement variant selector UI component
       * - Show dialog: "This vehicle has multiple engines. Select yours:"
       * - List each variant with engine_displacement and transmission_type
       * - User selects correct variant
       * - THEN save only those recommendations
       * 
       * For now: Auto-select first variant (temporary)
       */
      if (data.multiple_variants) {
        console.log('[DEBUG] Multiple variants detected:', data.variants?.length)
        // TODO: Show variant selector dialog
        // Temporary: Use first variant
        setAiServices(data.variants[0]?.services || [])
        setSelectedAiServices(data.variants[0]?.services || [])
        setAiSource(data.source)
        
        // Save first variant's recommendations
        await saveRecommendationsToDatabase(data.variants[0]?.services || [])
      } else {
        // Single variant - auto-save immediately
        setAiServices(data.services || [])
        setSelectedAiServices(data.services || []) // Auto-select all
        setAiSource(data.source)
        
        // Auto-save recommendations to database
        await saveRecommendationsToDatabase(data.services || [])
      }
      
      console.log('[DEBUG] Services set:', data.services?.length || 0, 'services')
      console.log('[DEBUG] Source:', data.source)
    } catch (error) {
      console.error('[DEBUG] AI recommendation error:', error)
    } finally {
      console.log('[DEBUG] Setting loading to false')
      setAiLoading(false)
    }
  }, [workOrder])

  /**
   * Save AI recommendations to vehicle_recommendations table
   * 
   * This creates records with status='awaiting_approval' so service advisors
   * can review and approve them. When approved, they're added to work_order_items.
   * 
   * Why auto-save:
   * - Creates audit trail (even if user closes dialog)
   * - Tracks presentation history (declined_count, last_presented)
   * - Allows showing recommendations on future ROs for same vehicle
   * 
   * @param services - Array of AI-generated maintenance services
   */
  const saveRecommendationsToDatabase = async (services: any[]) => {
    if (!workOrder?.vehicle_id || !services || services.length === 0) {
      console.log('[DEBUG] Skip save: no vehicle_id or no services')
      console.log('[DEBUG] workOrder.vehicle_id:', workOrder?.vehicle_id)
      return
    }

    try {
      console.log('[DEBUG] Saving recommendations to database...')
      console.log('[DEBUG] Vehicle ID:', workOrder.vehicle_id)
      console.log('[DEBUG] Vehicle ID type:', typeof workOrder.vehicle_id)
      console.log('[DEBUG] Services count:', services.length)

      // Ensure vehicle_id is a number
      const vehicleId = typeof workOrder.vehicle_id === 'string' 
        ? parseInt(workOrder.vehicle_id, 10) 
        : workOrder.vehicle_id

      if (!vehicleId || isNaN(vehicleId)) {
        console.error('[DEBUG] Invalid vehicle_id:', vehicleId)
        return
      }

      const saveResponse = await fetch('/api/save-recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicle_id: vehicleId,
          services: services
        })
      })

      if (!saveResponse.ok) {
        const errorText = await saveResponse.text()
        console.error('[DEBUG] Save error:', errorText)
        throw new Error(`Failed to save: ${saveResponse.status}`)
      }

      const saveData = await saveResponse.json()
      console.log('[DEBUG] Save successful:', saveData)
      console.log('[DEBUG] Saved recommendation IDs:', saveData.recommendation_ids)

      /**
       * TODO: Refresh recommendations list on the page
       * 
       * After saving, we should refresh the vehicle_recommendations query
       * to show the newly added recommendations in the UI.
       * 
       * Implementation ideas:
       * 1. Add a recommendations section to this page
       * 2. Query: SELECT * FROM vehicle_recommendations WHERE vehicle_id = ?
       * 3. Show with approve/decline buttons
       * 4. On approve: INSERT INTO work_order_items
       * 
       * For now: Recommendations are saved but not displayed on this page.
       * Service advisors can view them in the vehicle history or recommendations tab.
       */

    } catch (error) {
      console.error('[DEBUG] Failed to save recommendations:', error)
      // Don't throw - still show recommendations in dialog even if save fails
    }
  }

  const toggleAiService = useCallback((service: any) => {
    setSelectedAiServices(prev =>
      prev.includes(service)
        ? prev.filter(s => s !== service)
        : [...prev, service]
    )
  }, [])

  /**
   * NEW FLOW: Generate parts list with AI + PartsTech pricing
   * 
   * This replaces the old "add services with labor only" flow.
   * Now we:
   * 1. Generate parts list via AI
   * 2. Look up pricing via PartsTech
   * 3. Show parts selection modal
   * 4. Add services + parts to RO
   */
  const addSelectedAiServices = useCallback(async () => {
    if (!workOrder?.id || selectedAiServices.length === 0) return

    console.log('=== GENERATING PARTS LIST FOR SERVICES ===')
    console.log('Selected services:', selectedAiServices.length)

    setGeneratingParts(true)
    setAiDialogOpen(false)

    try {
      // Step 1: Generate parts list via AI
      const partsResponse = await fetch('/api/services/generate-parts-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          services: selectedAiServices.map(s => ({
            service_name: s.service_name,
            service_description: s.service_description
          })),
          vehicle: {
            year: workOrder.year,
            make: workOrder.make,
            model: workOrder.model,
            engine: `${workOrder.year} ${workOrder.make} ${workOrder.model}`,
            vin: workOrder.vin
          }
        })
      })

      if (!partsResponse.ok) {
        const errorText = await partsResponse.text()
        console.error('Parts API Error:', errorText)
        throw new Error(`Failed to generate parts list: ${errorText}`)
      }

      const { servicesWithParts: generatedParts } = await partsResponse.json()
      console.log('✓ Parts generated for', generatedParts.length, 'services')

      // Step 2: Show parts selection modal
      setServicesWithParts(generatedParts)
      setPartsDialogOpen(true)

    } catch (error: any) {
      console.error('Failed to generate parts:', error)
      showToast(error.message || 'Failed to generate parts list', 'error')
    } finally {
      setGeneratingParts(false)
    }
  }, [selectedAiServices, workOrder, showToast])

  /**
   * Confirm parts selection and add services + parts to RO
   */
  const handleConfirmPartsSelection = useCallback(async (servicesWithSelectedParts: any[]) => {
    if (!workOrder?.id) return

    console.log('=== ADDING SERVICES WITH PARTS ===')
    setPartsDialogOpen(false)

    // Save each service with its selected parts
    for (let i = 0; i < servicesWithSelectedParts.length; i++) {
      const serviceData = servicesWithSelectedParts[i]
      const aiService = selectedAiServices[i]

      try {
        console.log('Creating service:', serviceData.serviceName)

        // Step 1: Create service record
        const serviceResponse = await fetch(`/api/work-orders/${workOrder.id}/services`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: serviceData.serviceName,
            description: aiService.service_description || '',
            display_order: services.length + i,
            ai_generated: true
          })
        })

        if (!serviceResponse.ok) {
          console.error('✗ Failed to create service:', serviceData.serviceName)
          continue
        }

        const serviceResult = await serviceResponse.json()
        const serviceId = serviceResult.service?.id
        console.log('✓ Service created - ID:', serviceId)

        // Step 2: Add labor item
        await fetch(`/api/work-orders/${workOrder.id}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            item_type: 'labor',
            description: serviceData.serviceName,
            notes: aiService.service_description,
            labor_hours: aiService.estimated_labor_hours || 1,
            labor_rate: 160,
            is_taxable: false,
            service_id: serviceId
          })
        })
        console.log('✓ Labor item added')

        // Step 3: Add part items
        for (const part of serviceData.parts) {
          if (!part.selectedOption) {
            console.log('⚠️ No pricing for:', part.description, '- skipping')
            continue
          }

          await fetch(`/api/work-orders/${workOrder.id}/items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              item_type: 'part',
              description: part.selectedOption.description || part.description,
              quantity: part.quantity,
              unit_price: part.selectedOption.retailPrice,
              is_taxable: true,
              service_id: serviceId
            })
          })
          console.log('✓ Part added:', part.description)
        }
      } catch (error) {
        console.error('Error adding service:', error)
      }
    }

    // Reload services from database
    console.log('Reloading services...')
    try {
      const servicesResponse = await fetch(`/api/work-orders/${workOrder.id}/services`)
      if (servicesResponse.ok) {
        const servicesData = await servicesResponse.json()
        const loadedServices = convertDbServicesToServiceData(servicesData.services || [])
        setServices(loadedServices)
        showToast('Services and parts added to RO', 'success')
      }
    } catch (error) {
      console.error('Error reloading services:', error)
    }

    console.log('=== SAVE COMPLETE ===')
  }, [workOrder, selectedAiServices, services, showToast])

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

  const createDragHandleProps = useCallback((index: number) => ({
    onMouseDown: () => setDragEnabledIndex(index),
    onMouseUp: () => setDragEnabledIndex(null),
    onMouseLeave: () => setDragEnabledIndex(null),
  }), [])

  const toggleServiceExpanded = useCallback((serviceId: string) => {
    setExpandedServices(prev => {
      const next = new Set(prev)
      if (next.has(serviceId)) {
        next.delete(serviceId)
      } else {
        next.add(serviceId)
      }
      return next
    })
  }, [])

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
        
        // Fetch services with items
        const servicesResponse = await fetch(`/api/work-orders/${roId}/services`)
        if (servicesResponse.ok) {
          const servicesData = await servicesResponse.json()
          console.log('✓ Loaded', servicesData.services?.length || 0, 'services from database')

          const loadedServices = convertDbServicesToServiceData(servicesData.services || [])
          setServices(loadedServices)
        } else {
          console.log('No services found for this work order')
        }
        
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

  // Non-hook functions can stay here
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
                onClick={handleAIRecommend}
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
                onDragEnd={() => {
                  setDragEnabledIndex(null)
                  handleDragEnd()
                }}
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
          <Button
            className="gap-2"
            onClick={handleApprove}
            disabled={statusSaving || isApproved || isCompleted || isCancelled}
          >
            Approve
          </Button>
          <Button
            variant="outline"
            className="bg-transparent gap-2"
            onClick={handleComplete}
            disabled={statusSaving || isCompleted || isCancelled}
          >
            Complete
          </Button>
          <Button
            variant="outline"
            className="bg-transparent text-destructive border-destructive/30 hover:bg-destructive/10 gap-2"
            onClick={handleCancel}
            disabled={statusSaving || isCancelled}
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
      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>AI Maintenance Recommendations</DialogTitle>
            <p className="text-sm text-muted-foreground">
              {workOrder.year} {workOrder.make} {workOrder.model}
            </p>
          </DialogHeader>

          {aiLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-3">Analyzing maintenance schedule...</span>
            </div>
          )}

          {!aiLoading && aiSource && (
            <div className="mb-4">
              {aiSource === "database" && (
                <div className="flex items-center gap-2 text-green-600 text-sm">
                  <CheckCircle className="h-4 w-4" />
                  <span>Found in database (instant)</span>
                </div>
              )}
              {aiSource === "vehicle_databases_api" && (
                <div className="flex items-center gap-2 text-blue-600 text-sm">
                  <FileText className="h-4 w-4" />
                  <span>Extracted from owner's manual - Saved to database</span>
                </div>
              )}
            </div>
          )}

          {!aiLoading && aiServices.length > 0 && (
            <>
              <div className="space-y-2">
                {aiServices.map((service, i) => (
                  <div
                    key={i}
                    className="border rounded p-3 flex items-start gap-3 hover:bg-accent cursor-pointer"
                    onClick={() => toggleAiService(service)}
                  >
                    <Checkbox
                      checked={selectedAiServices.includes(service)}
                      onCheckedChange={() => toggleAiService(service)}
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
                <Button onClick={addSelectedAiServices} className="flex-1" disabled={generatingParts}>
                  {generatingParts ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating parts list...
                    </>
                  ) : (
                    <>Add {selectedAiServices.length} Service{selectedAiServices.length !== 1 ? 's' : ''} to RO</>
                  )}
                </Button>
                <Button variant="outline" onClick={() => setAiDialogOpen(false)} disabled={generatingParts}>
                  Cancel
                </Button>
              </div>
            </>
          )}

          {!aiLoading && aiServices.length === 0 && aiSource === 'not_found' && (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-2">
                No maintenance data available for this vehicle.
              </p>
              <p className="text-sm text-muted-foreground">
                Try uploading the owner's manual or check back later.
              </p>
            </div>
          )}
          
          {!aiLoading && aiServices.length === 0 && aiSource && aiSource !== 'not_found' && (
            <div className="text-center text-muted-foreground py-8">
              No maintenance items found for this vehicle at this mileage.
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Parts Selection Modal */}
      <PartsSelectionModal
        isOpen={partsDialogOpen}
        onClose={() => setPartsDialogOpen(false)}
        servicesWithParts={servicesWithParts}
        onConfirm={handleConfirmPartsSelection}
      />
    </div>
  )
}
