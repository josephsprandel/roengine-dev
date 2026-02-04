'use client'

/**
 * Fluid Specification Scanner UI
 * 
 * Allows scanning product labels with camera or file upload to extract specs.
 * Displays AI-extracted data for review and saves to inventory.
 */

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { 
  Camera, 
  Upload, 
  AlertCircle, 
  CheckCircle, 
  Loader2, 
  Save,
  Search,
  X,
  Edit2
} from 'lucide-react'

interface ExtractedSpec {
  product_name: string
  brand?: string
  fluid_type: string
  base_stock?: string
  viscosity?: string
  api_service_class?: string
  acea_class?: string
  ilsac_class?: string
  jaso_class?: string
  oem_approvals?: Array<{
    raw_text: string
    normalized_code: string
    manufacturer?: string
    status: string
    was_normalized?: boolean
  }>
  low_saps?: boolean
  high_mileage?: boolean
  container_size?: string
  confidence_score: number
  warnings?: string[]
}

interface InventoryItem {
  id: number
  part_number: string
  description: string
  vendor?: string
  quantity_available?: number
}

export default function ScanSpecsPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [photos, setPhotos] = useState<File[]>([])
  const [photoPreview, setPhotoPreview] = useState<string[]>([])
  const [scanning, setScanning] = useState(false)
  const [extracted, setExtracted] = useState<ExtractedSpec | null>(null)
  const [needsReview, setNeedsReview] = useState(false)
  
  // Inventory linking
  const [showInventorySearch, setShowInventorySearch] = useState(false)
  const [inventorySearch, setInventorySearch] = useState('')
  const [inventoryResults, setInventoryResults] = useState<InventoryItem[]>([])
  const [selectedInventory, setSelectedInventory] = useState<InventoryItem | null>(null)
  const [saving, setSaving] = useState(false)

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    if (files.length === 0) return

    setPhotos(files)

    // Generate previews
    const previews = files.map(file => URL.createObjectURL(file))
    setPhotoPreview(previews)
  }

  // Trigger file input
  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  // Remove a photo
  const removePhoto = (index: number) => {
    const newPhotos = photos.filter((_, i) => i !== index)
    const newPreviews = photoPreview.filter((_, i) => i !== index)
    
    // Revoke old URL to free memory
    URL.revokeObjectURL(photoPreview[index])
    
    setPhotos(newPhotos)
    setPhotoPreview(newPreviews)
  }

  // Scan labels with AI
  const handleScan = async () => {
    if (photos.length === 0) {
      alert('Please select at least one photo')
      return
    }

    setScanning(true)
    setExtracted(null)
    setNeedsReview(false)

    try {
      const formData = new FormData()
      photos.forEach(photo => {
        formData.append('photos', photo)
      })

      const response = await fetch('/api/inventory/scan-label', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to scan label')
      }

      const result = await response.json()
      setExtracted(result.extracted)
      setNeedsReview(result.needs_review)
      
      console.log('Extraction complete:', result)

    } catch (error: any) {
      console.error('Scan error:', error)
      alert(`Scan failed: ${error.message}`)
    } finally {
      setScanning(false)
    }
  }

  // Search inventory
  const handleInventorySearch = async () => {
    if (!inventorySearch.trim()) return

    try {
      const response = await fetch(`/api/inventory/parts?search=${encodeURIComponent(inventorySearch)}`)
      
      if (!response.ok) {
        console.error('API error response:', response.status, response.statusText)
        const errorData = await response.json().catch(() => ({}))
        console.error('API error data:', errorData)
        alert(`Search failed: ${errorData.error || response.statusText}`)
        setInventoryResults([])
        return
      }
      
      const data = await response.json()
      console.log('API response data:', data)
      console.log('Parts count:', data.parts?.length || 0)
      
      if (data.success === false) {
        console.error('API returned error:', data.error)
        alert(`Search failed: ${data.error}`)
        setInventoryResults([])
        return
      }
      
      setInventoryResults(data.parts || [])
    } catch (error) {
      console.error('Inventory search error:', error)
      alert(`Search failed: ${error}`)
      setInventoryResults([])
    }
  }

  // Select inventory item
  const handleSelectInventory = (item: InventoryItem) => {
    setSelectedInventory(item)
    setShowInventorySearch(false)
  }

  // Save specs to inventory
  const handleSave = async () => {
    if (!selectedInventory || !extracted) {
      alert('Please select an inventory item first')
      return
    }

    setSaving(true)

    try {
      const response = await fetch(`/api/inventory/${selectedInventory.id}/specs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          extracted,
          photoUrl: null // Could implement photo upload later
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save specifications')
      }

      const result = await response.json()
      
      alert(`✅ Specifications saved successfully!\n${result.message}`)
      
      // Reset form
      setPhotos([])
      setPhotoPreview([])
      setExtracted(null)
      setSelectedInventory(null)
      setNeedsReview(false)

    } catch (error: any) {
      console.error('Save error:', error)
      alert(`Failed to save: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  // Confidence color
  const getConfidenceColor = (score: number) => {
    if (score >= 0.9) return 'bg-green-500'
    if (score >= 0.8) return 'bg-green-400'
    if (score >= 0.7) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Fluid Specification Scanner</h1>
        <p className="text-muted-foreground mt-2">
          Scan product labels to extract technical specifications using AI
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Photo Upload & Scan */}
        <Card>
          <CardHeader>
            <CardTitle>1. Upload Label Photos</CardTitle>
            <CardDescription>
              Take photos of the product label (front and back if needed)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* Photo Preview Grid */}
            {photoPreview.length > 0 && (
              <div className="grid grid-cols-2 gap-2 mb-4">
                {photoPreview.map((preview, index) => (
                  <div key={index} className="relative aspect-square">
                    <img
                      src={preview}
                      alt={`Label ${index + 1}`}
                      className="w-full h-full object-cover rounded-lg border"
                    />
                    <Button
                      size="sm"
                      variant="destructive"
                      className="absolute top-2 right-2"
                      onClick={() => removePhoto(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload Buttons */}
            <div className="flex gap-2">
              <Button
                onClick={handleUploadClick}
                variant="outline"
                className="flex-1"
                disabled={scanning}
              >
                <Upload className="mr-2 h-4 w-4" />
                {photoPreview.length > 0 ? 'Add More Photos' : 'Upload Photos'}
              </Button>
            </div>

            {/* Scan Button */}
            <Button
              onClick={handleScan}
              disabled={photos.length === 0 || scanning}
              className="w-full"
              size="lg"
            >
              {scanning ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Scanning with AI...
                </>
              ) : (
                <>
                  <Camera className="mr-2 h-5 w-5" />
                  Scan Labels ({photos.length} photo{photos.length !== 1 ? 's' : ''})
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Right: Extracted Specs */}
        <Card>
          <CardHeader>
            <CardTitle>2. Extracted Specifications</CardTitle>
            <CardDescription>
              AI-extracted specs from label (editable)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!extracted && !scanning && (
              <div className="text-center py-12 text-muted-foreground">
                <Camera className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Upload and scan photos to see extracted specs</p>
              </div>
            )}

            {scanning && (
              <div className="text-center py-12">
                <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-primary" />
                <p className="text-muted-foreground">Analyzing label with Gemini 3.0...</p>
              </div>
            )}

            {extracted && (
              <div className="space-y-4">
                {/* Confidence Score */}
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    {needsReview ? (
                      <AlertCircle className="h-5 w-5 text-yellow-500" />
                    ) : (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    )}
                    <span className="font-medium">
                      Confidence: {(extracted.confidence_score * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className={`h-2 w-32 rounded-full bg-muted-foreground/20 overflow-hidden`}>
                    <div
                      className={`h-full ${getConfidenceColor(extracted.confidence_score)}`}
                      style={{ width: `${extracted.confidence_score * 100}%` }}
                    />
                  </div>
                </div>

                {/* Warnings */}
                {extracted.warnings && extracted.warnings.length > 0 && (
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <p className="font-medium text-yellow-900 dark:text-yellow-100 mb-2">
                      ⚠️ Warnings:
                    </p>
                    <ul className="text-sm text-yellow-800 dark:text-yellow-200 space-y-1">
                      {extracted.warnings.map((warning, i) => (
                        <li key={i}>• {warning}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Specs Grid */}
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Product Name</Label>
                    <p className="font-medium">{extracted.product_name}</p>
                  </div>

                  {extracted.brand && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Brand</Label>
                      <p>{extracted.brand}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Fluid Type</Label>
                      <p className="capitalize">{extracted.fluid_type?.replace(/_/g, ' ')}</p>
                    </div>
                    
                    {extracted.viscosity && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Viscosity</Label>
                        <p className="font-mono font-bold">{extracted.viscosity}</p>
                      </div>
                    )}
                  </div>

                  {/* Industry Standards */}
                  {(extracted.api_service_class || extracted.acea_class || extracted.ilsac_class) && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Industry Standards</Label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {extracted.api_service_class && (
                          <Badge variant="secondary">API {extracted.api_service_class}</Badge>
                        )}
                        {extracted.acea_class && (
                          <Badge variant="secondary">ACEA {extracted.acea_class}</Badge>
                        )}
                        {extracted.ilsac_class && (
                          <Badge variant="secondary">ILSAC {extracted.ilsac_class}</Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {/* OEM Approvals */}
                  {extracted.oem_approvals && extracted.oem_approvals.length > 0 && (
                    <div>
                      <Label className="text-xs text-muted-foreground">OEM Approvals</Label>
                      <div className="space-y-2 mt-1">
                        {extracted.oem_approvals.map((approval, i) => (
                          <div key={i} className="flex items-center justify-between p-2 bg-muted rounded">
                            <span className="font-mono text-sm">{approval.normalized_code}</span>
                            <Badge variant={approval.was_normalized ? "default" : "outline"} className="text-xs">
                              {approval.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Properties */}
                  {(extracted.low_saps || extracted.high_mileage || extracted.base_stock) && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Properties</Label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {extracted.base_stock && (
                          <Badge variant="outline" className="capitalize">
                            {extracted.base_stock.replace(/_/g, ' ')}
                          </Badge>
                        )}
                        {extracted.low_saps && (
                          <Badge variant="outline">Low SAPS</Badge>
                        )}
                        {extracted.high_mileage && (
                          <Badge variant="outline">High Mileage</Badge>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Link to Inventory */}
      {extracted && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>3. Link to Inventory Item</CardTitle>
            <CardDescription>
              Select which inventory item these specifications belong to
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedInventory ? (
              <Button onClick={() => setShowInventorySearch(true)} variant="outline" className="w-full">
                <Search className="mr-2 h-4 w-4" />
                Search Inventory
              </Button>
            ) : (
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <p className="font-medium">{selectedInventory.part_number}</p>
                  <p className="text-sm text-muted-foreground">{selectedInventory.description}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedInventory(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Save Button */}
            <Button
              onClick={handleSave}
              disabled={!selectedInventory || saving}
              className="w-full"
              size="lg"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-5 w-5" />
                  Save Specifications to Inventory
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Inventory Search Dialog */}
      <Dialog open={showInventorySearch} onOpenChange={setShowInventorySearch}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Search Inventory</DialogTitle>
            <DialogDescription>
              Find and select the inventory part to attach specifications to
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Search by part number or description..."
                value={inventorySearch}
                onChange={(e) => setInventorySearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleInventorySearch()}
              />
              <Button onClick={handleInventorySearch}>
                <Search className="h-4 w-4" />
              </Button>
            </div>

            {inventoryResults.length > 0 ? (
              <div className="space-y-2">
                {inventoryResults.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSelectInventory(item)}
                    className="w-full p-3 text-left border rounded-lg hover:bg-muted transition-colors"
                  >
                    <p className="font-medium">{item.part_number}</p>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                    {item.quantity_available !== undefined && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Qty: {item.quantity_available}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No results. Try searching by part number or description.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
