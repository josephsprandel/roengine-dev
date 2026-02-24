"use client"

import React from "react"

import { useState, useEffect, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Search, Plus, X, Sparkles, GripVertical, Loader2, ClipboardCheck, Check } from "lucide-react"
import type { ServiceData, VehicleData, LineItem } from "../ro-creation-wizard"
import type { CannedJob } from "@/lib/canned-jobs"

interface ServicesStepProps {
  selectedServices: ServiceData[]
  onUpdateServices: (services: ServiceData[]) => void
  vehicleData: VehicleData | null
}

function cannedJobToServiceData(job: CannedJob, defaultLaborRate: number = 160): ServiceData {
  const laborRate = job.labor_rate_per_hour ? parseFloat(String(job.labor_rate_per_hour)) : defaultLaborRate
  const laborHours = job.default_labor_hours ? parseFloat(String(job.default_labor_hours)) : 0
  const laborCost = laborHours * laborRate
  const partsCost = (job.parts || []).reduce(
    (sum, p) => sum + (p.estimated_price ? parseFloat(String(p.estimated_price)) : 0) * (p.quantity || 1),
    0
  )
  const totalCost = laborCost + partsCost

  const laborItems: LineItem[] =
    laborHours > 0
      ? [
          {
            id: `labor-${job.id}`,
            description: `Labor - ${job.name}`,
            quantity: laborHours,
            unitPrice: laborRate,
            total: laborCost,
          },
        ]
      : []

  const partItems: LineItem[] = (job.parts || []).map((p, i) => ({
    id: `part-${job.id}-${i}`,
    description: p.part_name,
    quantity: p.quantity || 1,
    unitPrice: p.estimated_price ? parseFloat(String(p.estimated_price)) : 0,
    total: (p.estimated_price ? parseFloat(String(p.estimated_price)) : 0) * (p.quantity || 1),
    part_number: p.part_number || undefined,
  }))

  const timeStr =
    laborHours >= 1
      ? `${laborHours} hr${laborHours !== 1 ? "s" : ""}`
      : laborHours > 0
        ? `${Math.round(laborHours * 60)} min`
        : "TBD"

  return {
    id: `canned-${job.id}`,
    name: job.name,
    description: job.description || "",
    estimatedCost: totalCost,
    estimatedTime: timeStr,
    category: job.category_name || "General",
    parts: partItems,
    labor: laborItems,
    sublets: [],
    hazmat: [],
    fees: [],
    cannedJobId: job.id,
  }
}

export function ServicesStep({ selectedServices, onUpdateServices, vehicleData }: ServicesStepProps) {
  const [cannedJobs, setCannedJobs] = useState<CannedJob[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [isAddingCustom, setIsAddingCustom] = useState(false)
  const [customServiceName, setCustomServiceName] = useState("")
  const [customServiceTime, setCustomServiceTime] = useState("")
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [defaultLaborRate, setDefaultLaborRate] = useState(160)

  // Fetch default labor rate from shop profile
  useEffect(() => {
    fetch('/api/settings/shop-profile')
      .then(r => r.json())
      .then(data => {
        if (data.profile?.default_labor_rate) {
          setDefaultLaborRate(parseFloat(data.profile.default_labor_rate) || 160)
        }
      })
      .catch(() => { /* uses default values on failure */ })
  }, [])

  useEffect(() => {
    fetch("/api/canned-jobs?wizard=true")
      .then((r) => r.json())
      .then((d) => setCannedJobs(d.canned_jobs || []))
      .catch((err) => console.error("Error fetching canned jobs:", err))
      .finally(() => setLoading(false))
  }, [])

  const selectedCannedJobIds = useMemo(
    () => new Set(selectedServices.filter((s) => s.cannedJobId).map((s) => s.cannedJobId)),
    [selectedServices]
  )

  const filteredJobs = useMemo(() => {
    if (!searchTerm) return cannedJobs
    const term = searchTerm.toLowerCase()
    return cannedJobs.filter(
      (j) =>
        j.name.toLowerCase().includes(term) ||
        (j.description || "").toLowerCase().includes(term) ||
        (j.category_name || "").toLowerCase().includes(term)
    )
  }, [cannedJobs, searchTerm])

  const totals = useMemo(() => {
    const initial = { parts: 0, labor: 0, sublets: 0, hazmat: 0, fees: 0, total: 0 }
    return selectedServices.reduce((acc, svc) => {
      const partsSum = svc.parts.reduce((sum, item) => sum + item.total, 0)
      const laborSum = svc.labor.reduce((sum, item) => sum + item.total, 0)
      const subletsSum = svc.sublets.reduce((sum, item) => sum + item.total, 0)
      const hazmatSum = svc.hazmat.reduce((sum, item) => sum + item.total, 0)
      const feesSum = svc.fees.reduce((sum, item) => sum + item.total, 0)
      return {
        parts: acc.parts + partsSum,
        labor: acc.labor + laborSum,
        sublets: acc.sublets + subletsSum,
        hazmat: acc.hazmat + hazmatSum,
        fees: acc.fees + feesSum,
        total: acc.total + partsSum + laborSum + subletsSum + hazmatSum + feesSum,
      }
    }, initial)
  }, [selectedServices])

  const toggleCannedJob = (job: CannedJob) => {
    if (selectedCannedJobIds.has(job.id)) {
      onUpdateServices(selectedServices.filter((s) => s.cannedJobId !== job.id))
    } else {
      onUpdateServices([...selectedServices, cannedJobToServiceData(job, defaultLaborRate)])
    }
  }

  const removeService = (id: string) => {
    onUpdateServices(selectedServices.filter((s) => s.id !== id))
  }

  const addCustomService = () => {
    if (customServiceName) {
      const newService: ServiceData = {
        id: `custom-${Date.now()}`,
        name: customServiceName,
        description: "Custom service",
        estimatedCost: 0,
        estimatedTime: customServiceTime || "TBD",
        category: "Custom",
        parts: [],
        labor: [],
        sublets: [],
        hazmat: [],
        fees: [],
      }
      onUpdateServices([...selectedServices, newService])
      setCustomServiceName("")
      setCustomServiceTime("")
      setIsAddingCustom(false)
    }
  }

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDragIndex(index)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (dragIndex !== null && dragIndex !== index) {
      setDragOverIndex(index)
    }
  }

  const handleDragEnd = () => {
    if (dragIndex !== null && dragOverIndex !== null && dragIndex !== dragOverIndex) {
      const newServices = [...selectedServices]
      const [removed] = newServices.splice(dragIndex, 1)
      newServices.splice(dragOverIndex, 0, removed)
      onUpdateServices(newServices)
    }
    setDragIndex(null)
    setDragOverIndex(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-1">Select Services</h2>
          <p className="text-sm text-muted-foreground">
            Choose from your canned jobs or add a custom service. Drag to reorder.
          </p>
        </div>
        {vehicleData && (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Sparkles size={12} />
            {vehicleData.year} {vehicleData.make} {vehicleData.model}
          </Badge>
        )}
      </div>

      {/* Selected Services Summary */}
      {selectedServices.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-foreground">
            Selected Services ({selectedServices.length})
          </h3>
          <div className="space-y-2">
            {selectedServices.map((service, index) => (
              <div
                key={service.id}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={`flex items-center gap-3 p-3 rounded-lg border border-border bg-card transition-all ${
                  dragOverIndex === index ? "border-t-2 border-primary" : ""
                }`}
              >
                <GripVertical
                  size={16}
                  className="text-muted-foreground cursor-grab active:cursor-grabbing flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-foreground truncate">{service.name}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 flex-shrink-0">
                      {service.category}
                    </Badge>
                  </div>
                  {service.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{service.description}</p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-medium text-foreground">${service.estimatedCost.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">{service.estimatedTime}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 flex-shrink-0"
                  onClick={() => removeService(service.id)}
                >
                  <X size={14} />
                </Button>
              </div>
            ))}
          </div>

          {/* Totals Summary */}
          <Card className="p-4 border-border bg-muted/30">
            <div className="grid grid-cols-3 md:grid-cols-6 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Parts</p>
                <p className="font-medium text-foreground">${totals.parts.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Labor</p>
                <p className="font-medium text-foreground">${totals.labor.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Sublets</p>
                <p className="font-medium text-foreground">${totals.sublets.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Hazmat</p>
                <p className="font-medium text-foreground">${totals.hazmat.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Fees</p>
                <p className="font-medium text-foreground">${totals.fees.toFixed(2)}</p>
              </div>
              <div className="border-l border-border pl-4">
                <p className="text-muted-foreground">Total</p>
                <p className="font-bold text-lg text-foreground">${totals.total.toFixed(2)}</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Add Services Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground">Canned Jobs</h3>
          <Button
            variant={isAddingCustom ? "default" : "outline"}
            size="sm"
            onClick={() => setIsAddingCustom(!isAddingCustom)}
            className={isAddingCustom ? "" : "bg-transparent"}
          >
            <Plus size={16} className="mr-1.5" />
            Custom Service
          </Button>
        </div>

        {/* Custom Service Form */}
        {isAddingCustom && (
          <Card className="p-4 border-border bg-muted/30">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium text-foreground">Add Custom Service</h4>
              <Button variant="ghost" size="icon" onClick={() => setIsAddingCustom(false)}>
                <X size={16} />
              </Button>
            </div>
            <div className="flex gap-3">
              <Input
                placeholder="Service name"
                value={customServiceName}
                onChange={(e) => setCustomServiceName(e.target.value)}
                className="flex-1 bg-card border-border"
              />
              <Input
                placeholder="Est. time (e.g., 1 hr)"
                value={customServiceTime}
                onChange={(e) => setCustomServiceTime(e.target.value)}
                className="w-40 bg-card border-border"
              />
              <Button onClick={addCustomService} disabled={!customServiceName}>
                Add
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Custom services can be detailed after the RO is created
            </p>
          </Card>
        )}

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search canned jobs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-card border-border"
          />
        </div>

        {/* Canned Jobs Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="animate-spin text-muted-foreground" size={24} />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-1">
            {filteredJobs.map((job) => {
              const isSelected = selectedCannedJobIds.has(job.id)
              return (
                <Card
                  key={job.id}
                  className={`p-3 cursor-pointer transition-colors group ${
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                  onClick={() => toggleCannedJob(job)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-foreground text-sm truncate">{job.name}</h4>
                        <div className="flex gap-1 flex-shrink-0">
                          {job.category_name && (
                            <Badge variant="outline" className="text-xs">
                              {job.category_name}
                            </Badge>
                          )}
                          {job.is_inspection && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-0.5">
                              <ClipboardCheck size={10} />
                              Inspection
                            </Badge>
                          )}
                        </div>
                      </div>
                      {job.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{job.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        {job.default_labor_hours && parseFloat(String(job.default_labor_hours)) > 0 && (
                          <span>
                            {parseFloat(String(job.default_labor_hours)) >= 1
                              ? `${job.default_labor_hours} hrs`
                              : `${Math.round(parseFloat(String(job.default_labor_hours)) * 60)} min`}
                          </span>
                        )}
                        {(job.parts || []).length > 0 && (
                          <span>{job.parts.length} part{job.parts.length !== 1 ? "s" : ""}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0 ml-2">
                      {isSelected ? (
                        <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                          <Check size={14} className="text-primary-foreground" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full border-2 border-muted-foreground/30 group-hover:border-primary/50 transition-colors" />
                      )}
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}

        {!loading && filteredJobs.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p>
              {cannedJobs.length === 0
                ? "No canned jobs configured for the wizard. Add them in Settings > Canned Jobs."
                : "No canned jobs found matching your search"}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
