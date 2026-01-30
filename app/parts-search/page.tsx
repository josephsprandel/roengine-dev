'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Car, Package, DollarSign, AlertCircle } from 'lucide-react';

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

export default function PartsSearchPage() {
  const [vin, setVin] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [mode, setMode] = useState<'manual' | 'ai'>('manual');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [statusLog, setStatusLog] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState('');

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    setStatusLog(prev => [...prev, logEntry]);
    console.log(`[PartsTech] ${message}`);
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

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">PartsTech Search</h1>
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

      {/* Search Form */}
      <Card className="mb-6">
        <CardContent className="pt-6">
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
                  <div>
                    <CardTitle className="text-lg">{vendor.vendor}</CardTitle>
                    <p className="text-sm text-muted-foreground">{vendor.vendor_location}</p>
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
  );
}
