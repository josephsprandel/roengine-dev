"use client"

import React from "react"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Clock,
  ChevronDown,
  ChevronUp,
  Wrench,
  Package,
  Users,
  AlertTriangle,
  Receipt,
  Trash2,
  Plus,
  GripVertical,
  User,
  Search,
  ClipboardCheck,
  Camera,
} from "lucide-react"
import type { ServiceData, LineItem, InspectionItem } from "./ro-creation-wizard"
import { PartsCatalogModal } from "./parts-catalog-modal"
import { PartDetailsModal } from "./part-details-modal"
import { PhotoLightbox } from "./ro-detail/PhotoLightbox"

interface EditableServiceCardProps {
  service: ServiceData
  onUpdate: (updated: ServiceData) => void
  onRemove: () => void
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
  isDragging?: boolean
  roTechnician?: string
}

const lineItemCategories = [
  { key: "parts", label: "Parts", icon: Package, color: "text-blue-500" },
  { key: "labor", label: "Labor", icon: Wrench, color: "text-green-500" },
  { key: "sublets", label: "Sublets", icon: Users, color: "text-purple-500" },
  { key: "hazmat", label: "Hazmat", icon: AlertTriangle, color: "text-amber-500" },
  { key: "fees", label: "Fees", icon: Receipt, color: "text-slate-500" },
] as const

type LineItemCategory = (typeof lineItemCategories)[number]["key"]

function createLineItem(description = ""): LineItem {
  return {
    id: `li-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    description,
    quantity: 1,
    unitPrice: 0,
    total: 0,
  }
}

interface DraggableLineItemProps {
  item: LineItem
  category: LineItemCategory
  categoryLabel: string
  categoryIcon: React.ElementType
  categoryColor: string
  onUpdate: (updated: LineItem) => void
  onRemove: () => void
  index: number
  onDragStart: (e: React.DragEvent, index: number) => void
  onDragOver: (e: React.DragEvent, index: number) => void
  onDragEnd: () => void
  isDragging: boolean
  onFindPart?: () => void
  onClickPart?: () => void
}

function DraggableLineItem({
  item,
  category,
  categoryLabel,
  categoryIcon: Icon,
  categoryColor,
  onUpdate,
  onRemove,
  index,
  onDragStart,
  onDragOver,
  onDragEnd,
  isDragging,
  onFindPart,
  onClickPart,
}: DraggableLineItemProps) {
  const [isDragEnabled, setIsDragEnabled] = useState(false)

  const handleUpdate = (field: keyof LineItem, value: string | number) => {
    const updated = { ...item, [field]: value }
    if (field === "quantity" || field === "unitPrice") {
      updated.total = updated.quantity * updated.unitPrice
    }
    onUpdate(updated)
  }

  return (
    <div
      draggable={isDragEnabled}
      onDragStart={(e) => {
        if (isDragEnabled) {
          onDragStart(e, index)
        }
      }}
      onDragOver={(e) => onDragOver(e, index)}
      onDragEnd={() => {
        setIsDragEnabled(false)
        onDragEnd()
      }}
      className={`flex items-center gap-2 p-2 rounded-lg border border-border bg-card transition-all ${
        isDragging ? "opacity-50 scale-95" : ""
      }`}
    >
      <div 
        onMouseDown={() => setIsDragEnabled(true)}
        onMouseUp={() => setIsDragEnabled(false)}
        onMouseLeave={() => setIsDragEnabled(false)}
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
      >
        <GripVertical size={14} />
      </div>
      <div className={`${categoryColor} flex-shrink-0`}>
        <Icon size={14} />
      </div>
      <Input
        value={item.description}
        onChange={(e) => handleUpdate("description", e.target.value)}
        onClick={(e) => {
          if (category === "parts" && onClickPart) {
            e.stopPropagation()
            onClickPart()
          }
        }}
        placeholder={`${categoryLabel} description`}
        className={`flex-1 h-8 text-sm bg-background border-border ${
          category === "parts" && onClickPart ? "cursor-pointer hover:bg-muted/50" : ""
        }`}
        readOnly={category === "parts" && !!onClickPart}
      />
      {category === "parts" && onFindPart && (
        <Button
          size="sm"
          variant="outline"
          onClick={(e) => {
            e.stopPropagation()
            onFindPart()
          }}
          className="h-8 px-2 text-xs whitespace-nowrap"
        >
          <Search size={12} className="mr-1" />
          Catalog
        </Button>
      )}
      <div className="flex items-center gap-1">
        <Input
          type="number"
          min="0"
          step="0.01"
          value={item.quantity || ""}
          onChange={(e) => handleUpdate("quantity", parseFloat(e.target.value) || 0)}
          placeholder="Qty"
          className="w-16 h-8 text-sm text-center bg-background border-border"
        />
        <span className="text-muted-foreground text-xs">x</span>
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={item.unitPrice || ""}
            onChange={(e) => handleUpdate("unitPrice", parseFloat(e.target.value) || 0)}
            placeholder="0.00"
            className="w-24 h-8 text-sm pl-5 bg-background border-border"
          />
        </div>
        <span className="text-muted-foreground text-xs">=</span>
        <div className="w-20 text-right font-medium text-sm text-foreground">
          ${item.total.toFixed(2)}
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={onRemove}
        className="h-7 w-7 text-muted-foreground hover:text-destructive"
      >
        <Trash2 size={12} />
      </Button>
    </div>
  )
}

interface LineItemSectionProps {
  category: LineItemCategory
  label: string
  icon: React.ElementType
  color: string
  items: LineItem[]
  onUpdateItems: (items: LineItem[]) => void
  onFindPart?: (index: number) => void
  onClickPart?: (index: number) => void
}

function LineItemSection({ category, label, icon: Icon, color, items, onUpdateItems, onFindPart, onClickPart }: LineItemSectionProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const addItem = () => {
    onUpdateItems([...items, createLineItem()])
  }

  const updateItem = (index: number, updated: LineItem) => {
    const newItems = [...items]
    newItems[index] = updated
    onUpdateItems(newItems)
  }

  const removeItem = (index: number) => {
    onUpdateItems(items.filter((_, i) => i !== index))
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
      const newItems = [...items]
      const [removed] = newItems.splice(dragIndex, 1)
      newItems.splice(dragOverIndex, 0, removed)
      onUpdateItems(newItems)
    }
    setDragIndex(null)
    setDragOverIndex(null)
  }

  const sectionTotal = items.reduce((sum, item) => sum + item.total, 0)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size={14} className={color} />
          <span className="text-sm font-medium text-foreground">{label}</span>
          <Badge variant="secondary" className="text-xs">
            {items.length}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">${sectionTotal.toFixed(2)}</span>
          <Button variant="ghost" size="sm" onClick={addItem} className="h-7 px-2 text-xs">
            <Plus size={12} className="mr-1" />
            Add
          </Button>
        </div>
      </div>
      {items.length > 0 && (
        <div className="space-y-1 pl-1">
          {items.map((item, index) => (
            <DraggableLineItem
              key={item.id}
              item={item}
              category={category}
              categoryLabel={label}
              categoryIcon={Icon}
              categoryColor={color}
              onUpdate={(updated) => updateItem(index, updated)}
              onRemove={() => removeItem(index)}
              index={index}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              isDragging={dragIndex === index}
              onFindPart={onFindPart ? () => onFindPart(index) : undefined}
              onClickPart={onClickPart ? () => onClickPart(index) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  )
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-300 dark:bg-gray-600",
  green: "bg-green-500",
  yellow: "bg-yellow-400",
  red: "bg-red-500",
}

const STATUS_CYCLE: Record<string, InspectionItem["status"]> = {
  pending: "green",
  green: "yellow",
  yellow: "red",
  red: "pending",
}

function formatInspectionTimeAgo(dateStr: string | null): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHrs = Math.floor(diffMin / 60)
  if (diffHrs < 24) return `${diffHrs}h ago`
  const diffDays = Math.floor(diffHrs / 24)
  if (diffDays < 30) return `${diffDays}d ago`
  return `${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) !== 1 ? 's' : ''} ago`
}

function InspectionChecklist({
  items,
  onStatusChange,
}: {
  items: InspectionItem[]
  onStatusChange: (id: number, newStatus: InspectionItem["status"]) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [expandedItemId, setExpandedItemId] = useState<number | null>(null)
  const [lightbox, setLightbox] = useState<{ photos: { src: string; itemName: string }[]; index: number } | null>(null)
  const counts = { green: 0, yellow: 0, red: 0, pending: 0 }
  items.forEach((i) => counts[i.status]++)
  const inspected = counts.green + counts.yellow + counts.red

  // Collect all photos across all inspection items for lightbox navigation
  const allPhotos: { src: string; itemName: string }[] = []
  items.forEach((item) => {
    (item.photos || []).forEach((src) => {
      allPhotos.push({ src, itemName: item.item_name })
    })
  })

  const totalPhotos = allPhotos.length

  const openLightbox = (item: InspectionItem, photoIndex: number) => {
    let globalIndex = 0
    for (const it of items) {
      if (it.id === item.id) {
        globalIndex += photoIndex
        break
      }
      globalIndex += (it.photos || []).length
    }
    setLightbox({ photos: allPhotos, index: globalIndex })
  }

  const hasDetail = (item: InspectionItem) =>
    item.tech_notes || item.ai_cleaned_notes || item.condition ||
    item.measurement_value != null || (item.photos && item.photos.length > 0)

  const toggleItemExpand = (item: InspectionItem) => {
    if (!hasDetail(item)) return
    setExpandedItemId(expandedItemId === item.id ? null : item.id)
  }

  // Display notes: prefer ai_cleaned_notes when available, fall back to tech_notes
  const getDisplayNotes = (item: InspectionItem) => item.ai_cleaned_notes || item.tech_notes || null

  return (
    <div className="space-y-2">
      <div
        className="flex items-center justify-between cursor-pointer hover:bg-muted/30 rounded-md -mx-1 px-1 py-0.5 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          <ClipboardCheck size={14} className="text-indigo-500" />
          <span className="text-sm font-medium text-foreground">Inspection</span>
          <Badge variant="secondary" className="text-xs">
            {inspected}/{items.length}
          </Badge>
          {totalPhotos > 0 && (
            <Badge variant="outline" className="text-xs gap-1">
              <Camera size={10} />
              {totalPhotos}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {counts.green > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                {counts.green}
              </span>
            )}
            {counts.yellow > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />
                {counts.yellow}
              </span>
            )}
            {counts.red > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                {counts.red}
              </span>
            )}
            {counts.pending > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600 inline-block" />
                {counts.pending}
              </span>
            )}
          </div>
          {isOpen ? (
            <ChevronUp size={16} className="text-muted-foreground" />
          ) : (
            <ChevronDown size={16} className="text-muted-foreground" />
          )}
        </div>
      </div>
      {isOpen && (
        <div className="space-y-1 pl-1">
          {items.map((item) => {
            const isItemExpanded = expandedItemId === item.id
            const itemHasDetail = hasDetail(item)
            const photoCount = item.photos?.length || 0
            const displayNotes = getDisplayNotes(item)

            return (
              <div key={item.id} className="space-y-0">
                {/* Collapsed row: dot + name + condition badge + camera icon + chevron */}
                <div
                  className={`flex items-center gap-2.5 p-1.5 rounded-lg transition-colors ${
                    itemHasDetail ? 'cursor-pointer hover:bg-muted/50' : ''
                  }`}
                  onClick={() => toggleItemExpand(item)}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onStatusChange(item.id, STATUS_CYCLE[item.status])
                    }}
                    className="flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-primary/50 rounded-full"
                    title={`Status: ${item.status} (click to cycle)`}
                  >
                    <div className={`w-4 h-4 rounded-full ${STATUS_COLORS[item.status]} transition-colors`} />
                  </button>
                  <span className="text-[14px] text-foreground flex-1">{item.item_name}</span>
                  {/* Right side indicators */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!isItemExpanded && item.condition && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">
                        {item.condition}
                      </Badge>
                    )}
                    {photoCount > 0 && (
                      <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                        <Camera size={12} />
                        {photoCount}
                      </span>
                    )}
                    {itemHasDetail && (
                      <ChevronDown
                        size={14}
                        className={`text-muted-foreground transition-transform ${isItemExpanded ? 'rotate-180' : ''}`}
                      />
                    )}
                  </div>
                </div>

                {/* Expanded detail panel — two column layout */}
                {isItemExpanded && (
                  <div className="ml-7 pl-3 border-l-2 border-border pb-2 pt-1">
                    <div className="flex flex-col md:flex-row gap-3">
                      {/* Left column (60%): condition, measurement, tech notes */}
                      <div className="flex-[3] space-y-2 min-w-0">
                        {(item.condition || item.measurement_value != null) && (
                          <div className="flex items-center gap-2 flex-wrap">
                            {item.condition && (
                              <Badge variant="outline" className="text-xs capitalize">
                                {item.condition}
                              </Badge>
                            )}
                            {item.measurement_value != null && (
                              <span className="text-[13px] font-medium text-foreground">
                                {item.measurement_value}
                                {item.measurement_unit && ` ${item.measurement_unit}`}
                              </span>
                            )}
                          </div>
                        )}

                        {displayNotes && (
                          <div>
                            <p className="text-[11px] font-medium text-muted-foreground mb-0.5">Tech Notes</p>
                            <p className="text-[14px] text-foreground bg-muted/40 rounded px-2 py-1.5 whitespace-pre-wrap">
                              {displayNotes}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Right column (40%): photo thumbnails grid */}
                      {photoCount > 0 && (
                        <div className="flex-[2] min-w-0">
                          <div className="grid grid-cols-2 gap-1.5">
                            {item.photos!.map((photoSrc, pi) => (
                              <button
                                key={pi}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openLightbox(item, pi)
                                }}
                                className="relative aspect-square w-full max-w-[150px] rounded-md overflow-hidden border border-border hover:border-primary/50 hover:ring-2 hover:ring-primary/20 transition-all"
                              >
                                <img
                                  src={photoSrc}
                                  alt={`${item.item_name} photo ${pi + 1}`}
                                  className="w-full h-full object-cover"
                                />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Below both columns: tech name + timestamp, right-aligned */}
                    {(item.inspected_by_name || item.inspected_at) && (
                      <div className="flex justify-end mt-2">
                        <span className="text-[13px] text-muted-foreground flex items-center gap-1.5">
                          {item.inspected_by_name && (
                            <>
                              <User size={12} />
                              {item.inspected_by_name}
                            </>
                          )}
                          {item.inspected_by_name && item.inspected_at && <span>·</span>}
                          {item.inspected_at && formatInspectionTimeAgo(item.inspected_at)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <PhotoLightbox
          photos={lightbox.photos}
          initialIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  )
}

export function EditableServiceCard({
  service,
  onUpdate,
  onRemove,
  dragHandleProps,
  isDragging,
  roTechnician,
}: EditableServiceCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isCatalogOpen, setIsCatalogOpen] = useState(false)
  const [catalogLineItemIndex, setCatalogLineItemIndex] = useState<number | undefined>(undefined)
  const [isPartDetailsOpen, setIsPartDetailsOpen] = useState(false)
  const [editingLineItem, setEditingLineItem] = useState<LineItem | null>(null)
  const [editingLineItemIndex, setEditingLineItemIndex] = useState<number | null>(null)

  const calculateTotal = (svc: ServiceData) => {
    const partsTotal = svc.parts.reduce((sum, item) => sum + item.total, 0)
    const laborTotal = svc.labor.reduce((sum, item) => sum + item.total, 0)
    const subletsTotal = svc.sublets.reduce((sum, item) => sum + item.total, 0)
    const hazmatTotal = svc.hazmat.reduce((sum, item) => sum + item.total, 0)
    const feesTotal = svc.fees.reduce((sum, item) => sum + item.total, 0)
    return partsTotal + laborTotal + subletsTotal + hazmatTotal + feesTotal
  }

  const totalCost = calculateTotal(service)
  const totalLineItems =
    service.parts.length +
    service.labor.length +
    service.sublets.length +
    service.hazmat.length +
    service.fees.length

  const handleFieldChange = (field: keyof ServiceData, value: string) => {
    onUpdate({ ...service, [field]: value })
  }

  const handleLineItemsUpdate = (category: LineItemCategory, items: LineItem[]) => {
    const updated = { ...service, [category]: items }
    updated.estimatedCost = calculateTotal(updated)
    onUpdate(updated)
  }

  const handleSelectPart = (part: any) => {
    const newLineItem = createLineItem(part.name)
    newLineItem.unitPrice = part.price
    newLineItem.quantity = 1
    newLineItem.total = part.price
    // Store inventory part details
    newLineItem.part_id = parseInt(part.id)
    newLineItem.part_number = part.partNumber
    newLineItem.vendor = part.manufacturer
    newLineItem.cost = part.price / 2 // Default to 50% markup, will be editable
    newLineItem.location = part.location
    
    // If catalogLineItemIndex is set, replace that line item, otherwise add new
    let updatedParts
    if (catalogLineItemIndex !== undefined) {
      updatedParts = [...service.parts]
      updatedParts[catalogLineItemIndex] = newLineItem
    } else {
      updatedParts = [...service.parts, newLineItem]
    }
    
    handleLineItemsUpdate("parts", updatedParts)
    setIsCatalogOpen(false)
    setCatalogLineItemIndex(undefined)
  }

  const handleOpenCatalog = (index?: number) => {
    setCatalogLineItemIndex(index)
    setIsCatalogOpen(true)
  }

  const handleOpenPartDetails = (index: number) => {
    setEditingLineItem(service.parts[index])
    setEditingLineItemIndex(index)
    setIsPartDetailsOpen(true)
  }

  const handleSavePartDetails = (updatedItem: LineItem) => {
    if (editingLineItemIndex !== null) {
      const updatedParts = [...service.parts]
      updatedParts[editingLineItemIndex] = updatedItem
      handleLineItemsUpdate("parts", updatedParts)
    }
    setIsPartDetailsOpen(false)
    setEditingLineItem(null)
    setEditingLineItemIndex(null)
  }

  const handleInspectionStatusChange = async (resultId: number, newStatus: InspectionItem["status"]) => {
    // Optimistic update
    if (service.inspectionItems) {
      const updatedItems = service.inspectionItems.map((item) =>
        item.id === resultId ? { ...item, status: newStatus } : item
      )
      onUpdate({ ...service, inspectionItems: updatedItems })
    }

    try {
      const res = await fetch(`/api/inspection-results/${resultId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        console.error("Failed to update inspection status")
      }
    } catch (err) {
      console.error("Error updating inspection status:", err)
    }
  }

  return (
    <Card
      className={`border-border overflow-hidden transition-all !py-1 !gap-0 ${
        isDragging ? "opacity-50 scale-[0.98] shadow-lg" : ""
      }`}
    >
      {/* Collapsed Header */}
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors rounded-t-xl">
        {dragHandleProps && (
          <div
            {...dragHandleProps}
            className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
          >
            <GripVertical size={16} />
          </div>
        )}
        <div
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center justify-between flex-1 cursor-pointer"
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Wrench size={16} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-foreground truncate">{service.name}</h3>
                <Badge variant="outline" className="text-xs flex-shrink-0">
                  {service.category}
                </Badge>
                {service.status && (
                  <Badge
                    variant="secondary"
                    className={`text-xs ${
                      service.status === "completed"
                        ? "bg-green-500/20 text-green-700 dark:text-green-400"
                        : service.status === "in_progress"
                          ? "bg-blue-500/20 text-blue-700 dark:text-blue-400"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {service.status === "completed"
                      ? "Completed"
                      : service.status === "in_progress"
                        ? "In Progress"
                        : "Pending"}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-4 mt-0.5 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock size={12} />
                  {service.estimatedTime}
                </span>
                <span>{totalLineItems} line items</span>
                {service.inspectionItems && service.inspectionItems.length > 0 && (
                  <span className="flex items-center gap-1">
                    <ClipboardCheck size={12} />
                    {service.inspectionItems.filter((i) => i.status !== "pending").length}/{service.inspectionItems.length} inspected
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="font-semibold text-foreground">${totalCost.toFixed(2)}</p>
            </div>
            {isExpanded ? (
              <ChevronUp size={20} className="text-muted-foreground" />
            ) : (
              <ChevronDown size={20} className="text-muted-foreground" />
            )}
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-border p-4 bg-muted/20 space-y-5">
          {/* Service Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Service Name</Label>
              <Input
                value={service.name}
                onChange={(e) => handleFieldChange("name", e.target.value)}
                className="bg-card border-border"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Estimated Time</Label>
              <Input
                value={service.estimatedTime}
                onChange={(e) => handleFieldChange("estimatedTime", e.target.value)}
                className="bg-card border-border"
                placeholder="e.g., 1.5 hrs"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground flex items-center gap-1">
                <User size={14} />
                Technician {roTechnician && <span className="text-xs text-muted-foreground">(RO: {roTechnician})</span>}
              </Label>
              <select
                value={service.technician || ""}
                onChange={(e) => handleFieldChange("technician", e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-md bg-card border border-border text-foreground"
              >
                <option value="">Use RO Technician</option>
                <option value="Mike Rodriguez">Mike Rodriguez</option>
                <option value="Sarah Chen">Sarah Chen</option>
                <option value="James Wilson">James Wilson</option>
                <option value="Lisa Park">Lisa Park</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Description</Label>
            <Textarea
              value={service.description}
              onChange={(e) => handleFieldChange("description", e.target.value)}
              className="bg-card border-border resize-none"
              rows={2}
            />
          </div>

          {/* Line Items by Category: Parts, Labor, Inspections, Sublets, Hazmat, Fees */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-foreground border-b border-border pb-2">
              Line Items
            </h4>
            {/* Parts */}
            <LineItemSection
              category="parts"
              label="Parts"
              icon={Package}
              color="text-blue-500"
              items={service.parts}
              onUpdateItems={(items) => handleLineItemsUpdate("parts", items)}
              onFindPart={handleOpenCatalog}
              onClickPart={handleOpenPartDetails}
            />
            {/* Labor */}
            <LineItemSection
              category="labor"
              label="Labor"
              icon={Wrench}
              color="text-green-500"
              items={service.labor}
              onUpdateItems={(items) => handleLineItemsUpdate("labor", items)}
            />
            {/* Inspection Checklist (between Labor and Sublets) */}
            {service.inspectionItems && service.inspectionItems.length > 0 && (
              <InspectionChecklist
                items={service.inspectionItems}
                onStatusChange={handleInspectionStatusChange}
              />
            )}
            {/* Sublets */}
            <LineItemSection
              category="sublets"
              label="Sublets"
              icon={Users}
              color="text-purple-500"
              items={service.sublets}
              onUpdateItems={(items) => handleLineItemsUpdate("sublets", items)}
            />
            {/* Hazmat */}
            <LineItemSection
              category="hazmat"
              label="Hazmat"
              icon={AlertTriangle}
              color="text-amber-500"
              items={service.hazmat}
              onUpdateItems={(items) => handleLineItemsUpdate("hazmat", items)}
            />
            {/* Fees */}
            <LineItemSection
              category="fees"
              label="Fees"
              icon={Receipt}
              color="text-slate-500"
              items={service.fees}
              onUpdateItems={(items) => handleLineItemsUpdate("fees", items)}
            />
          </div>

          {/* Footer with Total and Remove */}
          <div className="flex items-center justify-between pt-3 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onRemove()
              }}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 size={14} className="mr-1.5" />
              Remove Service
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Service Total:</span>
              <span className="text-lg font-bold text-foreground">${totalCost.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      <PartsCatalogModal
        isOpen={isCatalogOpen}
        onClose={() => setIsCatalogOpen(false)}
        onSelectPart={handleSelectPart}
      />
      
      <PartDetailsModal
        isOpen={isPartDetailsOpen}
        onClose={() => {
          setIsPartDetailsOpen(false)
          setEditingLineItem(null)
          setEditingLineItemIndex(null)
        }}
        lineItem={editingLineItem}
        onSave={handleSavePartDetails}
        roNumber="Draft"
      />
    </Card>
  )
}

export { createLineItem }
export type { LineItemCategory }
