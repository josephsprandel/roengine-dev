"use client"

import { useState, useEffect, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Search, Plus, Check, Phone, Mail, User, Loader2 } from "lucide-react"
import { CustomerCreateDialog } from "@/components/customers/customer-create-dialog"
import type { CustomerData } from "../ro-creation-wizard"

interface CustomerSelectionStepProps {
  selectedCustomer: CustomerData | null
  onSelectCustomer: (customer: CustomerData | null) => void
  initialCustomerId?: string
}

interface Customer {
  id: string
  customer_name: string
  phone_primary: string
  email: string | null
  customer_type: string
}

export function CustomerSelectionStep({
  selectedCustomer,
  onSelectCustomer,
  initialCustomerId,
}: CustomerSelectionStepProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(false)

  const fetchCustomers = useCallback(async (search?: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: "50" })
      if (search) {
        params.set("search", search)
      }
      
      const response = await fetch(`/api/customers?${params}`)
      if (!response.ok) throw new Error("Failed to fetch customers")
      
      const data = await response.json()
      setCustomers(data.customers || [])
    } catch (error) {
      console.error("Error fetching customers:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchCustomers(searchTerm)
    }, 300)

    return () => clearTimeout(debounce)
  }, [searchTerm, fetchCustomers])

  useEffect(() => {
    if (!initialCustomerId) return

    const fetchInitialCustomer = async () => {
      try {
        const response = await fetch(`/api/customers/${initialCustomerId}`)
        if (!response.ok) {
          throw new Error("Failed to fetch customer")
        }
        const data = await response.json()
        onSelectCustomer({
          id: data.customer.id,
          name: data.customer.customer_name,
          phone: data.customer.phone_primary,
          email: data.customer.email || "",
          isNew: false,
        })
      } catch (error) {
        console.error("Failed to preload customer:", error)
      }
    }

    fetchInitialCustomer()
  }, [initialCustomerId, onSelectCustomer])

  const handleSelectExisting = (customer: Customer) => {
    onSelectCustomer({
      id: customer.id,
      name: customer.customer_name,
      phone: customer.phone_primary,
      email: customer.email || "",
      isNew: false,
    })
  }

  const handleCustomerCreated = async () => {
    // Refresh customer list to show the newly created customer
    await fetchCustomers(searchTerm)
    // The user will then need to select it from the list
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-1">Select Customer</h2>
        <p className="text-sm text-muted-foreground">
          Search for an existing customer or create a new one
        </p>
      </div>

      {/* Search and Create New */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={18} />
          <Input
            placeholder="Search by name, phone, or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-card border-border"
          />
        </div>
        <Button
          variant="outline"
          onClick={() => setShowCreateDialog(true)}
          className="bg-transparent"
        >
          <Plus size={18} className="mr-2" />
          New Customer
        </Button>
      </div>

      {/* Customer Create Dialog */}
      <CustomerCreateDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={handleCustomerCreated}
      />

      {/* Existing Customers List */}
      <div className="space-y-2">
        {loading ? (
            <Card className="p-12 border-border text-center">
              <Loader2 className="mx-auto text-muted-foreground mb-3 animate-spin" size={32} />
              <p className="text-muted-foreground">Loading customers...</p>
            </Card>
          ) : customers.length > 0 ? (
            customers.map((customer) => {
              const isSelected = selectedCustomer?.id === customer.id
              return (
                <Card
                  key={customer.id}
                  onClick={() => handleSelectExisting(customer)}
                  className={`p-4 border cursor-pointer transition-all ${
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-semibold ${
                        isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      }`}>
                        {customer.customer_name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-foreground">{customer.customer_name}</h3>
                          {customer.customer_type === "business" && (
                            <Badge variant="outline" className="text-xs">Business</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-0.5">
                          <span className="flex items-center gap-1">
                            <Phone size={14} />
                            {customer.phone_primary}
                          </span>
                          {customer.email && (
                            <span className="flex items-center gap-1">
                              <Mail size={14} />
                              {customer.email}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {isSelected && (
                        <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                          <Check size={14} className="text-primary-foreground" />
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              )
            })
          ) : (
            <Card className="p-12 border-border text-center">
              <User className="mx-auto text-muted-foreground mb-3" size={32} />
              <p className="text-muted-foreground">No customers found</p>
              <Button variant="link" onClick={() => setShowCreateDialog(true)} className="mt-2">
                Create new customer
              </Button>
            </Card>
          )}
      </div>
    </div>
  )
}
