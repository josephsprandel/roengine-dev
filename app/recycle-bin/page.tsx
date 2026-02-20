'use client'

/**
 * Recycle Bin Page
 * 
 * Shows deleted items that can be restored. Items are auto-purged after 30 days.
 */

import { useState, useEffect } from 'react'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RotateCcw, Trash2, AlertCircle, Clock, Wrench, Users, Car } from 'lucide-react'
import { formatPhoneNumber } from '@/lib/utils/phone-format'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/auth-context'

interface WorkOrder {
  id: number
  ro_number: string
  customer_name: string
  vehicle_year: number
  vehicle_make: string
  vehicle_model: string
  state: string
  total: number
  deleted_at: string
  deleted_by_name: string
  days_deleted: number
}

interface Customer {
  id: number
  customer_name: string
  phone_primary: string
  email: string
  deleted_at: string
  deleted_by_name: string
  days_deleted: number
  vehicle_count: number
}

interface Vehicle {
  id: number
  year: number
  make: string
  model: string
  vin: string
  license_plate: string
  customer_name: string
  deleted_at: string
  deleted_by_name: string
  days_deleted: number
}

interface RecycleBinData {
  workOrders: WorkOrder[]
  customers: Customer[]
  vehicles: Vehicle[]
  permissions: {
    canRestoreRO: boolean
    canRestoreCustomer: boolean
    canRestoreVehicle: boolean
  }
}

export default function RecycleBinPage() {
  const { hasPermission } = useAuth()
  const [data, setData] = useState<RecycleBinData | null>(null)
  const [loading, setLoading] = useState(true)
  const [restoring, setRestoring] = useState<string | null>(null)

  useEffect(() => {
    fetchDeletedItems()
  }, [])

  async function fetchDeletedItems() {
    setLoading(true)
    try {
      const token = localStorage.getItem('auth_token')
      const res = await fetch('/api/recycle-bin', {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      if (res.ok) {
        const data = await res.json()
        setData(data)
      } else {
        const error = await res.json()
        toast.error(error.error || 'Failed to load recycle bin')
      }
    } catch (error) {
      toast.error('Failed to load recycle bin')
    }
    setLoading(false)
  }

  async function handleRestore(type: 'work-orders' | 'customers' | 'vehicles', id: number, name: string) {
    const key = `${type}-${id}`
    setRestoring(key)
    
    try {
      const token = localStorage.getItem('auth_token')
      const res = await fetch(`/api/${type}/${id}/restore`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      })
      
      if (res.ok) {
        toast.success(`${name} restored successfully`)
        fetchDeletedItems()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Failed to restore item')
      }
    } catch (error) {
      toast.error('Failed to restore item')
    }
    
    setRestoring(null)
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  const totalItems = data 
    ? data.workOrders.length + data.customers.length + data.vehicles.length 
    : 0

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-muted">
                <Trash2 size={24} className="text-foreground" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">Recycle Bin</h1>
                <p className="text-sm text-muted-foreground">
                  Deleted items can be restored within 30 days
                </p>
              </div>
            </div>

            {loading ? (
              <Card className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-4 text-muted-foreground">Loading deleted items...</p>
              </Card>
            ) : !data ? (
              <Card className="p-8 text-center">
                <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium">Unable to load recycle bin</p>
                <p className="text-sm text-muted-foreground mt-2">
                  You may not have permission to view deleted items.
                </p>
              </Card>
            ) : totalItems === 0 ? (
              <Card className="p-8 text-center">
                <Trash2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium">Recycle bin is empty</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Deleted items will appear here for 30 days before being permanently removed.
                </p>
              </Card>
            ) : (
              <Tabs defaultValue="ros" className="space-y-6">
                <TabsList className="bg-muted/50 p-1">
                  <TabsTrigger value="ros" className="flex items-center gap-2 data-[state=active]:bg-background">
                    <Wrench size={16} />
                    Repair Orders ({data.workOrders.length})
                  </TabsTrigger>
                  <TabsTrigger value="customers" className="flex items-center gap-2 data-[state=active]:bg-background">
                    <Users size={16} />
                    Customers ({data.customers.length})
                  </TabsTrigger>
                  <TabsTrigger value="vehicles" className="flex items-center gap-2 data-[state=active]:bg-background">
                    <Car size={16} />
                    Vehicles ({data.vehicles.length})
                  </TabsTrigger>
                </TabsList>

                {/* Work Orders Tab */}
                <TabsContent value="ros">
                  {data.workOrders.length === 0 ? (
                    <Card className="p-6 text-center text-muted-foreground">
                      No deleted repair orders
                    </Card>
                  ) : (
                    <div className="space-y-3">
                      {data.workOrders.map((ro) => (
                        <Card key={ro.id} className="p-4">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-foreground">{ro.ro_number}</h3>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                                  {ro.state}
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">
                                {ro.customer_name} • {ro.vehicle_year} {ro.vehicle_make} {ro.vehicle_model}
                              </p>
                              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  Deleted {formatDate(ro.deleted_at)}
                                </span>
                                <span>by {ro.deleted_by_name || 'Unknown'}</span>
                                {ro.days_deleted > 25 && (
                                  <span className="text-red-600 font-semibold flex items-center gap-1">
                                    <AlertCircle className="h-3 w-3" />
                                    Purge in {30 - ro.days_deleted} days
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {data.permissions.canRestoreRO && (
                                <Button
                                  size="sm"
                                  onClick={() => handleRestore('work-orders', ro.id, ro.ro_number)}
                                  disabled={restoring === `work-orders-${ro.id}`}
                                >
                                  <RotateCcw className="mr-2 h-4 w-4" />
                                  {restoring === `work-orders-${ro.id}` ? 'Restoring...' : 'Restore'}
                                </Button>
                              )}
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Customers Tab */}
                <TabsContent value="customers">
                  {data.customers.length === 0 ? (
                    <Card className="p-6 text-center text-muted-foreground">
                      No deleted customers
                    </Card>
                  ) : (
                    <div className="space-y-3">
                      {data.customers.map((customer) => (
                        <Card key={customer.id} className="p-4">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h3 className="font-semibold text-foreground">{customer.customer_name}</h3>
                              <p className="text-sm text-muted-foreground mt-1">
                                {customer.phone_primary ? formatPhoneNumber(customer.phone_primary) : (customer.email || 'No contact info')}
                              </p>
                              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  Deleted {formatDate(customer.deleted_at)}
                                </span>
                                <span>by {customer.deleted_by_name || 'Unknown'}</span>
                                {customer.days_deleted > 25 && (
                                  <span className="text-red-600 font-semibold flex items-center gap-1">
                                    <AlertCircle className="h-3 w-3" />
                                    Purge in {30 - customer.days_deleted} days
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {data.permissions.canRestoreCustomer && (
                                <Button
                                  size="sm"
                                  onClick={() => handleRestore('customers', customer.id, customer.customer_name)}
                                  disabled={restoring === `customers-${customer.id}`}
                                >
                                  <RotateCcw className="mr-2 h-4 w-4" />
                                  {restoring === `customers-${customer.id}` ? 'Restoring...' : 'Restore'}
                                </Button>
                              )}
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Vehicles Tab */}
                <TabsContent value="vehicles">
                  {data.vehicles.length === 0 ? (
                    <Card className="p-6 text-center text-muted-foreground">
                      No deleted vehicles
                    </Card>
                  ) : (
                    <div className="space-y-3">
                      {data.vehicles.map((vehicle) => (
                        <Card key={vehicle.id} className="p-4">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h3 className="font-semibold text-foreground">
                                {vehicle.year} {vehicle.make} {vehicle.model}
                              </h3>
                              <p className="text-sm text-muted-foreground mt-1">
                                {vehicle.vin} • {vehicle.customer_name || 'No owner'}
                              </p>
                              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  Deleted {formatDate(vehicle.deleted_at)}
                                </span>
                                <span>by {vehicle.deleted_by_name || 'Unknown'}</span>
                                {vehicle.days_deleted > 25 && (
                                  <span className="text-red-600 font-semibold flex items-center gap-1">
                                    <AlertCircle className="h-3 w-3" />
                                    Purge in {30 - vehicle.days_deleted} days
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {data.permissions.canRestoreVehicle && (
                                <Button
                                  size="sm"
                                  onClick={() => handleRestore('vehicles', vehicle.id, `${vehicle.year} ${vehicle.make} ${vehicle.model}`)}
                                  disabled={restoring === `vehicles-${vehicle.id}`}
                                >
                                  <RotateCcw className="mr-2 h-4 w-4" />
                                  {restoring === `vehicles-${vehicle.id}` ? 'Restoring...' : 'Restore'}
                                </Button>
                              )}
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
