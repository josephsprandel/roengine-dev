"use client"

import React from "react"

import { useState, useCallback, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Check,
  Plus,
  Car,
  Camera,
  Upload,
  Sparkles,
  Loader2,
  X,
  AlertCircle,
  ImageIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import type { VehicleData } from "../ro-creation-wizard"
import { decodeVIN } from "@/lib/vin-decoder"

interface VehicleSelectionStepProps {
  customerId?: string
  selectedVehicle: VehicleData | null
  onSelectVehicle: (vehicle: VehicleData | null) => void
}

interface ExistingVehicle {
  id: string
  year: string
  make: string
  model: string
  trim?: string
  vin: string
  licensePlate: string
  color: string
  mileage: string
}

type CreationMode = "select" | "manual" | "ai"

interface UploadedImage {
  file: File
  preview: string
  classification?: string
  classifying?: boolean
}

export function VehicleSelectionStep({
  customerId,
  selectedVehicle,
  onSelectVehicle,
}: VehicleSelectionStepProps) {
  const [existingVehicles, setExistingVehicles] = useState<ExistingVehicle[]>([])
  const [vehiclesLoading, setVehiclesLoading] = useState(false)
  const [vehiclesError, setVehiclesError] = useState<string | null>(null)
  const [creationMode, setCreationMode] = useState<CreationMode>("select")
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisComplete, setAnalysisComplete] = useState(false)
  const [isDecodingVIN, setIsDecodingVIN] = useState(false)
  const [extractedData, setExtractedData] = useState<Partial<VehicleData>>({})
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [manualData, setManualData] = useState<VehicleData>({
    year: "",
    make: "",
    model: "",
    trim: "",
    vin: "",
    licensePlate: "",
    licensePlateState: "",
    color: "",
    mileage: "",
    isNew: true,
  })

  useEffect(() => {
    const fetchVehicles = async () => {
      if (!customerId) {
        setExistingVehicles([])
        return
      }

      setVehiclesLoading(true)
      setVehiclesError(null)

      try {
        const response = await fetch(`/api/vehicles?customer_id=${customerId}`)
        if (!response.ok) {
          throw new Error("Failed to load vehicles")
        }
        const data = await response.json()
        const vehicles = (data.vehicles || []).map((vehicle: any) => ({
          id: vehicle.id,
          year: String(vehicle.year || ""),
          make: vehicle.make || "",
          model: vehicle.model || "",
          trim: vehicle.submodel || vehicle.trim || "",
          vin: vehicle.vin || "",
          licensePlate: vehicle.license_plate || "",
          color: vehicle.color || "",
          mileage: vehicle.mileage ? vehicle.mileage.toLocaleString() : "",
        }))
        setExistingVehicles(vehicles)
      } catch (error: any) {
        console.error("[Vehicle Step] Failed to load vehicles:", error)
        setVehiclesError(error.message || "Failed to load vehicles")
      } finally {
        setVehiclesLoading(false)
      }
    }

    fetchVehicles()
  }, [customerId])

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    const newImages: UploadedImage[] = Array.from(files).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }))

    setUploadedImages((prev) => [...prev, ...newImages])
    setAnalysisComplete(false)
  }, [])


  const removeImage = (index: number) => {
    setUploadedImages((prev) => {
      const newImages = [...prev]
      URL.revokeObjectURL(newImages[index].preview)
      newImages.splice(index, 1)
      return newImages
    })
    setAnalysisComplete(false)
  }

  const openLightbox = (index: number) => {
    setLightboxIndex(index)
    setLightboxOpen(true)
  }

  const closeLightbox = () => {
    setLightboxOpen(false)
  }

  const nextImage = () => {
    setLightboxIndex((prev) => (prev + 1) % uploadedImages.length)
  }

  const prevImage = () => {
    setLightboxIndex((prev) => (prev - 1 + uploadedImages.length) % uploadedImages.length)
  }

  const handleAnalyzeImages = async () => {
    setIsAnalyzing(true)

    try {
      console.log('=== STARTING VEHICLE ANALYSIS ===')
      console.log('Number of images:', uploadedImages.length)

      // Mark all images as classifying
      setUploadedImages(prev => prev.map(img => ({ ...img, classifying: true })))

      // Create FormData with images
      const formData = new FormData()
      uploadedImages.forEach((img) => {
        formData.append('images', img.file)
      })

      // Call the API
      const response = await fetch('/api/analyze-vehicle', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to analyze images')
      }

      const result = await response.json()
      console.log('Analysis result:', result)

      if (result.success && result.data) {
        // Update images with classifications
        if (result.classifications && result.classifications.length === uploadedImages.length) {
          setUploadedImages(prev => prev.map((img, idx) => ({
            ...img,
            classifying: false,
            classification: result.classifications[idx]
          })))
        }

        const extracted: Partial<VehicleData> = {
          year: result.data.year || "",
          make: result.data.make || "",
          model: result.data.model || "",
          trim: result.data.trim || "",
          vin: result.data.vin || "",
          licensePlate: result.data.licensePlate || "",
          licensePlateState: result.data.licensePlateState || "",
          color: result.data.color || "",
          mileage: result.data.mileage || "",
        }

        // Store additional data
        if (result.data.build_date || result.data.tire_size) {
          (extracted as any).build_date = result.data.build_date || "";
          (extracted as any).tire_size = result.data.tire_size || "";
        }

        setExtractedData(extracted)
        setManualData((prev) => ({ ...prev, ...extracted }))
        setAnalysisComplete(true)
        console.log('Vehicle data extracted successfully')

        // Auto-decode VIN if we have it
        if (extracted.vin && extracted.vin.length === 17) {
          console.log('VIN detected, auto-decoding...')
          decodeAndFillVIN(extracted.vin)
        }
      } else {
        throw new Error('No data extracted from images')
      }
    } catch (error: any) {
      console.error('Analysis error:', error)
      alert(`Failed to analyze images: ${error.message}`)
    } finally {
      setIsAnalyzing(false)
      console.log('=================================')
    }
  }

  const handleSelectExisting = (vehicle: ExistingVehicle) => {
    setCreationMode("select")
    onSelectVehicle({
      ...vehicle,
      isNew: false,
    })
  }

  const handleManualChange = (field: keyof VehicleData, value: string) => {
    const updated = { ...manualData, [field]: value }
    setManualData(updated)
    if (updated.year && updated.make && updated.model && updated.vin) {
      onSelectVehicle(updated)
    } else {
      onSelectVehicle(null)
    }
  }

  const decodeAndFillVIN = async (vin: string) => {
    if (!vin || vin.length !== 17) return

    setIsDecodingVIN(true)
    try {
      console.log('[Vehicle Step] Decoding VIN:', vin)
      const decoded = await decodeVIN(vin)

      if (decoded.error) {
        console.error('[Vehicle Step] VIN decode error:', decoded.error)
        return
      }

      // Fill in missing fields from VIN decode
      setManualData(prev => ({
        ...prev,
        year: prev.year || decoded.year || "",
        make: prev.make || decoded.make || "",
        model: prev.model || decoded.model || "",
        trim: prev.trim || decoded.trim || ""
      }))

      // Update extracted data to show which fields came from VIN
      setExtractedData(prev => ({
        ...prev,
        year: prev.year || decoded.year || "",
        make: prev.make || decoded.make || "",
        model: prev.model || decoded.model || "",
        trim: prev.trim || decoded.trim || ""
      }))

      console.log('[Vehicle Step] VIN decoded successfully:', decoded)
    } catch (error) {
      console.error('[Vehicle Step] VIN decode failed:', error)
    } finally {
      setIsDecodingVIN(false)
    }
  }

  const handleConfirmAIData = () => {
    console.log('[Vehicle Step] Confirming AI data...')
    console.log('[Vehicle Step] manualData:', JSON.stringify(manualData, null, 2))
    
    if (manualData.year && manualData.make && manualData.model && manualData.vin) {
      console.log('[Vehicle Step] Calling onSelectVehicle with manualData')
      onSelectVehicle(manualData)
    } else {
      console.warn('[Vehicle Step] Missing required fields, not calling onSelectVehicle')
    }
  }

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (!lightboxOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') nextImage()
      else if (e.key === 'ArrowLeft') prevImage()
      else if (e.key === 'Escape') closeLightbox()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [lightboxOpen, lightboxIndex, uploadedImages.length])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-1">Select or Add Vehicle</h2>
        <p className="text-sm text-muted-foreground">
          Choose from existing vehicles, upload photos for AI analysis, or enter details manually
        </p>
      </div>

      {/* Mode Selector */}
      <div className="flex gap-2">
        <Button
          variant={creationMode === "select" ? "default" : "outline"}
          onClick={() => {
            setCreationMode("select")
            onSelectVehicle(null)
          }}
          className={creationMode !== "select" ? "bg-transparent" : ""}
        >
          <Car size={18} className="mr-2" />
          Existing Vehicles
        </Button>
        <Button
          variant={creationMode === "ai" ? "default" : "outline"}
          onClick={() => {
            setCreationMode("ai")
            onSelectVehicle(null)
          }}
          className={creationMode !== "ai" ? "bg-transparent" : ""}
        >
          <Sparkles size={18} className="mr-2" />
          AI Photo Analysis
        </Button>
        <Button
          variant={creationMode === "manual" ? "default" : "outline"}
          onClick={() => {
            setCreationMode("manual")
            onSelectVehicle(null)
          }}
          className={creationMode !== "manual" ? "bg-transparent" : ""}
        >
          <Plus size={18} className="mr-2" />
          Manual Entry
        </Button>
      </div>

      {/* Select Existing */}
      {creationMode === "select" && (
        <div className="space-y-2">
          {vehiclesLoading ? (
            <Card className="p-12 border-border text-center">
              <Loader2 className="mx-auto text-muted-foreground mb-3 animate-spin" size={32} />
              <p className="text-muted-foreground">Loading vehicles...</p>
            </Card>
          ) : vehiclesError ? (
            <Card className="p-12 border-border text-center">
              <p className="text-destructive mb-2">Error loading vehicles</p>
              <p className="text-sm text-muted-foreground">{vehiclesError}</p>
            </Card>
          ) : existingVehicles.length > 0 ? (
            existingVehicles.map((vehicle) => {
              const isSelected = selectedVehicle?.id === vehicle.id
              return (
                <Card
                  key={vehicle.id}
                  onClick={() => handleSelectExisting(vehicle)}
                  className={`p-4 border cursor-pointer transition-all ${
                    isSelected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                          isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <Car size={24} />
                      </div>
                      <div>
                        <h3 className="font-medium text-foreground">
                          {vehicle.year} {vehicle.make} {vehicle.model}
                        </h3>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
                          <span>VIN: {vehicle.vin.slice(-8)}</span>
                          <span>Plate: {vehicle.licensePlate}</span>
                          <span>{vehicle.color}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary" className="text-xs">
                        {vehicle.mileage} mi
                      </Badge>
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
              <Car className="mx-auto text-muted-foreground mb-3" size={32} />
              <p className="text-muted-foreground">No vehicles on file for this customer</p>
              <Button variant="link" onClick={() => setCreationMode("ai")} className="mt-2">
                Add a new vehicle
              </Button>
            </Card>
          )}
        </div>
      )}

      {/* AI Photo Analysis */}
      {creationMode === "ai" && (
        <div className="space-y-6">
          {/* Upload Area */}
          <Card className="border-border border-dashed">
            <label className="block p-8 cursor-pointer">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
              />
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                  <Camera size={28} className="text-muted-foreground" />
                </div>
                <h3 className="font-medium text-foreground mb-1">Upload Vehicle Photos</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Drag and drop or click to upload. For best results, include:
                </p>
                <div className="flex flex-wrap justify-center gap-2 text-xs">
                  <Badge variant="secondary">Front of vehicle</Badge>
                  <Badge variant="secondary">Rear (license plate)</Badge>
                  <Badge variant="secondary">VIN plate</Badge>
                  <Badge variant="secondary">Dashboard (mileage)</Badge>
                </div>
              </div>
            </label>
          </Card>

          {/* Uploaded Images */}
          {uploadedImages.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-medium text-foreground">Uploaded Photos ({uploadedImages.length})</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {uploadedImages.map((image, index) => (
                  <div key={index} className="relative group">
                    <div 
                      className="aspect-video rounded-lg overflow-hidden bg-muted border border-border cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                      onClick={() => openLightbox(index)}
                    >
                      <img
                        src={image.preview || "/placeholder.svg"}
                        alt={`Upload ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    {image.classifying && (
                      <div className="absolute bottom-2 left-2 right-2">
                        <Badge variant="secondary" className="text-xs w-full justify-center">
                          <Loader2 size={12} className="mr-1 animate-spin" />
                          Classifying...
                        </Badge>
                      </div>
                    )}
                    {image.classification && !image.classifying && (
                      <div className="absolute bottom-2 left-2 right-2">
                        <Badge 
                          variant="default" 
                          className="text-xs w-full justify-center bg-primary/90"
                        >
                          {String(image.classification).replace(/_/g, ' ')}
                        </Badge>
                      </div>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        removeImage(index)
                      }}
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Analyze Button */}
              {!analysisComplete && (
                <Button
                  onClick={handleAnalyzeImages}
                  disabled={isAnalyzing || uploadedImages.length === 0}
                  className="w-full gap-2"
                  size="lg"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Analyzing Images...
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} />
                      Analyze with AI
                    </>
                  )}
                </Button>
              )}
            </div>
          )}

          {/* Analysis Results */}
          {analysisComplete && (
            <Card className="p-5 border-border bg-green-500/5 border-green-500/20">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                  {isDecodingVIN ? (
                    <Loader2 size={16} className="text-green-600 animate-spin" />
                  ) : (
                    <Check size={16} className="text-green-600" />
                  )}
                </div>
                <div>
                  <h3 className="font-medium text-foreground">
                    {isDecodingVIN ? 'Decoding VIN...' : 'Analysis Complete'}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {isDecodingVIN 
                      ? 'Filling in vehicle details from VIN...'
                      : 'We extracted the following information. Please verify and edit if needed.'
                    }
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Year", field: "year" as const, required: true },
                  { label: "Make", field: "make" as const, required: true },
                  { label: "Model", field: "model" as const, required: true },
                  { label: "Trim", field: "trim" as const, required: false },
                  { label: "VIN", field: "vin" as const, required: true, span: 2 },
                  { label: "License Plate", field: "licensePlate" as const, required: false },
                  { label: "State", field: "licensePlateState" as const, required: false },
                  { label: "Color", field: "color" as const, required: false },
                  { label: "Mileage", field: "mileage" as const, required: false },
                  { label: "Build Date", field: "build_date" as any, required: false },
                  { label: "Tire Size", field: "tire_size" as any, required: false, span: 2 },
                ].map(({ label, field, required, span }) => (
                  <div key={field} className={span === 2 ? "col-span-2" : ""}>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      {label} {required && "*"}
                    </label>
                    <Input
                      value={(manualData as any)[field] || ""}
                      onChange={(e) => handleManualChange(field as any, e.target.value)}
                      className={`bg-card border-border text-sm ${
                        (extractedData as any)[field] ? "border-green-500/50" : ""
                      }`}
                      placeholder={`Enter ${label.toLowerCase()}`}
                    />
                    {(extractedData as any)[field] && (
                      <span className="text-xs text-green-600 flex items-center gap-1 mt-1">
                        <Sparkles size={10} />
                        AI detected
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <Button onClick={handleConfirmAIData} className="w-full mt-4 gap-2">
                <Check size={16} />
                Confirm Vehicle Details
              </Button>
            </Card>
          )}

          {/* Tips */}
          <Card className="p-4 border-border bg-muted/30">
            <div className="flex items-start gap-3">
              <AlertCircle size={18} className="text-muted-foreground flex-shrink-0 mt-0.5" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">Tips for best results:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Ensure photos are clear and well-lit</li>
                  <li>Include the VIN plate (usually on the dashboard or driver door jamb)</li>
                  <li>Capture the full license plate in the rear photo</li>
                  <li>For mileage, photograph the odometer clearly</li>
                </ul>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Manual Entry */}
      {creationMode === "manual" && (
        <Card className="p-5 border-border">
          <h3 className="font-medium text-foreground mb-4">Enter Vehicle Details</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Year", field: "year" as const, placeholder: "2023", required: true },
              { label: "Make", field: "make" as const, placeholder: "Ford", required: true },
              { label: "Model", field: "model" as const, placeholder: "F-150", required: true },
              { label: "Trim", field: "trim" as const, placeholder: "Lariat", required: false },
              { label: "VIN", field: "vin" as const, placeholder: "1FTFW1E85NFA12345", required: true, span: 2 },
              { label: "License Plate", field: "licensePlate" as const, placeholder: "ABC-1234", required: false },
              { label: "State", field: "licensePlateState" as const, placeholder: "TX", required: false },
              { label: "Color", field: "color" as const, placeholder: "Silver", required: false },
              { label: "Mileage", field: "mileage" as const, placeholder: "45000", required: false },
              { label: "Build Date", field: "build_date" as any, placeholder: "05/16", required: false },
              { label: "Tire Size", field: "tire_size" as any, placeholder: "235/50R18 97V", required: false, span: 2 },
            ].map(({ label, field, placeholder, required, span }) => (
              <div key={field} className={span === 2 ? "col-span-2" : ""}>
                <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                  {label} {required && <span className="text-destructive">*</span>}
                </label>
                <Input
                  value={(manualData as any)[field] || ""}
                  onChange={(e) => handleManualChange(field as any, e.target.value)}
                  placeholder={placeholder}
                  className="bg-card border-border"
                />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Lightbox */}
      {lightboxOpen && uploadedImages.length > 0 && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={closeLightbox}
        >
          {/* Close button */}
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors z-10"
          >
            <X size={24} className="text-white" />
          </button>

          {/* Image counter */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/50 px-4 py-2 rounded-full text-white text-sm">
            {lightboxIndex + 1} / {uploadedImages.length}
          </div>

          {/* Previous button */}
          {uploadedImages.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                prevImage()
              }}
              className="absolute left-4 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <ChevronLeft size={28} className="text-white" />
            </button>
          )}

          {/* Image */}
          <div 
            className="max-w-7xl max-h-[90vh] p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={uploadedImages[lightboxIndex]?.preview || "/placeholder.svg"}
              alt={`Photo ${lightboxIndex + 1}`}
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
            />
            {uploadedImages[lightboxIndex]?.classification && (
              <div className="mt-4 flex justify-center">
                <Badge variant="default" className="bg-primary/90 text-sm px-4 py-2">
                  {String(uploadedImages[lightboxIndex].classification).replace(/_/g, ' ')}
                </Badge>
              </div>
            )}
          </div>

          {/* Next button */}
          {uploadedImages.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                nextImage()
              }}
              className="absolute right-4 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <ChevronRight size={28} className="text-white" />
            </button>
          )}

          {/* Keyboard hint */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 px-4 py-2 rounded-full text-white text-xs">
            Use arrow keys to navigate • ESC to close
          </div>
        </div>
      )}
    </div>
  )
}
