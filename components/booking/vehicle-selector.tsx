"use client"

import { useState, useEffect, useCallback } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Loader2,
  Check,
  RotateCcw,
  Search,
} from "lucide-react"

export interface VehicleSelection {
  year: string
  make: string
  model: string
  vin?: string
}

interface VehicleSelectorProps {
  value: VehicleSelection
  onChange: (value: VehicleSelection) => void
}

export function VehicleSelector({ value, onChange }: VehicleSelectorProps) {
  // ── Dropdown data ──
  const [years, setYears] = useState<number[]>([])
  const [makes, setMakes] = useState<string[]>([])
  const [models, setModels] = useState<string[]>([])

  // ── Loading states ──
  const [loadingYears, setLoadingYears] = useState(false)
  const [loadingMakes, setLoadingMakes] = useState(false)
  const [loadingModels, setLoadingModels] = useState(false)

  // ── Error state ──
  const [error, setError] = useState('')

  // ── VIN decode ──
  const [vinInput, setVinInput] = useState(value.vin || "")
  const [vinDecoding, setVinDecoding] = useState(false)
  const [vinResult, setVinResult] = useState<string | null>(null)
  const [vinError, setVinError] = useState<string | null>(null)

  // ── Fetch years on mount ──
  useEffect(() => {
    setLoadingYears(true)
    fetch("/api/vehicles/years")
      .then((r) => r.json())
      .then((data) => setYears(data.years || []))
      .catch(() => setError('Failed to load vehicle options'))
      .finally(() => setLoadingYears(false))
  }, [])

  // ── Fetch makes when year changes ──
  useEffect(() => {
    if (!value.year) {
      setMakes([])
      return
    }
    setLoadingMakes(true)
    fetch(`/api/vehicles/makes?year=${value.year}`)
      .then((r) => r.json())
      .then((data) => setMakes(data.makes || []))
      .catch(() => setError('Failed to load vehicle options'))
      .finally(() => setLoadingMakes(false))
  }, [value.year])

  // ── Fetch models when year+make change ──
  useEffect(() => {
    if (!value.year || !value.make) {
      setModels([])
      return
    }
    setLoadingModels(true)
    fetch(`/api/vehicles/models?year=${value.year}&make=${encodeURIComponent(value.make)}`)
      .then((r) => r.json())
      .then((data) => setModels(data.models || []))
      .catch(() => setError('Failed to load vehicle options'))
      .finally(() => setLoadingModels(false))
  }, [value.year, value.make])

  // ── Handlers ──
  const handleYearChange = (year: string) => {
    onChange({ year, make: "", model: "", vin: value.vin })
    setVinResult(null)
  }

  const handleMakeChange = (make: string) => {
    onChange({ ...value, make, model: "" })
    setVinResult(null)
  }

  const handleModelChange = (model: string) => {
    onChange({ ...value, model })
  }

  const handleReset = () => {
    onChange({ year: "", make: "", model: "", vin: "" })
    setVinInput("")
    setVinResult(null)
    setVinError(null)
  }

  // ── VIN decode ──
  const decodeVin = useCallback(async (vin: string) => {
    if (vin.length !== 17) return
    setVinDecoding(true)
    setVinError(null)
    setVinResult(null)
    try {
      const res = await fetch(`/api/vehicles/decode-vin?vin=${encodeURIComponent(vin)}`)
      const data = await res.json()
      if (!res.ok || data.error) {
        setVinError(data.error || "Could not decode VIN")
        return
      }
      const { year, make, model } = data
      if (year && make && model) {
        onChange({
          year: String(year),
          make,
          model,
          vin,
        })
        setVinResult(`${year} ${make} ${model}`)
      } else {
        setVinError("VIN decoded but missing vehicle data — use dropdowns instead")
      }
    } catch {
      setVinError("Failed to decode VIN")
    } finally {
      setVinDecoding(false)
    }
  }, [onChange])

  const handleVinChange = (raw: string) => {
    const cleaned = raw.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "").slice(0, 17)
    setVinInput(cleaned)
    setVinError(null)
    setVinResult(null)
    onChange({ ...value, vin: cleaned })
    if (cleaned.length === 17) {
      decodeVin(cleaned)
    }
  }

  const hasSelection = value.year || value.make || value.model || vinInput

  return (
    <div className="space-y-4">
      {/* VIN fast path */}
      <div>
        <Label htmlFor="vin-input" className="text-xs text-gray-500">
          Enter VIN for faster lookup (optional)
        </Label>
        <div className="relative mt-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            id="vin-input"
            placeholder="1FTEW1EP5KKC12345"
            value={vinInput}
            onChange={(e) => handleVinChange(e.target.value)}
            maxLength={17}
            className="pl-8 font-mono text-sm tracking-wider"
          />
          {vinDecoding && (
            <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />
          )}
        </div>
        {vinResult && (
          <div className="flex items-center gap-1.5 mt-1.5 text-sm text-green-600">
            <Check size={14} />
            <span>Vehicle identified: {vinResult}</span>
          </div>
        )}
        {vinError && (
          <p className="text-xs text-red-500 mt-1">{vinError}</p>
        )}
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-xs text-gray-400 uppercase">or select manually</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      {/* Year dropdown */}
      <div>
        <Label htmlFor="vehicle-year" className="text-xs text-gray-500">Year *</Label>
        <div className="relative mt-1">
          <select
            id="vehicle-year"
            value={value.year}
            onChange={(e) => handleYearChange(e.target.value)}
            disabled={loadingYears}
            className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">Select year...</option>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          {loadingYears && (
            <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />
          )}
        </div>
      </div>

      {/* Make dropdown */}
      <div>
        <Label htmlFor="vehicle-make" className="text-xs text-gray-500">Make *</Label>
        <div className="relative mt-1">
          <select
            id="vehicle-make"
            value={value.make}
            onChange={(e) => handleMakeChange(e.target.value)}
            disabled={!value.year || loadingMakes}
            className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">{value.year ? "Select make..." : "Select year first"}</option>
            {makes.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          {loadingMakes && (
            <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />
          )}
        </div>
      </div>

      {/* Model dropdown */}
      <div>
        <Label htmlFor="vehicle-model" className="text-xs text-gray-500">Model *</Label>
        <div className="relative mt-1">
          <select
            id="vehicle-model"
            value={value.model}
            onChange={(e) => handleModelChange(e.target.value)}
            disabled={!value.make || loadingModels}
            className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">{value.make ? "Select model..." : "Select make first"}</option>
            {models.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          {loadingModels && (
            <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />
          )}
        </div>
      </div>

      {/* Reset button */}
      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}

      {hasSelection && (
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          <RotateCcw size={12} />
          Clear and start over
        </button>
      )}
    </div>
  )
}
