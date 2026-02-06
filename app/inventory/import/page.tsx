'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowUpTrayIcon as Upload, ExclamationCircleIcon as AlertCircle, CheckCircleIcon as CheckCircle, ArrowPathIcon as Loader2 } from '@heroicons/react/24/outline';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';

export default function InventoryImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [importFormat, setImportFormat] = useState<'shopware' | 'roengine'>('shopware');

  // Load current inventory stats on mount
  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      const response = await fetch('/api/inventory/import');
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoadingStats(false);
    }
  }

  async function handleImport() {
    if (!file) return;
    
    setImporting(true);
    setResult(null);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      // Choose endpoint based on format
      const endpoint = importFormat === 'roengine' 
        ? '/api/inventory/import-roengine'
        : '/api/inventory/import';
      
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData
      });
      
      const data = await response.json();
      setResult(data);
      
      if (data.success) {
        setFile(null); // Clear file input on success
        // Reload stats
        await loadStats();
      }
    } catch (error: any) {
      setResult({ 
        success: false,
        error: 'Import failed', 
        details: error.message 
      });
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-4xl mx-auto space-y-6">
            <div>
              <h1 className="text-3xl font-bold mb-2">Import Parts Inventory</h1>
              <p className="text-muted-foreground">
                Import parts from ShopWare exports or RO Engine CSV for mass editing
              </p>
            </div>

            {/* Current Stats */}
            {!loadingStats && stats && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="p-4">
                  <p className="text-sm text-muted-foreground mb-1">Total Parts</p>
                  <p className="text-2xl font-bold">{stats.totalParts.toLocaleString()}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm text-muted-foreground mb-1">In Stock</p>
                  <p className="text-2xl font-bold text-green-600">{stats.inStockParts.toLocaleString()}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm text-muted-foreground mb-1">Low Stock</p>
                  <p className="text-2xl font-bold text-amber-600">{stats.lowStockParts.toLocaleString()}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm text-muted-foreground mb-1">Last Sync</p>
                  <p className="text-sm font-medium">
                    {stats.lastSync 
                      ? new Date(stats.lastSync).toLocaleDateString() 
                      : 'Never'}
                  </p>
                </Card>
              </div>
            )}

            {/* Import Form */}
            <Card className="p-6">
              <div className="space-y-6">
                {/* Format Selector */}
                <div>
                  <label className="block text-sm font-medium mb-3">
                    Import Format
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setImportFormat('shopware')}
                      disabled={importing}
                      className={`p-4 rounded-lg border-2 text-left transition-all ${
                        importFormat === 'shopware'
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                      } disabled:opacity-50`}
                    >
                      <div className="font-semibold mb-1">ShopWare Export</div>
                      <div className="text-xs text-muted-foreground">
                        Daily sync from ShopWare inventory
                      </div>
                    </button>
                    <button
                      onClick={() => setImportFormat('roengine')}
                      disabled={importing}
                      className={`p-4 rounded-lg border-2 text-left transition-all ${
                        importFormat === 'roengine'
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                      } disabled:opacity-50`}
                    >
                      <div className="font-semibold mb-1">RO Engine CSV</div>
                      <div className="text-xs text-muted-foreground">
                        Mass edit exported CSV (includes approvals)
                      </div>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    {importFormat === 'shopware' ? 'ShopWare Parts CSV Export' : 'RO Engine Parts CSV'}
                  </label>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    disabled={importing}
                    className="block w-full text-sm text-gray-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded file:border-0
                      file:text-sm file:font-semibold
                      file:bg-blue-50 file:text-blue-700
                      hover:file:bg-blue-100
                      disabled:opacity-50"
                  />
                </div>
                
                {file && (
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Selected: {file.name} ({(file.size / 1024).toFixed(2)} KB)
                  </div>
                )}
                
                <Button
                  onClick={handleImport}
                  disabled={!file || importing}
                  className="w-full"
                  size="lg"
                >
                  {importing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Import Parts Inventory
                    </>
                  )}
                </Button>
                
                {/* Result Message */}
                {result && (
                  <div className={`p-4 rounded-lg border ${
                    result.success 
                      ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800' 
                      : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
                  }`}>
                    {result.success ? (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle className="h-5 w-5 text-green-600" />
                          <p className="font-semibold text-green-900 dark:text-green-100">
                            Import Successful
                          </p>
                        </div>
                        <p className="text-sm text-green-800 dark:text-green-200">
                          {result.message}
                        </p>
                        {result.errors && result.errors.length > 0 && (
                          <details className="mt-3">
                            <summary className="text-sm text-amber-700 cursor-pointer">
                              {result.errors.length} errors occurred (click to view)
                            </summary>
                            <ul className="mt-2 text-xs space-y-1">
                              {result.errors.map((err: any, idx: number) => (
                                <li key={idx} className="text-amber-700">
                                  {err.part_number}: {err.error}
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle className="h-5 w-5 text-red-600" />
                          <p className="font-semibold text-red-900 dark:text-red-100">
                            Import Failed
                          </p>
                        </div>
                        <p className="text-sm text-red-800 dark:text-red-200">
                          {result.details || result.error}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>

            {/* Instructions */}
            <Card className="p-6 bg-muted/30">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                {importFormat === 'shopware' ? 'ShopWare Import Instructions' : 'RO Engine Import Instructions'}
              </h3>
              
              {importFormat === 'shopware' ? (
                <>
                  <ol className="list-decimal ml-5 space-y-2 text-sm text-muted-foreground">
                    <li>Export parts inventory from ShopWare as CSV format</li>
                    <li>Ensure CSV includes at minimum: part_number, description, price</li>
                    <li>Upload the CSV file using the form above</li>
                    <li>Import will update existing parts or add new ones (UPSERT)</li>
                    <li>Run this daily to keep inventory synchronized</li>
                  </ol>
                  
                  <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 rounded border border-blue-200 dark:border-blue-800">
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                      Supported Column Names:
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-xs text-blue-800 dark:text-blue-200">
                      <div>• Number or "Part Number"</div>
                      <div>• Description</div>
                      <div>• Primary Vendor or Manufacturer</div>
                      <div>• Cost</div>
                      <div>• MSRP or Price</div>
                      <div>• Quantity On Hand</div>
                      <div>• Min Stock (reorder point)</div>
                      <div>• Location</div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <ol className="list-decimal ml-5 space-y-2 text-sm text-muted-foreground">
                    <li>Export current inventory using "Export" button in Parts Manager</li>
                    <li>Edit the CSV in Excel/Google Sheets (e.g., add approvals, update prices)</li>
                    <li>Save your changes to the CSV file</li>
                    <li>Upload the modified CSV here</li>
                    <li>Import will update ALL fields based on ID or part_number</li>
                  </ol>
                  
                  <div className="mt-4 p-3 bg-green-50 dark:bg-green-950/20 rounded border border-green-200 dark:border-green-800">
                    <p className="text-sm font-medium text-green-900 dark:text-green-100 mb-2">
                      Editable Fields:
                    </p>
                    <div className="grid grid-cols-3 gap-2 text-xs text-green-800 dark:text-green-200">
                      <div>• part_number</div>
                      <div>• description</div>
                      <div>• vendor</div>
                      <div>• cost</div>
                      <div>• price</div>
                      <div>• quantity_on_hand</div>
                      <div>• quantity_available</div>
                      <div>• reorder_point</div>
                      <div>• location</div>
                      <div>• bin_location</div>
                      <div>• category</div>
                      <div>• <strong>approvals</strong></div>
                      <div>• notes</div>
                    </div>
                  </div>
                  
                  <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/20 rounded border border-amber-200 dark:border-amber-800">
                    <p className="text-xs text-amber-800 dark:text-amber-200">
                      <strong>Note:</strong> Do NOT edit id, shopware_id, last_synced_at, last_updated, or created_at columns.
                      These are managed automatically.
                    </p>
                  </div>
                </>
              )}
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
