"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Search, Phone, Mail, MapPin, Plus, Loader2, Upload, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useAuth } from "@/contexts/auth-context"
import { Pagination, PaginationInfo } from "@/components/ui/pagination"
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
  is_active: boolean
  created_at: string
  updated_at: string
}

export function CustomerSearch({ onSelectCustomer }: { onSelectCustomer?: (id: string) => void }) {
  const router = useRouter()
  const { hasPermission } = useAuth()
  const [searchTerm, setSearchTerm] = useState("")
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCustomers, setTotalCustomers] = useState(0)
  const itemsPerPage = 50

  const fetchCustomers = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const offset = (currentPage - 1) * itemsPerPage
      const params = new URLSearchParams({
        limit: itemsPerPage.toString(),
        offset: offset.toString()
      })
      if (searchTerm) {
        params.set("search", searchTerm)
      }

      const response = await fetch(`/api/customers?${params}`)
      if (!response.ok) {
        throw new Error("Failed to fetch customers")
      }

      const data = await response.json()
      setCustomers(data.customers)
      setTotalCustomers(data.pagination?.total || 0)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCustomers()
  }, [searchTerm, currentPage])

  // Reset to page 1 when search changes
  useEffect(() => {
    if (currentPage !== 1 && searchTerm) {
      setCurrentPage(1)
    }
  }, [searchTerm])

  const getCustomerInitials = (customer: Customer) => {
    if (customer.first_name && customer.last_name) {
      return `${customer.first_name[0]}${customer.last_name[0]}`
    }
    return customer.customer_name.substring(0, 2).toUpperCase()
  }

  const getFullAddress = (customer: Customer) => {
    const parts = []
    if (customer.address_line1) parts.push(customer.address_line1)
    if (customer.city) parts.push(customer.city)
    if (customer.state) parts.push(customer.state)
    if (customer.zip) parts.push(customer.zip)
    return parts.join(", ") || "No address on file"
  }

  const handleCardClick = (id: string) => {
    if (onSelectCustomer) {
      onSelectCustomer(id)
      return
    }
    router.push(`/customers/${id}`)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Customers</h1>
        <p className="text-sm text-muted-foreground">Search and manage customer profiles</p>
      </div>

      {/* Search and actions */}
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
          onClick={() => router.push('/customers/import')} 
          className="gap-2 bg-transparent"
        >
          <Upload size={18} />
          Import
        </Button>
        <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
          <Plus size={18} />
          New Customer
        </Button>
      </div>

      {/* Results */}
      <div className="space-y-3">
        {loading ? (
          <Card className="p-12 border-border text-center">
            <Loader2 className="mx-auto text-muted-foreground mb-3 animate-spin" size={32} />
            <p className="text-muted-foreground">Loading customers...</p>
          </Card>
        ) : error ? (
          <Card className="p-12 border-border text-center">
            <p className="text-destructive mb-2">Error loading customers</p>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button onClick={fetchCustomers} variant="outline" className="mt-4">
              Try Again
            </Button>
          </Card>
        ) : customers.length > 0 ? (
          customers.map((customer) => (
            <Card
              key={customer.id}
              className="p-5 border-border cursor-pointer hover:bg-muted/30 transition-colors group"
              onClick={() => handleCardClick(customer.id)}
            >
              <div className="flex items-start justify-between gap-4">
                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-accent to-blue-600 flex items-center justify-center text-accent-foreground font-bold text-lg flex-shrink-0">
                      {getCustomerInitials(customer)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="font-semibold text-foreground">{customer.customer_name}</h3>
                        {customer.customer_type === "business" && (
                          <Badge variant="outline" className="text-xs">
                            Business
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Phone size={14} />
                          {formatPhoneNumber(customer.phone_primary)}
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

                  {/* Secondary info */}
                  <div className="ml-15 space-y-1">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin size={14} />
                      {getFullAddress(customer)}
                    </div>
                    {(customer.phone_secondary || customer.phone_mobile) && (
                      <div className="text-xs text-muted-foreground">
                        {customer.phone_secondary && `Secondary: ${formatPhoneNumber(customer.phone_secondary)}`}
                        {customer.phone_secondary && customer.phone_mobile && " • "}
                        {customer.phone_mobile && `Mobile: ${formatPhoneNumber(customer.phone_mobile)}`}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right side */}
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <div className="flex items-center gap-1">
                    {hasPermission('delete_customer') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-800 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={async (e) => {
                          e.stopPropagation()
                          if (!confirm(`Delete ${customer.customer_name}? It can be restored from the recycle bin.`)) return
                          
                          const res = await fetch(`/api/customers/${customer.id}/delete`, {
                            method: 'DELETE',
                            headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` }
                          })
                          
                          if (res.ok) {
                            toast.success('Customer deleted')
                            fetchCustomers()
                          } else {
                            const error = await res.json()
                            toast.error(error.error || 'Failed to delete')
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                    <Badge
                      className={
                        customer.customer_type === "business"
                          ? "bg-purple-500/20 text-purple-700 dark:text-purple-400"
                          : "bg-green-500/20 text-green-700 dark:text-green-400"
                      }
                    >
                      {customer.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>

                  <p className="text-xs text-muted-foreground text-right">
                    Added
                    <br />
                    {new Date(customer.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </Card>
          ))
        ) : (
          <Card className="p-12 border-border text-center">
            <Search className="mx-auto text-muted-foreground mb-3" size={32} />
            <p className="text-muted-foreground">No customers found</p>
            {searchTerm && (
              <Button
                onClick={() => setSearchTerm("")}
                variant="outline"
                className="mt-4"
              >
                Clear search
              </Button>
            )}
          </Card>
        )}
      </div>

      {/* Pagination */}
      {!loading && customers.length > 0 && (
        <div className="flex items-center justify-between border-t pt-4">
          <PaginationInfo
            currentPage={currentPage}
            totalPages={Math.ceil(totalCustomers / itemsPerPage)}
            totalItems={totalCustomers}
            itemsPerPage={itemsPerPage}
          />
          <Pagination
            currentPage={currentPage}
            totalPages={Math.ceil(totalCustomers / itemsPerPage)}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      {/* Create Dialog */}
      <CustomerCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={fetchCustomers}
      />
    </div>
  )
}
