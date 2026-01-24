"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Edit2, Mail, Phone, MessageSquare, MapPin, Calendar, DollarSign, Loader2 } from "lucide-react"
import { VehicleManagement } from "./vehicle-management"

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
  is_active: boolean
  created_at: string
}

export function CustomerProfile({ customerId, onClose }: { customerId: string; onClose?: () => void }) {
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchCustomer = async () => {
      setLoading(true)
      setError(null)
      
      try {
        const response = await fetch(`/v0/api/customers/${customerId}`)
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

    if (customerId) {
      fetchCustomer()
    }
  }, [customerId])

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
        <Button size="icon" className="gap-2">
          <Edit2 size={18} />
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Information */}
          <Card className="p-6 border-border">
            <h2 className="text-lg font-semibold text-foreground mb-4">Contact Information</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Phone size={18} className="text-accent flex-shrink-0" />
                <div>
                  <p className="text-sm text-muted-foreground">Primary Phone</p>
                  <p className="font-medium text-foreground">{customer.phone_primary}</p>
                  {customer.phone_secondary && (
                    <p className="text-sm text-muted-foreground">Secondary: {customer.phone_secondary}</p>
                  )}
                  {customer.phone_mobile && (
                    <p className="text-sm text-muted-foreground">Mobile: {customer.phone_mobile}</p>
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
            <Button className="w-full">Create New RO</Button>
            <Button variant="outline" className="w-full bg-transparent">
              View History
            </Button>
            <Button variant="outline" className="w-full bg-transparent">
              Schedule Appointment
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
