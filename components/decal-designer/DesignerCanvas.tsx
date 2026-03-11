"use client"

import { useRef, useCallback } from "react"
import {
  DesignElement,
  FieldData,
  LABEL_WIDTH,
  LABEL_HEIGHT,
  GRID_SIZE,
  DISPLAY_SCALE,
  snapToGrid,
} from "./types"

interface DesignerCanvasProps {
  elements: DesignElement[]
  selectedId: string | null
  fieldData: FieldData
  snapEnabled?: boolean
  onSelect: (id: string | null) => void
  onMove: (id: string, x: number, y: number) => void
  onResize?: (id: string, width: number, height: number) => void
}

const DISPLAY_W = LABEL_WIDTH * DISPLAY_SCALE
const DISPLAY_H = LABEL_HEIGHT * DISPLAY_SCALE
const RESIZE_HANDLE_SIZE = 10

function dotsToPx(dots: number): number {
  return dots * DISPLAY_SCALE
}

function pxToDots(px: number): number {
  return px / DISPLAY_SCALE
}

function fontDotsToCss(zplDots: number): number {
  return zplDots * DISPLAY_SCALE * 0.75
}

export function DesignerCanvas({ elements, selectedId, fieldData, snapEnabled = true, onSelect, onMove, onResize }: DesignerCanvasProps) {
  const snapRef = useRef(snapEnabled)
  snapRef.current = snapEnabled
  const canvasRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null)

  const handleMouseDown = useCallback((e: React.MouseEvent, el: DesignElement) => {
    e.stopPropagation()
    e.preventDefault()
    onSelect(el.id)

    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return

    const elPxX = dotsToPx(el.x)
    const elPxY = dotsToPx(el.y)
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    dragRef.current = {
      id: el.id,
      offsetX: mouseX - elPxX,
      offsetY: mouseY - elPxY,
    }

    const handleMouseMove = (ev: MouseEvent) => {
      if (!dragRef.current || !canvasRef.current) return
      const r = canvasRef.current.getBoundingClientRect()
      const rawX = pxToDots(ev.clientX - r.left - dragRef.current.offsetX)
      const rawY = pxToDots(ev.clientY - r.top - dragRef.current.offsetY)

      const clampedX = Math.max(0, Math.min(rawX, LABEL_WIDTH - 16))
      const clampedY = Math.max(0, Math.min(rawY, LABEL_HEIGHT - 16))
      const finalX = snapRef.current ? snapToGrid(clampedX) : Math.round(clampedX)
      const finalY = snapRef.current ? snapToGrid(clampedY) : Math.round(clampedY)

      onMove(dragRef.current.id, finalX, finalY)
    }

    const handleMouseUp = () => {
      dragRef.current = null
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }

    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
  }, [onSelect, onMove])

  const handleResizeMouseDown = useCallback((e: React.MouseEvent, el: DesignElement) => {
    e.stopPropagation()
    e.preventDefault()
    if (!onResize) return

    const startX = e.clientX
    const startY = e.clientY
    const startW = el.imageWidth || 80
    const startH = el.imageHeight || 48
    const aspect = startW / startH

    const handleMouseMove = (ev: MouseEvent) => {
      const dx = pxToDots(ev.clientX - startX)
      const dy = pxToDots(ev.clientY - startY)
      // Use whichever axis moved more, maintain aspect ratio
      const delta = Math.abs(dx) > Math.abs(dy) ? dx : dy
      const rawW = Math.max(16, Math.round(startW + delta))
      const newW = snapRef.current ? snapToGrid(rawW) : rawW
      const newH = Math.max(16, Math.round(newW / aspect))
      onResize(el.id, newW, newH)
    }

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }

    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
  }, [onResize])

  const handleCanvasClick = useCallback(() => {
    onSelect(null)
  }, [onSelect])

  // Build grid lines
  const gridLines: React.ReactNode[] = []
  for (let x = 0; x <= LABEL_WIDTH; x += GRID_SIZE) {
    gridLines.push(
      <div
        key={`vl-${x}`}
        className="absolute top-0 bottom-0 border-l border-muted-foreground/10"
        style={{ left: dotsToPx(x) }}
      />
    )
  }
  for (let y = 0; y <= LABEL_HEIGHT; y += GRID_SIZE) {
    gridLines.push(
      <div
        key={`hl-${y}`}
        className="absolute left-0 right-0 border-t border-muted-foreground/10"
        style={{ top: dotsToPx(y) }}
      />
    )
  }

  const fieldMap: Record<string, string> = {
    shopName: fieldData.shopName,
    nextMileage: fieldData.nextMileage,
    nextDate: fieldData.nextDate,
  }

  return (
    <div className="flex items-start justify-center p-6 bg-muted/30 overflow-auto min-h-0 flex-1">
      <div
        ref={canvasRef}
        className="relative bg-white border border-border shadow-md select-none"
        style={{ width: DISPLAY_W, height: DISPLAY_H, flexShrink: 0 }}
        onClick={handleCanvasClick}
      >
        {/* Grid overlay */}
        {gridLines}

        {/* Elements */}
        {elements.map((el) => {
          if (!el.visible) return null
          const isSelected = el.id === selectedId
          const px = dotsToPx(el.x)
          const py = dotsToPx(el.y)
          const ring = isSelected ? 'ring-2 ring-blue-500 ring-offset-1' : ''

          // --- Rule ---
          if (el.type === 'rule') {
            const ruleWidthDots = LABEL_WIDTH - el.x * 2
            const ruleW = dotsToPx(ruleWidthDots > 0 ? ruleWidthDots : 240)
            return (
              <div
                key={el.id}
                className={`absolute cursor-move ${ring}`}
                style={{ left: px, top: py, width: ruleW, height: dotsToPx(4) }}
                onClick={(e) => { e.stopPropagation(); onSelect(el.id) }}
                onMouseDown={(e) => handleMouseDown(e, el)}
              >
                <div className="w-full h-[2px] bg-gray-400 mt-[2px]" />
              </div>
            )
          }

          // --- Image ---
          if (el.type === 'image') {
            const iw = dotsToPx(el.imageWidth || 80)
            const ih = dotsToPx(el.imageHeight || 80)
            return (
              <div
                key={el.id}
                className={`absolute cursor-move ${ring} rounded-sm`}
                style={{ left: px, top: py, width: iw, height: ih }}
                onClick={(e) => { e.stopPropagation(); onSelect(el.id) }}
                onMouseDown={(e) => handleMouseDown(e, el)}
              >
                {el.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={el.imageUrl}
                    alt="Logo"
                    className="w-full h-full object-contain"
                    draggable={false}
                  />
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center text-xs text-muted-foreground">
                    Logo
                  </div>
                )}
                {/* Resize handle */}
                {isSelected && (
                  <div
                    className="absolute bg-blue-500 border border-white cursor-se-resize"
                    style={{
                      width: RESIZE_HANDLE_SIZE,
                      height: RESIZE_HANDLE_SIZE,
                      right: -RESIZE_HANDLE_SIZE / 2,
                      bottom: -RESIZE_HANDLE_SIZE / 2,
                      borderRadius: 2,
                    }}
                    onMouseDown={(e) => handleResizeMouseDown(e, el)}
                  />
                )}
              </div>
            )
          }

          // --- Text ---
          const displayText = el.field ? (fieldMap[el.field] || `{{${el.field}}}`) : el.content
          const cssFontSize = fontDotsToCss(el.fontSize)
          const align = el.align || 'center'
          const style = el.style || 'none'

          // Center/right: full-width positioned at x=0, text-align controls alignment
          // Left: positioned at el.x, auto width
          const isFullWidth = align === 'center' || align === 'right'

          const textStyle: React.CSSProperties = {
            left: isFullWidth ? 0 : px,
            top: py,
            width: isFullWidth ? DISPLAY_W : 'auto',
            textAlign: align,
            fontSize: cssFontSize,
            fontWeight: el.bold ? 700 : 400,
            fontFamily: 'Arial, Helvetica, sans-serif',
            lineHeight: 1,
            color: style === 'inverted' ? '#fff' : '#111',
            backgroundColor: style === 'inverted' ? '#111' : undefined,
            border: style === 'outline' ? '2px solid #111' : undefined,
            borderRadius: style !== 'none' ? 4 : undefined,
            padding: style !== 'none' ? '4px 8px' : undefined,
          }

          return (
            <div
              key={el.id}
              className={`absolute cursor-move whitespace-nowrap ${ring} rounded-sm`}
              style={textStyle}
              onClick={(e) => { e.stopPropagation(); onSelect(el.id) }}
              onMouseDown={(e) => handleMouseDown(e, el)}
            >
              {displayText}
            </div>
          )
        })}
      </div>
    </div>
  )
}
