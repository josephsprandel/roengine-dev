"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  GripVertical,
  Plus,
  Pencil,
  MoreHorizontal,
  Loader2,
  Upload,
  Search,
  Star,
  StarOff,
  X,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { toast } from "sonner"

interface Vendor {
  id: number
  name: string
  phone: string | null
  account_number: string | null
  is_preferred: boolean
  website: string | null
  email: string | null
  address: string | null
  notes: string | null
  sort_order: number
  is_active: boolean
  created_at: string
}

interface VendorFormData {
  name: string
  phone: string
  account_number: string
  email: string
  website: string
  address: string
  notes: string
  is_preferred: boolean
}

const emptyForm: VendorFormData = {
  name: "",
  phone: "",
  account_number: "",
  email: "",
  website: "",
  address: "",
  notes: "",
  is_preferred: false,
}

interface CsvPreviewRow {
  name: string
  phone?: string
  account_number?: string
  is_preferred: boolean
}

// --- Sortable preferred vendor row ---
function SortableVendorRow({
  vendor,
  onEdit,
  onTogglePreferred,
  onDeactivate,
}: {
  vendor: Vendor
  onEdit: (v: Vendor) => void
  onTogglePreferred: (v: Vendor) => void
  onDeactivate: (v: Vendor) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: vendor.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg group"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
      >
        <GripVertical size={16} />
      </button>

      <div className="flex-1 min-w-0">
        <span className="font-medium text-sm text-foreground">{vendor.name}</span>
        {vendor.account_number && (
          <span className="text-xs text-muted-foreground ml-2">#{vendor.account_number}</span>
        )}
      </div>

      {vendor.phone && (
        <span className="text-xs text-muted-foreground hidden sm:inline">{vendor.phone}</span>
      )}

      <span className="text-xs text-muted-foreground">0 POs</span>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(vendor)}>
          <Pencil size={14} />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <MoreHorizontal size={14} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onTogglePreferred(vendor)}>
              <StarOff size={14} className="mr-2" />
              Move to Other
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDeactivate(vendor)}
              className="text-destructive focus:text-destructive"
            >
              <X size={14} className="mr-2" />
              Deactivate
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

// --- Main component ---
export function VendorsSettings() {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null)
  const [formData, setFormData] = useState<VendorFormData>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Other vendors search/pagination
  const [otherSearch, setOtherSearch] = useState("")
  const [otherPage, setOtherPage] = useState(1)
  const OTHERS_PER_PAGE = 10

  // CSV import
  const [importOpen, setImportOpen] = useState(false)
  const [csvPreview, setCsvPreview] = useState<CsvPreviewRow[] | null>(null)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; updated: number; skipped: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const fetchVendors = useCallback(async () => {
    try {
      const res = await fetch("/api/vendors")
      if (res.ok) {
        const data = await res.json()
        setVendors(data.data || [])
      }
    } catch {
      setError("Failed to load vendors")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchVendors()
  }, [fetchVendors])

  // Derived lists
  const preferredVendors = vendors
    .filter((v) => v.is_preferred)
    .sort((a, b) => a.sort_order - b.sort_order)

  const otherVendorsAll = vendors.filter((v) => !v.is_preferred)
  const otherVendorsFiltered = otherSearch
    ? otherVendorsAll.filter((v) => v.name.toLowerCase().includes(otherSearch.toLowerCase()))
    : otherVendorsAll
  const otherTotalPages = Math.max(1, Math.ceil(otherVendorsFiltered.length / OTHERS_PER_PAGE))
  const otherVendorsPaged = otherVendorsFiltered.slice(
    (otherPage - 1) * OTHERS_PER_PAGE,
    otherPage * OTHERS_PER_PAGE
  )

  // --- Handlers ---

  const handleAdd = () => {
    setEditingVendor(null)
    setFormData(emptyForm)
    setFormOpen(true)
    setError(null)
  }

  const handleEdit = (vendor: Vendor) => {
    setEditingVendor(vendor)
    setFormData({
      name: vendor.name,
      phone: vendor.phone || "",
      account_number: vendor.account_number || "",
      email: vendor.email || "",
      website: vendor.website || "",
      address: vendor.address || "",
      notes: vendor.notes || "",
      is_preferred: vendor.is_preferred,
    })
    setFormOpen(true)
    setError(null)
  }

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError("Vendor name is required")
      return
    }
    setSaving(true)
    setError(null)

    try {
      const url = editingVendor ? `/api/vendors/${editingVendor.id}` : "/api/vendors"
      const method = editingVendor ? "PUT" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || "Failed to save vendor")
        return
      }

      setFormOpen(false)
      fetchVendors()
    } catch {
      setError("Failed to save vendor")
    } finally {
      setSaving(false)
    }
  }

  const handleTogglePreferred = async (vendor: Vendor) => {
    try {
      const res = await fetch(`/api/vendors/${vendor.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_preferred: !vendor.is_preferred }),
      })
      if (res.ok) toast.success('Vendor updated')
      fetchVendors()
    } catch {
      setError("Failed to update vendor")
    }
  }

  const handleDeactivate = async (vendor: Vendor) => {
    if (!window.confirm(`Deactivate "${vendor.name}"? You can reactivate later.`)) return
    try {
      const res = await fetch(`/api/vendors/${vendor.id}`, { method: "DELETE" })
      if (res.ok) toast.success('Vendor updated')
      fetchVendors()
    } catch {
      setError("Failed to deactivate vendor")
    }
  }

  // Drag-and-drop reorder for preferred vendors
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = preferredVendors.findIndex((v) => v.id === active.id)
    const newIndex = preferredVendors.findIndex((v) => v.id === over.id)
    const reordered = arrayMove(preferredVendors, oldIndex, newIndex)

    // Optimistic update
    setVendors((prev) => {
      const others = prev.filter((v) => !v.is_preferred)
      const updated = reordered.map((v, i) => ({ ...v, sort_order: i }))
      return [...updated, ...others]
    })

    // Persist new sort orders
    try {
      await Promise.all(
        reordered.map((v, i) =>
          fetch(`/api/vendors/${v.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sort_order: i }),
          })
        )
      )
    } catch {
      fetchVendors() // rollback on error
    }
  }

  // --- CSV Import ---

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCsvFile(file)
    setImportResult(null)

    // Parse preview
    const text = await file.text()
    const lines = text.split(/\r?\n/).filter((l) => l.trim())
    if (lines.length < 2) {
      setError("CSV must have a header row and at least one data row")
      return
    }

    const headers = parseCsvLine(lines[0]).map(normalizeHeader)
    const nameIdx = headers.indexOf("name")
    if (nameIdx === -1) {
      setError('CSV must have a "name" column')
      return
    }

    const phoneIdx = headers.indexOf("phone")
    const acctIdx = headers.indexOf("account_number")
    const prefIdx = headers.indexOf("is_preferred")

    const preview: CsvPreviewRow[] = []
    for (let i = 1; i < Math.min(lines.length, 51); i++) {
      const vals = parseCsvLine(lines[i])
      const name = vals[nameIdx]?.trim()
      if (!name) continue
      preview.push({
        name,
        phone: phoneIdx >= 0 ? vals[phoneIdx]?.trim() : undefined,
        account_number: acctIdx >= 0 ? vals[acctIdx]?.trim() : undefined,
        is_preferred: prefIdx >= 0 ? parsePreferredValue(vals[prefIdx] || "") : false,
      })
    }

    setCsvPreview(preview)
    setError(null)
  }

  const handleImportConfirm = async () => {
    if (!csvFile) return
    setImporting(true)
    setError(null)

    try {
      const fd = new FormData()
      fd.append("file", csvFile)

      const res = await fetch("/api/vendors/import", { method: "POST", body: fd })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Import failed")
        return
      }

      setImportResult(data.data)
      setCsvPreview(null)
      setCsvFile(null)
      fetchVendors()
    } catch {
      setError("Import failed")
    } finally {
      setImporting(false)
    }
  }

  const handleImportClose = () => {
    setImportOpen(false)
    setCsvPreview(null)
    setCsvFile(null)
    setImportResult(null)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  // --- Loading ---
  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="animate-spin text-muted-foreground" size={24} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Vendors</h2>
          <p className="text-sm text-muted-foreground">
            Manage your parts vendors. Preferred vendors appear first in all dropdowns.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => {
              setImportOpen(true)
              setImportResult(null)
              setCsvPreview(null)
              setError(null)
            }}
          >
            <Upload size={16} />
            Import CSV
          </Button>
          <Button size="sm" className="gap-2" onClick={handleAdd}>
            <Plus size={16} />
            Add Vendor
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
          <AlertTriangle size={16} />
          {error}
          <Button variant="ghost" size="icon" className="h-5 w-5 ml-auto" onClick={() => setError(null)}>
            <X size={12} />
          </Button>
        </div>
      )}

      {/* Preferred Vendors — sortable */}
      <Card className="p-6 border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Star size={18} className="text-yellow-500" />
            <h3 className="text-lg font-semibold text-foreground">Preferred Vendors</h3>
            <Badge variant="secondary" className="text-xs">{preferredVendors.length}</Badge>
          </div>
        </div>

        {preferredVendors.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No preferred vendors yet. Add a vendor and mark it as preferred, or promote one from the list below.
          </p>
        ) : (
          <div className="space-y-2">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={preferredVendors.map((v) => v.id)} strategy={verticalListSortingStrategy}>
                {preferredVendors.map((vendor) => (
                  <SortableVendorRow
                    key={vendor.id}
                    vendor={vendor}
                    onEdit={handleEdit}
                    onTogglePreferred={handleTogglePreferred}
                    onDeactivate={handleDeactivate}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>
        )}
      </Card>

      {/* Other Vendors — searchable table with pagination */}
      <Card className="p-6 border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-foreground">Other Vendors</h3>
            <Badge variant="secondary" className="text-xs">{otherVendorsAll.length}</Badge>
          </div>
          <div className="relative w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search vendors..."
              value={otherSearch}
              onChange={(e) => {
                setOtherSearch(e.target.value)
                setOtherPage(1)
              }}
              className="pl-9 h-8 text-sm"
            />
          </div>
        </div>

        {otherVendorsFiltered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            {otherSearch ? "No vendors match your search." : "No other vendors."}
          </p>
        ) : (
          <>
            <div className="border border-border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Account #</TableHead>
                    <TableHead>Active POs</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {otherVendorsPaged.map((vendor) => (
                    <TableRow key={vendor.id}>
                      <TableCell className="font-medium">{vendor.name}</TableCell>
                      <TableCell className="text-muted-foreground">{vendor.phone || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{vendor.account_number || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">0</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(vendor)}>
                            <Pencil size={14} />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreHorizontal size={14} />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleTogglePreferred(vendor)}>
                                <Star size={14} className="mr-2" />
                                Make Preferred
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDeactivate(vendor)}
                                className="text-destructive focus:text-destructive"
                              >
                                <X size={14} className="mr-2" />
                                Deactivate
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {otherTotalPages > 1 && (
              <div className="flex items-center justify-between mt-3">
                <p className="text-xs text-muted-foreground">
                  Showing {(otherPage - 1) * OTHERS_PER_PAGE + 1}–
                  {Math.min(otherPage * OTHERS_PER_PAGE, otherVendorsFiltered.length)} of{" "}
                  {otherVendorsFiltered.length}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    disabled={otherPage === 1}
                    onClick={() => setOtherPage((p) => p - 1)}
                  >
                    <ChevronLeft size={14} />
                  </Button>
                  <span className="text-xs text-muted-foreground px-2">
                    {otherPage} / {otherTotalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    disabled={otherPage === otherTotalPages}
                    onClick={() => setOtherPage((p) => p + 1)}
                  >
                    <ChevronRight size={14} />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Add/Edit Vendor Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingVendor ? "Edit Vendor" : "Add Vendor"}</DialogTitle>
            <DialogDescription>
              {editingVendor ? "Update vendor information." : "Add a new vendor to your directory."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="vendor-name">Name *</Label>
              <Input
                id="vendor-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Vendor name"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vendor-phone">Phone</Label>
                <Input
                  id="vendor-phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(555) 123-4567"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vendor-acct">Account Number</Label>
                <Input
                  id="vendor-acct"
                  value={formData.account_number}
                  onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                  placeholder="e.g., 150404"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vendor-email">Email</Label>
                <Input
                  id="vendor-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="sales@vendor.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vendor-website">Website</Label>
                <Input
                  id="vendor-website"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  placeholder="https://vendor.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="vendor-address">Address</Label>
              <Input
                id="vendor-address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="123 Main St, City, State"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vendor-notes">Notes</Label>
              <Textarea
                id="vendor-notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Internal notes about this vendor..."
                rows={2}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div>
                <Label htmlFor="vendor-preferred" className="text-sm font-medium">
                  Preferred Vendor
                </Label>
                <p className="text-xs text-muted-foreground">
                  Preferred vendors appear first in all dropdowns
                </p>
              </div>
              <Switch
                id="vendor-preferred"
                checked={formData.is_preferred}
                onCheckedChange={(checked) => setFormData({ ...formData, is_preferred: checked })}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 size={14} className="mr-2 animate-spin" />
                    Saving...
                  </>
                ) : editingVendor ? (
                  "Update"
                ) : (
                  "Add Vendor"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* CSV Import Dialog */}
      <Dialog open={importOpen} onOpenChange={(open) => !open && handleImportClose()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet size={20} />
              Import Vendors from CSV
            </DialogTitle>
            <DialogDescription>
              Upload a CSV file with columns: name, phone, account_number, type (or is_preferred).
              Existing vendors are matched by name and updated. Headers are case-insensitive.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* File picker */}
            {!csvPreview && !importResult && (
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                <Upload size={32} className="mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground mb-3">
                  Choose a CSV file to import
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                  Select CSV File
                </Button>
              </div>
            )}

            {/* Preview */}
            {csvPreview && !importResult && (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-foreground font-medium">
                    Preview ({csvPreview.length} vendor{csvPreview.length !== 1 ? "s" : ""})
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setCsvPreview(null)
                      setCsvFile(null)
                      if (fileInputRef.current) fileInputRef.current.value = ""
                    }}
                  >
                    Choose Different File
                  </Button>
                </div>
                <div className="border border-border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead>Name</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Account #</TableHead>
                        <TableHead>Type</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {csvPreview.map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{row.name}</TableCell>
                          <TableCell className="text-muted-foreground">{row.phone || "—"}</TableCell>
                          <TableCell className="text-muted-foreground">{row.account_number || "—"}</TableCell>
                          <TableCell>
                            {row.is_preferred ? (
                              <Badge className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 text-xs">
                                Preferred
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">Other</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={handleImportClose}>
                    Cancel
                  </Button>
                  <Button onClick={handleImportConfirm} disabled={importing}>
                    {importing ? (
                      <>
                        <Loader2 size={14} className="mr-2 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Upload size={14} className="mr-2" />
                        Import {csvPreview.length} Vendor{csvPreview.length !== 1 ? "s" : ""}
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}

            {/* Import results */}
            {importResult && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <CheckCircle2 size={20} />
                  <span className="font-medium">Import complete</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 bg-muted/30 rounded-lg">
                    <p className="text-2xl font-bold text-foreground">{importResult.imported}</p>
                    <p className="text-xs text-muted-foreground">New vendors</p>
                  </div>
                  <div className="text-center p-3 bg-muted/30 rounded-lg">
                    <p className="text-2xl font-bold text-foreground">{importResult.updated}</p>
                    <p className="text-xs text-muted-foreground">Updated</p>
                  </div>
                  <div className="text-center p-3 bg-muted/30 rounded-lg">
                    <p className="text-2xl font-bold text-foreground">{importResult.skipped}</p>
                    <p className="text-xs text-muted-foreground">Skipped</p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleImportClose}>Done</Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// --- CSV parsing helpers (client-side for preview) ---

function parseCsvLine(line: string): string[] {
  const values: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === "," && !inQuotes) {
      values.push(current.trim())
      current = ""
    } else {
      current += char
    }
  }
  values.push(current.trim())
  return values
}

function normalizeHeader(header: string): string {
  const h = header.toLowerCase().replace(/[^a-z0-9_]/g, "_").trim()
  if (h === "type" || h === "is_preferred" || h === "preferred") return "is_preferred"
  if (h === "account" || h === "account_number" || h === "acct" || h === "acct_number") return "account_number"
  if (h === "phone" || h === "phone_number") return "phone"
  if (h === "name" || h === "vendor" || h === "vendor_name") return "name"
  return h
}

function parsePreferredValue(value: string): boolean {
  const v = value.toLowerCase().trim()
  return v === "true" || v === "1" || v === "yes" || v === "preferred"
}
