"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Loader2, Search, Package, CheckCircle2, ScanLine, Upload, AlertTriangle, FileText } from "lucide-react"
import { toast } from "sonner"

// --- Types ---

interface PurchaseOrderSummary {
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

interface PODetail extends PurchaseOrderSummary {
  items: POItem[]
}

interface ExtractedLineItem {
  part_number: string
  description: string
  quantity: number
  unit_cost: number
  extended_cost: number
  is_core: boolean
}

interface ExtractedInvoice {
  vendor_name: string
  invoice_number: string
  invoice_date: string
  po_number: string | null
  vehicle_vin: string | null
  is_credit: boolean
  line_items: ExtractedLineItem[]
  shipping: number
  invoice_total: number
  notes: string | null
}

interface ScanResult {
  extracted: ExtractedInvoice
  matched_po_id: number | null
  matched_po: PODetail | null
  prior_receipt: boolean
  open_pos: { id: number; po_number: string; vendor_name: string; status: string }[]
}

export interface ReceivingTabProps {
  preloadPoId?: number | null
  onPreloadHandled?: () => void
}

// --- Part number matching ---

const normalize = (s: string) => s.replace(/[\s\-\.]/g, "").toUpperCase()

type MatchLevel = "exact" | "fuzzy" | "none"

/**
 * Match an extracted part number against PO items.
 * Returns the match level and the matched PO item (if any).
 *
 * 1. Exact: normalized strings are identical
 * 2. Fuzzy (suffix): one normalized string ends with the other
 *    (handles vendor brand prefixes like "MOO K7465" → "K7465")
 * 3. None: no match
 */
function matchPartNumber(
  extPartNumber: string,
  poItems: POItem[]
): { level: MatchLevel; poItem: POItem | null } {
  const extNorm = normalize(extPartNumber)
  if (!extNorm) return { level: "none", poItem: null }

  // Pass 1: exact
  for (const poItem of poItems) {
    if (normalize(poItem.part_number) === extNorm) {
      return { level: "exact", poItem }
    }
  }

  // Pass 2: suffix/contains — one ends with the other
  for (const poItem of poItems) {
    const poNorm = normalize(poItem.part_number)
    if (
      poNorm.length >= 3 &&
      extNorm.length >= 3 &&
      (extNorm.endsWith(poNorm) || poNorm.endsWith(extNorm))
    ) {
      return { level: "fuzzy", poItem }
    }
  }

  return { level: "none", poItem: null }
}

/**
 * Compute match status for every extracted line item against the matched PO.
 * Core charges are always marked "none" (they don't map to receivable items).
 */
function computeLineMatchStatus(
  extractedItems: ExtractedLineItem[],
  poItems: POItem[]
): { level: MatchLevel; poItem: POItem | null }[] {
  return extractedItems.map((ext) => {
    if (ext.is_core) return { level: "none" as MatchLevel, poItem: null }
    return matchPartNumber(ext.part_number, poItems)
  })
}

// --- Helpers ---

function statusBadge(status: PurchaseOrderSummary["status"]) {
  switch (status) {
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
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "-"
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value)
}

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  }
}

// --- Component ---

export function ReceivingTab({ preloadPoId, onPreloadHandled }: ReceivingTabProps) {
  // Open POs list
  const [openPOs, setOpenPOs] = useState<PurchaseOrderSummary[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [poSearch, setPoSearch] = useState("")

  // Selected PO detail
  const [selectedPO, setSelectedPO] = useState<PODetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Receiving inputs: keyed by item id
  const [receiveQuantities, setReceiveQuantities] = useState<Record<number, number>>({})
  const [receiving, setReceiving] = useState(false)

  // Track if preload has been handled
  const [preloadHandled, setPreloadHandled] = useState(false)

  // Scan invoice state
  const [scanOpen, setScanOpen] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [manualPoId, setManualPoId] = useState<number | null>(null)
  const [manualPoLoading, setManualPoLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Editable extracted fields (for OCR corrections)
  const [editVendor, setEditVendor] = useState("")
  const [editInvoiceNum, setEditInvoiceNum] = useState("")
  const [editInvoiceDate, setEditInvoiceDate] = useState("")
  const [editPoNumber, setEditPoNumber] = useState("")

  // --- Load open POs ---

  const loadOpenPOs = useCallback(async () => {
    try {
      setListLoading(true)
      const res = await fetch("/api/purchase-orders?limit=100", { headers: authHeaders() })
      if (!res.ok) throw new Error("Failed to load purchase orders")
      const data = await res.json()
      const allPOs: PurchaseOrderSummary[] = data.data || []
      const filtered = allPOs.filter(
        (po) => po.status === "ordered" || po.status === "partially_received"
      )
      setOpenPOs(filtered)
    } catch (err) {
      console.error(err)
      toast.error("Failed to load open purchase orders")
    } finally {
      setListLoading(false)
    }
  }, [])

  useEffect(() => {
    loadOpenPOs()
  }, [loadOpenPOs])

  // --- Preload PO ---

  useEffect(() => {
    if (preloadPoId && !preloadHandled) {
      setPreloadHandled(true)
      loadPODetail(preloadPoId)
      onPreloadHandled?.()
    }
  }, [preloadPoId, preloadHandled, onPreloadHandled]) // eslint-disable-line react-hooks/exhaustive-deps

  // --- Load PO detail ---

  async function loadPODetail(poId: number) {
    setDetailLoading(true)
    setSelectedPO(null)
    setReceiveQuantities({})
    try {
      const res = await fetch(`/api/purchase-orders/${poId}`, { headers: authHeaders() })
      if (!res.ok) throw new Error("Failed to load PO details")
      const data = await res.json()
      const po: PODetail = data.data
      setSelectedPO(po)
      // Initialize receive quantities to 0
      const initial: Record<number, number> = {}
      for (const item of po.items) {
        initial[item.id] = 0
      }
      setReceiveQuantities(initial)
    } catch (err) {
      console.error(err)
      toast.error("Failed to load purchase order details")
    } finally {
      setDetailLoading(false)
    }
  }

  // --- Receive ---

  async function handleReceive() {
    if (!selectedPO) return

    const itemsToReceive = selectedPO.items
      .filter((item) => (receiveQuantities[item.id] || 0) > 0)
      .map((item) => ({
        id: item.id,
        quantity_received: receiveQuantities[item.id],
      }))

    if (itemsToReceive.length === 0) {
      toast.error("Enter quantities to receive for at least one item")
      return
    }

    setReceiving(true)
    try {
      const res = await fetch(`/api/purchase-orders/${selectedPO.id}/receive`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ items: itemsToReceive }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed to receive parts")
      }

      const result = await res.json()
      const updatedPO: PODetail | undefined = result.data

      toast.success("Parts received — inventory updated")

      // Refresh the open POs list
      await loadOpenPOs()

      // If the PO is now fully received, clear selection and show message
      if (updatedPO && updatedPO.status === "received") {
        setSelectedPO(null)
        setReceiveQuantities({})
        toast.success("Purchase order fully received")
      } else {
        // Reload the PO detail to reflect new quantities
        await loadPODetail(selectedPO.id)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to receive parts")
    } finally {
      setReceiving(false)
    }
  }

  // --- Scan Invoice ---

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Reset previous results
    setScanResult(null)
    setManualPoId(null)
    setScanning(true)

    try {
      // Convert file to base64
      const buffer = await file.arrayBuffer()
      const base64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
      )

      const res = await fetch("/api/purchase-orders/scan-invoice", {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          file_data: base64,
          mime_type: file.type,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Scan failed")
      }

      const data: ScanResult = await res.json()
      setScanResult(data)

      // Populate editable fields
      setEditVendor(data.extracted.vendor_name || "")
      setEditInvoiceNum(data.extracted.invoice_number || "")
      setEditInvoiceDate(data.extracted.invoice_date || "")
      setEditPoNumber(data.extracted.po_number || "")

      if (data.matched_po) {
        toast.success(`Matched to ${data.matched_po.po_number}`)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to scan invoice")
    } finally {
      setScanning(false)
      // Reset file input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  // Load a manually-selected PO for the scan result
  async function loadManualPO(poId: number) {
    setManualPoLoading(true)
    try {
      const res = await fetch(`/api/purchase-orders/${poId}`, { headers: authHeaders() })
      if (!res.ok) throw new Error("Failed to load PO")
      const data = await res.json()
      const po: PODetail = data.data
      setScanResult((prev) =>
        prev ? { ...prev, matched_po: po, matched_po_id: po.id } : prev
      )
      setManualPoId(poId)
    } catch (err) {
      toast.error("Failed to load selected PO")
    } finally {
      setManualPoLoading(false)
    }
  }

  // Apply scanned data to the receiving form
  function applyToReceiving() {
    if (!scanResult?.matched_po) return

    const po = scanResult.matched_po
    const extractedItems = scanResult.extracted.line_items
    const matchStatuses = computeLineMatchStatus(extractedItems, po.items)

    // Load the PO into the right panel
    setSelectedPO(po)

    // Build quantities from matched extracted items
    const quantities: Record<number, number> = {}
    // Initialize all to 0
    for (const poItem of po.items) {
      quantities[poItem.id] = 0
    }

    // For each extracted item that matched, set quantity on the matched PO item
    const matchedPoItemIds = new Set<number>()
    for (let i = 0; i < extractedItems.length; i++) {
      const ext = extractedItems[i]
      const status = matchStatuses[i]
      if (ext.is_core || status.level === "none" || !status.poItem) continue

      const poItem = status.poItem
      if (matchedPoItemIds.has(poItem.id)) continue // already matched by a prior line
      matchedPoItemIds.add(poItem.id)

      const remaining = poItem.quantity_ordered - poItem.quantity_received
      if (remaining > 0) {
        quantities[poItem.id] = Math.min(ext.quantity, remaining)
      }
    }

    setReceiveQuantities(quantities)

    // Collect unmatched non-core invoice lines
    const unmatched = extractedItems.filter(
      (ext, i) => !ext.is_core && matchStatuses[i].level === "none"
    )

    // Close the dialog
    setScanOpen(false)
    setScanResult(null)

    const matchedCount = Object.values(quantities).filter((q) => q > 0).length
    if (matchedCount > 0) {
      toast.success(`Pre-filled ${matchedCount} item${matchedCount > 1 ? "s" : ""} from invoice`)
    }

    if (unmatched.length > 0) {
      const lines = unmatched
        .map((u) => `${u.part_number} — ${u.description}`)
        .join("\n")
      toast.warning(
        `${unmatched.length} invoice line${unmatched.length > 1 ? "s" : ""} did not match any PO item:\n${lines}`,
        { duration: 10000 }
      )
    } else if (matchedCount === 0) {
      toast.info("No part numbers matched — review the PO manually")
    }
  }

  function closeScanDialog() {
    setScanOpen(false)
    setScanResult(null)
    setManualPoId(null)
    setScanning(false)
  }

  // --- Filtered PO list ---

  const filteredPOs = poSearch
    ? openPOs.filter(
        (po) =>
          po.po_number.toLowerCase().includes(poSearch.toLowerCase()) ||
          po.vendor_name.toLowerCase().includes(poSearch.toLowerCase())
      )
    : openPOs

  // Check if any receive quantity is > 0
  const hasReceiveQuantity = selectedPO
    ? selectedPO.items.some((item) => (receiveQuantities[item.id] || 0) > 0)
    : false

  // --- Render ---

  return (
    <div className="space-y-4">
      {/* Scan Invoice Button */}
      <div className="flex justify-end">
        <Button variant="outline" onClick={() => setScanOpen(true)} className="gap-2">
          <ScanLine size={16} />
          Scan Invoice
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Open POs List */}
        <div className="lg:col-span-1 space-y-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search PO number..."
              value={poSearch}
              onChange={(e) => setPoSearch(e.target.value)}
              className="pl-9 bg-card border-border"
            />
          </div>

          {listLoading ? (
            <div className="flex items-center justify-center py-12 border border-border rounded-lg">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filteredPOs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 border border-border rounded-lg">
              <Package size={32} className="text-muted-foreground mb-2" />
              <p className="text-muted-foreground text-sm">No open purchase orders</p>
            </div>
          ) : (
            <div className="border border-border rounded-lg divide-y divide-border max-h-[600px] overflow-y-auto">
              {filteredPOs.map((po) => (
                <button
                  key={po.id}
                  type="button"
                  className={`w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors ${
                    selectedPO?.id === po.id ? "bg-accent/70" : ""
                  }`}
                  onClick={() => loadPODetail(po.id)}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-medium text-foreground">{po.po_number}</span>
                    {statusBadge(po.status)}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">{po.vendor_name}</div>
                  <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
                    <span>{po.item_count} items</span>
                    <span>{formatCurrency(po.total_cost)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Receiving Form */}
        <div className="lg:col-span-2">
          {detailLoading ? (
            <div className="flex items-center justify-center py-12 border border-border rounded-lg">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : !selectedPO ? (
            <div className="flex flex-col items-center justify-center py-16 border border-border rounded-lg">
              <Package size={48} className="text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Select a purchase order to receive parts</p>
            </div>
          ) : (
            <div className="border border-border rounded-lg">
              {/* PO Header */}
              <div className="px-4 py-3 border-b border-border bg-card rounded-t-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-mono text-lg font-semibold text-foreground">{selectedPO.po_number}</h3>
                    <p className="text-sm text-muted-foreground">{selectedPO.vendor_name}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {statusBadge(selectedPO.status)}
                    <span className="text-xs text-muted-foreground">
                      Ordered {formatDate(selectedPO.ordered_date || selectedPO.created_at)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Line Items */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Part #</th>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Description</th>
                      <th className="px-4 py-2.5 text-center font-medium text-muted-foreground">Ordered</th>
                      <th className="px-4 py-2.5 text-center font-medium text-muted-foreground">Received</th>
                      <th className="px-4 py-2.5 text-center font-medium text-muted-foreground">Remaining</th>
                      <th className="px-4 py-2.5 text-center font-medium text-muted-foreground">Receive Now</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPO.items.map((item) => {
                      const remaining = item.quantity_ordered - item.quantity_received
                      const isFullyReceived = remaining <= 0

                      return (
                        <tr
                          key={item.id}
                          className={`border-b border-border last:border-0 ${
                            isFullyReceived ? "opacity-40" : ""
                          }`}
                        >
                          <td className="px-4 py-2.5 font-mono text-foreground">{item.part_number}</td>
                          <td className="px-4 py-2.5 text-foreground">
                            {item.description}
                            {item.brand && (
                              <span className="text-xs text-muted-foreground ml-1">({item.brand})</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-center text-foreground">{item.quantity_ordered}</td>
                          <td className="px-4 py-2.5 text-center text-foreground">
                            {item.quantity_received}
                            {isFullyReceived && (
                              <CheckCircle2 size={14} className="inline ml-1 text-green-500" />
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-center text-foreground">
                            {remaining > 0 ? remaining : 0}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            {isFullyReceived ? (
                              <span className="text-xs text-muted-foreground">Done</span>
                            ) : (
                              <Input
                                type="number"
                                min={0}
                                max={remaining}
                                value={receiveQuantities[item.id] ?? 0}
                                onChange={(e) => {
                                  const val = Math.min(
                                    Math.max(0, parseInt(e.target.value) || 0),
                                    remaining
                                  )
                                  setReceiveQuantities((prev) => ({ ...prev, [item.id]: val }))
                                }}
                                className="w-20 mx-auto bg-transparent border-border text-sm text-center"
                              />
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Receive Button */}
              <div className="px-4 py-3 border-t border-border bg-card rounded-b-lg flex justify-end">
                <Button
                  onClick={handleReceive}
                  disabled={!hasReceiveQuantity || receiving}
                >
                  {receiving && <Loader2 size={16} className="mr-2 animate-spin" />}
                  Receive Selected
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Scan Invoice Dialog */}
      <Dialog open={scanOpen} onOpenChange={(open) => { if (!open) closeScanDialog() }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScanLine size={20} />
              Scan Vendor Invoice
            </DialogTitle>
            <DialogDescription>
              Upload a vendor invoice photo or PDF. AI will extract parts and match them to an open PO.
            </DialogDescription>
          </DialogHeader>

          {/* File Upload */}
          {!scanResult && !scanning && (
            <div className="space-y-4">
              <div
                className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={32} className="mx-auto text-muted-foreground mb-3" />
                <p className="text-sm font-medium text-foreground">Click to upload invoice</p>
                <p className="text-xs text-muted-foreground mt-1">
                  PDF, JPEG, PNG, or HEIC
                </p>
                <p className="text-xs text-muted-foreground/60 mt-2">
                  For best results, upload a single-page invoice PDF or photo
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>
          )}

          {/* Scanning State */}
          {scanning && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 size={32} className="animate-spin text-primary mb-4" />
              <p className="text-sm font-medium text-foreground">Reading invoice...</p>
              <p className="text-xs text-muted-foreground mt-1">This usually takes 5-10 seconds</p>
            </div>
          )}

          {/* Scan Results */}
          {scanResult && !scanning && (
            <div className="space-y-4">
              {/* Credit/Return Warning */}
              {scanResult.extracted.is_credit && (
                <div className="space-y-2">
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                    <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-red-700 dark:text-red-400">
                        Credit / Return Invoice — receiving is not applicable
                      </p>
                      <p className="text-xs text-red-600 dark:text-red-400/80 mt-0.5">
                        This invoice represents a return or credit. Record it as a return against the PO instead of receiving parts.
                      </p>
                    </div>
                  </div>
                  {scanResult.prior_receipt && scanResult.matched_po && (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50 border border-border">
                      <FileText size={14} className="text-muted-foreground shrink-0" />
                      <p className="text-xs text-muted-foreground">
                        Parts were previously received on{" "}
                        <span className="font-mono font-medium text-foreground">{scanResult.matched_po.po_number}</span>
                        {" "}— this credit likely reverses that receipt.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Extracted Header Fields (editable) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Vendor</Label>
                  <Input
                    value={editVendor}
                    onChange={(e) => setEditVendor(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Invoice #</Label>
                  <Input
                    value={editInvoiceNum}
                    onChange={(e) => setEditInvoiceNum(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Invoice Date</Label>
                  <Input
                    value={editInvoiceDate}
                    onChange={(e) => setEditInvoiceDate(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">PO Number</Label>
                  <Input
                    value={editPoNumber}
                    onChange={(e) => setEditPoNumber(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              </div>

              {/* VIN if extracted */}
              {scanResult.extracted.vehicle_vin && (
                <div className="text-xs text-muted-foreground">
                  VIN detected: <span className="font-mono">{scanResult.extracted.vehicle_vin}</span>
                </div>
              )}

              {/* PO Match Status */}
              <div className="flex items-center gap-2">
                {scanResult.matched_po ? (
                  <>
                    <Badge className="bg-green-500/10 text-green-600 border-green-500/30 dark:text-green-400">
                      <CheckCircle2 size={12} className="mr-1" />
                      Matched
                    </Badge>
                    <span className="text-sm font-medium font-mono">{scanResult.matched_po.po_number}</span>
                    <span className="text-sm text-muted-foreground">— {scanResult.matched_po.vendor_name}</span>
                  </>
                ) : (
                  <>
                    <Badge variant="outline" className="text-amber-600 border-amber-400 dark:text-amber-400">
                      <AlertTriangle size={12} className="mr-1" />
                      No Match
                    </Badge>
                    {scanResult.open_pos.length > 0 ? (
                      <select
                        className="text-sm border border-border rounded-md px-2 py-1 bg-background text-foreground"
                        value={manualPoId || ""}
                        onChange={(e) => {
                          const id = parseInt(e.target.value)
                          if (id) loadManualPO(id)
                        }}
                      >
                        <option value="">Select a PO...</option>
                        {scanResult.open_pos.map((po) => (
                          <option key={po.id} value={po.id}>
                            {po.po_number} — {po.vendor_name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-sm text-muted-foreground">No open POs available</span>
                    )}
                    {manualPoLoading && <Loader2 size={14} className="animate-spin" />}
                  </>
                )}
              </div>

              {/* Extracted Line Items */}
              {(() => {
                // Compute match statuses when a PO is matched
                const lineMatchStatuses = scanResult.matched_po
                  ? computeLineMatchStatus(scanResult.extracted.line_items, scanResult.matched_po.items)
                  : null

                const exactCount = lineMatchStatuses
                  ? lineMatchStatuses.filter((s) => s.level === "exact").length
                  : 0
                const fuzzyCount = lineMatchStatuses
                  ? lineMatchStatuses.filter((s) => s.level === "fuzzy").length
                  : 0
                const unmatchedCount = lineMatchStatuses
                  ? lineMatchStatuses.filter((s, i) => s.level === "none" && !scanResult.extracted.line_items[i].is_core).length
                  : 0

                return (
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="px-3 py-2 bg-muted/30 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText size={14} className="text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">
                      {scanResult.extracted.line_items.length} line items extracted
                    </span>
                  </div>
                  {lineMatchStatuses && (
                    <div className="flex items-center gap-2 text-xs">
                      {exactCount > 0 && (
                        <span className="text-green-600 dark:text-green-400">{exactCount} exact</span>
                      )}
                      {fuzzyCount > 0 && (
                        <span className="text-yellow-600 dark:text-yellow-400">{fuzzyCount} fuzzy</span>
                      )}
                      {unmatchedCount > 0 && (
                        <span className="text-red-600 dark:text-red-400">{unmatchedCount} unmatched</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/20">
                        {lineMatchStatuses && (
                          <th className="px-2 py-1.5 text-center font-medium text-muted-foreground w-8">Match</th>
                        )}
                        <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Part #</th>
                        <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Description</th>
                        <th className="px-3 py-1.5 text-center font-medium text-muted-foreground">Qty</th>
                        <th className="px-3 py-1.5 text-right font-medium text-muted-foreground">Unit</th>
                        <th className="px-3 py-1.5 text-right font-medium text-muted-foreground">Ext</th>
                        <th className="px-3 py-1.5 text-center font-medium text-muted-foreground">Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scanResult.extracted.line_items.map((item, i) => {
                        const matchStatus = lineMatchStatuses?.[i]
                        return (
                        <tr key={i} className="border-b border-border last:border-0">
                          {lineMatchStatuses && (
                            <td className="px-2 py-1.5 text-center">
                              {item.is_core ? (
                                <span className="text-muted-foreground" title="Core charge">-</span>
                              ) : matchStatus?.level === "exact" ? (
                                <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500" title={`Exact match: ${matchStatus.poItem?.part_number}`} />
                              ) : matchStatus?.level === "fuzzy" ? (
                                <span className="inline-block w-2.5 h-2.5 rounded-full bg-yellow-500" title={`Fuzzy match: ${matchStatus.poItem?.part_number}`} />
                              ) : (
                                <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500" title="No match in PO" />
                              )}
                            </td>
                          )}
                          <td className="px-3 py-1.5 font-mono">{item.part_number}</td>
                          <td className="px-3 py-1.5 max-w-[200px] truncate">{item.description}</td>
                          <td className="px-3 py-1.5 text-center">{item.quantity}</td>
                          <td className="px-3 py-1.5 text-right">{formatCurrency(item.unit_cost)}</td>
                          <td className="px-3 py-1.5 text-right">{formatCurrency(item.extended_cost)}</td>
                          <td className="px-3 py-1.5 text-center">
                            {item.is_core ? (
                              <Badge variant="outline" className="text-xs px-1.5 py-0">Core</Badge>
                            ) : (
                              <span className="text-muted-foreground">Part</span>
                            )}
                          </td>
                        </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      {scanResult.extracted.shipping > 0 && (
                        <tr className="border-t border-border">
                          <td colSpan={lineMatchStatuses ? 5 : 4} className="px-3 py-1.5 text-right text-muted-foreground">Shipping</td>
                          <td className="px-3 py-1.5 text-right">{formatCurrency(scanResult.extracted.shipping)}</td>
                          <td />
                        </tr>
                      )}
                      <tr className="border-t border-border bg-muted/20">
                        <td colSpan={lineMatchStatuses ? 5 : 4} className="px-3 py-1.5 text-right font-medium">Invoice Total</td>
                        <td className="px-3 py-1.5 text-right font-medium">{formatCurrency(scanResult.extracted.invoice_total)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
                )
              })()}

              {/* Notes */}
              {scanResult.extracted.notes && (
                <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
                  <span className="font-medium">Notes:</span> {scanResult.extracted.notes}
                </div>
              )}

              {/* Actions */}
              <DialogFooter>
                <Button variant="outline" onClick={closeScanDialog}>
                  {scanResult.extracted.is_credit ? "Close" : "Cancel"}
                </Button>
                {!scanResult.extracted.is_credit && (
                  <Button
                    onClick={applyToReceiving}
                    disabled={!scanResult.matched_po}
                  >
                    <CheckCircle2 size={16} className="mr-2" />
                    Apply to Receiving
                  </Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
