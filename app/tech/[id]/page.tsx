'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Check,
  Loader2,
  Send,
} from 'lucide-react'
import { jobStateBadgeStyle } from '@/lib/job-states'
import { STATUS_BG_CLASSES } from '@/lib/tech-helpers'
import type { TechService, TechInspectionItem } from '@/lib/tech-helpers'
import { InspectionItemOverlay } from '@/components/tech/inspection-item-overlay'

interface TechWorkOrderDetail {
  id: number
  ro_number: string
  vehicle_id: number
  created_by: number | null
  job_state_id: number | null
  assigned_tech_id: number | null
  year: number
  make: string
  model: string
  vin: string
  job_state_name: string | null
  job_state_color: string | null
  job_state_icon: string | null
  job_state_slug: string | null
  creator_name: string | null
  creator_id: number | null
}

export default function TechROView() {
  const params = useParams()
  const router = useRouter()
  const roId = params.id as string

  const [workOrder, setWorkOrder] = useState<TechWorkOrderDetail | null>(null)
  const [services, setServices] = useState<TechService[]>([])
  const [needsEstimateStateId, setNeedsEstimateStateId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [transferring, setTransferring] = useState(false)
  const [expandedServices, setExpandedServices] = useState<Set<number>>(new Set())
  const [activeInspectionItem, setActiveInspectionItem] = useState<TechInspectionItem | null>(null)
  const [activeInspectionServiceId, setActiveInspectionServiceId] = useState<number | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem('auth_token')
    return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' }
  }, [])

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }, [])

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/tech/ro/${roId}`, {
        headers: getAuthHeaders(),
      })
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setWorkOrder(data.work_order)
      setServices(data.services || [])
      setNeedsEstimateStateId(data.needs_estimate_state_id)

      // Auto-expand services that have inspection items
      const withInspections = new Set<number>()
      for (const svc of data.services || []) {
        if (svc.inspection_items?.length > 0) {
          withInspections.add(svc.id)
        }
      }
      setExpandedServices(withInspections)
    } catch (err) {
      console.error('Error fetching tech RO:', err)
    } finally {
      setLoading(false)
    }
  }, [roId, getAuthHeaders])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const toggleService = (serviceId: number) => {
    setExpandedServices((prev) => {
      const next = new Set(prev)
      if (next.has(serviceId)) {
        next.delete(serviceId)
      } else {
        next.add(serviceId)
      }
      return next
    })
  }

  const handleMarkComplete = async (serviceId: number) => {
    try {
      const res = await fetch(`/api/work-orders/${workOrder?.id}/services`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ service_id: serviceId, status: 'COMPLETED' }),
      })
      if (res.ok) {
        setServices((prev) =>
          prev.map((s) => (s.id === serviceId ? { ...s, status: 'COMPLETED' } : s))
        )
        showToast('Service marked complete', 'success')
      }
    } catch {
      showToast('Failed to update service', 'error')
    }
  }

  const handleTransferToSA = async () => {
    if (!workOrder || !needsEstimateStateId) return

    const toUserId = workOrder.creator_id || workOrder.assigned_tech_id
    if (!toUserId) {
      showToast('No service advisor found to transfer to', 'error')
      return
    }

    setTransferring(true)
    try {
      const res = await fetch(`/api/work-orders/${workOrder.id}/transfer`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          to_user_id: toUserId,
          to_state_id: needsEstimateStateId,
          note: 'Inspection complete — transferred from tech app',
        }),
      })
      if (res.ok) {
        showToast('Transferred to Service Advisor', 'success')
        setTimeout(() => router.push('/tech'), 500)
      } else {
        const data = await res.json()
        showToast(data.error || 'Transfer failed', 'error')
      }
    } catch {
      showToast('Transfer failed', 'error')
    } finally {
      setTransferring(false)
    }
  }

  const handleInspectionItemTap = (item: TechInspectionItem, serviceId: number) => {
    setActiveInspectionItem(item)
    setActiveInspectionServiceId(serviceId)
  }

  const handleInspectionSave = (updated: TechInspectionItem) => {
    // Update the item in the services list
    setServices((prev) =>
      prev.map((svc) => {
        if (svc.id !== activeInspectionServiceId) return svc
        return {
          ...svc,
          inspection_items: svc.inspection_items.map((item) =>
            item.id === updated.id ? updated : item
          ),
        }
      })
    )
    setActiveInspectionItem(null)
    setActiveInspectionServiceId(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={32} className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!workOrder) {
    return (
      <div className="px-4 pt-8 text-center">
        <p className="text-destructive font-medium">Work order not found</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/tech')}>
          Back to Dashboard
        </Button>
      </div>
    )
  }

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-border bg-background sticky top-14 z-40">
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={() => router.push('/tech')}
            className="p-2 -ml-2 rounded-lg hover:bg-muted active:bg-muted/80 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold text-foreground">{workOrder.ro_number}</h1>
          {workOrder.job_state_name && workOrder.job_state_color && (
            <Badge
              className="text-xs font-medium border"
              style={jobStateBadgeStyle(workOrder.job_state_color)}
            >
              {workOrder.job_state_name}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground font-medium ml-10">
          {workOrder.year} {workOrder.make} {workOrder.model}
        </p>
      </div>

      {/* Services List */}
      <div className="px-4 pt-3 space-y-3">
        {services.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No services on this RO</p>
        ) : (
          services.map((service) => {
            const isExpanded = expandedServices.has(service.id)
            const hasInspection = service.inspection_items?.length > 0
            const inspected = hasInspection
              ? service.inspection_items.filter((i) => i.status !== 'pending').length
              : 0
            const total = hasInspection ? service.inspection_items.length : 0
            const isCompleted = service.status === 'COMPLETED'

            return (
              <Card key={service.id} className="border-border overflow-hidden">
                {/* Service header */}
                <button
                  onClick={() => toggleService(service.id)}
                  className="w-full flex items-center justify-between p-4 text-left active:bg-muted/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground truncate">
                        {service.title}
                      </span>
                      {isCompleted && (
                        <Badge className="bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/20 text-xs">
                          Done
                        </Badge>
                      )}
                    </div>
                    {hasInspection && (
                      <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                        <ClipboardCheck size={12} />
                        <span>{inspected}/{total} inspected</span>
                      </div>
                    )}
                  </div>
                  {isExpanded ? (
                    <ChevronDown size={20} className="text-muted-foreground flex-shrink-0" />
                  ) : (
                    <ChevronRight size={20} className="text-muted-foreground flex-shrink-0" />
                  )}
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-border">
                    {hasInspection ? (
                      <div className="divide-y divide-border">
                        {service.inspection_items.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => handleInspectionItemTap(item, service.id)}
                            className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-muted/30 transition-colors"
                            style={{ minHeight: '52px' }}
                          >
                            <div
                              className={`w-4 h-4 rounded-full flex-shrink-0 ${STATUS_BG_CLASSES[item.status] || 'bg-gray-400'}`}
                            />
                            <span className="text-sm text-foreground flex-1">
                              {item.item_name}
                            </span>
                            {item.photos?.length > 0 && (
                              <span className="text-xs text-muted-foreground">
                                {item.photos.length} photo{item.photos.length !== 1 ? 's' : ''}
                              </span>
                            )}
                            <ChevronRight size={16} className="text-muted-foreground flex-shrink-0" />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4">
                        {isCompleted ? (
                          <div className="flex items-center gap-2 text-green-600 text-sm">
                            <Check size={16} />
                            <span>Service completed</span>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            className="w-full h-12 text-base"
                            onClick={() => handleMarkComplete(service.id)}
                          >
                            <Check size={18} className="mr-2" />
                            Mark Complete
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )
          })
        )}
      </div>

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 z-40">
        <Button
          onClick={handleTransferToSA}
          disabled={transferring || !needsEstimateStateId}
          className="w-full h-14 text-base font-medium gap-2"
          variant="default"
        >
          {transferring ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            <Send size={20} />
          )}
          Transfer to Service Advisor
        </Button>
      </div>

      {/* Inspection Item Overlay */}
      {activeInspectionItem && workOrder && (
        <InspectionItemOverlay
          item={activeInspectionItem}
          roId={workOrder.id}
          vehicleYMM={`${workOrder.year} ${workOrder.make} ${workOrder.model}`}
          onClose={() => {
            setActiveInspectionItem(null)
            setActiveInspectionServiceId(null)
          }}
          onSave={handleInspectionSave}
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-16 left-4 right-4 z-[60] rounded-lg px-4 py-3 text-sm shadow-lg border ${
            toast.type === 'success'
              ? 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20'
              : 'bg-destructive/10 text-destructive border-destructive/20'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  )
}
