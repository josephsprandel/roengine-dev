'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Car, Package, DollarSign, AlertCircle, CheckCircle2, XCircle, ShoppingCart, Trash2, RefreshCw, ClipboardList, Store } from 'lucide-react';

interface Vehicle {
  vin: string;
  year: number;
  make: string;
  model: string;
  engine?: string;
  trim?: string;
}

interface Part {
  part_number: string;
  brand: string;
  description: string;
  price: number;
  list_price: number;
  retail_price: number;
  stock_status: string;
  position?: string;
  quantity_per_vehicle?: number;
  images?: Array<{
    preview?: string;
    medium?: string;
    full?: string;
  }>;
}

interface Vendor {
  vendor: string;
  vendor_location: string;
  parts: Part[];
}

interface SearchResults {
  vehicle: Vehicle;
  vendors: Vendor[];
  totalVendors: number;
  totalParts: number;
  searchTerm: string;
  mode: string;
  duration: number;
}

// Worldpac types
interface WorldpacPart {
  partNumber: string;
  description: string;
  brand: string;
  price: number;
  listPrice?: number;
  coreCharge?: number;
  availability: 'in_stock' | 'limited' | 'order' | 'unavailable';
  quantityAvailable?: number;
  estimatedDelivery?: string;
  imageUrl?: string;
  supplier: string;
  supplierPartId?: string;
}

interface WorldpacSearchResult {
  parts: WorldpacPart[];
  supplier: string;
  count: number;
  error?: string;
  raw?: any;
}

// First Call Online (O'Reilly) types
interface FirstCallPart {
  partNumber: string;
  brandCode: string;
  brandName: string;
  description: string;
  listPrice: number;
  cost: number;
  customerPrice: number;
  corePrice: number;
  availability: {
    storeQty: number;
    networkQty: number;
    totalQty: number;
  };
  catalogKey: string;
  partTypeId: string;
  partTypeName: string | null;
  warranty: string | null;
  supplier: string;
}

interface FirstCallSearchResult {
  success: boolean;
  vehicle?: {
    vin: string;
    year: number;
    make: string;
    model: string;
    descriptor: string;
  };
  parts: FirstCallPart[];
  worksheetHeaderId?: number;
  worksheetVehicleId?: number;
  totalParts: number;
  durationSeconds: number;
  error?: { code: string; message: string };
}

interface FcPartType {
  id: string;
  name: string;
}

interface CartItem {
  partNumber: string;
  description: string;
  brand: string;
  price: number;
  quantity: number;
  supplierPartId?: string;
}

interface WorkOrderOption {
  id: number;
  ro_number: string;
  customer_name: string;
}

interface SupplierOrderRecord {
  id: number;
  work_order_id: number | null;
  supplier_order_id: string | null;
  po_number: string;
  status: string;
  total: string | null;
  ordered_at: string;
  ro_number: string | null;
  customer_name: string | null;
}

export default function PartsSearchPage() {
  const [vin, setVin] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [mode, setMode] = useState<'manual' | 'ai'>('manual');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [statusLog, setStatusLog] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState('');

  // Worldpac state
  const [wpConnected, setWpConnected] = useState<boolean | null>(null);
  const [wpSearchTerm, setWpSearchTerm] = useState('');
  const [wpLoading, setWpLoading] = useState(false);
  const [wpError, setWpError] = useState('');
  const [wpResults, setWpResults] = useState<WorldpacSearchResult | null>(null);
  const [wpRaw, setWpRaw] = useState<any>(null);

  // First Call Online state
  const [fcConnected, setFcConnected] = useState<boolean | null>(null);
  const [fcPartType, setFcPartType] = useState('');       // selected part type ID
  const [fcPartTypeSearch, setFcPartTypeSearch] = useState(''); // search input text
  const [fcPartTypes, setFcPartTypes] = useState<FcPartType[]>([]); // full list from API
  const [fcPartTypeOpen, setFcPartTypeOpen] = useState(false);     // dropdown open state
  const [fcLoading, setFcLoading] = useState(false);
  const [fcError, setFcError] = useState('');
  const [fcResults, setFcResults] = useState<FirstCallSearchResult | null>(null);

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [poNumber, setPoNumber] = useState('');
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<number | null>(null);
  const [workOrders, setWorkOrders] = useState<WorkOrderOption[]>([]);
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderError, setOrderError] = useState('');
  const [orderSuccess, setOrderSuccess] = useState('');
  // Quantity inputs per search result row (keyed by partNumber)
  const [rowQuantities, setRowQuantities] = useState<Record<string, number>>({});

  // Recent orders
  const [recentOrders, setRecentOrders] = useState<SupplierOrderRecord[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [statusCheckLoading, setStatusCheckLoading] = useState<string | null>(null);

  // Check Worldpac connection on page load
  useEffect(() => {
    fetch('/api/suppliers/worldpac/validate')
      .then(res => res.json())
      .then(data => setWpConnected(data.connected))
      .catch(() => setWpConnected(false));
  }, []);

  // Check First Call connection + load part types on page load
  useEffect(() => {
    fetch('/api/suppliers/firstcall/validate')
      .then(res => res.json())
      .then(data => {
        setFcConnected(data.success === true);
        if (data.success) {
          // Fetch part types once connected
          fetch('/api/suppliers/firstcall/part-types')
            .then(r => r.json())
            .then(d => {
              if (d.success && d.partTypes) {
                setFcPartTypes(d.partTypes);
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => setFcConnected(false));
  }, []);

  // Load work orders for dropdown
  useEffect(() => {
    fetch('/api/work-orders?limit=50&sort=date_opened_desc')
      .then(res => res.json())
      .then(data => {
        if (data.work_orders) {
          setWorkOrders(data.work_orders.map((wo: any) => ({
            id: wo.id,
            ro_number: wo.ro_number,
            customer_name: wo.customer_name || 'Unknown',
          })));
        }
      })
      .catch(() => {});
  }, []);

  // Load recent orders
  const loadRecentOrders = () => {
    setOrdersLoading(true);
    fetch('/api/suppliers/worldpac/orders')
      .then(res => res.json())
      .then(data => setRecentOrders(data.orders || []))
      .catch(() => {})
      .finally(() => setOrdersLoading(false));
  };

  useEffect(() => { loadRecentOrders(); }, []);

  const addToCart = (part: WorldpacPart) => {
    const qty = rowQuantities[part.partNumber] || 1;
    setCart(prev => {
      const existing = prev.find(c => c.partNumber === part.partNumber);
      if (existing) {
        return prev.map(c =>
          c.partNumber === part.partNumber ? { ...c, quantity: c.quantity + qty } : c
        );
      }
      return [...prev, {
        partNumber: part.partNumber,
        description: part.description,
        brand: part.brand,
        price: part.price,
        quantity: qty,
        supplierPartId: part.supplierPartId,
      }];
    });
    setRowQuantities(prev => ({ ...prev, [part.partNumber]: 1 }));
  };

  const removeFromCart = (partNumber: string) => {
    setCart(prev => prev.filter(c => c.partNumber !== partNumber));
  };

  const cartTotal = cart.reduce((sum, c) => sum + c.price * c.quantity, 0);

  const handlePlaceOrder = async () => {
    if (!poNumber.trim()) {
      setOrderError('PO number is required');
      return;
    }
    if (cart.length === 0) return;

    setOrderLoading(true);
    setOrderError('');
    setOrderSuccess('');

    try {
      const res = await fetch('/api/suppliers/worldpac/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parts: cart.map(c => ({
            partNumber: c.partNumber,
            quantity: c.quantity,
            supplierPartId: c.supplierPartId,
          })),
          poNumber: poNumber.trim(),
          workOrderId: selectedWorkOrderId || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setOrderError(data.error || 'Failed to place order');
        return;
      }

      setOrderSuccess(`Order placed! ID: ${data.order?.orderId || data.savedOrderId}`);
      setCart([]);
      setPoNumber('');
      setSelectedWorkOrderId(null);
      loadRecentOrders();
    } catch (err: any) {
      setOrderError(err.message || 'Failed to place order');
    } finally {
      setOrderLoading(false);
    }
  };

  const handleCheckStatus = async (supplierOrderId: string) => {
    if (!supplierOrderId) return;
    setStatusCheckLoading(supplierOrderId);
    try {
      await fetch(`/api/suppliers/worldpac/order/${encodeURIComponent(supplierOrderId)}`);
      loadRecentOrders();
    } catch {
      // ignore — will show current status
    } finally {
      setStatusCheckLoading(null);
    }
  };

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    setStatusLog(prev => [...prev, logEntry]);
    console.log(`[PartsTech] ${message}`);
  };

  // Map vendor names to logo filenames
  const getVendorLogo = (vendorName: string): string | null => {
    const logoMap: Record<string, string> = {
      'SSF Auto Parts': '/vendor-logos/ssf-auto-parts.png',
      'O\'Reilly Auto Parts': '/vendor-logos/oreilly-auto-parts.png',
      'AutoZone': '/vendor-logos/autozone.png',
      'Crow-Burlingame': '/vendor-logos/crow-burlingame.png',
      'NAPA Auto Parts': '/vendor-logos/napa-auto-parts.png',
      'Tri-State Enterprises': '/vendor-logos/tri-state-enterprises.png',
      'WorldPac': '/vendor-logos/worldpac.png',
      'PartsTech Catalog': '/vendor-logos/partstech-catalog.png',
    };
    return logoMap[vendorName] || null;
  };

  const handleSearch = async () => {
    setError('');
    setLoading(true);
    setResults(null);
    setStatusLog([]);

    addLog('🚀 Starting PartsTech search...');
    addLog(`📋 VIN: ${vin}`);
    addLog(`🔍 Search term: ${searchTerm}`);
    addLog(`⚙️ Mode: ${mode}`);
    
    setCurrentStep('Connecting to PartsTech...');
    addLog('🔐 Step 1: Logging in to PartsTech...');

    try {
      // Start the search with progress simulation
      const searchPromise = fetch('/api/parts/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vin, searchTerm, mode }),
      });

      // Simulate progress updates while waiting
      const progressSteps = [
        { delay: 3000, step: 'Authenticating...', log: '✓ Login credentials sent' },
        { delay: 5000, step: 'Dismissing popups...', log: '✓ Handling any popup dialogs' },
        { delay: 8000, step: 'Loading vehicle by VIN...', log: '🚗 Step 2: Decoding VIN...' },
        { delay: 12000, step: 'Selecting vehicle...', log: '📝 Looking for vehicle selection options' },
        { delay: 18000, step: 'Searching for parts...', log: '🔍 Step 3: Submitting parts search...' },
        { delay: 25000, step: 'Loading results...', log: '⏳ Waiting for search results...' },
        { delay: 35000, step: 'Extracting vendor data...', log: '📊 Step 4: Extracting parts from vendors...' },
        { delay: 50000, step: 'Processing multi-vendor results...', log: '🏪 Parsing data from multiple vendors...' },
      ];

      const timeoutIds: NodeJS.Timeout[] = [];
      
      for (const { delay, step, log } of progressSteps) {
        const timeoutId = setTimeout(() => {
          setCurrentStep(step);
          addLog(log);
        }, delay);
        timeoutIds.push(timeoutId);
      }

      const response = await searchPromise;
      
      // Clear any pending progress updates
      timeoutIds.forEach(id => clearTimeout(id));

      addLog('📥 Received response from server');
      const data = await response.json();

      if (!data.success) {
        addLog(`❌ Error: ${data.error}`);
        setError(data.error || 'Search failed');
        setResults(null);
      } else {
        addLog(`✅ Success! Found ${data.data.totalParts} parts from ${data.data.totalVendors} vendors`);
        addLog(`⏱️ Search completed in ${data.data.duration}s`);
        setResults(data.data);
      }
    } catch (err: any) {
      addLog(`❌ Error: ${err.message}`);
      setError(err.message || 'Failed to search');
      setResults(null);
    } finally {
      setCurrentStep('');
      setLoading(false);
      addLog('🏁 Search process complete');
    }
  };

  const getStockStatusColor = (status: string) => {
    const lower = status.toLowerCase();
    if (lower.includes('in stock') || lower.match(/\(\d+\)/)) {
      return 'bg-green-500';
    } else if (lower.includes('backorder')) {
      return 'bg-yellow-500';
    } else {
      return 'bg-red-500';
    }
  };

  const getPriceRange = () => {
    if (!results) return { min: 0, max: 0 };
    const allPrices = results.vendors
      .flatMap(v => v.parts.map(p => p.price))
      .filter(p => p != null && !isNaN(p));
    if (allPrices.length === 0) return { min: 0, max: 0 };
    return {
      min: Math.min(...allPrices),
      max: Math.max(...allPrices),
    };
  };

  const priceRange = results ? getPriceRange() : null;

  // Worldpac search handler
  const handleWorldpacSearch = async () => {
    setWpError('');
    setWpLoading(true);
    setWpResults(null);
    setWpRaw(null);

    try {
      const res = await fetch('/api/suppliers/worldpac/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vin: vin || undefined,
          searchTerm: wpSearchTerm,
        }),
      });

      const data: WorldpacSearchResult = await res.json();

      if (data.error && data.count === 0) {
        setWpError(data.error);
      }

      setWpResults(data);
      setWpRaw(data);
    } catch (err: any) {
      setWpError(err.message || 'Search failed. Check Worldpac connection in Settings.');
    } finally {
      setWpLoading(false);
    }
  };

  // First Call search handler
  const handleFirstCallSearch = async () => {
    if (!vin || vin.length !== 17 || !fcPartType) return;

    setFcError('');
    setFcLoading(true);
    setFcResults(null);

    try {
      const res = await fetch('/api/suppliers/firstcall/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vin, partTypeId: fcPartType }),
      });

      const data: FirstCallSearchResult = await res.json();

      if (!data.success) {
        setFcError(data.error?.message || 'Search failed');
      }

      setFcResults(data);
    } catch (err: any) {
      setFcError(err.message || 'Search failed. Check First Call connection.');
    } finally {
      setFcLoading(false);
    }
  };

  const addFcToCart = (part: FirstCallPart) => {
    const qty = rowQuantities[part.partNumber] || 1;
    setCart(prev => {
      const existing = prev.find(c => c.partNumber === part.partNumber);
      if (existing) {
        return prev.map(c =>
          c.partNumber === part.partNumber ? { ...c, quantity: c.quantity + qty } : c
        );
      }
      return [...prev, {
        partNumber: part.partNumber,
        description: part.description,
        brand: part.brandName,
        price: part.customerPrice,
        quantity: qty,
        supplierPartId: part.catalogKey,
      }];
    });
    setRowQuantities(prev => ({ ...prev, [part.partNumber]: 1 }));
  };

  const getFcAvailabilityBadge = (avail: FirstCallPart['availability']) => {
    if (avail.storeQty > 0) {
      return <Badge className="bg-green-600 hover:bg-green-700 text-white">In Store ({avail.storeQty})</Badge>;
    }
    if (avail.networkQty > 0) {
      return <Badge className="bg-blue-500 hover:bg-blue-600 text-white">Network ({avail.networkQty})</Badge>;
    }
    return <Badge className="bg-gray-400 hover:bg-gray-500 text-white">Unavailable</Badge>;
  };

  const getWpAvailabilityBadge = (availability: WorldpacPart['availability']) => {
    switch (availability) {
      case 'in_stock':
        return <Badge className="bg-green-600 hover:bg-green-700 text-white">In Stock</Badge>;
      case 'limited':
        return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white">Limited</Badge>;
      case 'order':
        return <Badge className="bg-blue-500 hover:bg-blue-600 text-white">Order</Badge>;
      case 'unavailable':
      default:
        return <Badge className="bg-gray-400 hover:bg-gray-500 text-white">Unavailable</Badge>;
    }
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden min-h-0">
        <Header />
        <main className="flex-1 overflow-y-auto p-6 min-h-0">
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Parts Search</h1>
          <p className="text-muted-foreground">Search for parts across multiple vendors</p>
        </div>

        {results && (
          <Card className="w-64">
            <CardContent className="pt-6">
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Parts Found:</span>
                  <span className="font-semibold">{results.totalParts}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Vendors:</span>
                  <span className="font-semibold">{results.totalVendors}</span>
                </div>
                {priceRange && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Price Range:</span>
                    <span className="font-semibold">
                      ${priceRange.min.toFixed(2)} - ${priceRange.max.toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Duration:</span>
                  <span className="font-semibold">{results.duration}s</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Worldpac speedDIAL Search */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Worldpac speedDIAL</CardTitle>
            <div className="flex items-center gap-2 text-sm">
              {wpConnected === null && (
                <span className="text-muted-foreground">Checking...</span>
              )}
              {wpConnected === true && (
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="h-4 w-4" /> Connected
                </span>
              )}
              {wpConnected === false && (
                <span className="flex items-center gap-1 text-red-500">
                  <XCircle className="h-4 w-4" /> Not Connected
                </span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <Label className="text-muted-foreground text-xs">VIN (shared)</Label>
              <Input
                value={vin}
                onChange={(e) => setVin(e.target.value.toUpperCase())}
                maxLength={17}
                className="font-mono"
                placeholder="3FAHP0JG3CR449015"
              />
            </div>
            <div>
              <Label htmlFor="wpSearchTerm">Part Search</Label>
              <Input
                id="wpSearchTerm"
                placeholder="Part number or keyword"
                value={wpSearchTerm}
                onChange={(e) => setWpSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <Button
            onClick={handleWorldpacSearch}
            disabled={wpLoading || !wpSearchTerm.trim()}
            className="w-full"
            variant="outline"
          >
            {wpLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Searching Worldpac...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Search Worldpac
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Worldpac Error */}
      {wpError && (
        <Card className="mb-6 border-red-500">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              <span>Search failed. Check Worldpac connection in Settings.</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Worldpac Results */}
      {wpResults && wpResults.parts.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="bg-slate-50 dark:bg-slate-900 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Worldpac Results</CardTitle>
              <Badge variant="secondary">
                <Package className="mr-1 h-3 w-3" />
                {wpResults.count} {wpResults.count === 1 ? 'part' : 'parts'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Part Number</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Description</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Brand</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground text-right">Price</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground text-right">List</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground text-right">Core</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Availability</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Est. Delivery</th>
                    <th className="pb-2 font-medium text-muted-foreground text-center">Order</th>
                  </tr>
                </thead>
                <tbody>
                  {wpResults.parts.map((part, idx) => (
                    <tr key={idx} className="border-b last:border-0 hover:bg-slate-50 dark:hover:bg-slate-900">
                      <td className="py-3 pr-4 font-mono text-xs">{part.partNumber}</td>
                      <td className="py-3 pr-4 max-w-[200px] truncate">{part.description || '—'}</td>
                      <td className="py-3 pr-4">{part.brand || '—'}</td>
                      <td className="py-3 pr-4 text-right font-medium">${part.price.toFixed(2)}</td>
                      <td className="py-3 pr-4 text-right text-muted-foreground">
                        {part.listPrice != null ? `$${part.listPrice.toFixed(2)}` : '—'}
                      </td>
                      <td className="py-3 pr-4 text-right text-muted-foreground">
                        {part.coreCharge != null && part.coreCharge > 0
                          ? `$${part.coreCharge.toFixed(2)}`
                          : '—'}
                      </td>
                      <td className="py-3 pr-4">{getWpAvailabilityBadge(part.availability)}</td>
                      <td className="py-3 pr-4 text-muted-foreground text-xs">{part.estimatedDelivery || '—'}</td>
                      <td className="py-3">
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min={1}
                            value={rowQuantities[part.partNumber] || 1}
                            onChange={(e) => setRowQuantities(prev => ({ ...prev, [part.partNumber]: Math.max(1, parseInt(e.target.value) || 1) }))}
                            className="w-14 h-7 text-xs text-center"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            onClick={() => addToCart(part)}
                          >
                            <ShoppingCart className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Raw API Response (debug) */}
            {wpRaw && (
              <details className="mt-4">
                <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                  Raw API Response
                </summary>
                <pre className="mt-2 bg-slate-950 text-slate-100 rounded-lg p-4 font-mono text-xs max-h-64 overflow-auto">
                  {JSON.stringify(wpRaw, null, 2)}
                </pre>
              </details>
            )}
          </CardContent>
        </Card>
      )}

      {/* Worldpac No Results */}
      {wpResults && wpResults.parts.length === 0 && !wpError && (
        <Card className="mb-6">
          <CardContent className="pt-6 text-center py-8">
            <Package className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No parts found for this search.</p>
          </CardContent>
        </Card>
      )}

      {/* Worldpac Order Cart */}
      {cart.length > 0 && (
        <Card className="mb-6 border-blue-200 dark:border-blue-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Worldpac Order Cart ({cart.length} {cart.length === 1 ? 'item' : 'items'})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Part</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Brand</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground text-center">Qty</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground text-right">Unit Price</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground text-right">Line Total</th>
                    <th className="pb-2 font-medium text-muted-foreground"></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item) => (
                    <tr key={item.partNumber} className="border-b last:border-0">
                      <td className="py-2 pr-4">
                        <span className="font-mono text-xs">{item.partNumber}</span>
                        <span className="text-muted-foreground text-xs ml-2">{item.description}</span>
                      </td>
                      <td className="py-2 pr-4 text-xs">{item.brand}</td>
                      <td className="py-2 pr-4 text-center">{item.quantity}</td>
                      <td className="py-2 pr-4 text-right">${item.price.toFixed(2)}</td>
                      <td className="py-2 pr-4 text-right font-medium">${(item.price * item.quantity).toFixed(2)}</td>
                      <td className="py-2">
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => removeFromCart(item.partNumber)}>
                          <Trash2 className="h-3 w-3 text-red-500" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t">
                    <td colSpan={4} className="py-2 text-right font-semibold">Total:</td>
                    <td className="py-2 text-right font-semibold">${cartTotal.toFixed(2)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <Label htmlFor="poNumber">PO Number *</Label>
                <Input
                  id="poNumber"
                  placeholder="PO-2026-001"
                  value={poNumber}
                  onChange={(e) => setPoNumber(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="workOrder">Link to Work Order (optional)</Label>
                <select
                  id="workOrder"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={selectedWorkOrderId || ''}
                  onChange={(e) => setSelectedWorkOrderId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">None</option>
                  {workOrders.map(wo => (
                    <option key={wo.id} value={wo.id}>
                      RO #{wo.ro_number} — {wo.customer_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <Button
                  onClick={handlePlaceOrder}
                  disabled={orderLoading || !poNumber.trim() || cart.length === 0}
                  className="w-full"
                >
                  {orderLoading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Placing Order...</>
                  ) : (
                    <><ClipboardList className="mr-2 h-4 w-4" />Place Order</>
                  )}
                </Button>
              </div>
            </div>

            {orderError && (
              <div className="flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle className="h-4 w-4" />
                <span>{orderError}</span>
              </div>
            )}
            {orderSuccess && (
              <div className="flex items-center gap-2 text-green-600 text-sm">
                <CheckCircle2 className="h-4 w-4" />
                <span>{orderSuccess}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recent Worldpac Orders */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Recent Worldpac Orders</CardTitle>
            <Button size="sm" variant="ghost" onClick={loadRecentOrders} disabled={ordersLoading}>
              <RefreshCw className={`h-4 w-4 ${ordersLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {recentOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No orders yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Date</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">PO #</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Order ID</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Status</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground text-right">Total</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Linked RO</th>
                    <th className="pb-2 font-medium text-muted-foreground"></th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => (
                    <tr key={order.id} className="border-b last:border-0 hover:bg-slate-50 dark:hover:bg-slate-900">
                      <td className="py-2 pr-4 text-xs text-muted-foreground">
                        {new Date(order.ordered_at).toLocaleDateString()}
                      </td>
                      <td className="py-2 pr-4 font-mono text-xs">{order.po_number}</td>
                      <td className="py-2 pr-4 font-mono text-xs">{order.supplier_order_id || '—'}</td>
                      <td className="py-2 pr-4">
                        <Badge variant={order.status === 'placed' ? 'default' : 'secondary'}>
                          {order.status}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4 text-right">
                        {order.total ? `$${parseFloat(order.total).toFixed(2)}` : '—'}
                      </td>
                      <td className="py-2 pr-4 text-xs">
                        {order.ro_number ? `RO #${order.ro_number}` : '—'}
                      </td>
                      <td className="py-2">
                        {order.supplier_order_id && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-xs"
                            disabled={statusCheckLoading === order.supplier_order_id}
                            onClick={() => handleCheckStatus(order.supplier_order_id!)}
                          >
                            {statusCheckLoading === order.supplier_order_id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              'Check Status'
                            )}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* First Call Online (O'Reilly) Search */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Store className="h-5 w-5" />
              First Call Online (O&apos;Reilly)
            </CardTitle>
            <div className="flex items-center gap-2 text-sm">
              {fcConnected === null && (
                <span className="text-muted-foreground">Checking...</span>
              )}
              {fcConnected === true && (
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="h-4 w-4" /> Connected
                </span>
              )}
              {fcConnected === false && (
                <span className="flex items-center gap-1 text-red-500">
                  <XCircle className="h-4 w-4" /> Not Connected
                </span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <Label className="text-muted-foreground text-xs">VIN (shared)</Label>
              <Input
                value={vin}
                onChange={(e) => setVin(e.target.value.toUpperCase())}
                maxLength={17}
                className="font-mono"
                placeholder="YV440MRR5H2128371"
              />
            </div>
            <div className="relative">
              <Label className="text-muted-foreground text-xs">Part Type</Label>
              <Input
                value={fcPartTypeSearch}
                onChange={(e) => {
                  setFcPartTypeSearch(e.target.value);
                  setFcPartTypeOpen(true);
                  // Clear selection if user edits text
                  if (fcPartType) {
                    const selected = fcPartTypes.find(pt => pt.id === fcPartType);
                    if (selected && e.target.value !== selected.name) {
                      setFcPartType('');
                    }
                  }
                }}
                onFocus={() => setFcPartTypeOpen(true)}
                placeholder={fcPartTypes.length > 0 ? "Type to search part types..." : "Loading part types..."}
                className={fcPartType ? 'border-green-500' : ''}
              />
              {fcPartTypeOpen && fcPartTypeSearch.length > 0 && (
                <div className="absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-md border bg-popover shadow-lg">
                  {fcPartTypes
                    .filter(pt => pt.name.toLowerCase().includes(fcPartTypeSearch.toLowerCase()))
                    .slice(0, 20)
                    .map(pt => (
                      <button
                        key={pt.id}
                        className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground cursor-pointer"
                        onClick={() => {
                          setFcPartType(pt.id);
                          setFcPartTypeSearch(pt.name);
                          setFcPartTypeOpen(false);
                        }}
                      >
                        {pt.name}
                      </button>
                    ))
                  }
                  {fcPartTypes.filter(pt => pt.name.toLowerCase().includes(fcPartTypeSearch.toLowerCase())).length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">No matching part types</div>
                  )}
                </div>
              )}
              {/* Close dropdown when clicking outside */}
              {fcPartTypeOpen && (
                <div className="fixed inset-0 z-40" onClick={() => setFcPartTypeOpen(false)} />
              )}
            </div>
          </div>

          <Button
            onClick={handleFirstCallSearch}
            disabled={fcLoading || vin.length !== 17 || !fcPartType}
            className="w-full"
            variant="outline"
          >
            {fcLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Searching O&apos;Reilly...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Search First Call
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* First Call Error */}
      {fcError && (
        <Card className="mb-6 border-red-500">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              <span>{fcError}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* First Call Vehicle Info */}
      {fcResults?.success && fcResults.vehicle && (
        <Card className="mb-6 bg-green-50 dark:bg-green-950">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Car className="h-6 w-6 text-green-600" />
              <div>
                <h3 className="font-semibold text-lg">{fcResults.vehicle.descriptor}</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  VIN: {fcResults.vehicle.vin} &bull; {fcResults.totalParts} parts found in {fcResults.durationSeconds}s
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* First Call Results */}
      {fcResults?.success && fcResults.parts.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="bg-green-50 dark:bg-green-950 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">O&apos;Reilly Results</CardTitle>
              <Badge variant="secondary">
                <Package className="mr-1 h-3 w-3" />
                {fcResults.totalParts} {fcResults.totalParts === 1 ? 'part' : 'parts'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Part Number</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Description</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Brand</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground text-right">Cost</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground text-right">List</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground text-right">Customer</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground text-right">Core</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Availability</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Warranty</th>
                    <th className="pb-2 font-medium text-muted-foreground text-center">Order</th>
                  </tr>
                </thead>
                <tbody>
                  {fcResults.parts.map((part, idx) => (
                    <tr key={idx} className="border-b last:border-0 hover:bg-slate-50 dark:hover:bg-slate-900">
                      <td className="py-3 pr-4 font-mono text-xs">{part.partNumber}</td>
                      <td className="py-3 pr-4 max-w-[200px] truncate">{part.description || '\u2014'}</td>
                      <td className="py-3 pr-4">{part.brandName || '\u2014'}</td>
                      <td className="py-3 pr-4 text-right font-medium">
                        {part.cost != null ? `$${part.cost.toFixed(2)}` : '\u2014'}
                      </td>
                      <td className="py-3 pr-4 text-right text-muted-foreground">
                        {part.listPrice != null ? `$${part.listPrice.toFixed(2)}` : '\u2014'}
                      </td>
                      <td className="py-3 pr-4 text-right text-muted-foreground">
                        {part.customerPrice != null ? `$${part.customerPrice.toFixed(2)}` : '\u2014'}
                      </td>
                      <td className="py-3 pr-4 text-right text-muted-foreground">
                        {part.corePrice > 0 ? `$${part.corePrice.toFixed(2)}` : '\u2014'}
                      </td>
                      <td className="py-3 pr-4">{getFcAvailabilityBadge(part.availability)}</td>
                      <td className="py-3 pr-4 text-xs text-muted-foreground max-w-[120px] truncate">
                        {part.warranty || '\u2014'}
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min={1}
                            value={rowQuantities[part.partNumber] || 1}
                            onChange={(e) => setRowQuantities(prev => ({ ...prev, [part.partNumber]: Math.max(1, parseInt(e.target.value) || 1) }))}
                            className="w-14 h-7 text-xs text-center"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            onClick={() => addFcToCart(part)}
                          >
                            <ShoppingCart className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* First Call No Results */}
      {fcResults?.success && fcResults.parts.length === 0 && (
        <Card className="mb-6">
          <CardContent className="pt-6 text-center py-8">
            <Package className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No parts found for this vehicle and part type.</p>
          </CardContent>
        </Card>
      )}

      {/* PartsTech Search */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">PartsTech</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <Label htmlFor="vin">VIN (17 characters)</Label>
              <Input
                id="vin"
                placeholder="3FAHP0JG3CR449015"
                value={vin}
                onChange={(e) => setVin(e.target.value.toUpperCase())}
                maxLength={17}
                className="font-mono"
              />
            </div>

            <div>
              <Label htmlFor="searchTerm">Part Search</Label>
              <Input
                id="searchTerm"
                placeholder="Oil Filter, Brake Pads, etc."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div>
              <Label>Mode</Label>
              <div className="flex gap-2 mt-2">
                <Button
                  variant={mode === 'manual' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setMode('manual')}
                  className="flex-1"
                >
                  Manual
                </Button>
                <Button
                  variant={mode === 'ai' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setMode('ai')}
                  className="flex-1"
                >
                  AI (All)
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {mode === 'manual' ? 'Filter unavailable parts' : 'Show all parts'}
              </p>
            </div>
          </div>

          <Button
            onClick={handleSearch}
            disabled={loading || vin.length !== 17 || !searchTerm.trim()}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Search PartsTech
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Progress Log */}
      {(loading || statusLog.length > 0) && (
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>Progress Log</span>
              {currentStep && (
                <Badge variant="outline" className="ml-auto">
                  {currentStep}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-slate-950 text-slate-100 rounded-lg p-4 font-mono text-xs max-h-48 overflow-y-auto">
              {statusLog.map((log, index) => (
                <div key={index} className="py-0.5">
                  {log}
                </div>
              ))}
              {loading && (
                <div className="py-0.5 text-slate-400 animate-pulse">
                  ▊
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Message */}
      {error && (
        <Card className="mb-6 border-red-500">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Vehicle Info */}
      {results && (
        <Card className="mb-6 bg-blue-50 dark:bg-blue-950">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Car className="h-6 w-6 text-blue-600" />
              <div>
                <h3 className="font-semibold text-lg">
                  {results.vehicle.year} {results.vehicle.make} {results.vehicle.model}
                </h3>
                {results.vehicle.engine && (
                  <p className="text-sm text-muted-foreground">
                    {results.vehicle.engine}
                    {results.vehicle.trim && ` • ${results.vehicle.trim}`}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  VIN: {results.vehicle.vin}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {results && results.vendors.length > 0 && (
        <div className="space-y-4">
          {results.vendors.map((vendor, vendorIndex) => (
            <Card key={vendorIndex}>
              <CardHeader className="bg-slate-50 dark:bg-slate-900">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* Vendor Logo */}
                    {getVendorLogo(vendor.vendor) && (
                      <div className="w-24 h-12 flex items-center justify-center bg-white rounded p-2">
                        <img
                          src={getVendorLogo(vendor.vendor)!}
                          alt={`${vendor.vendor} logo`}
                          className="max-w-full max-h-full object-contain"
                          onError={(e) => {
                            // Hide if logo fails to load
                            e.currentTarget.parentElement!.style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                    <div>
                      <CardTitle className="text-lg">{vendor.vendor}</CardTitle>
                      <p className="text-sm text-muted-foreground">{vendor.vendor_location}</p>
                    </div>
                  </div>
                  <Badge variant="secondary">
                    <Package className="mr-1 h-3 w-3" />
                    {vendor.parts.length} {vendor.parts.length === 1 ? 'part' : 'parts'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {vendor.parts.map((part, partIndex) => (
                    <div
                      key={partIndex}
                      className="flex items-start gap-4 p-4 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900"
                    >
                      {/* Part Image */}
                      <div className="w-16 h-16 bg-slate-200 dark:bg-slate-700 rounded flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {part.images && part.images.length > 0 && part.images[0].preview ? (
                          <img
                            src={part.images[0].preview}
                            alt={part.part_number}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              // Fallback to placeholder if image fails to load
                              e.currentTarget.style.display = 'none';
                              const parent = e.currentTarget.parentElement;
                              if (parent) {
                                const icon = document.createElement('div');
                                icon.className = 'flex items-center justify-center w-full h-full';
                                icon.innerHTML = '<svg class="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>';
                                parent.appendChild(icon);
                              }
                            }}
                          />
                        ) : (
                          <Package className="h-8 w-8 text-slate-400" />
                        )}
                      </div>

                      {/* Part Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold">
                              {part.part_number} - {part.brand}
                            </h4>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {part.description || 'No description'}
                            </p>
                            {part.position && (
                              <Badge variant="outline" className="mt-1">
                                {part.position}
                              </Badge>
                            )}
                          </div>

                          {/* Pricing */}
                          <div className="flex gap-6 flex-shrink-0">
                            <div className="text-center">
                              <p className="text-xs text-muted-foreground">Cost</p>
                              <p className="font-semibold">${part.price?.toFixed(2) ?? 'N/A'}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-muted-foreground">List</p>
                              <p className="font-semibold">${part.list_price?.toFixed(2) ?? 'N/A'}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-muted-foreground">Retail</p>
                              <p className="font-semibold">${part.retail_price?.toFixed(2) ?? 'N/A'}</p>
                            </div>
                          </div>
                        </div>

                        {/* Stock Status & Actions */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-2 h-2 rounded-full ${getStockStatusColor(part.stock_status)}`}
                            />
                            <span className="text-sm">{part.stock_status}</span>
                          </div>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              console.log('Add to quote:', {
                                vendor: vendor.vendor,
                                part: part.part_number,
                                brand: part.brand,
                                price: part.price,
                              });
                            }}
                          >
                            <DollarSign className="mr-1 h-4 w-4" />
                            Add to Quote
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* No Results */}
      {results && results.vendors.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold mb-2">No Parts Found</h3>
            <p className="text-sm text-muted-foreground">
              No parts were found for this search. Try a different search term.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
        </main>
      </div>
    </div>
  );
}
