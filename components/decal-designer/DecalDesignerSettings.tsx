"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { RotateCcw } from "lucide-react"
import { DesignerCanvas } from "./DesignerCanvas"
import { Toolbar } from "./Toolbar"
import { PropertiesPanel } from "./PropertiesPanel"
import {
  DesignElement,
  FieldData,
  FontSize,
  DEFAULT_ELEMENTS,
  LABEL_WIDTH,
  LABEL_HEIGHT,
  snapToGrid,
} from "./types"
import { generateZPLFromLayout } from "@/lib/print/zpl-templates"
import { convertImageToZPL } from "@/lib/print/image-to-zpl"
import { toast } from "sonner"

export function DecalDesignerSettings() {
  const [elements, setElements] = useState<DesignElement[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [snapEnabled, setSnapEnabled] = useState(true)

  const previewData: FieldData = useMemo(() => ({
    shopName: "AutoHouse NWA",
    nextMileage: "130,000",
    nextDate: "10/09/2026",
    logoUrl: logoUrl || undefined,
  }), [logoUrl])

  useEffect(() => {
    // Fetch saved layout and shop info in parallel
    Promise.all([
      fetch("/api/settings/decal-layout").then(r => r.ok ? r.json() : null).catch(() => null),
      fetch("/api/decals/oil-change").then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([layoutData, shopData]) => {
      if (layoutData?.layout && Array.isArray(layoutData.layout) && layoutData.layout.length > 0) {
        setElements(layoutData.layout)
      } else {
        setElements(DEFAULT_ELEMENTS.map(e => ({ ...e })))
      }
      if (shopData?.logo_url) {
        setLogoUrl(shopData.logo_url)
      }
      setLoaded(true)
    })
  }, [])

  const handleMove = useCallback((id: string, x: number, y: number) => {
    setElements(prev => prev.map(el => el.id === id ? { ...el, x, y } : el))
  }, [])

  const handleUpdate = useCallback((id: string, updates: Partial<DesignElement>) => {
    setElements(prev => prev.map(el => el.id === id ? { ...el, ...updates } : el))
  }, [])

  const handleAddText = useCallback(() => {
    const id = `text-${Date.now()}`
    const newEl: DesignElement = {
      id,
      type: 'text',
      content: 'New Text',
      x: snapToGrid(Math.round(LABEL_WIDTH / 2) - 40),
      y: snapToGrid(Math.round(LABEL_HEIGHT / 2)),
      fontSize: 36,
      bold: false,
      visible: true,
      align: 'center',
    }
    setElements(prev => [...prev, newEl])
    setSelectedId(id)
  }, [])

  const handleAddLogo = useCallback(async () => {
    if (!logoUrl) return
    const id = 'shop-logo'
    const imgW = 80  // dots (~10mm)
    const imgH = 48  // dots (~6mm)

    // Pre-convert logo to ZPL graphic data
    let zplGraphicData: string | undefined
    try {
      zplGraphicData = await convertImageToZPL(logoUrl, imgW, imgH)
    } catch {
      toast.error("Could not convert logo image — it will show on canvas but won't print")
    }

    const newEl: DesignElement = {
      id,
      type: 'image',
      content: '',
      x: snapToGrid(Math.round((LABEL_WIDTH - imgW) / 2)),
      y: 8,
      fontSize: 24,
      bold: false,
      visible: true,
      align: 'left',
      imageUrl: logoUrl,
      imageWidth: imgW,
      imageHeight: imgH,
      zplGraphicData,
    }
    setElements(prev => [...prev, newEl])
    setSelectedId(id)
  }, [logoUrl])

  const handleResize = useCallback(async (id: string, width: number, height: number) => {
    setElements(prev => prev.map(el => el.id === id ? { ...el, imageWidth: width, imageHeight: height } : el))
    // Regenerate ZPL graphic data for the new dimensions
    const el = elements.find(e => e.id === id)
    if (el?.imageUrl) {
      try {
        const zplGraphicData = await convertImageToZPL(el.imageUrl, width, height)
        setElements(prev => prev.map(e => e.id === id ? { ...e, zplGraphicData } : e))
      } catch {
        // Keep old graphic data if conversion fails
      }
    }
  }, [elements])

  const handleDelete = useCallback((id: string) => {
    setElements(prev => prev.filter(el => el.id !== id))
    if (selectedId === id) setSelectedId(null)
  }, [selectedId])

  const handleToggleVisibility = useCallback((id: string) => {
    setElements(prev => prev.map(el => el.id === id ? { ...el, visible: !el.visible } : el))
  }, [])

  const handleChangeFontSize = useCallback((id: string, size: FontSize) => {
    setElements(prev => prev.map(el => el.id === id ? { ...el, fontSize: size } : el))
  }, [])

  const handleReset = useCallback(() => {
    setElements(DEFAULT_ELEMENTS.map(e => ({ ...e })))
    setSelectedId(null)
  }, [])

  const zpl = useMemo(() => {
    if (elements.length === 0) return ''
    return generateZPLFromLayout(elements, previewData)
  }, [elements, previewData])

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        Loading designer...
      </div>
    )
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 130px)', minHeight: 600 }}>
      {/* Sub-header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Oil Change Decal Designer</h3>
          <p className="text-xs text-muted-foreground">40mm × 58mm — 203 DPI — Godex RT200i</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleReset}>
          <RotateCcw size={14} />
          Reset to Default
        </Button>
      </div>

      {/* Toolbar */}
      <Toolbar
        elements={elements}
        selectedId={selectedId}
        logoUrl={logoUrl}
        onSelect={setSelectedId}
        onAddText={handleAddText}
        onAddLogo={handleAddLogo}
        onDelete={handleDelete}
        onToggleVisibility={handleToggleVisibility}
        onChangeFontSize={handleChangeFontSize}
      />

      {/* Canvas + Properties */}
      <div className="flex flex-1 min-h-0 overflow-hidden rounded-lg border border-border mt-1">
        <DesignerCanvas
          elements={elements}
          selectedId={selectedId}
          fieldData={previewData}
          snapEnabled={snapEnabled}
          onSelect={setSelectedId}
          onMove={handleMove}
          onResize={handleResize}
        />
        <PropertiesPanel
          elements={elements}
          selectedId={selectedId}
          zpl={zpl}
          fieldData={previewData}
          snapEnabled={snapEnabled}
          onToggleSnap={() => setSnapEnabled(prev => !prev)}
          onUpdate={handleUpdate}
        />
      </div>
    </div>
  )
}
