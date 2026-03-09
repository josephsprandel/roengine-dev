"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog"
import { Loader2, Plus, Search, X, Trash2, ChevronLeft, ChevronRight } from "lucide-react"
import { toast } from "sonner"

// --- Types ---

interface PurchaseOrder {
  id: number
  po_number: string
  vendor_id: number
  vendor_name: string
  status: "draft" | "ordered" | "partially_received" | "received" | "cancelled"
  ordered_date: string | null
  expected_date: string | null
  received_date: string | null
  notes: string | null
  total_cost: number
  item_count: number
  created_at: string
}

interface POItem {
  id: number
  part_number: string
  description: string
  brand: string | null
  quantity_ordered: number
  quantity_received: number
  unit_cost: number
  parts_inventory_id: number | null
  notes: string | null
}

interface PODetail extends PurchaseOrder {
  items: POItem[]
}

interface VendorSuggestion {
  id: number
  name: string
  phone: string | null
  account_number: string | null
  is_preferred: boolean
}

interface PartSuggestion {
  value: string
  label: string
  description: string
  vendor: string
  cost: number
  price: number
  quantity_available: number
}

interface Pagination {
  total: number
  limit: number
  offset: number
}

interface LineItemDraft {
  key: number
  part_number: string
  description: string
  brand: string
  quantity_ordered: number
  unit_cost: number
  parts_inventory_id: number | null
  notes: string
}

export interface PurchaseOrdersTabProps {
  onNavigateToReceiving?: (poId: number) => void
}

// --- Helpers ---

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "draft", label: "Draft" },
  { value: "ordered", label: "Ordered" },
  { value: "partially_received", label: "Partially Received" },
  { value: "received", label: "Received" },
  { value: "cancelled", label: "Cancelled" },
]

function statusBadge(status: PurchaseOrder["status"]) {
  switch (status) {
    case "draft":
      return <Badge variant="secondary">Draft</Badge>
    case "ordered":
      return <Badge variant="default">Ordered</Badge>
    case "partially_received":
      return (
        <Badge variant="outline" className="text-yellow-600 border-yellow-400 dark:text-yellow-400 dark:border-yellow-600">
          Partial
        </Badge>
      )
    case "received":
      return (
        <Badge variant="outline" className="text-green-600 border-green-400 dark:text-green-400 dark:border-green-600">
          Received
        </Badge>
      )
    case "cancelled":
      return <Badge variant="destructive">Cancelled</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

let lineItemKeyCounter = 0
function nextLineItemKey() {
  return ++lineItemKeyCounter
}

function emptyLineItem(): LineItemDraft {
  return {
    key: nextLineItemKey(),
    part_number: "",
    description: "",
    brand: "",
    quantity_ordered: 1,
    unit_cost: 0,
    parts_inventory_id: null,
    notes: "",
  }
}

// --- Component ---

export function PurchaseOrdersTab({ onNavigateToReceiving }: PurchaseOrdersTabProps) {
  // List state
  const [pos, setPos] = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState<Pagination>({ total: 0, limit: 25, offset: 0 })
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  // Detail dialog
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [selectedPO, setSelectedPO] = useState<PODetail | null>(null)

  // Create/Edit dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [editingPO, setEditingPO] = useState<PODetail | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Create form state
  const [formVendorId, setFormVendorId] = useState<number | null>(null)
  const [formVendorName, setFormVendorName] = useState("")
  const [formVendorSearch, setFormVendorSearch] = useState("")
  const [vendorSuggestions, setVendorSuggestions] = useState<VendorSuggestion[]>([])
  const [showVendorDropdown, setShowVendorDropdown] = useState(false)
  const [formExpectedDate, setFormExpectedDate] = useState("")
  const [formNotes, setFormNotes] = useState("")
  const [formItems, setFormItems] = useState<LineItemDraft[]>([emptyLineItem()])

  // Part autocomplete per line item
  const [partSuggestions, setPartSuggestions] = useState<Record<number, PartSuggestion[]>>({})
  const [activePartKey, setActivePartKey] = useState<number | null>(null)

  // Delete confirmation
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  // Debounce ref
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // --- Data Loading ---

  const loadPOs = useCallback(async (search: string, status: string, offset: number) => {
    try {
      setLoading(true)
      const params = new URLSearchParams({ limit: "25", offset: offset.toString() })
      if (search) params.set("search", search)
      if (status !== "all") params.set("status", status)

      const res = await fetch(`/api/purchase-orders?${params}`)
      if (!res.ok) throw new Error("Failed to load purchase orders")
      const data = await res.json()
      setPos(data.data || [])
      setPagination(data.pagination || { total: 0, limit: 25, offset })
    } catch (err) {
      console.error(err)
      toast.error("Failed to load purchase orders")
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    loadPOs(searchTerm, statusFilter, 0)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced search
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      loadPOs(searchTerm, statusFilter, 0)
    }, 300)
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [searchTerm, statusFilter, loadPOs])

  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1
  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.limit))

  function goToPage(page: number) {
    const offset = (page - 1) * pagination.limit
    loadPOs(searchTerm, statusFilter, offset)
  }

  // --- Detail ---

  async function openDetail(po: PurchaseOrder) {
    setDetailOpen(true)
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/purchase-orders/${po.id}`)
      if (!res.ok) throw new Error("Failed to load PO details")
      const data = await res.json()
      setSelectedPO(data.data)
    } catch (err) {
      console.error(err)
      toast.error("Failed to load PO details")
      setDetailOpen(false)
    } finally {
      setDetailLoading(false)
    }
  }

  // --- Create/Edit ---

  function openCreateDialog() {
    setEditingPO(null)
    setFormVendorId(null)
    setFormVendorName("")
    setFormVendorSearch("")
    setVendorSuggestions([])
    setShowVendorDropdown(false)
    setFormExpectedDate("")
    setFormNotes("")
    setFormItems([emptyLineItem()])
    setPartSuggestions({})
    setActivePartKey(null)
    setCreateOpen(true)
  }

  function openEditDialog(po: PODetail) {
    setEditingPO(po)
    setFormVendorId(po.vendor_id)
    setFormVendorName(po.vendor_name)
    setFormVendorSearch(po.vendor_name)
    setVendorSuggestions([])
    setShowVendorDropdown(false)
    setFormExpectedDate(po.expected_date ? po.expected_date.split("T")[0] : "")
    setFormNotes(po.notes || "")
    setFormItems(
      po.items.map((item) => ({
        key: nextLineItemKey(),
        part_number: item.part_number,
        description: item.description,
        brand: item.brand || "",
        quantity_ordered: item.quantity_ordered,
        unit_cost: item.unit_cost,
        parts_inventory_id: item.parts_inventory_id,
        notes: item.notes || "",
      }))
    )
    setPartSuggestions({})
    setActivePartKey(null)
    setDetailOpen(false)
    setCreateOpen(true)
  }

  // Vendor autocomplete
  async function searchVendors(query: string) {
    setFormVendorSearch(query)
    setFormVendorName(query)
    setFormVendorId(null)
    if (query.length < 1) {
      setVendorSuggestions([])
      setShowVendorDropdown(false)
      return
    }
    try {
      const res = await fetch(`/api/vendors/autocomplete?q=${encodeURIComponent(query)}`)
      if (res.ok) {
        const data = await res.json()
        setVendorSuggestions(data.data || [])
        setShowVendorDropdown(true)
      }
    } catch {
      // silently fail
    }
  }

  function selectVendor(vendor: VendorSuggestion) {
    setFormVendorId(vendor.id)
    setFormVendorName(vendor.name)
    setFormVendorSearch(vendor.name)
    setShowVendorDropdown(false)
    setVendorSuggestions([])
  }

  // Part autocomplete
  async function searchParts(key: number, query: string) {
    if (query.length < 1) {
      setPartSuggestions((prev) => ({ ...prev, [key]: [] }))
      setActivePartKey(null)
      return
    }
    try {
      const res = await fetch(`/api/inventory/parts/autocomplete?q=${encodeURIComponent(query)}&field=part_number`)
      if (res.ok) {
        const data = await res.json()
        setPartSuggestions((prev) => ({ ...prev, [key]: data.suggestions || [] }))
        setActivePartKey(key)
      }
    } catch {
      // silently fail
    }
  }

  function selectPart(key: number, suggestion: PartSuggestion) {
    setFormItems((prev) =>
      prev.map((item) =>
        item.key === key
          ? {
              ...item,
              part_number: suggestion.value,
              description: suggestion.description || suggestion.label,
              unit_cost: suggestion.cost || 0,
              parts_inventory_id: null, // Will be resolved server-side if needed
            }
          : item
      )
    )
    setPartSuggestions((prev) => ({ ...prev, [key]: [] }))
    setActivePartKey(null)
  }

  function updateLineItem(key: number, field: keyof LineItemDraft, value: string | number) {
    setFormItems((prev) =>
      prev.map((item) => (item.key === key ? { ...item, [field]: value } : item))
    )
  }

  function removeLineItem(key: number) {
    setFormItems((prev) => {
      const updated = prev.filter((item) => item.key !== key)
      return updated.length === 0 ? [emptyLineItem()] : updated
    })
  }

  function addLineItem() {
    setFormItems((prev) => [...prev, emptyLineItem()])
  }

  async function handleSubmitPO() {
    if (!formVendorId) {
      toast.error("Please select a vendor")
      return
    }
    const validItems = formItems.filter((item) => item.part_number.trim() !== "")
    if (validItems.length === 0) {
      toast.error("Add at least one line item with a part number")
      return
    }

    setSubmitting(true)
    try {
      const body = {
        vendor_id: formVendorId,
        expected_date: formExpectedDate || undefined,
        notes: formNotes || undefined,
        items: validItems.map((item) => ({
          part_number: item.part_number,
          description: item.description,
          brand: item.brand || undefined,
          quantity_ordered: item.quantity_ordered,
          unit_cost: item.unit_cost,
          parts_inventory_id: item.parts_inventory_id || undefined,
          notes: item.notes || undefined,
        })),
      }

      const isEdit = editingPO !== null
      const url = isEdit ? `/api/purchase-orders/${editingPO.id}` : "/api/purchase-orders"
      const method = isEdit ? "PATCH" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Failed to ${isEdit ? "update" : "create"} purchase order`)
      }

      toast.success(isEdit ? "Purchase order updated" : "Purchase order created")
      setCreateOpen(false)
      loadPOs(searchTerm, statusFilter, pagination.offset)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save purchase order")
    } finally {
      setSubmitting(false)
    }
  }

  // --- Actions ---

  async function updatePOStatus(poId: number, status: string) {
    try {
      const res = await fetch(`/api/purchase-orders/${poId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error("Failed to update status")
      toast.success(`Purchase order ${status === "ordered" ? "marked as ordered" : "cancelled"}`)
      setDetailOpen(false)
      setSelectedPO(null)
      loadPOs(searchTerm, statusFilter, pagination.offset)
    } catch {
      toast.error("Failed to update purchase order status")
    }
  }

  async function deletePO(poId: number) {
    try {
      const res = await fetch(`/api/purchase-orders/${poId}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete PO")
      toast.success("Purchase order deleted")
      setDeleteConfirmOpen(false)
      setDeletingId(null)
      setDetailOpen(false)
      setSelectedPO(null)
      loadPOs(searchTerm, statusFilter, pagination.offset)
    } catch {
      toast.error("Failed to delete purchase order")
    }
  }

  // --- Render ---

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex justify-between gap-4">
        <div className="flex gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search PO number or vendor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-card border-border"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px] bg-card border-border">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button className="gap-2" onClick={openCreateDialog}>
          <Plus size={16} />
          New PO
        </Button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12 border border-border rounded-lg">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : pos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 border border-border rounded-lg">
          <p className="text-muted-foreground">No purchase orders found</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto border border-border rounded-lg">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-card">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">PO Number</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Vendor</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">Items</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Total</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pos.map((po) => (
                  <tr
                    key={po.id}
                    className="border-b border-border hover:bg-card/50 cursor-pointer"
                    onClick={() => openDetail(po)}
                  >
                    <td className="px-4 py-3 font-mono text-foreground">{po.po_number}</td>
                    <td className="px-4 py-3 text-foreground">{po.vendor_name}</td>
                    <td className="px-4 py-3 text-center text-foreground">{po.item_count}</td>
                    <td className="px-4 py-3 text-right text-foreground font-medium">
                      {formatCurrency(po.total_cost)}
                    </td>
                    <td className="px-4 py-3">{statusBadge(po.status)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(po.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 bg-transparent"
                        onClick={(e) => {
                          e.stopPropagation()
                          openDetail(po)
                        }}
                      >
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-transparent"
                  disabled={currentPage <= 1}
                  onClick={() => goToPage(currentPage - 1)}
                >
                  <ChevronLeft size={16} className="mr-1" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-transparent"
                  disabled={currentPage >= totalPages}
                  onClick={() => goToPage(currentPage + 1)}
                >
                  Next
                  <ChevronRight size={16} className="ml-1" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedPO ? `Purchase Order ${selectedPO.po_number}` : "Purchase Order"}
            </DialogTitle>
            <DialogDescription>
              {selectedPO ? `${selectedPO.vendor_name} - ${formatDate(selectedPO.created_at)}` : "Loading..."}
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : selectedPO ? (
            <div className="space-y-4">
              {/* Header info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Status:</span>{" "}
                  {statusBadge(selectedPO.status)}
                </div>
                <div>
                  <span className="text-muted-foreground">Vendor:</span>{" "}
                  <span className="text-foreground">{selectedPO.vendor_name}</span>
                </div>
                {selectedPO.ordered_date && (
                  <div>
                    <span className="text-muted-foreground">Ordered:</span>{" "}
                    <span className="text-foreground">{formatDate(selectedPO.ordered_date)}</span>
                  </div>
                )}
                {selectedPO.expected_date && (
                  <div>
                    <span className="text-muted-foreground">Expected:</span>{" "}
                    <span className="text-foreground">{formatDate(selectedPO.expected_date)}</span>
                  </div>
                )}
                {selectedPO.received_date && (
                  <div>
                    <span className="text-muted-foreground">Received:</span>{" "}
                    <span className="text-foreground">{formatDate(selectedPO.received_date)}</span>
                  </div>
                )}
                {selectedPO.notes && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Notes:</span>{" "}
                    <span className="text-foreground">{selectedPO.notes}</span>
                  </div>
                )}
              </div>

              {/* Line items */}
              <div className="overflow-x-auto border border-border rounded-lg">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-card">
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Part #</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Description</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Brand</th>
                      <th className="px-3 py-2 text-center font-medium text-muted-foreground">Ordered</th>
                      <th className="px-3 py-2 text-center font-medium text-muted-foreground">Received</th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">Unit Cost</th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">Extended</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPO.items.map((item) => (
                      <tr key={item.id} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 font-mono text-foreground">{item.part_number}</td>
                        <td className="px-3 py-2 text-foreground">{item.description}</td>
                        <td className="px-3 py-2 text-muted-foreground">{item.brand || "-"}</td>
                        <td className="px-3 py-2 text-center text-foreground">{item.quantity_ordered}</td>
                        <td className="px-3 py-2 text-center text-foreground">{item.quantity_received}</td>
                        <td className="px-3 py-2 text-right text-foreground">{formatCurrency(item.unit_cost)}</td>
                        <td className="px-3 py-2 text-right text-foreground font-medium">
                          {formatCurrency(item.unit_cost * item.quantity_ordered)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-border bg-card">
                      <td colSpan={6} className="px-3 py-2 text-right font-medium text-muted-foreground">
                        Total:
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-foreground">
                        {formatCurrency(selectedPO.total_cost)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Actions */}
              <div className="flex gap-2 justify-end pt-2">
                {selectedPO.status === "draft" && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-transparent text-destructive hover:text-destructive"
                      onClick={() => {
                        setDeletingId(selectedPO.id)
                        setDeleteConfirmOpen(true)
                      }}
                    >
                      <Trash2 size={14} className="mr-1" />
                      Delete
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-transparent"
                      onClick={() => openEditDialog(selectedPO)}
                    >
                      Edit
                    </Button>
                    <Button size="sm" onClick={() => updatePOStatus(selectedPO.id, "ordered")}>
                      Mark as Ordered
                    </Button>
                  </>
                )}
                {(selectedPO.status === "ordered" || selectedPO.status === "partially_received") && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setDetailOpen(false)
                      onNavigateToReceiving?.(selectedPO.id)
                    }}
                  >
                    Receive Parts
                  </Button>
                )}
                {selectedPO.status === "ordered" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-transparent text-destructive hover:text-destructive"
                    onClick={() => updatePOStatus(selectedPO.id, "cancelled")}
                  >
                    Cancel PO
                  </Button>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Purchase Order</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this draft purchase order? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="bg-transparent" onClick={() => setDeleteConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => deletingId && deletePO(deletingId)}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create / Edit Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPO ? "Edit Purchase Order" : "New Purchase Order"}</DialogTitle>
            <DialogDescription>
              {editingPO ? `Editing ${editingPO.po_number}` : "Create a new purchase order for a vendor"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Vendor */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Vendor</label>
              <div className="relative">
                <Input
                  placeholder="Search vendors..."
                  value={formVendorSearch}
                  onChange={(e) => searchVendors(e.target.value)}
                  onFocus={() => {
                    if (vendorSuggestions.length > 0) setShowVendorDropdown(true)
                  }}
                  onBlur={() => {
                    // Delay to allow click on dropdown item
                    setTimeout(() => setShowVendorDropdown(false), 200)
                  }}
                  className="bg-card border-border"
                />
                {formVendorId && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-green-600">Selected</span>
                )}
                {showVendorDropdown && vendorSuggestions.length > 0 && (
                  <div className="absolute z-50 top-full mt-1 w-full bg-popover border border-border rounded-md shadow-md max-h-48 overflow-y-auto">
                    {vendorSuggestions.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground flex items-center justify-between"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectVendor(v)}
                      >
                        <span>{v.name}</span>
                        {v.is_preferred && (
                          <Badge variant="secondary" className="text-xs ml-2">Preferred</Badge>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Expected Date */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Expected Date</label>
              <Input
                type="date"
                value={formExpectedDate}
                onChange={(e) => setFormExpectedDate(e.target.value)}
                className="bg-card border-border max-w-xs"
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Notes</label>
              <textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[60px] resize-y"
                placeholder="Optional notes..."
              />
            </div>

            {/* Line Items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">Line Items</label>
                <Button type="button" variant="outline" size="sm" className="bg-transparent gap-1" onClick={addLineItem}>
                  <Plus size={14} />
                  Add Line Item
                </Button>
              </div>

              <div className="space-y-2">
                {formItems.map((item) => (
                  <div key={item.key} className="flex gap-2 items-start border border-border rounded-md p-2 bg-card">
                    {/* Part Number with autocomplete */}
                    <div className="relative flex-1 min-w-[140px]">
                      <Input
                        placeholder="Part #"
                        value={item.part_number}
                        onChange={(e) => {
                          updateLineItem(item.key, "part_number", e.target.value)
                          searchParts(item.key, e.target.value)
                        }}
                        onBlur={() => {
                          setTimeout(() => {
                            if (activePartKey === item.key) setActivePartKey(null)
                          }, 200)
                        }}
                        className="bg-transparent border-border text-sm"
                      />
                      {activePartKey === item.key && (partSuggestions[item.key]?.length ?? 0) > 0 && (
                        <div className="absolute z-50 top-full mt-1 w-64 bg-popover border border-border rounded-md shadow-md max-h-48 overflow-y-auto">
                          {partSuggestions[item.key].map((ps, idx) => (
                            <button
                              key={idx}
                              type="button"
                              className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => selectPart(item.key, ps)}
                            >
                              <div className="font-mono">{ps.value}</div>
                              <div className="text-xs text-muted-foreground truncate">{ps.description || ps.label}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Description */}
                    <Input
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) => updateLineItem(item.key, "description", e.target.value)}
                      className="flex-[2] bg-transparent border-border text-sm min-w-[160px]"
                    />

                    {/* Qty */}
                    <Input
                      type="number"
                      placeholder="Qty"
                      min={1}
                      value={item.quantity_ordered}
                      onChange={(e) => updateLineItem(item.key, "quantity_ordered", parseInt(e.target.value) || 1)}
                      className="w-20 bg-transparent border-border text-sm"
                    />

                    {/* Unit Cost */}
                    <Input
                      type="number"
                      placeholder="Cost"
                      min={0}
                      step={0.01}
                      value={item.unit_cost}
                      onChange={(e) => updateLineItem(item.key, "unit_cost", parseFloat(e.target.value) || 0)}
                      className="w-24 bg-transparent border-border text-sm"
                    />

                    {/* Remove */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-9 w-9 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeLineItem(item.key)}
                    >
                      <X size={16} />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" className="bg-transparent" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitPO} disabled={submitting}>
              {submitting && <Loader2 size={16} className="mr-2 animate-spin" />}
              {editingPO ? "Update PO" : "Create PO"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
