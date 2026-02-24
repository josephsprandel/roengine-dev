'use client'

import { useRef, useState } from 'react'
import { Camera, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PhotoCaptureProps {
  photos: string[]
  maxPhotos?: number
  inspectionResultId: number
  onPhotoAdded: (photos: string[]) => void
  onPhotoRemoved: (photos: string[]) => void
  onPhotoTap: (index: number) => void
}

/**
 * Client-side image compression using canvas
 */
async function compressImage(file: File, maxWidth = 1200, quality = 0.7): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      let { width, height } = img
      if (width > maxWidth) {
        height = (height * maxWidth) / width
        width = maxWidth
      }
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas context not available'))
        return
      }
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob)
          else reject(new Error('Failed to compress image'))
        },
        'image/jpeg',
        quality
      )
    }
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = URL.createObjectURL(file)
  })
}

export function PhotoCapture({
  photos,
  maxPhotos = 5,
  inspectionResultId,
  onPhotoAdded,
  onPhotoRemoved,
  onPhotoTap,
}: PhotoCaptureProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      // Compress client-side
      const compressed = await compressImage(file)

      // Upload via FormData
      const formData = new FormData()
      formData.append('photo', compressed, `photo-${Date.now()}.jpg`)

      const token = localStorage.getItem('auth_token')
      const res = await fetch(`/api/tech/inspection/${inspectionResultId}/photo`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })

      if (res.ok) {
        const data = await res.json()
        onPhotoAdded(data.photos)
      } else {
        const err = await res.json()
        console.error('Upload failed:', err.error)
      }
    } catch (err) {
      console.error('Error uploading photo:', err)
    } finally {
      setUploading(false)
      // Reset input so same file can be selected again
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDelete = async (index: number) => {
    setDeleting(index)
    try {
      const token = localStorage.getItem('auth_token')
      const res = await fetch(`/api/tech/inspection/${inspectionResultId}/photo/${index}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })

      if (res.ok) {
        const data = await res.json()
        onPhotoRemoved(data.photos)
      }
    } catch (err) {
      console.error('Error deleting photo:', err)
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCapture}
        className="hidden"
      />

      {/* Photo thumbnails + add button */}
      <div className="flex items-center gap-3 overflow-x-auto pb-2">
        {photos.map((photoPath, index) => (
          <div
            key={`${photoPath}-${index}`}
            className="relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border border-border bg-muted"
          >
            <button
              onClick={() => onPhotoTap(index)}
              className="w-full h-full"
            >
              <img
                src={photoPath}
                alt={`Photo ${index + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleDelete(index)
              }}
              disabled={deleting === index}
              className="absolute top-0.5 right-0.5 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80"
            >
              {deleting === index ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <X size={12} />
              )}
            </button>
          </div>
        ))}

        {photos.length < maxPhotos && (
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex-shrink-0 w-20 h-20 rounded-lg border-dashed border-2 flex flex-col items-center justify-center gap-1"
          >
            {uploading ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <>
                <Camera size={20} />
                <span className="text-[10px]">Add</span>
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}
