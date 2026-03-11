"use client"

import React from "react"

import { useState, useEffect, useRef, useCallback } from "react"
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
  Sparkles,
  Loader2,
  CheckCircle2,
  Circle,
} from "lucide-react"
import type { ServiceData, LineItem, InspectionItem } from "./ro-creation-wizard"
import { PartsCatalogModal } from "./parts-catalog-modal"
import { PartDetailsModal } from "./part-details-modal"
import { PhotoLightbox } from "./ro-detail/PhotoLightbox"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { calculateServiceDiscount } from "@/lib/invoice-calculator"
import { PositionSelector } from "./PositionSelector"
import { PairRecommendationWarn } from "./PairRecommendationWarn"

export interface VehicleContext {
  year?: string | number | null
  make?: string | null
  model?: string | null
  engine?: string | null
}

interface PositionRuleState {
  requires_position: boolean
  position_type: string
  valid_positions: string[]
  pair_recommended: boolean
  detected_position: string | null
}

interface EditableServiceCardProps {
  service: ServiceData
  onUpdate: (updated: ServiceData) => void
  onRemove: () => void
  onServiceCompleted?: (service: ServiceData) => void
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
  isDragging?: boolean
  roTechnician?: string
  vehicleInfo?: VehicleContext
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

function PartFieldPopover({ value, label, prefix, onSave }: {
  value: number
  label: string
  prefix?: string
  onSave: (v: number) => void
}) {
  const [open, setOpen] = useState(false)
  const [editValue, setEditValue] = useState("")

  return (
    <Popover open={open} onOpenChange={(o) => {
      setOpen(o)
      if (o) setEditValue(String(value || ''))
    }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="h-8 px-2 rounded-md border border-border bg-background text-sm font-mono cursor-pointer hover:bg-muted/50 transition-colors min-w-[3rem] text-center"
        >
          {prefix}{(value || 0).toFixed(2)}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-40 p-3" align="center" sideOffset={4}>
        <p className="text-xs font-medium text-muted-foreground mb-2">{label}</p>
        <div className="flex items-center gap-1">
          {prefix && <span className="text-muted-foreground text-xs">{prefix}</span>}
          <Input
            type="number"
            step="0.01"
            min="0"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onSave(parseFloat(editValue) || 0)
                setOpen(false)
              }
              if (e.key === 'Escape') setOpen(false)
            }}
            className="h-7 text-sm font-mono flex-1"
            autoFocus
          />
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5">Enter to save, Esc to cancel</p>
      </PopoverContent>
    </Popover>
  )
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
  serviceTitle?: string
  autoRewrite?: boolean
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
  serviceTitle,
  autoRewrite,
}: DraggableLineItemProps) {
  const [isDragEnabled, setIsDragEnabled] = useState(false)
  const [localDesc, setLocalDesc] = useState(item.description)
  const localDescCommitted = useRef(item.description)
  // Sync from parent when item changes externally (not from our typing)
  useEffect(() => {
    if (item.description !== localDescCommitted.current) {
      setLocalDesc(item.description)
      localDescCommitted.current = item.description
    }
  }, [item.description])

  const handleUpdate = (field: keyof LineItem, value: string | number) => {
    const updated = { ...item, [field]: value }
    if (field === "quantity" || field === "unitPrice") {
      updated.total = updated.quantity * updated.unitPrice
    }
    onUpdate(updated)
  }

  const descInputRef = useRef<HTMLInputElement>(null)

  const handleDescBlur = () => {
    const trimmed = localDesc.trim()
    if (localDesc !== item.description) {
      localDescCommitted.current = localDesc
      handleUpdate("description", localDesc)
    }
    // Auto-rewrite labor descriptions on blur (only if auto-rewrite is on)
    if (category === "labor" && autoRewrite && trimmed.length >= 3) {
      ;(async () => {
        try {
          const res = await fetch("/api/local-ai/rewrite-labor", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              serviceTitle: serviceTitle || "",
              description: trimmed,
            }),
          })
          const data = await res.json()
          if (!data.description || data.description === trimmed) return
          if (descInputRef.current === document.activeElement) return
          setLocalDesc(data.description)
          localDescCommitted.current = data.description
          handleUpdate("description", data.description)
        } catch {
          // silent fail
        }
      })()
    }
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
      {category === "parts" && onClickPart ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onClickPart()
          }}
          className="flex-1 h-8 text-sm text-left truncate px-3 rounded-md border border-border bg-background cursor-pointer hover:bg-muted/50"
          title={[item.vendor, item.description, item.part_number].filter(Boolean).join(' ')}
        >
          {[item.vendor, item.description, item.part_number].filter(Boolean).join(' ') || `${categoryLabel} description`}
        </button>
      ) : (
        <Input
          ref={descInputRef}
          value={localDesc}
          onChange={(e) => setLocalDesc(e.target.value)}
          onBlur={handleDescBlur}
          placeholder={`${categoryLabel} description`}
          className="flex-1 h-8 text-sm bg-background border-border"
        />
      )}
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
        {category === "parts" ? (
          <PartFieldPopover
            value={item.quantity}
            label="Qty"
            onSave={(v) => handleUpdate("quantity", v)}
          />
        ) : (
          <Input
            type="number"
            min="0"
            step="0.01"
            value={item.quantity || ""}
            onChange={(e) => handleUpdate("quantity", parseFloat(e.target.value) || 0)}
            placeholder="Qty"
            className="w-16 h-8 text-sm text-center bg-background border-border"
          />
        )}
        <span className="text-muted-foreground text-xs">x</span>
        {category === "parts" ? (
          <PartFieldPopover
            value={item.unitPrice}
            label="Price"
            prefix="$"
            onSave={(v) => handleUpdate("unitPrice", v)}
          />
        ) : (
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
        )}
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
  serviceTitle?: string
  autoRewrite?: boolean
}

function LineItemSection({ category, label, icon: Icon, color, items, onUpdateItems, onFindPart, onClickPart, serviceTitle, autoRewrite }: LineItemSectionProps) {
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
              serviceTitle={serviceTitle}
              autoRewrite={autoRewrite}
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

function ServiceTotalWithDiscount({
  totalCost,
  discountAmount,
  discountType,
  onDiscountChange,
  showLabel = false,
}: {
  totalCost: number
  discountAmount: number
  discountType: 'percent' | 'flat'
  onDiscountChange: (amount: number, type: 'percent' | 'flat') => void
  showLabel?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [editAmount, setEditAmount] = useState(String(discountAmount || ''))
  const [editType, setEditType] = useState<'percent' | 'flat'>(discountType)

  const discountValue = calculateServiceDiscount(totalCost, discountAmount, discountType)
  const netTotal = totalCost - discountValue
  const hasDiscount = discountAmount > 0

  const handleSave = () => {
    const parsed = parseFloat(editAmount) || 0
    onDiscountChange(parsed, editType)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={(o) => {
      setOpen(o)
      if (o) {
        setEditAmount(String(discountAmount || ''))
        setEditType(discountType)
      }
    }}>
      <PopoverTrigger asChild>
        <button
          className="text-right cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1 transition-colors"
          onClick={(e) => e.stopPropagation()}
          title="Click to add/edit discount"
        >
          {showLabel && <span className="text-sm text-muted-foreground mr-2">Service Total:</span>}
          {hasDiscount ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="text-muted-foreground line-through text-sm">${totalCost.toFixed(2)}</span>
              <span className={`font-bold ${showLabel ? 'text-lg' : 'font-semibold'} text-foreground`}>${netTotal.toFixed(2)}</span>
              <span className="text-xs text-red-600">
                (-{discountType === 'percent' ? `${discountAmount}%` : `$${discountAmount.toFixed(2)}`})
              </span>
            </span>
          ) : (
            <span className={`${showLabel ? 'text-lg font-bold' : 'font-semibold'} text-foreground`}>${totalCost.toFixed(2)}</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="end" sideOffset={4}>
        <p className="text-xs font-medium text-muted-foreground mb-2">Service Discount</p>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            step="0.01"
            min="0"
            value={editAmount}
            onChange={(e) => setEditAmount(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave()
              if (e.key === 'Escape') setOpen(false)
            }}
            className="h-8 text-sm font-mono flex-1"
            placeholder="0"
            autoFocus
          />
          <div className="flex rounded-md border border-border overflow-hidden flex-shrink-0">
            <button
              className={`px-2 py-1 text-xs font-medium transition-colors ${
                editType === 'percent' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'
              }`}
              onClick={() => setEditType('percent')}
            >
              %
            </button>
            <button
              className={`px-2 py-1 text-xs font-medium transition-colors ${
                editType === 'flat' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'
              }`}
              onClick={() => setEditType('flat')}
            >
              $
            </button>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5">Enter to save, Esc to cancel</p>
      </PopoverContent>
    </Popover>
  )
}

export function EditableServiceCard({
  service,
  onUpdate,
  onRemove,
  onServiceCompleted,
  dragHandleProps,
  isDragging,
  roTechnician,
  vehicleInfo,
}: EditableServiceCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isCatalogOpen, setIsCatalogOpen] = useState(false)
  const [catalogLineItemIndex, setCatalogLineItemIndex] = useState<number | undefined>(undefined)
  const [isPartDetailsOpen, setIsPartDetailsOpen] = useState(false)
  const [editingLineItem, setEditingLineItem] = useState<LineItem | null>(null)
  const [editingLineItemIndex, setEditingLineItemIndex] = useState<number | null>(null)
  const [isRewriting, setIsRewriting] = useState(false)
  const [autoRewrite, setAutoRewrite] = useState(true)
  const [localTitle, setLocalTitle] = useState(service.name)
  const [positionRule, setPositionRule] = useState<PositionRuleState | null>(null)
  const [showPairWarn, setShowPairWarn] = useState(false)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const serviceRef = useRef(service)
  serviceRef.current = service
  const onUpdateRef = useRef(onUpdate)
  onUpdateRef.current = onUpdate
  const onServiceCompletedRef = useRef(onServiceCompleted)
  onServiceCompletedRef.current = onServiceCompleted

  // Sync local title from parent when it changes externally (not from our own typing)
  const lastCommittedTitle = useRef(service.name)
  useEffect(() => {
    if (service.name !== lastCommittedTitle.current) {
      setLocalTitle(service.name)
      lastCommittedTitle.current = service.name
    }
  }, [service.name])

  const handleTitleBlur = useCallback(async () => {
    const raw = localTitle?.trim()
    if (!raw) return
    // Commit the typed value to parent first
    if (raw !== serviceRef.current.name) {
      lastCommittedTitle.current = raw
      onUpdateRef.current({ ...serviceRef.current, name: raw })
    }
    // Then try to normalize (only if auto-rewrite is on)
    if (!autoRewrite || raw.length < 3) return
    try {
      const res = await fetch("/api/local-ai/normalize-title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: raw }),
      })
      const data = await res.json()
      // Don't update if user refocused the input
      if (titleInputRef.current === document.activeElement) return
      if (data.normalized && data.normalized !== raw) {
        lastCommittedTitle.current = data.normalized
        setLocalTitle(data.normalized)
        onUpdateRef.current({ ...serviceRef.current, name: data.normalized })
      }
    } catch {
      // silent fail
    }

    // Fetch position rules for this title (runs after normalize, uses final title)
    try {
      const finalTitle = lastCommittedTitle.current || raw
      const params = new URLSearchParams({ title: finalTitle })
      if (vehicleInfo?.year) params.set('year', String(vehicleInfo.year))
      if (vehicleInfo?.make) params.set('make', vehicleInfo.make)
      if (vehicleInfo?.model) params.set('model', vehicleInfo.model)
      if (vehicleInfo?.engine) params.set('engine', vehicleInfo.engine)
      const posRes = await fetch(`/api/position-rules?${params}`)
      if (posRes.ok) {
        const rule = await posRes.json()
        setPositionRule(rule)
        setShowPairWarn(false)
        // Auto-set detected position if found
        if (rule.detected_position && !serviceRef.current.position) {
          onUpdateRef.current({
            ...serviceRef.current,
            name: lastCommittedTitle.current,
            position: rule.detected_position,
            positionType: rule.position_type,
            positionConfidence: rule.confidence,
          })
        }
      }
    } catch {
      // Position lookup failed — non-critical
    }
  }, [localTitle, autoRewrite, vehicleInfo])

  const handlePositionChange = useCallback((value: string) => {
    const svc = serviceRef.current
    const updated = {
      ...svc,
      position: value,
      positionType: positionRule?.position_type || null,
      positionConfidence: 'manual' as string | null,
      positionOverrideReason: null as string | null,
      positionOverrideNote: null as string | null,
    }

    // Check if pair warning is needed (single corner on a pair-recommended service)
    const isSingleCorner = positionRule?.position_type === 'single_corner' && positionRule?.pair_recommended
    if (isSingleCorner) {
      setShowPairWarn(true)
    } else {
      setShowPairWarn(false)
    }

    onUpdateRef.current(updated)
  }, [positionRule])

  const handlePairOverride = useCallback((reason: string, note: string) => {
    setShowPairWarn(false)
    onUpdateRef.current({
      ...serviceRef.current,
      positionOverrideReason: reason,
      positionOverrideNote: note || null,
    })
  }, [])

  const handleWriteDescription = useCallback(async () => {
    setIsRewriting(true)
    try {
      const svc = serviceRef.current
      const laborLines = svc.labor.map((l) => l.description).filter(Boolean).join(", ")
      const isCompleted = svc.status === "completed"
      const res = await fetch("/api/local-ai/rewrite-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: svc.name,
          laborLines,
          techNotes: (isCompleted ? svc.descriptionDraft : svc.description) || "",
          status: svc.status || "",
        }),
      })
      const data = await res.json()
      if (data.description) {
        if (isCompleted) {
          // When completed, sparkle writes to descriptionCompleted
          onUpdateRef.current({
            ...serviceRef.current,
            descriptionCompleted: data.description,
            description: data.description,
          })
        } else {
          // When in progress/pending, sparkle writes to descriptionDraft + description
          onUpdateRef.current({
            ...serviceRef.current,
            descriptionDraft: data.description,
            description: data.description,
          })
        }
      }
    } catch {
      // silent fail
    } finally {
      setIsRewriting(false)
    }
  }, [])

  const handleToggleComplete = useCallback(async () => {
    const svc = serviceRef.current
    const isCurrentlyCompleted = svc.status === "completed"

    if (!isCurrentlyCompleted) {
      // Check inspection gating: all inspection items must be checked (non-pending)
      const inspections = svc.inspectionItems || []
      if (inspections.length > 0) {
        const unchecked = inspections.filter((i) => i.status === "pending")
        if (unchecked.length > 0) {
          alert(
            `Cannot mark complete — ${unchecked.length} inspection item${unchecked.length > 1 ? "s" : ""} not checked. Complete the inspection checklist first.`
          )
          return
        }
      }

      // Save current description as draft before switching
      const draft = svc.description || ""

      // Fire AI rewrite for the completed description (fire-and-forget, update when ready)
      const laborLines = svc.labor.map((l) => l.description).filter(Boolean).join(", ")

      // Optimistically mark as completed with draft preserved
      onUpdateRef.current({
        ...serviceRef.current,
        status: "completed",
        descriptionDraft: draft,
        // Show existing completed description if we have one, otherwise keep current
        description: svc.descriptionCompleted || draft,
      })

      // Notify parent that a service was completed (for oil change detection, etc.)
      onServiceCompletedRef.current?.(svc)

      // If no completed description exists yet, generate one via AI
      if (!svc.descriptionCompleted) {
        try {
          const res = await fetch("/api/local-ai/rewrite-description", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: svc.name,
              laborLines,
              techNotes: draft,
              status: "completed",
            }),
          })
          const data = await res.json()
          if (data.description) {
            onUpdateRef.current({
              ...serviceRef.current,
              status: "completed",
              descriptionDraft: draft,
              descriptionCompleted: data.description,
              description: data.description,
            })
          }
        } catch {
          // silent fail — keeps the draft as description
        }
      }
    } else {
      // Un-completing: revert to draft description
      onUpdateRef.current({
        ...serviceRef.current,
        status: "in_progress",
        description: svc.descriptionDraft || svc.description || "",
      })
    }
  }, [])

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
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleToggleComplete()
              }}
              className="flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-primary/50 rounded-full transition-colors"
              title={service.status === "completed" ? "Mark as in progress" : "Mark as completed"}
            >
              {service.status === "completed" ? (
                <CheckCircle2 size={22} className="text-green-500" />
              ) : (
                <Circle size={22} className="text-muted-foreground hover:text-green-400" />
              )}
            </button>
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
            <ServiceTotalWithDiscount
              totalCost={totalCost}
              discountAmount={service.discountAmount || 0}
              discountType={(service.discountType as 'percent' | 'flat') || 'percent'}
              onDiscountChange={(amount, type) => {
                onUpdate({ ...service, discountAmount: amount, discountType: type })
              }}
            />
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
                ref={titleInputRef}
                value={localTitle}
                onChange={(e) => setLocalTitle(e.target.value)}
                onBlur={handleTitleBlur}
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

          {/* Position Selector */}
          {positionRule && positionRule.requires_position && (
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Position</Label>
              <PositionSelector
                positionType={positionRule.position_type}
                validPositions={positionRule.valid_positions}
                value={service.position || null}
                onChange={handlePositionChange}
              />
              {showPairWarn && service.position && (
                <PairRecommendationWarn
                  serviceName={service.name}
                  selectedPosition={service.position}
                  onReasonSelected={handlePairOverride}
                />
              )}
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm text-muted-foreground">
                {service.status === "completed" ? "Customer Description (Completed)" : "Customer Description"}
              </Label>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoRewrite}
                    onChange={(e) => setAutoRewrite(e.target.checked)}
                    className="h-3 w-3 rounded border-border accent-primary cursor-pointer"
                  />
                  <span className="text-[11px] text-muted-foreground">Auto-rewrite</span>
                </label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleWriteDescription}
                  disabled={isRewriting || !service.name}
                  className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                >
                  {isRewriting ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Sparkles size={12} />
                  )}
                  {isRewriting ? "Writing..." : "Write Description"}
                </Button>
              </div>
            </div>
            <Textarea
              value={service.description}
              onChange={(e) => {
                // When completed, edits go to descriptionCompleted; otherwise to descriptionDraft
                if (service.status === "completed") {
                  onUpdate({ ...service, description: e.target.value, descriptionCompleted: e.target.value })
                } else {
                  onUpdate({ ...service, description: e.target.value, descriptionDraft: e.target.value })
                }
              }}
              className={`bg-card border-border resize-none ${
                service.status === "completed" ? "border-green-500/30" : ""
              }`}
              rows={2}
            />
            {service.status === "completed" && service.descriptionDraft && service.descriptionDraft !== service.description && (
              <p className="text-[11px] text-muted-foreground italic">
                Draft: {service.descriptionDraft}
              </p>
            )}
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
              serviceTitle={service.name}
              autoRewrite={autoRewrite}
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
            <ServiceTotalWithDiscount
              totalCost={totalCost}
              discountAmount={service.discountAmount || 0}
              discountType={(service.discountType as 'percent' | 'flat') || 'percent'}
              onDiscountChange={(amount, type) => {
                onUpdate({ ...service, discountAmount: amount, discountType: type })
              }}
              showLabel
            />
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
