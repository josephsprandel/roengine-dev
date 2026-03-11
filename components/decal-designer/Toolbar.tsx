"use client"

import { Button } from "@/components/ui/button"
import { Plus, Trash2, Eye, EyeOff, ChevronUp, ChevronDown, ImageIcon, Layers } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { DesignElement, FONT_SIZES, FontSize } from "./types"

interface ToolbarProps {
  elements: DesignElement[]
  selectedId: string | null
  logoUrl: string | null
  onSelect: (id: string) => void
  onAddText: () => void
  onAddLogo: () => void
  onDelete: (id: string) => void
  onToggleVisibility: (id: string) => void
  onChangeFontSize: (id: string, size: FontSize) => void
}

function elementLabel(el: DesignElement): string {
  if (el.type === 'rule') return 'Rule'
  if (el.type === 'image') return 'Logo'
  if (el.field) return el.field === 'shopName' ? 'Shop Name' : el.field === 'nextMileage' ? 'Mileage' : 'Date'
  return el.content || 'Text'
}

export function Toolbar({
  elements,
  selectedId,
  logoUrl,
  onSelect,
  onAddText,
  onAddLogo,
  onDelete,
  onToggleVisibility,
  onChangeFontSize,
}: ToolbarProps) {
  const selected = selectedId ? elements.find(e => e.id === selectedId) : null
  const currentSizeIdx = selected ? FONT_SIZES.indexOf(selected.fontSize as FontSize) : -1
  const hasLogo = elements.some(e => e.type === 'image')

  function handleFontUp() {
    if (!selected || currentSizeIdx < 0) return
    const nextIdx = Math.min(currentSizeIdx + 1, FONT_SIZES.length - 1)
    onChangeFontSize(selected.id, FONT_SIZES[nextIdx])
  }

  function handleFontDown() {
    if (!selected || currentSizeIdx < 0) return
    const nextIdx = Math.max(currentSizeIdx - 1, 0)
    onChangeFontSize(selected.id, FONT_SIZES[nextIdx])
  }

  return (
    <div className="flex items-center gap-2 p-3 border-b border-border bg-card">
      {/* Element list popover */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Layers size={14} />
            Elements
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-52 p-1" align="start">
          {elements.map((el) => (
            <button
              key={el.id}
              className={`flex items-center gap-2 w-full rounded px-2 py-1.5 text-xs text-left hover:bg-muted ${
                el.id === selectedId ? 'bg-muted font-medium' : ''
              }`}
              onClick={() => onSelect(el.id)}
            >
              <button
                className="p-0.5 rounded hover:bg-muted-foreground/20"
                onClick={(e) => { e.stopPropagation(); onToggleVisibility(el.id) }}
                title={el.visible ? 'Hide' : 'Show'}
              >
                {el.visible ? <Eye size={12} className="text-muted-foreground" /> : <EyeOff size={12} className="text-muted-foreground/50" />}
              </button>
              <span className={el.visible ? '' : 'text-muted-foreground/50 line-through'}>
                {elementLabel(el)}
              </span>
            </button>
          ))}
        </PopoverContent>
      </Popover>

      <Button variant="outline" size="sm" className="gap-1.5" onClick={onAddText}>
        <Plus size={14} />
        Add Text
      </Button>

      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={onAddLogo}
        disabled={!logoUrl || hasLogo}
        title={!logoUrl ? 'No shop logo configured' : hasLogo ? 'Logo already added' : 'Add shop logo'}
      >
        <ImageIcon size={14} />
        Add Logo
      </Button>

      <div className="w-px h-6 bg-border" />

      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        disabled={!selected}
        onClick={() => selected && onToggleVisibility(selected.id)}
      >
        {selected?.visible === false ? <EyeOff size={14} /> : <Eye size={14} />}
        {selected?.visible === false ? 'Show' : 'Hide'}
      </Button>

      <Button
        variant="outline"
        size="sm"
        disabled={!selected}
        onClick={() => selected && onDelete(selected.id)}
        className="gap-1.5 text-destructive hover:text-destructive"
      >
        <Trash2 size={14} />
        Delete
      </Button>

      <div className="w-px h-6 bg-border" />

      <span className="text-xs text-muted-foreground">Font:</span>
      <Button variant="outline" size="icon" className="h-7 w-7" disabled={!selected || selected?.type !== 'text' || currentSizeIdx <= 0} onClick={handleFontDown}>
        <ChevronDown size={14} />
      </Button>
      <span className="text-xs font-mono w-6 text-center">{selected?.type === 'text' ? selected.fontSize : '–'}</span>
      <Button variant="outline" size="icon" className="h-7 w-7" disabled={!selected || selected?.type !== 'text' || currentSizeIdx >= FONT_SIZES.length - 1} onClick={handleFontUp}>
        <ChevronUp size={14} />
      </Button>
    </div>
  )
}
