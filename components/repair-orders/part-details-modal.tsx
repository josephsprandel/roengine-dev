"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"
import type { LineItem } from "./ro-creation-wizard"

interface PartDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  lineItem: LineItem | null
  onSave: (updatedItem: LineItem) => void
  roNumber?: string
}

interface AutocompleteSuggestion {
  value: string
  label: string
  part_number?: string
  description?: string
  vendor?: string
  cost?: number | string  // PostgreSQL DECIMAL can return as string
  price?: number | string
  quantity_available?: number
  field?: string
}

// Reusable Autocomplete Input Component
function AutocompleteInput({
  value,
  onChange,
  onSelect,
  placeholder,
  field,
  className,
}: {
  value: string
  onChange: (value: string) => void
  onSelect: (suggestion: AutocompleteSuggestion) => void
  placeholder?: string
  field: 'vendor' | 'description' | 'part_number'
  className?: string
}) {
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([])
      return
    }

    setLoading(true)
    try {
      const response = await fetch(
        `/api/inventory/parts/autocomplete?q=${encodeURIComponent(query)}&field=${field}&limit=8`
      )
      const data = await response.json()
      setSuggestions(data.suggestions || [])
      setShowSuggestions(true)
      setSelectedIndex(-1)
    } catch (error) {
      console.error('Autocomplete error:', error)
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }, [field])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    onChange(newValue)

    // Debounce the API call
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(newValue)
    }, 200)
  }

  const handleSelect = (suggestion: AutocompleteSuggestion) => {
    onChange(suggestion.value)
    onSelect(suggestion)
    setShowSuggestions(false)
    setSuggestions([])
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((prev) => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          handleSelect(suggestions[selectedIndex])
        }
        break
      case 'Escape':
        setShowSuggestions(false)
        break
    }
  }

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative">
      <div className="relative">
        <Input
          ref={inputRef}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          placeholder={placeholder}
          className={className}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-y-auto"
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={`${suggestion.value}-${index}`}
              type="button"
              onClick={() => handleSelect(suggestion)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors ${
                index === selectedIndex ? 'bg-accent text-accent-foreground' : ''
              }`}
            >
              <div className="font-medium">{suggestion.value}</div>
              {(suggestion.part_number || suggestion.vendor || suggestion.description) && (
                <div className="text-xs text-muted-foreground mt-0.5">
                  {field === 'vendor' && suggestion.part_number && (
                    <span>{suggestion.part_number}</span>
                  )}
                  {field === 'description' && suggestion.part_number && (
                    <span>#{suggestion.part_number}</span>
                  )}
                  {field === 'description' && suggestion.vendor && (
                    <span> • {suggestion.vendor}</span>
                  )}
                  {field === 'part_number' && suggestion.description && (
                    <span>{suggestion.description}</span>
                  )}
                  {suggestion.quantity_available !== undefined && (
                    <span className={`ml-2 ${suggestion.quantity_available > 0 ? 'text-green-600' : 'text-red-500'}`}>
                      ({suggestion.quantity_available} in stock)
                    </span>
                  )}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function PartDetailsModal({ isOpen, onClose, lineItem, onSave, roNumber }: PartDetailsModalProps) {
  const [partType, setPartType] = useState("Parts")
  const [vendor, setVendor] = useState("")
  const [description, setDescription] = useState("")
  const [partNumber, setPartNumber] = useState("")
  const [cost, setCost] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const [markupMultiplier, setMarkupMultiplier] = useState(2.0)
  const [markupPercent, setMarkupPercent] = useState(100)
  const [sellPrice, setSellPrice] = useState(0)

  // Load values when lineItem changes
  useEffect(() => {
    if (lineItem) {
      setDescription(lineItem.description)
      setPartNumber(lineItem.part_number || "")
      setVendor(lineItem.vendor || "")
      setCost(lineItem.cost || 0)
      setQuantity(lineItem.quantity)
      setSellPrice(lineItem.unitPrice)
      
      // Calculate markup from cost and price
      if (lineItem.cost && lineItem.cost > 0) {
        const calculatedMarkupMultiplier = lineItem.unitPrice / lineItem.cost
        const calculatedMarkupPercent = ((lineItem.unitPrice - lineItem.cost) / lineItem.cost) * 100
        setMarkupMultiplier(parseFloat(calculatedMarkupMultiplier.toFixed(2)))
        setMarkupPercent(parseFloat(calculatedMarkupPercent.toFixed(1)))
      } else {
        setMarkupMultiplier(2.0)
        setMarkupPercent(100)
      }
    }
  }, [lineItem])

  // Recalculate sell price when cost or markup changes
  const handleCostChange = (newCost: number) => {
    setCost(newCost)
    const newSellPrice = newCost * markupMultiplier
    setSellPrice(parseFloat(newSellPrice.toFixed(2)))
  }

  const handleMarkupMultiplierChange = (newMultiplier: number) => {
    setMarkupMultiplier(newMultiplier)
    const newPercent = (newMultiplier - 1) * 100
    setMarkupPercent(parseFloat(newPercent.toFixed(1)))
    const newSellPrice = cost * newMultiplier
    setSellPrice(parseFloat(newSellPrice.toFixed(2)))
  }

  const handleMarkupPercentChange = (newPercent: number) => {
    setMarkupPercent(newPercent)
    const newMultiplier = 1 + (newPercent / 100)
    setMarkupMultiplier(parseFloat(newMultiplier.toFixed(2)))
    const newSellPrice = cost * newMultiplier
    setSellPrice(parseFloat(newSellPrice.toFixed(2)))
  }

  const handleSellPriceChange = (newSellPrice: number) => {
    setSellPrice(newSellPrice)
    if (cost > 0) {
      const newMultiplier = newSellPrice / cost
      const newPercent = ((newSellPrice - cost) / cost) * 100
      setMarkupMultiplier(parseFloat(newMultiplier.toFixed(2)))
      setMarkupPercent(parseFloat(newPercent.toFixed(1)))
    }
  }

  // Handle autocomplete selection - auto-fill related fields
  const handleVendorSelect = (suggestion: AutocompleteSuggestion) => {
    setVendor(suggestion.value || "")
    // Optionally fill other fields if available
    if (suggestion.part_number && !partNumber) {
      setPartNumber(suggestion.part_number)
    }
    if (suggestion.description && !description) {
      setDescription(suggestion.description)
    }
  }

  const handleDescriptionSelect = (suggestion: AutocompleteSuggestion) => {
    setDescription(suggestion.value || "")
    // Auto-fill related fields
    if (suggestion.part_number) {
      setPartNumber(suggestion.part_number)
    }
    if (suggestion.vendor) {
      setVendor(suggestion.vendor)
    }
    if (suggestion.cost !== undefined && suggestion.cost !== null) {
      // Parse cost as number (PostgreSQL DECIMAL returns string)
      const costValue = typeof suggestion.cost === 'string' 
        ? parseFloat(suggestion.cost) 
        : suggestion.cost
      if (!isNaN(costValue)) {
        handleCostChange(costValue)
      }
    }
  }

  const handlePartNumberSelect = (suggestion: AutocompleteSuggestion) => {
    setPartNumber(suggestion.value || "")
    // Auto-fill related fields
    if (suggestion.description) {
      setDescription(suggestion.description)
    }
    if (suggestion.vendor) {
      setVendor(suggestion.vendor)
    }
    if (suggestion.cost !== undefined && suggestion.cost !== null) {
      // Parse cost as number (PostgreSQL DECIMAL returns string)
      const costValue = typeof suggestion.cost === 'string' 
        ? parseFloat(suggestion.cost) 
        : suggestion.cost
      if (!isNaN(costValue)) {
        handleCostChange(costValue)
      }
    }
  }

  const handleSave = () => {
    if (!lineItem) return

    const updatedItem: LineItem = {
      ...lineItem,
      description,
      part_number: partNumber,
      vendor,
      cost,
      quantity,
      unitPrice: sellPrice,
      total: sellPrice * quantity
    }

    onSave(updatedItem)
    onClose()
  }

  if (!lineItem) return null

  const inventoryPartInfo = lineItem.part_id 
    ? `${lineItem.part_number || ''} (${lineItem.cost ? `$ ${lineItem.cost.toFixed(2)}` : ''})`
    : null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            Edit Part - RO #{roNumber || 'Draft'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {inventoryPartInfo && (
            <div className="bg-muted/50 p-3 rounded-md">
              <p className="text-sm text-muted-foreground">This part's associated Inventory part is:</p>
              <p className="font-medium text-foreground mt-1">{lineItem.description}</p>
              <p className="text-sm text-muted-foreground">{inventoryPartInfo}</p>
            </div>
          )}

          <div className="text-sm text-muted-foreground">
            Edit the part information for this repair order only. Start typing to search inventory:
          </div>

          {/* Part Type */}
          <div className="space-y-2">
            <Label>Part Type</Label>
            <Input
              value={partType}
              onChange={(e) => setPartType(e.target.value)}
              className="bg-card"
            />
          </div>

          {/* Brand/Vendor - with autocomplete */}
          <div className="space-y-2">
            <Label>Brand</Label>
            <AutocompleteInput
              value={vendor}
              onChange={setVendor}
              onSelect={handleVendorSelect}
              placeholder="e.g., Iwis, Bosch, etc."
              field="vendor"
              className="bg-card"
            />
          </div>

          {/* Description - with autocomplete */}
          <div className="space-y-2">
            <Label>Description</Label>
            <AutocompleteInput
              value={description}
              onChange={setDescription}
              onSelect={handleDescriptionSelect}
              placeholder="Part description"
              field="description"
              className="bg-card"
            />
          </div>

          {/* Part Number - with autocomplete */}
          <div className="space-y-2">
            <Label>Part Number</Label>
            <AutocompleteInput
              value={partNumber}
              onChange={setPartNumber}
              onSelect={handlePartNumberSelect}
              placeholder="Enter part number"
              field="part_number"
              className="bg-card"
            />
          </div>

          {/* Cost */}
          <div className="space-y-2">
            <Label>Cost</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={cost || ""}
              onChange={(e) => handleCostChange(parseFloat(e.target.value) || 0)}
              className="bg-card"
            />
          </div>

          {/* AI Parts Matrix Price */}
          <div className="space-y-2">
            <Label>AI Parts Matrix Price</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={cost.toFixed(2)}
                readOnly
                className="bg-muted flex-1"
              />
              <Input
                type="number"
                min="0"
                step="0.1"
                value={markupMultiplier}
                onChange={(e) => handleMarkupMultiplierChange(parseFloat(e.target.value) || 1)}
                className="bg-card w-20"
              />
              <span className="text-muted-foreground">x</span>
              <Input
                type="number"
                min="0"
                step="0.1"
                value={markupPercent}
                onChange={(e) => handleMarkupPercentChange(parseFloat(e.target.value) || 0)}
                className="bg-card w-20"
              />
              <span className="text-muted-foreground">%</span>
            </div>
          </div>

          {/* Sell Price */}
          <div className="space-y-2">
            <Label>Sell Price</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={sellPrice || ""}
                onChange={(e) => handleSellPriceChange(parseFloat(e.target.value) || 0)}
                className="bg-card flex-1"
              />
              <Input
                type="number"
                min="0"
                step="0.01"
                value={quantity}
                onChange={(e) => setQuantity(parseFloat(e.target.value) || 1)}
                className="bg-card w-20"
              />
              <span className="text-muted-foreground">x</span>
              <Input
                type="number"
                min="0"
                step="0.1"
                value={markupPercent}
                onChange={(e) => handleMarkupPercentChange(parseFloat(e.target.value) || 0)}
                className="bg-card w-20"
              />
              <span className="text-muted-foreground">%</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              Update
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
