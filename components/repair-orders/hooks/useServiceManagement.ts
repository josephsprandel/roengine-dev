"use client"

import { useState, useCallback, useEffect } from "react"
import type { ServiceData, LineItem } from "../ro-creation-wizard"
import type { LineItemCategory } from "../editable-service-card"

interface UseServiceManagementParams {
  workOrderId: number | string | null | undefined
  convertDbServicesToServiceData: (dbServices: any[]) => ServiceData[]
}

interface UseServiceManagementReturn {
  // State
  services: ServiceData[]
  setServices: React.Dispatch<React.SetStateAction<ServiceData[]>>
  servicesLoading: boolean

  // Drag & drop state
  dragIndex: number | null
  dragOverIndex: number | null
  dragEnabledIndex: number | null

  // Expanded state
  expandedServices: Set<string>

  // CRUD operations
  updateService: (updated: ServiceData) => Promise<void>
  removeService: (id: string) => Promise<void>
  addService: () => Promise<void>
  reloadServices: () => Promise<void>

  // Drag & drop handlers
  handleDragStart: (e: React.DragEvent, index: number) => void
  handleDragOver: (e: React.DragEvent, index: number) => void
  handleDragEnd: () => void
  createDragHandleProps: (index: number) => {
    onMouseDown: () => void
    onMouseUp: () => void
    onMouseLeave: () => void
  }

  // UI state
  toggleServiceExpanded: (serviceId: string) => void
}

/**
 * Hook: useServiceManagement
 *
 * Extracts all service CRUD operations, drag & drop, and expanded/collapsed
 * state from ro-detail-view. Manages database synchronization for services
 * and all their line items (parts, labor, sublets, hazmat, fees).
 *
 * @param params.workOrderId - Work order ID (string or number)
 * @param params.convertDbServicesToServiceData - Conversion function (kept in main file)
 */
export function useServiceManagement({
  workOrderId,
  convertDbServicesToServiceData,
}: UseServiceManagementParams): UseServiceManagementReturn {
  // Service list state
  const [services, setServices] = useState<ServiceData[]>([])
  const [servicesLoading, setServicesLoading] = useState(false)

  // Drag & drop state
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [dragEnabledIndex, setDragEnabledIndex] = useState<number | null>(null)

  // Expanded/collapsed UI state
  const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set())

  // Normalize the work order ID
  const woId = workOrderId ? String(workOrderId) : null

  // ─── Load Services ───────────────────────────────────────────────────

  const reloadServices = useCallback(async () => {
    if (!woId) return
    try {
      const response = await fetch(`/api/work-orders/${woId}/services`)
      if (response.ok) {
        const data = await response.json()
        const loaded = convertDbServicesToServiceData(data.services || [])
        setServices(loaded)
      }
    } catch (error) {
      console.error("Error reloading services:", error)
    }
  }, [woId, convertDbServicesToServiceData])

  // Auto-load services when work order ID becomes available
  useEffect(() => {
    if (!woId) return

    const loadServices = async () => {
      setServicesLoading(true)
      try {
        const response = await fetch(`/api/work-orders/${woId}/services`)
        if (response.ok) {
          const data = await response.json()
          console.log("✓ Loaded", data.services?.length || 0, "services from database")
          const loaded = convertDbServicesToServiceData(data.services || [])
          setServices(loaded)
        } else {
          console.log("No services found for this work order")
        }
      } catch (error) {
        console.error("Error loading services:", error)
      } finally {
        setServicesLoading(false)
      }
    }

    loadServices()
  }, [woId, convertDbServicesToServiceData])

  // ─── Service CRUD ────────────────────────────────────────────────────

  const updateService = useCallback(
    async (updated: ServiceData) => {
      if (!woId) {
        setServices((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
        return
      }

      const previous = services.find((s) => s.id === updated.id)
      setServices((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))

      if (!previous) return

      // Extract database service_id from the service id (e.g., "svc-123" -> 123)
      const dbServiceId = parseInt(updated.id.replace("svc-", ""), 10)

      // Update the service record itself (title, description)
      await fetch(`/api/work-orders/${woId}/services`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
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

        // Delete removed items
        for (const prevItem of prevItems) {
          if (!nextIds.has(prevItem.id)) {
            const dbId = parseDbId(prevItem.id)
            if (dbId) {
              await fetch(`/api/work-orders/${woId}/items?item_id=${dbId}`, {
                method: "DELETE",
              })
            }
          }
        }

        // Create or update items
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
            is_taxable: true, // TODO: Move to shop settings
            display_order: 0,
            service_id: dbServiceId,
          }

          if (dbId) {
            // Update existing item
            await fetch(`/api/work-orders/${woId}/items`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ item_id: dbId, ...payload }),
            })
            syncedItems.push(item)
          } else {
            // Create new item
            const response = await fetch(`/api/work-orders/${woId}/items`, {
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

      setServices((prev) => prev.map((s) => (s.id === updated.id ? updatedWithIds : s)))
    },
    [services, woId]
  )

  const removeService = useCallback(
    async (id: string) => {
      if (!woId) return

      console.log("=== DELETING SERVICE ===")
      console.log("Service ID:", id)

      const dbServiceId = id.replace("svc-", "")

      try {
        const response = await fetch(`/api/work-orders/${woId}/services?service_id=${dbServiceId}`, {
          method: "DELETE",
        })

        if (response.ok) {
          console.log("✓ Deleted from database")
          setServices((prev) => prev.filter((s) => s.id !== id))
        } else {
          console.error("✗ Failed to delete from database")
        }
      } catch (error) {
        console.error("Error deleting service:", error)
      }
    },
    [woId]
  )

  const addService = useCallback(async () => {
    if (!woId) return

    console.log("=== ADDING NEW SERVICE ===")

    try {
      const response = await fetch(`/api/work-orders/${woId}/services`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "New Service",
          description: "",
          display_order: services.length,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        console.log("✓ Saved to database - ID:", data.service?.id)

        // Reload services from database to get proper IDs
        await reloadServices()
      } else {
        console.error("✗ Failed to save to database")
      }
    } catch (error) {
      console.error("Error adding service:", error)
    }
  }, [woId, services.length, reloadServices])

  // ─── Drag & Drop ────────────────────────────────────────────────────

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDragIndex(index)
    e.dataTransfer.effectAllowed = "move"
  }, [])

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault()
      if (dragIndex !== null && dragIndex !== index) {
        setDragOverIndex(index)
      }
    },
    [dragIndex]
  )

  const handleDragEnd = useCallback(() => {
    if (dragIndex !== null && dragOverIndex !== null && dragIndex !== dragOverIndex) {
      setServices((prev) => {
        const newServices = [...prev]
        const [removed] = newServices.splice(dragIndex, 1)
        newServices.splice(dragOverIndex, 0, removed)
        return newServices
      })
    }
    setDragIndex(null)
    setDragOverIndex(null)
  }, [dragIndex, dragOverIndex])

  const createDragHandleProps = useCallback(
    (index: number) => ({
      onMouseDown: () => setDragEnabledIndex(index),
      onMouseUp: () => setDragEnabledIndex(null),
      onMouseLeave: () => setDragEnabledIndex(null),
    }),
    []
  )

  // ─── Expanded/Collapsed UI State ────────────────────────────────────

  const toggleServiceExpanded = useCallback((serviceId: string) => {
    setExpandedServices((prev) => {
      const next = new Set(prev)
      if (next.has(serviceId)) {
        next.delete(serviceId)
      } else {
        next.add(serviceId)
      }
      return next
    })
  }, [])

  return {
    // State
    services,
    setServices,
    servicesLoading,

    // Drag & drop state
    dragIndex,
    dragOverIndex,
    dragEnabledIndex,

    // Expanded state
    expandedServices,

    // CRUD operations
    updateService,
    removeService,
    addService,
    reloadServices,

    // Drag & drop handlers
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    createDragHandleProps,

    // UI state
    toggleServiceExpanded,
  }
}
