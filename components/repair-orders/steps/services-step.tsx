"use client"

import React from "react"

import { useState, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MagnifyingGlassIcon as Search, PlusIcon as Plus, XMarkIcon as X, SparklesIcon as Sparkles, Bars3CenterLeftIcon as GripVertical } from "@heroicons/react/24/outline"
import type { ServiceData, VehicleData, LineItem } from "../ro-creation-wizard"
import { EditableServiceCard, createLineItem } from "../editable-service-card"

interface ServicesStepProps {
  selectedServices: ServiceData[]
  onUpdateServices: (services: ServiceData[]) => void
  vehicleData: VehicleData | null
}

const availableServices: Omit<ServiceData, "parts" | "labor" | "sublets" | "hazmat" | "fees">[] = [
  {
    id: "svc-001",
    name: "Oil Change",
    description: "Full synthetic oil change with filter replacement",
    estimatedCost: 89,
    estimatedTime: "45 min",
    category: "Maintenance",
  },
  {
    id: "svc-002",
    name: "Brake Inspection",
    description: "Complete brake system inspection and assessment",
    estimatedCost: 49,
    estimatedTime: "30 min",
    category: "Inspection",
  },
  {
    id: "svc-003",
    name: "Brake Pad Replacement",
    description: "Front or rear brake pad replacement with rotor inspection",
    estimatedCost: 299,
    estimatedTime: "2 hrs",
    category: "Repair",
  },
  {
    id: "svc-004",
    name: "Tire Rotation",
    description: "Four-tire rotation with pressure check",
    estimatedCost: 39,
    estimatedTime: "30 min",
    category: "Maintenance",
  },
  {
    id: "svc-005",
    name: "Diagnostic Scan",
    description: "Complete OBD-II diagnostic scan and code reading",
    estimatedCost: 99,
    estimatedTime: "1 hr",
    category: "Diagnostic",
  },
  {
    id: "svc-006",
    name: "Battery Test & Replace",
    description: "Battery load test with replacement if needed",
    estimatedCost: 189,
    estimatedTime: "45 min",
    category: "Repair",
  },
  {
    id: "svc-007",
    name: "A/C Service",
    description: "Air conditioning system inspection and recharge",
    estimatedCost: 149,
    estimatedTime: "1 hr",
    category: "Maintenance",
  },
  {
    id: "svc-008",
    name: "Transmission Fluid Service",
    description: "Transmission fluid flush and replacement",
    estimatedCost: 199,
    estimatedTime: "1.5 hrs",
    category: "Maintenance",
  },
]

const categories = ["All", "Maintenance", "Repair", "Diagnostic", "Inspection"]

function createServiceWithDefaults(
  service: Omit<ServiceData, "parts" | "labor" | "sublets" | "hazmat" | "fees">
): ServiceData {
  const laborCost = Math.round(service.estimatedCost * 0.6)
  const partsCost = Math.round(service.estimatedCost * 0.35)
  const fees = Math.round(service.estimatedCost * 0.05)

  return {
    ...service,
    parts: [{ ...createLineItem("Parts"), unitPrice: partsCost, total: partsCost }],
    labor: [{ ...createLineItem("Labor"), unitPrice: laborCost, total: laborCost }],
    sublets: [],
    hazmat: [],
    fees: fees > 0 ? [{ ...createLineItem("Shop supplies"), unitPrice: fees, total: fees }] : [],
  }
}

export function ServicesStep({ selectedServices, onUpdateServices, vehicleData }: ServicesStepProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [isAddingCustom, setIsAddingCustom] = useState(false)
  const [customServiceName, setCustomServiceName] = useState("")
  const [customServiceTime, setCustomServiceTime] = useState("")
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const filteredServices = useMemo(() => {
    return availableServices.filter((service) => {
      const matchesSearch =
        service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        service.description.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesCategory = selectedCategory === "All" || service.category === selectedCategory
      const notAlreadySelected = !selectedServices.some((s) => s.id === service.id)
      return matchesSearch && matchesCategory && notAlreadySelected
    })
  }, [searchTerm, selectedCategory, selectedServices])

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

  const addService = (service: Omit<ServiceData, "parts" | "labor" | "sublets" | "hazmat" | "fees">) => {
    const newService = createServiceWithDefaults(service)
    onUpdateServices([...selectedServices, newService])
  }

  const updateService = (updated: ServiceData) => {
    onUpdateServices(selectedServices.map((s) => (s.id === updated.id ? updated : s)))
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
            Add services and adjust line items as needed. Drag to reorder.
          </p>
        </div>
        {vehicleData && (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Sparkles size={12} />
            {vehicleData.year} {vehicleData.make} {vehicleData.model}
          </Badge>
        )}
      </div>

      {/* Selected Services - Draggable List */}
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
                className={`transition-all ${
                  dragOverIndex === index ? "border-t-2 border-primary" : ""
                }`}
              >
                <EditableServiceCard
                  service={service}
                  onUpdate={updateService}
                  onRemove={() => removeService(service.id)}
                  isDragging={dragIndex === index}
                  dragHandleProps={{
                    onMouseDown: (e) => e.stopPropagation(),
                  }}
                />
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
          <h3 className="text-sm font-medium text-foreground">Add Services</h3>
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
              Add line items after creating the service
            </p>
          </Card>
        )}

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search services..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-card border-border"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {categories.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category)}
                className={selectedCategory === category ? "" : "bg-transparent"}
              >
                {category}
              </Button>
            ))}
          </div>
        </div>

        {/* Available Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-1">
          {filteredServices.map((service) => (
            <Card
              key={service.id}
              className="p-3 border-border hover:border-primary/50 cursor-pointer transition-colors group"
              onClick={() => addService(service)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-foreground text-sm truncate">{service.name}</h4>
                    <Badge variant="outline" className="text-xs flex-shrink-0">
                      {service.category}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{service.description}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span>${service.estimatedCost}</span>
                    <span>{service.estimatedTime}</span>
                  </div>
                </div>
                <Plus
                  size={18}
                  className="text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 ml-2"
                />
              </div>
            </Card>
          ))}
        </div>

        {filteredServices.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p>No services found matching your criteria</p>
          </div>
        )}
      </div>
    </div>
  )
}
