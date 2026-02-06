"use client"
import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DotsThreeVertical, ChatCircle, CheckCircle, Clock, WarningCircle, CircleNotch } from "@phosphor-icons/react"
import { useRouter } from "next/navigation"

interface RepairOrder {
  id: string
  dbId: number
  customer: string
  vehicle: string
  service: string
  status: string
  statusLabel: string
  estimated: string
  timeLeft: string
}

export function RepairOrdersTable() {
  const router = useRouter()
  const [repairOrders, setRepairOrders] = useState<RepairOrder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchRepairOrders = async () => {
      try {
        const response = await fetch('/api/work-orders?limit=10&status=open,in_progress,estimate,waiting_approval')
        if (response.ok) {
          const data = await response.json()
          const orders = (data.work_orders || []).map((wo: any) => {
            const statusMap: Record<string, { status: string; label: string }> = {
              estimate: { status: 'awaiting_approval', label: 'Awaiting Approval' },
              open: { status: 'in_progress', label: 'In Progress' },
              in_progress: { status: 'in_progress', label: 'In Progress' },
              waiting_approval: { status: 'awaiting_approval', label: 'Awaiting Approval' },
              approved: { status: 'ready', label: 'Ready' },
              completed: { status: 'completed', label: 'Completed' },
            }
            const mapped = statusMap[wo.state] || { status: wo.state, label: wo.state }

            return {
              id: wo.ro_number,
              dbId: wo.id,
              customer: wo.customer_name || 'Unknown',
              vehicle: `${wo.year || ''} ${wo.make || ''} ${wo.model || ''}`.trim() || 'Unknown',
              service: wo.label || 'General Service',
              status: mapped.status,
              statusLabel: mapped.label,
              estimated: `$${parseFloat(wo.total || 0).toFixed(2)}`,
              timeLeft: wo.state === 'completed' ? 'Completed' : 'TBD',
            }
          })
          setRepairOrders(orders)
        }
      } catch (error) {
        console.error('Error fetching repair orders:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchRepairOrders()
  }, [])

  const getStatusStyles = (status: string) => {
    switch (status) {
      case "awaiting_approval":
        return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
      case "in_progress":
        return "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20"
      case "ready":
        return "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20"
      case "completed":
        return "bg-muted text-muted-foreground"
      default:
        return ""
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "awaiting_approval":
        return <WarningCircle size={14} />
      case "in_progress":
        return <Clock size={14} />
      case "ready":
        return <CheckCircle size={14} />
      default:
        return null
    }
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left px-6 py-3 font-semibold text-muted-foreground">RO ID</th>
              <th className="text-left px-6 py-3 font-semibold text-muted-foreground">Customer</th>
              <th className="text-left px-6 py-3 font-semibold text-muted-foreground">Vehicle</th>
              <th className="text-left px-6 py-3 font-semibold text-muted-foreground">Service</th>
              <th className="text-left px-6 py-3 font-semibold text-muted-foreground">Status</th>
              <th className="text-right px-6 py-3 font-semibold text-muted-foreground">Est. Cost</th>
              <th className="text-right px-6 py-3 font-semibold text-muted-foreground">Time Left</th>
              <th className="text-center px-6 py-3 font-semibold text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-center">
                  <CircleNotch className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mt-2">Loading repair orders...</p>
                </td>
              </tr>
            ) : repairOrders.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-center text-muted-foreground">
                  No active repair orders
                </td>
              </tr>
            ) : repairOrders.map((ro) => (
              <tr
                key={ro.id}
                className="border-b border-border hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => router.push(`/repair-orders/${ro.dbId}`)}
              >
                <td className="px-6 py-4 font-semibold text-foreground">{ro.id}</td>
                <td className="px-6 py-4">
                  <div>
                    <p className="font-medium text-foreground">{ro.customer}</p>
                  </div>
                </td>
                <td className="px-6 py-4 text-muted-foreground">{ro.vehicle}</td>
                <td className="px-6 py-4 text-muted-foreground">{ro.service}</td>
                <td className="px-6 py-4">
                  <Badge variant="outline" className={`${getStatusStyles(ro.status)} gap-1 border`}>
                    {getStatusIcon(ro.status)}
                    {ro.statusLabel}
                  </Badge>
                </td>
                <td className="px-6 py-4 text-right font-medium text-foreground">{ro.estimated}</td>
                <td className="px-6 py-4 text-right text-muted-foreground text-xs">{ro.timeLeft}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-accent"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <ChatCircle size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <DotsThreeVertical size={16} />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
