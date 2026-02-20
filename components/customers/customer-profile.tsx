"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Edit2, Mail, Phone, MessageSquare, MapPin, Calendar, Loader2, ChevronRight, FileText } from "lucide-react"
import { VehicleManagement } from "./vehicle-management"
import { CustomerCreateDialog } from "./customer-create-dialog"
import { formatPhoneNumber } from "@/lib/utils/phone-format"

interface Customer {
  id: string
  customer_name: string
  first_name: string | null
  last_name: string | null
  phone_primary: string
  phone_secondary: string | null
  phone_mobile: string | null
  email: string | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state: string | null
  zip: string | null
  customer_type: string
  notes: string | null
  is_active: boolean
  created_at: string
}

export function CustomerProfile({ customerId, onClose }: { customerId: string; onClose?: () => void }) {
  const router = useRouter()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null)
  const [workOrders, setWorkOrders] = useState<any[]>([])
  const [woLoading, setWoLoading] = useState(true)

  useEffect(() => {
    const fetchCustomer = async () => {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch(`/api/customers/${customerId}`)
        if (!response.ok) {
          throw new Error("Failed to load customer")
        }
        const data = await response.json()
        setCustomer(data.customer)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    const fetchWorkOrders = async () => {
      setWoLoading(true)
      try {
        const response = await fetch(`/api/work-orders?customer_id=${customerId}`)
        if (response.ok) {
          const data = await response.json()
          setWorkOrders(data.work_orders || [])
        }
      } catch {
        // Non-critical, just leave empty
      } finally {
        setWoLoading(false)
      }
    }

    if (customerId) {
      fetchCustomer()
      fetchWorkOrders()
    }
  }, [customerId])

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  const handleEditSuccess = async () => {
    // Reload customer data after successful edit
    try {
      const response = await fetch(`/api/customers/${customerId}`)
      if (response.ok) {
        const data = await response.json()
        setCustomer(data.customer)
        showToast("Customer updated successfully", "success")
      }
    } catch (err) {
      console.error('Failed to reload customer:', err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-muted-foreground" size={32} />
      </div>
    )
  }

  if (error || !customer) {
    return (
      <Card className="p-12 text-center">
        <p className="text-destructive mb-2">Error loading customer</p>
        <p className="text-sm text-muted-foreground mb-4">{error || "Customer not found"}</p>
        {onClose && <Button onClick={onClose} variant="outline">Go Back</Button>}
      </Card>
    )
  }

  const fullAddress = [
    customer.address_line1,
    customer.address_line2,
    [customer.city, customer.state, customer.zip].filter(Boolean).join(", ")
  ].filter(Boolean).join(", ")

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} className="text-muted-foreground">
              <ArrowLeft size={20} />
            </Button>
          )}
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-accent to-blue-600 flex items-center justify-center text-accent-foreground font-bold text-2xl">
            {customer.customer_name.charAt(0)}
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">{customer.customer_name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={customer.is_active ? "bg-green-500/20 text-green-700 dark:text-green-400" : "bg-muted"}>
                {customer.is_active ? "Active Customer" : "Inactive"}
              </Badge>
              <Badge variant="outline">{customer.customer_type}</Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Information */}
          <Card className="p-6 border-border relative">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Contact Information</h2>
              <Button size="icon" variant="ghost" onClick={() => setEditOpen(true)} className="text-muted-foreground hover:text-foreground">
                <Edit2 size={16} />
              </Button>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Phone size={18} className="text-accent flex-shrink-0" />
                <div>
                  <p className="text-sm text-muted-foreground">Primary Phone</p>
                  <p className="font-medium text-foreground">{formatPhoneNumber(customer.phone_primary)}</p>
                  {customer.phone_secondary && (
                    <p className="text-sm text-muted-foreground">Secondary: {formatPhoneNumber(customer.phone_secondary)}</p>
                  )}
                  {customer.phone_mobile && (
                    <p className="text-sm text-muted-foreground">Mobile: {formatPhoneNumber(customer.phone_mobile)}</p>
                  )}
                </div>
              </div>
              {customer.email && (
                <div className="flex items-center gap-3">
                  <Mail size={18} className="text-accent flex-shrink-0" />
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium text-foreground">{customer.email}</p>
                  </div>
                </div>
              )}
              {fullAddress && (
                <div className="flex items-center gap-3">
                  <MapPin size={18} className="text-accent flex-shrink-0" />
                  <div>
                    <p className="text-sm text-muted-foreground">Address</p>
                    <p className="font-medium text-foreground">{fullAddress}</p>
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-4 pt-4 border-t border-border">
              <Button size="sm" variant="outline" className="gap-2 flex-1 bg-transparent">
                <MessageSquare size={16} />
                Send SMS
              </Button>
              <Button size="sm" variant="outline" className="gap-2 flex-1 bg-transparent">
                <Phone size={16} />
                Call
              </Button>
              <Button size="sm" variant="outline" className="gap-2 flex-1 bg-transparent">
                <Mail size={16} />
                Email
              </Button>
            </div>
          </Card>

          {/* Vehicles */}
          <VehicleManagement customerId={customerId} />

          {/* Repair Order History */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Repair Orders</h2>
            </div>

            {woLoading ? (
              <Card className="p-8 border-border text-center">
                <Loader2 className="mx-auto text-muted-foreground mb-2 animate-spin" size={24} />
                <p className="text-sm text-muted-foreground">Loading repair orders...</p>
              </Card>
            ) : workOrders.length > 0 ? (
              <div className="space-y-3">
                {workOrders.map((wo) => {
                  const statusColor: Record<string, string> = {
                    estimate: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
                    approved: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
                    in_progress: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
                    waiting_on_parts: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
                    completed: "bg-green-500/10 text-green-700 dark:text-green-400",
                  }
                  const statusLabel: Record<string, string> = {
                    estimate: "Estimate",
                    approved: "Approved",
                    in_progress: "In Progress",
                    waiting_on_parts: "Waiting on Parts",
                    completed: "Completed",
                  }
                  const paymentColor =
                    wo.payment_status === "paid" ? "bg-green-500/20 text-green-700 dark:text-green-400"
                    : wo.payment_status === "partial" ? "bg-amber-500/20 text-amber-700 dark:text-amber-400"
                    : "bg-muted text-muted-foreground"

                  return (
                    <Card
                      key={wo.id}
                      className="p-4 border-border cursor-pointer hover:bg-muted/30 transition-colors group"
                      onClick={() => router.push(`/repair-orders/${wo.id}`)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-foreground">{wo.ro_number}</span>
                            <Badge variant="outline" className={statusColor[wo.state] || "bg-muted text-muted-foreground"}>
                              {statusLabel[wo.state] || wo.state}
                            </Badge>
                            <Badge variant="outline" className={paymentColor}>
                              {wo.payment_status === "paid" ? "Paid" : wo.payment_status === "partial" ? "Partial" : "Unpaid"}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>{wo.year} {wo.make} {wo.model}</span>
                            <span>${parseFloat(wo.total).toFixed(2)}</span>
                            <span>{new Date(wo.date_opened).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <ChevronRight className="text-muted-foreground group-hover:text-accent transition-colors flex-shrink-0" size={20} />
                      </div>
                    </Card>
                  )
                })}
              </div>
            ) : (
              <Card className="p-8 border-border text-center">
                <FileText className="mx-auto text-muted-foreground mb-2" size={24} />
                <p className="text-muted-foreground mb-4">No repair orders yet</p>
                <Button onClick={() => router.push(`/repair-orders/new?customerId=${customer.id}`)} variant="outline" size="sm">
                  Create First RO
                </Button>
              </Card>
            )}
          </div>

        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Statistics */}
          <Card className="p-6 border-border">
            <h2 className="text-sm font-semibold text-muted-foreground mb-4">STATISTICS</h2>
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Calendar size={16} className="text-accent" />
                  <p className="text-sm text-muted-foreground">Customer Since</p>
                </div>
                <p className="font-semibold text-foreground">{new Date(customer.created_at).toLocaleDateString()}</p>
              </div>
            </div>
          </Card>

          {/* Quick Actions */}
          <div className="space-y-2">
            <Button className="w-full" onClick={() => router.push(`/repair-orders/new?customerId=${customer.id}`)}>
              Create New RO
            </Button>
            <Button variant="outline" className="w-full bg-transparent">
              View History
            </Button>
            <Button variant="outline" className="w-full bg-transparent">
              Schedule Appointment
            </Button>
          </div>
        </div>
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

      {/* Edit Customer Dialog */}
      <CustomerCreateDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        onSuccess={handleEditSuccess}
        customer={customer || undefined}
      />
    </div>
  )
}
