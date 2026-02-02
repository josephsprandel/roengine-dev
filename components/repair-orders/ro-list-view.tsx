"use client"

import { useState, useEffect, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Plus, Download, ChevronRight, Search, Loader2, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useAuth } from "@/contexts/auth-context"
import { Pagination, PaginationInfo } from "@/components/ui/pagination"

interface WorkOrder {
  id: string
  ro_number: string
  customer_id: string
  vehicle_id: string
  state: string
  date_opened: string
  date_promised: string | null
  customer_concern: string | null
  labor_total: string
  parts_total: string
  tax_amount: string
  total: string
  payment_status: string
  customer_name: string
  phone_primary: string
  year: number
  make: string
  model: string
  vin: string
  license_plate: string | null
}

export function ROListView({ onSelectRO }: { onSelectRO?: (roId: string) => void }) {
  const router = useRouter()
  const { hasPermission } = useAuth()
  const [selectedFilter, setSelectedFilter] = useState<string>("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalWorkOrders, setTotalWorkOrders] = useState(0)
  const itemsPerPage = 50

  const fetchWorkOrders = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const offset = (currentPage - 1) * itemsPerPage
      const params = new URLSearchParams({
        limit: itemsPerPage.toString(),
        offset: offset.toString()
      })
      
      if (selectedFilter !== "all") {
        params.set("state", selectedFilter)
      }
      
      if (searchTerm) {
        params.set("search", searchTerm)
      }

      const response = await fetch(`/api/work-orders?${params}`)
      if (!response.ok) {
        throw new Error("Failed to fetch work orders")
      }

      const data = await response.json()
      setWorkOrders(data.work_orders || [])
      setTotalWorkOrders(data.pagination?.total || 0)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [searchTerm, selectedFilter, currentPage])

  useEffect(() => {
    fetchWorkOrders()
  }, [fetchWorkOrders])

  // Reset to page 1 when search or filter changes
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1)
    }
  }, [searchTerm, selectedFilter])


  // Count work orders by state
  const getFilterCounts = () => {
    const counts = {
      all: workOrders.length,
      estimate: 0,
      approved: 0,
      in_progress: 0,
      completed: 0,
    }

    workOrders.forEach((wo) => {
      if (wo.state === "estimate") counts.estimate++
      else if (wo.state === "approved") counts.approved++
      else if (wo.state === "in_progress") counts.in_progress++
      else if (wo.state === "completed") counts.completed++
    })

    return counts
  }

  const counts = getFilterCounts()

  const filters = [
    { id: "all", label: "All ROs", count: counts.all },
    { id: "estimate", label: "Estimates", count: counts.estimate },
    { id: "approved", label: "Approved", count: counts.approved },
    { id: "in_progress", label: "In Progress", count: counts.in_progress },
    { id: "completed", label: "Completed", count: counts.completed },
  ]

  const getStatusColor = (state: string) => {
    switch (state) {
      case "estimate":
        return "bg-amber-500/10 text-amber-700 dark:text-amber-400"
      case "approved":
        return "bg-purple-500/10 text-purple-700 dark:text-purple-400"
      case "in_progress":
        return "bg-blue-500/10 text-blue-700 dark:text-blue-400"
      case "completed":
        return "bg-green-500/10 text-green-700 dark:text-green-400"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  const getStatusLabel = (state: string) => {
    switch (state) {
      case "estimate":
        return "📋 Estimate"
      case "approved":
        return "✓ Approved"
      case "in_progress":
        return "⚙ In Progress"
      case "completed":
        return "✓ Completed"
      default:
        return state
    }
  }

  const getPaymentBadge = (paymentStatus: string) => {
    if (paymentStatus === "paid") return "bg-green-500/20 text-green-700 dark:text-green-400"
    if (paymentStatus === "partial") return "bg-amber-500/20 text-amber-700 dark:text-amber-400"
    return "bg-muted text-muted-foreground"
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header with actions */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-foreground mb-2">Repair Orders</h1>
            <p className="text-sm text-muted-foreground">Manage all active and completed service orders</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2 bg-transparent">
              <Download size={16} />
              Export
            </Button>
            <Button size="sm" className="gap-2" onClick={() => router.push('/repair-orders/new')}>
              <Plus size={16} />
              New RO
            </Button>
          </div>
        </div>

        {/* Search and filters */}
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              placeholder="Search by customer, vehicle, or RO number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-card border-border"
            />
          </div>

          {/* Filter tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {filters.map((filter) => (
              <button
                key={filter.id}
                onClick={() => setSelectedFilter(filter.id)}
                className={`px-4 py-2 rounded-lg whitespace-nowrap font-medium text-sm transition-colors ${
                  selectedFilter === filter.id
                    ? "bg-accent text-accent-foreground"
                    : "bg-card border border-border text-muted-foreground hover:bg-muted/50"
                }`}
              >
                {filter.label}
                <span className="ml-2 opacity-70">({filter.count})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Loading and Error States */}
        {loading ? (
          <Card className="p-12 border-border text-center">
            <Loader2 className="mx-auto text-muted-foreground mb-3 animate-spin" size={32} />
            <p className="text-muted-foreground">Loading repair orders...</p>
          </Card>
        ) : error ? (
          <Card className="p-12 border-border text-center">
            <p className="text-destructive mb-2">Error loading repair orders</p>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button onClick={fetchWorkOrders} variant="outline">
              Try Again
            </Button>
          </Card>
        ) : workOrders.length > 0 ? (
          /* RO Cards Grid */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {workOrders.map((wo) => (
              <Card
                key={wo.id}
                className="p-5 border-border cursor-pointer hover:bg-muted/30 transition-colors group"
                onClick={() => router.push(`/repair-orders/${wo.id}`)}
              >
                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-lg text-foreground">{wo.ro_number}</h3>
                        <Badge variant="outline" className={`text-xs ${getPaymentBadge(wo.payment_status)}`}>
                          {wo.payment_status === "paid" && "💰 Paid"}
                          {wo.payment_status === "partial" && "💵 Partial"}
                          {wo.payment_status === "unpaid" && "○ Unpaid"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{wo.customer_name}</p>
                      <p className="text-xs text-muted-foreground">{wo.phone_primary}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {hasPermission('delete_ro') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-800 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={async (e) => {
                            e.stopPropagation()
                            if (!confirm(`Delete ${wo.ro_number}? It can be restored from the recycle bin.`)) return
                            
                            const res = await fetch(`/api/work-orders/${wo.id}/delete`, {
                              method: 'DELETE',
                              headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` }
                            })
                            
                            if (res.ok) {
                              toast.success('Repair order deleted')
                              fetchWorkOrders()
                            } else {
                              const error = await res.json()
                              toast.error(error.error || 'Failed to delete')
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                      <ChevronRight className="text-muted-foreground group-hover:text-accent transition-colors" size={20} />
                    </div>
                  </div>

                  {/* Details */}
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        {wo.year} {wo.make} {wo.model}
                      </span>
                      <span className="font-semibold text-foreground">
                        ${parseFloat(wo.total).toFixed(2)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">VIN: {wo.vin}</p>
                    {wo.customer_concern && (
                      <p className="text-sm text-muted-foreground italic">"{wo.customer_concern}"</p>
                    )}
                  </div>

                  {/* Status and dates */}
                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <Badge variant="outline" className={getStatusColor(wo.state)}>
                      {getStatusLabel(wo.state)}
                    </Badge>
                    <div className="text-xs text-muted-foreground text-right">
                      <p>Opened: {new Date(wo.date_opened).toLocaleDateString()}</p>
                      {wo.date_promised && (
                        <p>Due: {new Date(wo.date_promised).toLocaleDateString()}</p>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-12 border-border text-center">
            <p className="text-muted-foreground mb-4">No repair orders found</p>
            {searchTerm && (
              <Button onClick={() => setSearchTerm("")} variant="outline" className="mr-2">
                Clear search
              </Button>
            )}
            <Button onClick={() => router.push('/repair-orders/new')} variant="outline">
              <Plus size={16} className="mr-2" />
              Create First RO
            </Button>
          </Card>
        )}

        {/* Pagination */}
        {!loading && workOrders.length > 0 && (
          <div className="flex items-center justify-between">
            <PaginationInfo
              currentPage={currentPage}
              totalPages={Math.ceil(totalWorkOrders / itemsPerPage)}
              totalItems={totalWorkOrders}
              itemsPerPage={itemsPerPage}
            />
            <Pagination
              currentPage={currentPage}
              totalPages={Math.ceil(totalWorkOrders / itemsPerPage)}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

    </>
  )
}
