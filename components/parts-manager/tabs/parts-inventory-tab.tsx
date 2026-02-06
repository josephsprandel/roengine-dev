"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { MagnifyingGlassIcon as Search, ArrowDownTrayIcon as Download, ArrowUpTrayIcon as Upload, ArrowPathIcon as Loader2 } from "@heroicons/react/24/outline"
import Link from "next/link"
import { DataTable } from "../data-table"
import { columns, type Part } from "../columns"
import { PartDetailsModal } from "../part-details-modal"

export function PartsInventoryTab() {
  const [searchTerm, setSearchTerm] = useState("")
  const [parts, setParts] = useState<Part[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [totalParts, setTotalParts] = useState(0)
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(50)
  const [selectedPart, setSelectedPart] = useState<Part | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => {
    // Reset to first page when search term changes
    if (pageIndex !== 0) {
      setPageIndex(0)
    } else {
      loadParts()
    }
  }, [searchTerm])

  useEffect(() => {
    loadParts()
  }, [pageIndex, pageSize])

  async function loadParts() {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        search: searchTerm,
        limit: pageSize.toString(),
        offset: (pageIndex * pageSize).toString()
      })

      const response = await fetch(`/api/inventory/parts?${params}`)
      if (response.ok) {
        const data = await response.json()
        setParts(data.parts || [])
        setTotalParts(data.pagination?.total || 0)
      }
    } catch (error) {
      console.error('Failed to load parts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRowClick = (part: Part) => {
    setSelectedPart(part)
    setIsModalOpen(true)
  }

  const handleSavePart = async (updatedPart: Partial<Part>) => {
    if (!selectedPart) return
    
    try {
      const response = await fetch(`/api/inventory/parts/${selectedPart.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedPart)
      })
      
      if (!response.ok) {
        throw new Error('Failed to update part')
      }
      
      // Reload parts to show updated data
      await loadParts()
      setIsModalOpen(false)
      setSelectedPart(null)
    } catch (error) {
      console.error('Failed to save part:', error)
      throw error
    }
  }

  async function handleExport() {
    try {
      setExporting(true)
      
      // Fetch ALL parts (not just current page) for export
      const params = new URLSearchParams({
        search: searchTerm,
        limit: '100000' // Large number to get all results
      })

      const response = await fetch(`/api/inventory/parts?${params}`)
      if (!response.ok) throw new Error('Failed to fetch parts')
      
      const data = await response.json()
      const allParts = data.parts || []

      // Convert to CSV - Include ALL fields for mass editing
      const headers = [
        'id',
        'part_number',
        'description',
        'vendor',
        'cost',
        'price',
        'quantity_on_hand',
        'quantity_available',
        'quantity_allocated',
        'reorder_point',
        'location',
        'bin_location',
        'category',
        'approvals',
        'notes',
        'shopware_id',
        'last_synced_at',
        'last_updated',
        'created_at'
      ]

      const csvRows = [
        headers.join(','),
        ...allParts.map((part: Part) => [
          part.id,
          `"${part.part_number}"`,
          `"${part.description.replace(/"/g, '""')}"`,
          `"${part.vendor}"`,
          part.cost.toFixed(2),
          part.price.toFixed(2),
          part.quantity_on_hand,
          part.quantity_available,
          part.quantity_allocated,
          part.reorder_point,
          `"${part.location}"`,
          `"${part.bin_location || ''}"`,
          `"${part.category}"`,
          `"${(part.approvals || '').replace(/"/g, '""')}"`,
          `"${(part.notes || '').replace(/"/g, '""')}"`,
          `"${part.shopware_id || ''}"`,
          `"${part.last_synced_at || ''}"`,
          `"${part.last_updated || ''}"`,
          `"${part.created_at || ''}"`
        ].join(','))
      ]

      const csvContent = csvRows.join('\n')
      
      // Download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `parts_inventory_${new Date().toISOString().split('T')[0]}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
    } catch (error) {
      console.error('Export failed:', error)
      alert('Failed to export parts inventory')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full space-y-3">
      {/* Search and Actions */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by part number, description, or vendor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-card border-border"
          />
        </div>
        <Link href="/inventory/import">
          <Button variant="default" className="gap-2">
            <Upload size={16} />
            Import CSV
          </Button>
        </Link>
        <Button 
          variant="outline" 
          className="gap-2 bg-transparent"
          onClick={handleExport}
          disabled={exporting || totalParts === 0}
        >
          {exporting ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Download size={16} />
          )}
          {exporting ? 'Exporting...' : 'Export'}
        </Button>
      </div>

      {/* Stats Summary */}
      {!loading && (
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span>Total Parts: <strong className="text-foreground">{totalParts}</strong></span>
          <span>In Stock: <strong className="text-green-600">{parts.filter(p => p.quantity_available > 0).length}</strong></span>
          <span>Low Stock: <strong className="text-yellow-600">{parts.filter(p => p.quantity_available > 0 && p.quantity_available <= p.reorder_point).length}</strong></span>
          <span>Out of Stock: <strong className="text-red-600">{parts.filter(p => p.quantity_available === 0).length}</strong></span>
        </div>
      )}

      {/* Parts Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12 border border-border rounded-lg">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : parts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 border border-border rounded-lg">
          <p className="text-muted-foreground mb-4">No parts in inventory</p>
          <Link href="/inventory/import">
            <Button className="gap-2">
              <Upload size={16} />
              Import Parts from ShopWare
            </Button>
          </Link>
        </div>
      ) : (
        <div className="flex flex-col flex-1 min-h-0">
          <DataTable 
            columns={columns} 
            data={parts} 
            pageSize={pageSize}
            pageIndex={pageIndex}
            pageCount={Math.ceil(totalParts / pageSize)}
            onPageChange={setPageIndex}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize)
              setPageIndex(0) // Reset to first page when changing page size
            }}
            onRowClick={handleRowClick}
          />
        </div>
      )}

      {/* Part Details Modal */}
      <PartDetailsModal
        part={selectedPart}
        open={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedPart(null)
        }}
        onSave={handleSavePart}
      />
    </div>
  )
}
