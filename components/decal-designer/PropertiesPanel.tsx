"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Printer, Save, Loader2, Grid3X3, AlignLeft, AlignCenter, AlignRight, Eye } from "lucide-react"
import { toast } from "sonner"
import {
  DesignElement,
  FieldData,
  Align,
  FontSize,
  TextStyle,
  FONT_SIZES,
  TEXT_STYLES,
  LABEL_WIDTH,
  LABEL_HEIGHT,
  dotsToMm,
  mmToDots,
  snapToGrid,
} from "./types"

interface PropertiesPanelProps {
  elements: DesignElement[]
  selectedId: string | null
  zpl: string
  fieldData: FieldData
  snapEnabled: boolean
  onToggleSnap: () => void
  onUpdate: (id: string, updates: Partial<DesignElement>) => void
}

// Scale factor: 40mm label → 160px preview (4px per mm, ~1:1 at 96dpi screen)
const PREVIEW_SCALE = 160 / LABEL_WIDTH
const PREVIEW_W = LABEL_WIDTH * PREVIEW_SCALE
const PREVIEW_H = LABEL_HEIGHT * PREVIEW_SCALE

export function PropertiesPanel({ elements, selectedId, zpl, fieldData, snapEnabled, onToggleSnap, onUpdate }: PropertiesPanelProps) {
  const [saving, setSaving] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [showPreview, setShowPreview] = useState(true)
  const selected = selectedId ? elements.find(e => e.id === selectedId) : null

  const fieldMap: Record<string, string> = {
    shopName: fieldData.shopName,
    nextMileage: fieldData.nextMileage,
    nextDate: fieldData.nextDate,
  }

  async function handlePrintTest() {
    setPrinting(true)
    try {
      const res = await fetch("/api/print/zpl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zpl }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success("Test label printed")
      } else {
        toast.error(data.error || "Print failed")
      }
    } catch (err: any) {
      toast.error(err.message || "Could not reach printer")
    } finally {
      setPrinting(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch("/api/settings/decal-layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layout: elements }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success("Layout saved")
      } else {
        toast.error(data.error || "Save failed")
      }
    } catch (err: any) {
      toast.error(err.message || "Could not save layout")
    } finally {
      setSaving(false)
    }
  }

  const align = selected?.align || 'center'

  return (
    <div className="w-80 border-l border-border bg-card flex flex-col overflow-hidden">
      {/* Element properties */}
      <div className="p-4 border-b border-border min-h-0 flex-1 overflow-y-auto">
        <h3 className="text-sm font-medium mb-3">Element Properties</h3>
        {selected ? (
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground font-mono mb-2">
              {selected.id} ({selected.type}{selected.field ? ` → ${selected.field}` : ''})
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">X (mm)</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={dotsToMm(selected.x)}
                  onChange={(e) => onUpdate(selected.id, { x: mmToDots(parseFloat(e.target.value) || 0) })}
                  className="h-8 text-xs bg-background"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Y (mm)</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={dotsToMm(selected.y)}
                  onChange={(e) => onUpdate(selected.id, { y: mmToDots(parseFloat(e.target.value) || 0) })}
                  className="h-8 text-xs bg-background"
                />
              </div>
            </div>

            {/* Text-specific controls */}
            {selected.type === 'text' && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs">Alignment</Label>
                  <div className="flex gap-1">
                    {([['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight]] as const).map(([a, Icon]) => (
                      <Button
                        key={a}
                        variant={align === a ? 'default' : 'outline'}
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onUpdate(selected.id, { align: a as Align })}
                      >
                        <Icon size={14} />
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Font Size</Label>
                  <Select
                    value={String(selected.fontSize)}
                    onValueChange={(v) => onUpdate(selected.id, { fontSize: parseInt(v) as FontSize })}
                  >
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FONT_SIZES.map((s) => (
                        <SelectItem key={s} value={String(s)}>
                          {s} dots (~{Math.round(s * 0.35)}pt)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <Label className="text-xs">Bold</Label>
                  <Switch
                    checked={selected.bold}
                    onCheckedChange={(bold) => onUpdate(selected.id, { bold })}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Style</Label>
                  <Select
                    value={selected.style || 'none'}
                    onValueChange={(v) => onUpdate(selected.id, { style: v as TextStyle })}
                  >
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TEXT_STYLES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Content input — only for static text elements */}
                {!selected.field && (
                  <div className="space-y-1">
                    <Label className="text-xs">Content</Label>
                    <Input
                      value={selected.content}
                      onChange={(e) => onUpdate(selected.id, { content: e.target.value })}
                      className="h-8 text-xs bg-background"
                      placeholder="Label text"
                    />
                  </div>
                )}
              </>
            )}

            {/* Image-specific controls */}
            {selected.type === 'image' && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Width (mm)</Label>
                  <Input
                    type="number"
                    step="1"
                    value={dotsToMm(selected.imageWidth || 80)}
                    onChange={(e) => onUpdate(selected.id, { imageWidth: mmToDots(parseFloat(e.target.value) || 10) })}
                    className="h-8 text-xs bg-background"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Height (mm)</Label>
                  <Input
                    type="number"
                    step="1"
                    value={dotsToMm(selected.imageHeight || 80)}
                    onChange={(e) => onUpdate(selected.id, { imageHeight: mmToDots(parseFloat(e.target.value) || 10) })}
                    className="h-8 text-xs bg-background"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <Label className="text-xs">Visible</Label>
              <Switch
                checked={selected.visible}
                onCheckedChange={(visible) => onUpdate(selected.id, { visible })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-xs flex items-center gap-1.5">
                <Grid3X3 size={12} />
                Snap to Grid
              </Label>
              <Switch
                checked={snapEnabled}
                onCheckedChange={onToggleSnap}
              />
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Select an element on the canvas to edit its properties.</p>
        )}
      </div>

      {/* Print Preview */}
      <div className="p-4 border-b border-border min-h-0 max-h-72 overflow-y-auto">
        <button
          className="flex items-center gap-1.5 text-sm font-medium w-full text-left"
          onClick={() => setShowPreview(!showPreview)}
        >
          <Eye size={14} className="text-muted-foreground" />
          Print Preview
          <span className="text-xs text-muted-foreground ml-auto">{showPreview ? 'hide' : 'show'}</span>
        </button>
        {showPreview && (
          <div className="mt-3 flex justify-center">
            <div
              className="relative bg-white border border-border shadow-sm"
              style={{ width: PREVIEW_W, height: PREVIEW_H, overflow: 'hidden' }}
            >
              {elements.map((el) => {
                if (!el.visible) return null
                const px = el.x * PREVIEW_SCALE
                const py = el.y * PREVIEW_SCALE

                if (el.type === 'rule') {
                  const rw = (LABEL_WIDTH - el.x * 2) * PREVIEW_SCALE
                  return (
                    <div
                      key={el.id}
                      className="absolute"
                      style={{ left: px, top: py, width: rw > 0 ? rw : 120, height: 1, backgroundColor: '#666' }}
                    />
                  )
                }

                if (el.type === 'image') {
                  const iw = (el.imageWidth || 80) * PREVIEW_SCALE
                  const ih = (el.imageHeight || 48) * PREVIEW_SCALE
                  return el.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={el.id}
                      src={el.imageUrl}
                      alt=""
                      className="absolute object-contain"
                      style={{ left: px, top: py, width: iw, height: ih }}
                    />
                  ) : null
                }

                const text = el.field ? (fieldMap[el.field] || '') : el.content
                if (!text) return null
                const fs = (el.fontSize || 36) * PREVIEW_SCALE * 0.75
                const align = el.align || 'center'
                const style = el.style || 'none'
                const isFullWidth = align === 'center' || align === 'right'

                return (
                  <div
                    key={el.id}
                    className="absolute whitespace-nowrap"
                    style={{
                      left: isFullWidth ? 0 : px,
                      top: py,
                      width: isFullWidth ? PREVIEW_W : 'auto',
                      textAlign: align,
                      fontSize: fs,
                      fontWeight: el.bold ? 700 : 400,
                      fontFamily: 'Arial, Helvetica, sans-serif',
                      lineHeight: 1,
                      color: style === 'inverted' ? '#fff' : '#000',
                      backgroundColor: style === 'inverted' ? '#000' : undefined,
                      border: style === 'outline' ? '1px solid #000' : undefined,
                      borderRadius: style !== 'none' ? 2 : undefined,
                      padding: style !== 'none' ? '1px 3px' : undefined,
                    }}
                  >
                    {text}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ZPL Output */}
      <div className="p-4 flex-shrink-0">
        <h3 className="text-sm font-medium mb-2">ZPL Output</h3>
        <textarea
          readOnly
          value={zpl}
          className="h-[60px] w-full rounded-md border border-border bg-muted/50 p-2 font-mono text-xs resize-none focus:outline-none"
        />
        <div className="flex gap-2 mt-3">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-1.5"
            onClick={handlePrintTest}
            disabled={printing}
          >
            {printing ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
            {printing ? "Printing..." : "Print Test"}
          </Button>
          <Button
            size="sm"
            className="flex-1 gap-1.5"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? "Saving..." : "Save Layout"}
          </Button>
        </div>
      </div>
    </div>
  )
}
