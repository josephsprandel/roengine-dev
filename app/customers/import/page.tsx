'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Upload, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';

export default function CustomerImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Load current customer stats on mount
  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      const response = await fetch('/api/customers/import');
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
      
      const response = await fetch('/api/customers/import', {
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
              <h1 className="text-3xl font-bold mb-2">Import Customers</h1>
              <p className="text-muted-foreground">
                Import customers from ShopWare CSV export to sync customer database
              </p>
            </div>

            {/* Current Stats */}
            {!loadingStats && stats && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="p-4">
                  <p className="text-sm text-muted-foreground mb-1">Total Customers</p>
                  <p className="text-2xl font-bold">{stats.totalCustomers.toLocaleString()}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm text-muted-foreground mb-1">Individuals</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.individualCustomers.toLocaleString()}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm text-muted-foreground mb-1">Businesses</p>
                  <p className="text-2xl font-bold text-green-600">{stats.businessCustomers.toLocaleString()}</p>
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
                <div>
                  <label className="block text-sm font-medium mb-2">
                    ShopWare Customer CSV Export
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
                      Import Customers
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
                        {result.detectedColumns && result.detectedColumns.length > 0 && (
                          <details className="mt-3">
                            <summary className="text-sm text-blue-700 cursor-pointer font-medium">
                              Detected CSV columns (click to view)
                            </summary>
                            <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded text-xs">
                              <p className="font-medium mb-2">Your CSV has these columns:</p>
                              <ul className="list-disc ml-5 space-y-1">
                                {result.detectedColumns.map((col: string, idx: number) => (
                                  <li key={idx} className="text-blue-800 dark:text-blue-200">{col}</li>
                                ))}
                              </ul>
                              <p className="mt-3 text-amber-700">
                                ⚠️ None of these match the expected column names. Please check the supported columns list below or contact support.
                              </p>
                            </div>
                          </details>
                        )}
                        {result.errors && result.errors.length > 0 && (
                          <details className="mt-3">
                            <summary className="text-sm text-amber-700 cursor-pointer">
                              {result.errors.length} errors occurred (click to view)
                            </summary>
                            <ul className="mt-2 text-xs space-y-1">
                              {result.errors.map((err: any, idx: number) => (
                                <li key={idx} className="text-amber-700">
                                  {err.customer}: {err.error}
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
                Instructions
              </h3>
              <ol className="list-decimal ml-5 space-y-2 text-sm text-muted-foreground">
                <li>Export customers from ShopWare as CSV format</li>
                <li>Ensure CSV includes at minimum: Customer Name, Phone</li>
                <li>Upload the CSV file using the form above</li>
                <li>Import will update existing customers or add new ones (UPSERT)</li>
                <li>Customers are matched by name + primary phone combination</li>
              </ol>
              
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 rounded border border-blue-200 dark:border-blue-800">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                  Supported Column Names (ShopWare Format):
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs text-blue-800 dark:text-blue-200">
                  <div>• First Name + Last Name (combined)</div>
                  <div>• Phone</div>
                  <div>• Other phones (comma-separated)</div>
                  <div>• Email</div>
                  <div>• Address</div>
                  <div>• City</div>
                  <div>• State</div>
                  <div>• Zip</div>
                  <div>• Customer Notes</div>
                  <div>• Customer ID</div>
                  <div>• Company Name (optional)</div>
                  <div>• Tax ID (optional)</div>
                </div>
              </div>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
