"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MagnifyingGlassIcon as Search, ArrowPathIcon as Loader2 } from "@heroicons/react/24/outline"

interface InventoryPart {
  id: number
  part_number: string
  description: string
  vendor: string
  cost: number
  price: number
  quantity_available: number
  location: string
  category: string
}

interface Part {
  id: string
  name: string
  partNumber: string
  description: string
  price: number
  quantity: number
  category: string
  manufacturer: string
  location?: string
}

interface PartsCatalogModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectPart: (part: Part) => void
  lineItemIndex?: number // Optional: if provided, will replace that line item
}

export function PartsCatalogModal({ isOpen, onClose, onSelectPart, lineItemIndex }: PartsCatalogModalProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [parts, setParts] = useState<Part[]>([])
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<string[]>([])

  // Fetch parts from inventory API
  useEffect(() => {
    if (isOpen) {
      loadParts()
    }
  }, [isOpen, searchQuery, selectedCategory])

  async function loadParts() {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        search: searchQuery,
        sortBy: 'part_number',
        sortOrder: 'asc',
        limit: searchQuery ? '20' : '5' // Show 5 by default, 20 when searching
      })

      if (selectedCategory) {
        // Add category filter if selected - not implemented in API yet, will filter client-side
      }

      const response = await fetch(`/api/inventory/parts?${params}`)
      if (response.ok) {
        const data = await response.json()
        const inventoryParts: InventoryPart[] = data.parts || []
        
        // Convert inventory parts to Part format
        const convertedParts: Part[] = inventoryParts.map(p => ({
          id: p.id.toString(),
          name: p.description,
          partNumber: p.part_number,
          description: p.description,
          price: p.price,
          quantity: p.quantity_available,
          category: p.category || 'General',
          manufacturer: p.vendor,
          location: p.location
        }))
        
        setParts(convertedParts)
        
        // Extract unique categories
        const uniqueCategories = Array.from(new Set(convertedParts.map(p => p.category).filter(Boolean)))
        setCategories(uniqueCategories)
      }
    } catch (error) {
      console.error('Failed to load parts:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredParts = selectedCategory 
    ? parts.filter(part => part.category === selectedCategory)
    : parts

  const handleSelectPart = (part: Part) => {
    onSelectPart(part)
    setSearchQuery("")
    setSelectedCategory(null)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Parts Catalog</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 flex flex-col overflow-hidden">
          {/* Search */}
          <div className="space-y-2">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, part number, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Category Filter */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedCategory === null ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(null)}
              >
                All
              </Button>
              {categories.map((cat) => (
                <Button
                  key={cat}
                  variant={selectedCategory === cat ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat}
                </Button>
              ))}
            </div>
          </div>

          {/* Parts List */}
          <ScrollArea className="flex-1 border border-border rounded-lg">
            <div className="space-y-2 p-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : filteredParts.length > 0 ? (
                filteredParts.map((part) => (
                  <Card
                    key={part.id}
                    className="p-3 cursor-pointer hover:bg-muted/50 transition-colors border-border"
                    onClick={() => handleSelectPart(part)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-sm text-foreground">{part.name}</h4>
                          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                            {part.partNumber}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{part.description}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span>{part.manufacturer}</span>
                          <span>In Stock: {part.quantity}</span>
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <p className="font-semibold text-sm text-foreground">${part.price.toFixed(2)}</p>
                      </div>
                    </div>
                  </Card>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No parts found. Try adjusting your search.
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  )
}
