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
} from "lucide-react"
import type { ServiceData, LineItem } from "./ro-creation-wizard"
import { PartsCatalogModal } from "./parts-catalog-modal"
import { PartDetailsModal } from "./part-details-modal"

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

  return (
    <Card
      className={`border-border overflow-hidden transition-all ${
        isDragging ? "opacity-50 scale-[0.98] shadow-lg" : ""
      }`}
    >
      {/* Collapsed Header */}
      <div className="flex items-center gap-2 p-4 hover:bg-muted/30 transition-colors">
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

          {/* Line Items by Category */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-foreground border-b border-border pb-2">
              Line Items
            </h4>
            {lineItemCategories.map((cat) => (
              <LineItemSection
                key={cat.key}
                category={cat.key}
                label={cat.label}
                icon={cat.icon}
                color={cat.color}
                items={service[cat.key]}
                onUpdateItems={(items) => handleLineItemsUpdate(cat.key, items)}
                onFindPart={cat.key === "parts" ? handleOpenCatalog : undefined}
                onClickPart={cat.key === "parts" ? handleOpenPartDetails : undefined}
              />
            ))}
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
