"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { X, ChevronLeft, ChevronRight } from "lucide-react"

interface PhotoLightboxProps {
  photos: { src: string; itemName: string }[]
  initialIndex: number
  onClose: () => void
}

export function PhotoLightbox({ photos, initialIndex, onClose }: PhotoLightboxProps) {
  const [index, setIndex] = useState(initialIndex)
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)
  const photo = photos[index]

  const goPrev = useCallback(() => setIndex((i) => (i > 0 ? i - 1 : photos.length - 1)), [photos.length])
  const goNext = useCallback(() => setIndex((i) => (i < photos.length - 1 ? i + 1 : 0)), [photos.length])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      else if (e.key === "ArrowLeft") goPrev()
      else if (e.key === "ArrowRight") goNext()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onClose, goPrev, goNext])

  // Lock body scroll when open
  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = ""
    }
  }, [])

  // Touch handlers for swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return
    const deltaX = e.changedTouches[0].clientX - touchStartX.current
    const deltaY = e.changedTouches[0].clientY - touchStartY.current

    // Only trigger if horizontal swipe is dominant and exceeds threshold
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      if (deltaX > 0) goPrev()
      else goNext()
    }
    touchStartX.current = null
    touchStartY.current = null
  }

  return (
    <div
      className="fixed inset-0 z-[80] bg-black/90 flex flex-col items-center justify-center"
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 h-14 z-10">
        <span className="text-white/80 text-sm font-medium truncate max-w-[60%]">{photo.itemName}</span>
        <div className="flex items-center gap-3">
          <span className="text-white/60 text-xs">
            {index + 1} / {photos.length}
          </span>
          <button onClick={onClose} className="p-2 text-white/80 hover:text-white">
            <X size={22} />
          </button>
        </div>
      </div>

      {/* Image */}
      <img
        src={photo.src}
        alt={photo.itemName}
        className="max-w-[90vw] max-h-[80vh] object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
        draggable={false}
      />

      {/* Navigation arrows */}
      {photos.length > 1 && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation()
              goPrev()
            }}
            className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white/80 hover:text-white hover:bg-black/70"
          >
            <ChevronLeft size={28} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              goNext()
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white/80 hover:text-white hover:bg-black/70"
          >
            <ChevronRight size={28} />
          </button>
        </>
      )}
    </div>
  )
}
