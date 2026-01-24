"use client"

import React from "react"

import { useState, useCallback } from "react"
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
} from "lucide-react"
import type { VehicleData } from "../ro-creation-wizard"

interface VehicleSelectionStepProps {
  customerId?: string
  selectedVehicle: VehicleData | null
  onSelectVehicle: (vehicle: VehicleData | null) => void
}

const existingVehicles = [
  {
    id: "veh-001",
    year: "2022",
    make: "Tesla",
    model: "Model 3",
    trim: "Long Range",
    vin: "5YJ3E1EA2PF123456",
    licensePlate: "ABC-1234",
    color: "White",
    mileage: "24,500",
  },
  {
    id: "veh-002",
    year: "2020",
    make: "Honda",
    model: "Accord",
    trim: "Sport",
    vin: "1HGCV1F34LA012345",
    licensePlate: "XYZ-5678",
    color: "Black",
    mileage: "45,200",
  },
]

type CreationMode = "select" | "manual" | "ai"

interface UploadedImage {
  file: File
  preview: string
  type: "front" | "rear" | "vin" | "dashboard" | "other"
}

export function VehicleSelectionStep({
  customerId,
  selectedVehicle,
  onSelectVehicle,
}: VehicleSelectionStepProps) {
  const [creationMode, setCreationMode] = useState<CreationMode>("select")
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisComplete, setAnalysisComplete] = useState(false)
  const [extractedData, setExtractedData] = useState<Partial<VehicleData>>({})
  const [manualData, setManualData] = useState<VehicleData>({
    year: "",
    make: "",
    model: "",
    trim: "",
    vin: "",
    licensePlate: "",
    color: "",
    mileage: "",
    isNew: true,
  })

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    const newImages: UploadedImage[] = Array.from(files).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      type: "other" as const,
    }))

    setUploadedImages((prev) => [...prev, ...newImages])
    setAnalysisComplete(false)
  }, [])

  const handleImageTypeChange = (index: number, type: UploadedImage["type"]) => {
    setUploadedImages((prev) =>
      prev.map((img, i) => (i === index ? { ...img, type } : img))
    )
  }

  const removeImage = (index: number) => {
    setUploadedImages((prev) => {
      const newImages = [...prev]
      URL.revokeObjectURL(newImages[index].preview)
      newImages.splice(index, 1)
      return newImages
    })
    setAnalysisComplete(false)
  }

  const handleAnalyzeImages = async () => {
    setIsAnalyzing(true)

    try {
      console.log('=== STARTING VEHICLE ANALYSIS ===')
      console.log('Number of images:', uploadedImages.length)

      // Create FormData with images
      const formData = new FormData()
      uploadedImages.forEach((img) => {
        formData.append('images', img.file)
      })

      // Call the API
      const response = await fetch('/v0/api/analyze-vehicle', {
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
        const extracted: Partial<VehicleData> = {
          year: result.data.year || "",
          make: result.data.make || "",
          model: result.data.model || "",
          trim: result.data.trim || "",
          vin: result.data.vin || "",
          licensePlate: result.data.licensePlate || "",
          color: result.data.color || "",
          mileage: result.data.mileage || "",
        }

        setExtractedData(extracted)
        setManualData((prev) => ({ ...prev, ...extracted }))
        setAnalysisComplete(true)
        console.log('Vehicle data extracted successfully')
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

  const handleSelectExisting = (vehicle: typeof existingVehicles[0]) => {
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

  const handleConfirmAIData = () => {
    if (manualData.year && manualData.make && manualData.model && manualData.vin) {
      onSelectVehicle(manualData)
    }
  }

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
          {existingVehicles.length > 0 ? (
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
                    <div className="aspect-video rounded-lg overflow-hidden bg-muted border border-border">
                      <img
                        src={image.preview || "/placeholder.svg"}
                        alt={`Upload ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <button
                      onClick={() => removeImage(index)}
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={14} />
                    </button>
                    <select
                      value={image.type}
                      onChange={(e) => handleImageTypeChange(index, e.target.value as UploadedImage["type"])}
                      className="mt-2 w-full text-xs px-2 py-1 rounded bg-muted border border-border text-foreground"
                    >
                      <option value="front">Front View</option>
                      <option value="rear">Rear / License Plate</option>
                      <option value="vin">VIN Plate</option>
                      <option value="dashboard">Dashboard</option>
                      <option value="other">Other</option>
                    </select>
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
                  <Check size={16} className="text-green-600" />
                </div>
                <div>
                  <h3 className="font-medium text-foreground">Analysis Complete</h3>
                  <p className="text-sm text-muted-foreground">
                    We extracted the following information. Please verify and edit if needed.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Year", field: "year" as const, required: true },
                  { label: "Make", field: "make" as const, required: true },
                  { label: "Model", field: "model" as const, required: true },
                  { label: "Trim", field: "trim" as const, required: false },
                  { label: "VIN", field: "vin" as const, required: true },
                  { label: "License Plate", field: "licensePlate" as const, required: false },
                  { label: "Color", field: "color" as const, required: false },
                  { label: "Mileage", field: "mileage" as const, required: false },
                ].map(({ label, field, required }) => (
                  <div key={field}>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      {label} {required && "*"}
                    </label>
                    <Input
                      value={manualData[field] || ""}
                      onChange={(e) => handleManualChange(field, e.target.value)}
                      className={`bg-card border-border text-sm ${
                        extractedData[field] ? "border-green-500/50" : ""
                      }`}
                      placeholder={`Enter ${label.toLowerCase()}`}
                    />
                    {extractedData[field] && (
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
              { label: "VIN", field: "vin" as const, placeholder: "1FTFW1E85NFA12345", required: true },
              { label: "License Plate", field: "licensePlate" as const, placeholder: "ABC-1234", required: false },
              { label: "Color", field: "color" as const, placeholder: "Silver", required: false },
              { label: "Mileage", field: "mileage" as const, placeholder: "45,000", required: false },
            ].map(({ label, field, placeholder, required }) => (
              <div key={field} className={field === "vin" ? "col-span-2" : ""}>
                <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                  {label} {required && <span className="text-destructive">*</span>}
                </label>
                <Input
                  value={manualData[field] || ""}
                  onChange={(e) => handleManualChange(field, e.target.value)}
                  placeholder={placeholder}
                  className="bg-card border-border"
                />
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
