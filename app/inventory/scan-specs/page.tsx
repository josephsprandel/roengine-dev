'use client'

/**
 * Enhanced AI Product Scanner UI
 * 
 * Scans front + back photos of automotive fluid bottles.
 * Extracts ALL product data using Gemini AI vision.
 * Writes complete part records directly to database.
 */

import { useState, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { 
  Camera, 
  Upload, 
  AlertCircle, 
  CheckCircle, 
  Loader2, 
  Save,
  X,
  RotateCcw,
  Package,
  Droplets,
  Shield,
  Info
} from 'lucide-react'

interface OemApproval {
  rawText: string
  normalizedCode: string
  manufacturer?: string
  status: string
  wasNormalized?: boolean
}

interface ScanResult {
  success: boolean
  partNumber: string
  partNumberSource: 'manufacturer' | 'generated'
  manufacturerPartNumber?: string | null
  barcode?: string | null
  brand: string
  productName: string
  description: string
  category: string
  containerSize: string
  containerType: string
  baseUnitQuantity: number
  viscosity?: string | null
  fluidType: string
  baseStockType?: string | null
  color?: string | null
  apiClass?: string | null
  aceaClass?: string | null
  ilsacClass?: string | null
  jasoClass?: string | null
  oemApprovals: OemApproval[]
  oemApprovalsRawText?: string | null
  lowSaps: boolean
  highMileage: boolean
  racingFormula: boolean
  dieselSpecific: boolean
  confidenceScore: number
  warnings: string[]
  needsReview: boolean
  extractionRaw: string
}

export default function ScanSpecsPage() {
  const frontInputRef = useRef<HTMLInputElement>(null)
  const backInputRef = useRef<HTMLInputElement>(null)

  const [frontImage, setFrontImage] = useState<File | null>(null)
  const [backImage, setBackImage] = useState<File | null>(null)
  const [frontPreview, setFrontPreview] = useState<string>('')
  const [backPreview, setBackPreview] = useState<string>('')

  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)

  // Handle image upload
  const handleImageUpload = (file: File, side: 'front' | 'back') => {
    const preview = URL.createObjectURL(file)
    if (side === 'front') {
      if (frontPreview) URL.revokeObjectURL(frontPreview)
      setFrontImage(file)
      setFrontPreview(preview)
    } else {
      if (backPreview) URL.revokeObjectURL(backPreview)
      setBackImage(file)
      setBackPreview(preview)
    }
  }

  // Remove image
  const removeImage = (side: 'front' | 'back') => {
    if (side === 'front') {
      if (frontPreview) URL.revokeObjectURL(frontPreview)
      setFrontImage(null)
      setFrontPreview('')
    } else {
      if (backPreview) URL.revokeObjectURL(backPreview)
      setBackImage(null)
      setBackPreview('')
    }
  }

  // Scan product
  const handleScan = async () => {
    if (!frontImage && !backImage) {
      alert('Please upload at least one photo (front or back label)')
      return
    }

    setScanning(true)
    setScanResult(null)
    setSaveSuccess(null)

    try {
      const formData = new FormData()
      if (frontImage) formData.append('frontImage', frontImage)
      if (backImage) formData.append('backImage', backImage)

      const response = await fetch('/api/inventory/scan-product', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Scan failed')
      }

      const result = await response.json()
      setScanResult(result)
      console.log('Scan complete:', result)

    } catch (error: any) {
      console.error('Scan error:', error)
      alert(`Scan failed: ${error.message}`)
    } finally {
      setScanning(false)
    }
  }

  // Save to database
  const handleSave = async () => {
    if (!scanResult) return

    setSaving(true)
    setSaveSuccess(null)

    try {
      const response = await fetch('/api/inventory/scan-product/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scanResult,
          frontImageData: null,
          backImageData: null
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Save failed')
      }

      const result = await response.json()
      setSaveSuccess(`${result.isUpdate ? 'Updated' : 'Created'} part #${result.partNumber} (ID: ${result.partId})`)

    } catch (error: any) {
      console.error('Save error:', error)
      alert(`Save failed: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  // Reset everything
  const handleReset = () => {
    if (frontPreview) URL.revokeObjectURL(frontPreview)
    if (backPreview) URL.revokeObjectURL(backPreview)
    setFrontImage(null)
    setBackImage(null)
    setFrontPreview('')
    setBackPreview('')
    setScanResult(null)
    setSaveSuccess(null)
  }

  // Confidence color
  const getConfidenceColor = (score: number) => {
    if (score >= 0.9) return 'text-green-600'
    if (score >= 0.7) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getConfidenceBg = (score: number) => {
    if (score >= 0.9) return 'bg-green-500'
    if (score >= 0.7) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Camera className="h-8 w-8" />
            AI Product Scanner
          </h1>
          <p className="text-muted-foreground mt-1">
            Scan product labels to extract specifications and create inventory records
          </p>
        </div>
        {(scanResult || frontImage || backImage) && (
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Start Over
          </Button>
        )}
      </div>

      {/* Step 1: Photo Upload */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Step 1: Upload Label Photos
          </CardTitle>
          <CardDescription>
            Take photos of the front and back labels for best results. At least one photo required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Front Image */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Front Label</Label>
              <input
                ref={frontInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'front')}
                className="hidden"
              />
              <div
                onClick={() => !scanning && frontInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors min-h-[200px] flex items-center justify-center relative ${
                  frontPreview ? 'border-primary' : 'border-muted-foreground/25 hover:border-primary/50'
                }`}
              >
                {frontPreview ? (
                  <>
                    <img src={frontPreview} alt="Front label" className="max-h-[250px] rounded-lg object-contain" />
                    <Button
                      size="sm"
                      variant="destructive"
                      className="absolute top-2 right-2"
                      onClick={(e) => { e.stopPropagation(); removeImage('front') }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <div className="py-8">
                    <Camera className="mx-auto h-10 w-10 text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground">Click to upload front photo</p>
                  </div>
                )}
              </div>
            </div>

            {/* Back Image */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Back Label</Label>
              <input
                ref={backInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'back')}
                className="hidden"
              />
              <div
                onClick={() => !scanning && backInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors min-h-[200px] flex items-center justify-center relative ${
                  backPreview ? 'border-primary' : 'border-muted-foreground/25 hover:border-primary/50'
                }`}
              >
                {backPreview ? (
                  <>
                    <img src={backPreview} alt="Back label" className="max-h-[250px] rounded-lg object-contain" />
                    <Button
                      size="sm"
                      variant="destructive"
                      className="absolute top-2 right-2"
                      onClick={(e) => { e.stopPropagation(); removeImage('back') }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <div className="py-8">
                    <Camera className="mx-auto h-10 w-10 text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground">Click to upload back photo</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Scan Button */}
          <Button
            onClick={handleScan}
            disabled={(!frontImage && !backImage) || scanning}
            className="w-full mt-6"
            size="lg"
          >
            {scanning ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Scanning with Gemini AI...
              </>
            ) : (
              <>
                <Camera className="mr-2 h-5 w-5" />
                Scan Product ({(frontImage ? 1 : 0) + (backImage ? 1 : 0)} photo{(frontImage ? 1 : 0) + (backImage ? 1 : 0) !== 1 ? 's' : ''})
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Step 2: Scan Results */}
      {scanResult && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Column 1: Product Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5" />
                Product Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Confidence */}
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  {scanResult.needsReview ? (
                    <AlertCircle className="h-5 w-5 text-yellow-500" />
                  ) : (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  )}
                  <span className={`font-bold ${getConfidenceColor(scanResult.confidenceScore)}`}>
                    {(scanResult.confidenceScore * 100).toFixed(0)}% Confidence
                  </span>
                </div>
                <div className="h-2 w-24 rounded-full bg-muted-foreground/20 overflow-hidden">
                  <div
                    className={`h-full ${getConfidenceBg(scanResult.confidenceScore)}`}
                    style={{ width: `${scanResult.confidenceScore * 100}%` }}
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Part Number</Label>
                <div className="flex items-center gap-2">
                  <p className="font-mono font-bold text-lg">{scanResult.partNumber}</p>
                  {scanResult.partNumberSource === 'generated' && (
                    <Badge variant="outline" className="text-xs">Generated</Badge>
                  )}
                </div>
              </div>

              {scanResult.manufacturerPartNumber && (
                <div>
                  <Label className="text-xs text-muted-foreground">Manufacturer PN</Label>
                  <p className="font-mono">{scanResult.manufacturerPartNumber}</p>
                </div>
              )}

              {scanResult.barcode && (
                <div>
                  <Label className="text-xs text-muted-foreground">UPC/Barcode</Label>
                  <p className="font-mono text-sm">{scanResult.barcode}</p>
                </div>
              )}

              <div>
                <Label className="text-xs text-muted-foreground">Brand</Label>
                <p className="font-semibold">{scanResult.brand}</p>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Product Name</Label>
                <p>{scanResult.productName}</p>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Description</Label>
                <p className="text-sm text-muted-foreground">{scanResult.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Container</Label>
                  <p>{scanResult.containerSize}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Base Qty</Label>
                  <p>{scanResult.baseUnitQuantity} qt</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Column 2: Specifications */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Droplets className="h-5 w-5" />
                Specifications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Fluid Type</Label>
                  <p className="capitalize">{scanResult.fluidType?.replace(/_/g, ' ')}</p>
                </div>
                {scanResult.viscosity && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Viscosity</Label>
                    <p className="font-mono font-bold text-lg">{scanResult.viscosity}</p>
                  </div>
                )}
              </div>

              {scanResult.baseStockType && (
                <div>
                  <Label className="text-xs text-muted-foreground">Base Stock</Label>
                  <p className="capitalize">{scanResult.baseStockType.replace(/_/g, ' ')}</p>
                </div>
              )}

              {scanResult.color && (
                <div>
                  <Label className="text-xs text-muted-foreground">Color</Label>
                  <p className="capitalize">{scanResult.color}</p>
                </div>
              )}

              {/* Industry Standards */}
              {(scanResult.apiClass || scanResult.aceaClass || scanResult.ilsacClass || scanResult.jasoClass) && (
                <div>
                  <Label className="text-xs text-muted-foreground">Industry Standards</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {scanResult.apiClass && <Badge variant="secondary">API {scanResult.apiClass}</Badge>}
                    {scanResult.aceaClass && <Badge variant="secondary">ACEA {scanResult.aceaClass}</Badge>}
                    {scanResult.ilsacClass && <Badge variant="secondary">ILSAC {scanResult.ilsacClass}</Badge>}
                    {scanResult.jasoClass && <Badge variant="secondary">JASO {scanResult.jasoClass}</Badge>}
                  </div>
                </div>
              )}

              {/* Properties */}
              {(scanResult.lowSaps || scanResult.highMileage || scanResult.racingFormula || scanResult.dieselSpecific) && (
                <div>
                  <Label className="text-xs text-muted-foreground">Properties</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {scanResult.lowSaps && <Badge variant="outline">Low SAPS</Badge>}
                    {scanResult.highMileage && <Badge variant="outline">High Mileage</Badge>}
                    {scanResult.racingFormula && <Badge variant="outline">Racing</Badge>}
                    {scanResult.dieselSpecific && <Badge variant="outline">Diesel</Badge>}
                  </div>
                </div>
              )}

              {/* Category */}
              <div>
                <Label className="text-xs text-muted-foreground">Category</Label>
                <Badge className="capitalize">{scanResult.category.replace(/_/g, ' ')}</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Column 3: OEM Approvals */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-5 w-5" />
                OEM Approvals
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {scanResult.oemApprovals.length > 0 ? (
                <div className="space-y-2">
                  {scanResult.oemApprovals.map((approval, i) => (
                    <div key={i} className="p-2 bg-muted rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm font-medium">{approval.normalizedCode}</span>
                        <Badge 
                          variant={approval.wasNormalized ? "default" : "outline"} 
                          className="text-xs capitalize"
                        >
                          {approval.status}
                        </Badge>
                      </div>
                      {approval.manufacturer && (
                        <p className="text-xs text-muted-foreground mt-1">{approval.manufacturer}</p>
                      )}
                      {approval.rawText !== approval.normalizedCode && (
                        <p className="text-xs text-muted-foreground italic">"{approval.rawText}"</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No OEM approvals found on label
                </p>
              )}

              {/* Warnings */}
              {scanResult.warnings.length > 0 && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg mt-4">
                  <p className="font-medium text-yellow-900 dark:text-yellow-100 mb-2 text-sm flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" />
                    Warnings
                  </p>
                  <ul className="text-xs text-yellow-800 dark:text-yellow-200 space-y-1">
                    {scanResult.warnings.map((warning, i) => (
                      <li key={i}>• {warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step 3: Save to Database */}
      {scanResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Save className="h-5 w-5" />
              Step 3: Save to Inventory
            </CardTitle>
            <CardDescription>
              Save this product to the parts inventory database. Financial data (cost/price/quantity) from ShopWare will be preserved for existing parts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Success Message */}
            {saveSuccess && (
              <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg mb-4 flex items-center gap-3">
                <CheckCircle className="h-6 w-6 text-green-600 shrink-0" />
                <div>
                  <p className="font-medium text-green-900 dark:text-green-100">{saveSuccess}</p>
                  <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                    Product data and fluid specifications saved successfully.
                  </p>
                </div>
              </div>
            )}

            {/* Info Note */}
            <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg mb-4 flex items-start gap-2">
              <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <p><strong>New parts:</strong> Created with $0 cost/price — update pricing from ShopWare import.</p>
                <p><strong>Existing parts:</strong> AI data overwrites product info; cost, price & quantities preserved.</p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleSave}
                disabled={saving || !!saveSuccess}
                className="flex-1"
                size="lg"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Saving to Database...
                  </>
                ) : saveSuccess ? (
                  <>
                    <CheckCircle className="mr-2 h-5 w-5" />
                    Saved Successfully
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-5 w-5" />
                    Save to Inventory Database
                  </>
                )}
              </Button>

              {saveSuccess && (
                <Button variant="outline" size="lg" onClick={handleReset}>
                  <Camera className="mr-2 h-5 w-5" />
                  Scan Another Product
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scanning State */}
      {scanning && (
        <Card>
          <CardContent className="py-16 text-center">
            <Loader2 className="h-16 w-16 mx-auto mb-4 animate-spin text-primary" />
            <h3 className="text-xl font-semibold mb-2">Analyzing Product Labels...</h3>
            <p className="text-muted-foreground">
              Gemini AI is extracting specifications, OEM approvals, and product data
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
