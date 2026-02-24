'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Circle, ArrowRight, Undo2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PhotoAnnotationOverlayProps {
  photoUrl: string
  onSave: (annotatedBlob: Blob) => void
  onCancel: () => void
}

type Tool = 'circle' | 'arrow'

interface Stroke {
  type: Tool
  startX: number
  startY: number
  endX: number
  endY: number
}

export function PhotoAnnotationOverlay({ photoUrl, onSave, onCancel }: PhotoAnnotationOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [tool, setTool] = useState<Tool>('circle')
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null)
  const [imageLoaded, setImageLoaded] = useState(false)
  const imgRef = useRef<HTMLImageElement | null>(null)

  const COLOR = '#ef4444'
  // Scale stroke width relative to image size so it looks consistent on any resolution
  const getLineWidth = () => {
    const img = imgRef.current
    if (!img) return 6
    const shorter = Math.min(img.width, img.height)
    return Math.max(4, Math.round(shorter * 0.032))
  }
  const getHeadLen = () => {
    const img = imgRef.current
    if (!img) return 30
    const shorter = Math.min(img.width, img.height)
    return Math.max(15, Math.round(shorter * 0.08))
  }

  // Load the background image
  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      imgRef.current = img
      setImageLoaded(true)
    }
    img.src = photoUrl
  }, [photoUrl])

  // Redraw canvas whenever strokes or current stroke changes
  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size to match image
    canvas.width = img.width
    canvas.height = img.height

    // Draw background image
    ctx.drawImage(img, 0, 0)

    // Draw all saved strokes
    ctx.strokeStyle = COLOR
    ctx.lineWidth = getLineWidth()
    ctx.lineCap = 'round'

    for (const stroke of strokes) {
      drawStroke(ctx, stroke)
    }

    // Draw current in-progress stroke
    if (currentStroke) {
      drawStroke(ctx, currentStroke)
    }
  }, [strokes, currentStroke])

  useEffect(() => {
    if (imageLoaded) redraw()
  }, [imageLoaded, redraw])

  function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
    const lineWidth = getLineWidth()
    ctx.strokeStyle = COLOR
    ctx.lineWidth = lineWidth
    ctx.lineCap = 'round'

    if (stroke.type === 'circle') {
      const dx = stroke.endX - stroke.startX
      const dy = stroke.endY - stroke.startY
      const radius = Math.sqrt(dx * dx + dy * dy)
      ctx.beginPath()
      ctx.arc(stroke.startX, stroke.startY, radius, 0, Math.PI * 2)
      ctx.stroke()
    } else if (stroke.type === 'arrow') {
      const dx = stroke.endX - stroke.startX
      const dy = stroke.endY - stroke.startY
      const angle = Math.atan2(dy, dx)
      const headLen = getHeadLen()

      // Line
      ctx.beginPath()
      ctx.moveTo(stroke.startX, stroke.startY)
      ctx.lineTo(stroke.endX, stroke.endY)
      ctx.stroke()

      // Arrowhead
      ctx.beginPath()
      ctx.moveTo(stroke.endX, stroke.endY)
      ctx.lineTo(
        stroke.endX - headLen * Math.cos(angle - Math.PI / 6),
        stroke.endY - headLen * Math.sin(angle - Math.PI / 6)
      )
      ctx.moveTo(stroke.endX, stroke.endY)
      ctx.lineTo(
        stroke.endX - headLen * Math.cos(angle + Math.PI / 6),
        stroke.endY - headLen * Math.sin(angle + Math.PI / 6)
      )
      ctx.stroke()
    }
  }

  // Convert touch/mouse coordinates to canvas coordinates
  function getCanvasCoords(
    e: TouchEvent | MouseEvent | React.MouseEvent
  ): { x: number; y: number } | null {
    const canvas = canvasRef.current
    if (!canvas) return null

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    let clientX: number, clientY: number
    if ('touches' in e) {
      if (e.touches.length === 0) return null
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
    } else {
      clientX = e.clientX
      clientY = e.clientY
    }

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    }
  }

  // Refs to hold latest values for native event listeners
  const toolRef = useRef(tool)
  toolRef.current = tool
  const currentStrokeRef = useRef(currentStroke)
  currentStrokeRef.current = currentStroke

  // Attach native touch listeners with { passive: false } to allow preventDefault
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault()
      const coords = getCanvasCoords(e)
      if (!coords) return
      const stroke: Stroke = {
        type: toolRef.current,
        startX: coords.x,
        startY: coords.y,
        endX: coords.x,
        endY: coords.y,
      }
      setCurrentStroke(stroke)
      currentStrokeRef.current = stroke
    }

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      const cs = currentStrokeRef.current
      if (!cs) return
      const coords = getCanvasCoords(e)
      if (!coords) return
      const updated = { ...cs, endX: coords.x, endY: coords.y }
      setCurrentStroke(updated)
      currentStrokeRef.current = updated
    }

    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault()
      const cs = currentStrokeRef.current
      if (cs) {
        setStrokes((prev) => [...prev, cs])
        setCurrentStroke(null)
        currentStrokeRef.current = null
      }
    }

    canvas.addEventListener('touchstart', onTouchStart, { passive: false })
    canvas.addEventListener('touchmove', onTouchMove, { passive: false })
    canvas.addEventListener('touchend', onTouchEnd, { passive: false })

    return () => {
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchmove', onTouchMove)
      canvas.removeEventListener('touchend', onTouchEnd)
    }
  }, [imageLoaded])

  // Mouse handlers (React synthetic events are fine for mouse)
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    const coords = getCanvasCoords(e)
    if (!coords) return
    setCurrentStroke({
      type: tool,
      startX: coords.x,
      startY: coords.y,
      endX: coords.x,
      endY: coords.y,
    })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!currentStroke) return
    const coords = getCanvasCoords(e)
    if (!coords) return
    setCurrentStroke({ ...currentStroke, endX: coords.x, endY: coords.y })
  }

  const handleMouseUp = (e: React.MouseEvent) => {
    if (currentStroke) {
      setStrokes((prev) => [...prev, currentStroke])
      setCurrentStroke(null)
    }
  }

  const handleUndo = () => {
    setStrokes((prev) => prev.slice(0, -1))
  }

  const handleSave = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.toBlob(
      (blob) => {
        if (blob) onSave(blob)
      },
      'image/jpeg',
      0.85
    )
  }

  return (
    <div className="fixed inset-0 z-[70] bg-black flex flex-col">
      {/* Top toolbar */}
      <div className="flex items-center justify-between px-4 h-14 bg-slate-900 text-white flex-shrink-0">
        <button onClick={onCancel} className="p-2">
          <X size={22} />
        </button>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setTool('circle')}
            className={`p-2.5 rounded-lg transition-colors ${
              tool === 'circle' ? 'bg-red-500/30 text-red-400' : 'text-white/60'
            }`}
          >
            <Circle size={22} />
          </button>
          <button
            onClick={() => setTool('arrow')}
            className={`p-2.5 rounded-lg transition-colors ${
              tool === 'arrow' ? 'bg-red-500/30 text-red-400' : 'text-white/60'
            }`}
          >
            <ArrowRight size={22} />
          </button>
          <button
            onClick={handleUndo}
            disabled={strokes.length === 0}
            className="p-2.5 rounded-lg text-white/60 disabled:opacity-30"
          >
            <Undo2 size={22} />
          </button>
        </div>

        <button
          onClick={handleSave}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary rounded-lg text-sm font-medium"
        >
          <Check size={16} />
          Save
        </button>
      </div>

      {/* Canvas area */}
      <div className="flex-1 flex items-center justify-center overflow-hidden">
        <canvas
          ref={canvasRef}
          className="max-w-full max-h-full"
          style={{ touchAction: 'none' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        />
      </div>
    </div>
  )
}
