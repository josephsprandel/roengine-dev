"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeftIcon as ArrowLeft, PencilSquareIcon as Edit2, EnvelopeIcon as Mail, PhoneIcon as Phone, ChatBubbleBottomCenterTextIcon as MessageSquare, MapPinIcon as MapPin, CalendarIcon as Calendar, CurrencyDollarIcon as DollarSign, ArrowPathIcon as Loader2 } from "@heroicons/react/24/outline"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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
  const router = useRouter()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null)
  const [formData, setFormData] = useState({
    customer_name: "",
    first_name: "",
    last_name: "",
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

    if (customerId) {
      fetchCustomer()
    }
  }, [customerId])

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  const openEdit = () => {
    if (!customer) return
    setFormData({
      customer_name: customer.customer_name || "",
      first_name: customer.first_name || "",
      last_name: customer.last_name || "",
      phone_primary: customer.phone_primary || "",
      phone_secondary: customer.phone_secondary || "",
      phone_mobile: customer.phone_mobile || "",
      email: customer.email || "",
      address_line1: customer.address_line1 || "",
      address_line2: customer.address_line2 || "",
      city: customer.city || "",
      state: customer.state || "",
      zip: customer.zip || "",
    })
    setEditOpen(true)
  }

  const handleFormChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    if (!customer) return
    setSaving(true)

    const previousCustomer = customer
    const updatedCustomer = {
      ...customer,
      ...formData,
    }
    setCustomer(updatedCustomer)

    try {
      const response = await fetch(`/api/customers/${customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: formData.customer_name,
          first_name: formData.first_name || null,
          last_name: formData.last_name || null,
          phone_primary: formData.phone_primary,
          phone_secondary: formData.phone_secondary || null,
          phone_mobile: formData.phone_mobile || null,
          email: formData.email || null,
          address_line1: formData.address_line1 || null,
          address_line2: formData.address_line2 || null,
          city: formData.city || null,
          state: formData.state || null,
          zip: formData.zip || null,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || "Failed to update customer")
      }

      const data = await response.json()
      setCustomer(data.customer)
      setEditOpen(false)
      showToast("Customer updated successfully", "success")
    } catch (err: any) {
      setCustomer(previousCustomer)
      showToast(err.message || "Failed to update customer", "error")
    } finally {
      setSaving(false)
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
        <Button size="icon" className="gap-2" onClick={openEdit}>
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

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Customer</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={formData.customer_name}
                onChange={(e) => handleFormChange("customer_name", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                value={formData.email}
                onChange={(e) => handleFormChange("email", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Primary Phone</Label>
              <Input
                value={formData.phone_primary}
                onChange={(e) => handleFormChange("phone_primary", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Secondary Phone</Label>
              <Input
                value={formData.phone_secondary}
                onChange={(e) => handleFormChange("phone_secondary", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Mobile Phone</Label>
              <Input
                value={formData.phone_mobile}
                onChange={(e) => handleFormChange("phone_mobile", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Address Line 1</Label>
              <Input
                value={formData.address_line1}
                onChange={(e) => handleFormChange("address_line1", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Address Line 2</Label>
              <Input
                value={formData.address_line2}
                onChange={(e) => handleFormChange("address_line2", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>City</Label>
              <Input
                value={formData.city}
                onChange={(e) => handleFormChange("city", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>State</Label>
              <Input
                value={formData.state}
                onChange={(e) => handleFormChange("state", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Zip</Label>
              <Input
                value={formData.zip}
                onChange={(e) => handleFormChange("zip", e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
