"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Search, 
  User, 
  Car, 
  FileText, 
  Package,
  Loader2,
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Calendar,
  DollarSign,
  Wrench
} from "lucide-react"
import { formatPhoneNumber } from "@/lib/utils/phone-format"

interface SearchResult {
  id: string
  [key: string]: any
}

interface SearchResponse {
  success: boolean
  interpretation: string
  entity: string
  results: SearchResult[]
  count: number
  sql?: string
  error?: string
}

function SearchResultsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const query = searchParams.get('q') || ''
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(null)

  useEffect(() => {
    if (query) {
      performSearch(query)
    } else {
      setLoading(false)
    }
  }, [query])

  const performSearch = async (searchQuery: string) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/search/ai-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          context: {}
        })
      })

      const data = await response.json()

      if (data.success) {
        setSearchResponse(data)
      } else {
        setError(data.error || 'Search failed')
      }
    } catch (err: any) {
      setError(err.message || 'Search request failed')
    } finally {
      setLoading(false)
    }
  }

  const getEntityIcon = (entity: string) => {
    switch (entity) {
      case 'customers': return <User className="h-5 w-5" />
      case 'vehicles': return <Car className="h-5 w-5" />
      case 'work_orders': return <FileText className="h-5 w-5" />
      case 'work_order_items': return <Package className="h-5 w-5" />
      default: return <Search className="h-5 w-5" />
    }
  }

  const getEntityLabel = (entity: string) => {
    switch (entity) {
      case 'customers': return 'Customers'
      case 'vehicles': return 'Vehicles'
      case 'work_orders': return 'Repair Orders'
      case 'work_order_items': return 'Line Items'
      default: return 'Results'
    }
  }

  const navigateToDetail = (entity: string, id: string) => {
    switch (entity) {
      case 'customers':
        router.push(`/customers?id=${id}`)
        break
      case 'work_orders':
        router.push(`/repair-orders/${id}`)
        break
      default:
        // Stay on search page for other entities
        break
    }
  }

  const renderCustomerResult = (customer: SearchResult) => (
    <Card 
      key={customer.id} 
      className="cursor-pointer hover:bg-accent/50 transition-colors"
      onClick={() => navigateToDetail('customers', customer.id)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium">{customer.customer_name || customer.name || 'Unknown'}</h3>
              <div className="text-sm text-muted-foreground flex items-center gap-4 mt-1">
                {customer.phone_primary && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" /> {formatPhoneNumber(customer.phone_primary)}
                  </span>
                )}
                {customer.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3" /> {customer.email}
                  </span>
                )}
              </div>
              {customer.city && customer.state && (
                <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                  <MapPin className="h-3 w-3" /> {customer.city}, {customer.state}
                </div>
              )}
            </div>
          </div>
          <Badge variant={customer.customer_type === 'business' ? 'default' : 'secondary'}>
            {customer.customer_type || 'individual'}
          </Badge>
        </div>
      </CardContent>
    </Card>
  )

  const renderVehicleResult = (vehicle: SearchResult) => (
    <Card key={vehicle.id} className="hover:bg-accent/50 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
              <Car className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <h3 className="font-medium">
                {vehicle.year} {vehicle.make} {vehicle.model}
                {vehicle.submodel && ` ${vehicle.submodel}`}
              </h3>
              {vehicle.vin && (
                <div className="text-sm text-muted-foreground font-mono mt-1">
                  VIN: {vehicle.vin}
                </div>
              )}
              {vehicle.customer_name && (
                <div className="text-sm text-muted-foreground mt-1">
                  Owner: {vehicle.customer_name}
                </div>
              )}
              <div className="text-sm text-muted-foreground flex items-center gap-4 mt-1">
                {vehicle.mileage && <span>{vehicle.mileage.toLocaleString()} miles</span>}
                {vehicle.license_plate && (
                  <span>Plate: {vehicle.license_plate} ({vehicle.license_plate_state})</span>
                )}
              </div>
            </div>
          </div>
          {vehicle.color && (
            <Badge variant="outline">{vehicle.color}</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  )

  const renderWorkOrderResult = (wo: SearchResult) => (
    <Card 
      key={wo.id} 
      className="cursor-pointer hover:bg-accent/50 transition-colors"
      onClick={() => navigateToDetail('work_orders', wo.id)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              wo.state === 'completed' ? 'bg-green-500/10' :
              wo.state === 'in_progress' ? 'bg-yellow-500/10' :
              'bg-gray-500/10'
            }`}>
              <Wrench className={`h-5 w-5 ${
                wo.state === 'completed' ? 'text-green-500' :
                wo.state === 'in_progress' ? 'text-yellow-500' :
                'text-gray-500'
              }`} />
            </div>
            <div>
              <h3 className="font-medium">
                RO #{wo.ro_number || wo.id}
                {wo.label && <span className="text-muted-foreground ml-2">- {wo.label}</span>}
              </h3>
              <div className="text-sm text-muted-foreground mt-1">
                {wo.customer_name && <span>{wo.customer_name}</span>}
                {wo.year && wo.make && wo.model && (
                  <span className="ml-2">• {wo.year} {wo.make} {wo.model}</span>
                )}
              </div>
              <div className="text-sm text-muted-foreground flex items-center gap-4 mt-1">
                {wo.date_opened && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> {new Date(wo.date_opened).toLocaleDateString()}
                  </span>
                )}
                {wo.total && (
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3" /> ${parseFloat(wo.total).toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          </div>
          <Badge variant={
            wo.state === 'completed' ? 'default' :
            wo.state === 'in_progress' ? 'secondary' :
            wo.state === 'estimate' ? 'outline' :
            'destructive'
          }>
            {wo.state || 'unknown'}
          </Badge>
        </div>
      </CardContent>
    </Card>
  )

  const renderLineItemResult = (item: SearchResult) => (
    <Card key={item.id} className="hover:bg-accent/50 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              item.item_type === 'labor' ? 'bg-purple-500/10' :
              item.item_type === 'part' ? 'bg-blue-500/10' :
              'bg-orange-500/10'
            }`}>
              <Package className={`h-5 w-5 ${
                item.item_type === 'labor' ? 'text-purple-500' :
                item.item_type === 'part' ? 'text-blue-500' :
                'text-orange-500'
              }`} />
            </div>
            <div>
              <h3 className="font-medium">{item.description || 'Unknown item'}</h3>
              <div className="text-sm text-muted-foreground mt-1">
                {item.part_number && <span>Part #: {item.part_number}</span>}
                {item.quantity && <span className="ml-4">Qty: {item.quantity}</span>}
              </div>
            </div>
          </div>
          <div className="text-right">
            <Badge variant="outline">{item.item_type || 'item'}</Badge>
            {item.line_total && (
              <div className="text-sm font-medium mt-1">${parseFloat(item.line_total).toFixed(2)}</div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )

  const renderResult = (result: SearchResult, entity: string) => {
    switch (entity) {
      case 'customers': return renderCustomerResult(result)
      case 'vehicles': return renderVehicleResult(result)
      case 'work_orders': return renderWorkOrderResult(result)
      case 'work_order_items': return renderLineItemResult(result)
      default: return (
        <Card key={result.id}>
          <CardContent className="p-4">
            <pre className="text-xs overflow-auto">{JSON.stringify(result, null, 2)}</pre>
          </CardContent>
        </Card>
      )
    }
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => router.back()}
          className="mb-2"
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Search className="h-6 w-6" /> Search Results
        </h1>
        {query && (
          <p className="text-muted-foreground mt-1">
            Searching for: <span className="font-medium text-foreground">"{query}"</span>
          </p>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Searching...</span>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <Card className="border-destructive">
          <CardContent className="p-6">
            <p className="text-destructive">{error}</p>
            <Button 
              variant="outline" 
              onClick={() => performSearch(query)}
              className="mt-4"
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* No Query */}
      {!query && !loading && (
        <Card>
          <CardContent className="p-6 text-center">
            <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Enter a search query to find customers, vehicles, or repair orders.</p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {searchResponse && !loading && (
        <div>
          {/* Summary */}
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getEntityIcon(searchResponse.entity)}
                  <CardTitle className="text-lg">
                    {searchResponse.count} {getEntityLabel(searchResponse.entity)} Found
                  </CardTitle>
                </div>
                <Badge variant="outline">{searchResponse.entity}</Badge>
              </div>
              <CardDescription>{searchResponse.interpretation}</CardDescription>
            </CardHeader>
          </Card>

          {/* Results List */}
          {searchResponse.results.length > 0 ? (
            <div className="space-y-3">
              {searchResponse.results.map(result => renderResult(result, searchResponse.entity))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-6 text-center">
                <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No results found for your query.</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

export default function SearchPage() {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <Suspense fallback={
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          }>
            <SearchResultsContent />
          </Suspense>
        </main>
      </div>
    </div>
  )
}
