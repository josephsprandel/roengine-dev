"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Printer, Monitor, X, Loader2 } from "lucide-react"
import { formatPhoneNumber } from "@/lib/utils/phone-format"
import { generateOilChangeZPL, generateZPLFromLayout } from "@/lib/print/zpl-templates"
import { toast } from "sonner"

interface Preset {
  id: number
  label: string
  miles: number
  months: number
  is_default: boolean
}

interface OilChangeDecalModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentMileage: number | null
  roId: number
}

function formatMileage(n: number): string {
  return n.toLocaleString("en-US")
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

function formatDate(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const yyyy = date.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

export function OilChangeDecalModal({ open, onOpenChange, currentMileage, roId }: OilChangeDecalModalProps) {
  const [presets, setPresets] = useState<Preset[]>([])
  const [selectedPresetId, setSelectedPresetId] = useState<string>("")
  const [mileage, setMileage] = useState("")
  const [nextMileage, setNextMileage] = useState("")
  const [nextDate, setNextDate] = useState("")
  const [shopName, setShopName] = useState("")
  const [shopPhone, setShopPhone] = useState("")
  const [shopWebsite, setShopWebsite] = useState("")
  const [logoUrl, setLogoUrl] = useState("")
  const [loaded, setLoaded] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [zplFailed, setZplFailed] = useState(false)
  const [savedLayout, setSavedLayout] = useState<any[] | null>(null)

  useEffect(() => {
    if (!open) return
    setLoaded(false)
    setZplFailed(false)
    // Fetch saved decal layout (fire-and-forget on error)
    fetch("/api/settings/decal-layout")
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.layout && Array.isArray(data.layout) && data.layout.length > 0) {
          setSavedLayout(data.layout)
        } else {
          setSavedLayout(null)
        }
      })
      .catch(() => setSavedLayout(null))
    fetch("/api/decals/oil-change")
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data) {
          setShopName(data.shop_name || "")
          setShopPhone(formatPhoneNumber(data.phone || ""))
          setShopWebsite(data.website || "")
          setLogoUrl(data.logo_url || "")

          const fetchedPresets: Preset[] = data.presets || []
          setPresets(fetchedPresets)

          const current = currentMileage || 0
          setMileage(current ? formatMileage(current) : "")

          // Apply the default preset
          const defaultPreset = fetchedPresets.find(p => p.is_default) || fetchedPresets[0]
          if (defaultPreset) {
            setSelectedPresetId(String(defaultPreset.id))
            applyPreset(defaultPreset, current)
          } else {
            // Fallback if no presets exist
            setNextMileage(current ? formatMileage(current + 5000) : formatMileage(5000))
            setNextDate(formatDate(addMonths(new Date(), 6)))
          }
        }
        setLoaded(true)
      })
      .catch(() => {
        const current = currentMileage || 0
        setMileage(current ? formatMileage(current) : "")
        setNextMileage(current ? formatMileage(current + 5000) : "5,000")
        setNextDate(formatDate(addMonths(new Date(), 6)))
        setLoaded(true)
      })
  }, [open, currentMileage])

  function applyPreset(preset: Preset, current?: number) {
    const mi = current ?? currentMileage ?? 0
    setNextMileage(mi ? formatMileage(mi + preset.miles) : formatMileage(preset.miles))
    setNextDate(formatDate(addMonths(new Date(), preset.months)))
  }

  function handlePresetChange(presetId: string) {
    setSelectedPresetId(presetId)
    const preset = presets.find(p => String(p.id) === presetId)
    if (preset) applyPreset(preset)
  }

  async function handlePrint() {
    setPrinting(true)

    // Log the print (fire-and-forget)
    fetch("/api/decals/oil-change", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        current_mileage: mileage,
        next_mileage: nextMileage,
        next_date: nextDate,
        ro_id: roId,
      }),
    }).catch(() => {})

    // Generate ZPL — use saved designer layout if available, else default template
    const fieldData = { shopName, nextMileage, nextDate }
    const zpl = savedLayout
      ? generateZPLFromLayout(savedLayout, fieldData)
      : generateOilChangeZPL(fieldData)

    try {
      const res = await fetch("/api/print/zpl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zpl }),
      })
      const data = await res.json()

      if (res.ok && data.success) {
        toast.success("Decal printed")
        onOpenChange(false)
      } else {
        toast.error(data.error || "Print failed")
        setZplFailed(true)
      }
    } catch (err: any) {
      toast.error(err.message || "Could not reach print server")
      setZplFailed(true)
    } finally {
      setPrinting(false)
    }
  }

  function handleBrowserFallback() {
    const params = new URLSearchParams({
      shop: shopName,
      phone: shopPhone,
      website: shopWebsite,
      date: nextDate,
      mileage: nextMileage,
    })
    if (logoUrl) params.set("logo", logoUrl)
    const printWindow = window.open(
      `/decals/oil-change/print?${params}`,
      "oil-change-decal",
      "width=250,height=250,menubar=no,toolbar=no,status=no"
    )
    if (printWindow) printWindow.focus()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer size={18} />
            Print Oil Change Decal?
          </DialogTitle>
          <DialogDescription>
            Select an oil type and review the values for the windshield decal.
          </DialogDescription>
        </DialogHeader>

        {loaded && (
          <div className="space-y-4 py-2">
            {presets.length > 1 && (
              <div className="space-y-1.5">
                <Label className="text-sm">Oil Type</Label>
                <Select value={selectedPresetId} onValueChange={handlePresetChange}>
                  <SelectTrigger className="bg-card border-border">
                    <SelectValue placeholder="Select preset" />
                  </SelectTrigger>
                  <SelectContent>
                    {presets.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.label} ({formatMileage(p.miles)} mi / {p.months} mo)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-sm">Current Mileage</Label>
              <Input
                value={mileage}
                onChange={(e) => setMileage(e.target.value)}
                placeholder="125,000"
                className="bg-card border-border"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Next Due Mileage</Label>
              <Input
                value={nextMileage}
                onChange={(e) => setNextMileage(e.target.value)}
                placeholder="130,000"
                className="bg-card border-border"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Next Due Date</Label>
              <Input
                value={nextDate}
                onChange={(e) => setNextDate(e.target.value)}
                placeholder="September 2026"
                className="bg-card border-border"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" className="bg-transparent gap-1.5" onClick={() => onOpenChange(false)}>
            <X size={14} />
            Skip
          </Button>
          {zplFailed && (
            <Button variant="outline" className="gap-1.5" onClick={handleBrowserFallback}>
              <Monitor size={14} />
              Print via Browser
            </Button>
          )}
          <Button className="gap-1.5" onClick={handlePrint} disabled={!loaded || printing}>
            {printing ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
            {printing ? "Printing..." : "Print Decal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
