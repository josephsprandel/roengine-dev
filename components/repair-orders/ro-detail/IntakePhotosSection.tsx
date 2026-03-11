"use client"

import { useState, useEffect } from "react"
import { Camera } from "lucide-react"
import { PhotoLightbox } from "./PhotoLightbox"

interface IntakeImage {
  id: number
  file_path: string
  photo_type: string
  created_at: string
}

const PHOTO_TYPE_LABELS: Record<string, string> = {
  door_jamb: "Door Jamb",
  odometer: "Odometer",
  license_plate: "License Plate",
  paint: "Paint",
  exterior: "Exterior",
  damage: "Damage",
  tire_fl: "Tire FL",
  tire_fr: "Tire FR",
  tire_rl: "Tire RL",
  tire_rr: "Tire RR",
  unknown: "Photo",
}

interface IntakePhotosSectionProps {
  workOrderId: number
}

export function IntakePhotosSection({ workOrderId }: IntakePhotosSectionProps) {
  const [images, setImages] = useState<IntakeImage[]>([])
  const [lightbox, setLightbox] = useState<{ photos: { src: string; itemName: string }[]; index: number } | null>(null)

  useEffect(() => {
    async function fetchImages() {
      try {
        const res = await fetch(`/api/intake-images?work_order_id=${workOrderId}`)
        if (!res.ok) return
        const data = await res.json()
        setImages(data.images || [])
      } catch {
        // Silent fail — section just won't render
      }
    }
    fetchImages()
  }, [workOrderId])

  // Empty state: render nothing
  if (images.length === 0) return null

  const lightboxPhotos = images.map((img) => ({
    src: img.file_path,
    itemName: PHOTO_TYPE_LABELS[img.photo_type] || img.photo_type,
  }))

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Camera className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium text-muted-foreground">
          Intake Photos ({images.length})
        </h3>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {images.map((img, i) => (
          <button
            key={img.id}
            onClick={() => setLightbox({ photos: lightboxPhotos, index: i })}
            className="relative w-28 h-16 rounded-lg overflow-hidden border border-border hover:border-primary/50 hover:ring-2 hover:ring-primary/20 transition-all flex-shrink-0 group"
          >
            <img
              src={img.file_path}
              alt={PHOTO_TYPE_LABELS[img.photo_type] || img.photo_type}
              className="w-full h-full object-cover"
            />
            <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] text-center py-0.5 truncate px-0.5">
              {PHOTO_TYPE_LABELS[img.photo_type] || img.photo_type}
            </span>
          </button>
        ))}
      </div>

      {lightbox && (
        <PhotoLightbox
          photos={lightbox.photos}
          initialIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  )
}
