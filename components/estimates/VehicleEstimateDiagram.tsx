'use client'

import { useState } from 'react'
import Image from 'next/image'
import type { Hotspot } from '@/lib/generate-hotspots'
import { ZoneServicesModal } from './ZoneServicesModal'

interface VehicleEstimateDiagramProps {
  vehicleImagePath: string
  hotspots: Hotspot[]
  onServiceToggle: (serviceId: number) => void
  selectedServiceIds?: Set<number>
}

const hotspotColors = {
  critical: {
    bg: 'bg-red-500',
    border: 'border-red-500',
    fillBg: 'bg-red-500/15',
    text: 'text-red-600',
    ring: 'ring-red-500/30',
    shadow: 'shadow-red-500/25',
    pulse: 'animate-hotspot-pulse-red',
    label: 'Needs Attention',
  },
  recommended: {
    bg: 'bg-amber-500',
    border: 'border-amber-500',
    fillBg: 'bg-amber-500/15',
    text: 'text-amber-600',
    ring: 'ring-amber-500/30',
    shadow: 'shadow-amber-500/25',
    pulse: '',
    label: 'Recommended',
  },
  coming_soon: {
    bg: 'bg-emerald-500',
    border: 'border-emerald-500',
    fillBg: 'bg-emerald-500/15',
    text: 'text-emerald-600',
    ring: 'ring-emerald-500/30',
    shadow: 'shadow-emerald-500/25',
    pulse: '',
    label: 'Coming Soon',
  },
} as const

function HotspotBubble({
  hotspot,
  onClick,
}: {
  hotspot: Hotspot
  onClick: () => void
}) {
  const config = hotspotColors[hotspot.urgency]
  const isCritical = hotspot.urgency === 'critical'

  const displaySize = Math.max(hotspot.size_px || 40, 40)

  return (
    <button
      onClick={onClick}
      aria-label={`${hotspot.zone_label}: ${hotspot.count} service${hotspot.count !== 1 ? 's' : ''} - ${config.label}`}
      className="absolute group"
      style={{
        top: `${hotspot.top_percent}%`,
        left: `${hotspot.left_percent}%`,
        transform: 'translate(-50%, -50%)',
        width: `${displaySize}px`,
        height: `${displaySize}px`,
        zIndex: isCritical ? 20 : 10,
      }}
    >
      {/* Pulse ring for critical zones */}
      {isCritical && (
        <span
          className={`absolute inset-[-4px] rounded-full border-2 ${config.border} opacity-60 ${config.pulse}`}
        />
      )}

      {/* Ring bubble — colored border with transparent fill */}
      <span
        className={`absolute inset-0 rounded-full 
          border-[3px] ${config.border} ${config.fillBg}
          shadow-md ${config.shadow}
          flex items-center justify-center
          transition-all duration-200
          group-hover:scale-110 group-hover:shadow-lg group-active:scale-95`}
      >
        {/* Service count — black text with white halo for readability */}
        <span
          className="font-bold text-xl text-gray-900 leading-none"
          style={{
            textShadow: `-1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff, 0 -1px 0 #fff, 0 1px 0 #fff, -1px 0 0 #fff, 1px 0 0 #fff, 0 0 2px rgba(255,255,255,0.8)`,
          }}
        >
          {hotspot.count}
        </span>
      </span>

      {/* Zone label tooltip — visible on hover (desktop) */}
      <span
        className="absolute left-1/2 -translate-x-1/2 -top-2 -translate-y-full
          opacity-0 group-hover:opacity-100 transition-opacity duration-200
          pointer-events-none whitespace-nowrap
          px-2.5 py-1.5 rounded-lg text-xs font-semibold
          bg-foreground text-background shadow-lg
          hidden sm:block"
      >
        {hotspot.zone_label}
        <span className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-[5px] border-x-transparent border-t-[5px] border-t-foreground" />
      </span>
    </button>
  )
}

function HotspotLegend() {
  return (
    <div className="flex items-center justify-center gap-4 sm:gap-6 py-3 px-4">
      {[
        { color: 'bg-red-500', label: 'Critical' },
        { color: 'bg-amber-500', label: 'Recommended' },
        { color: 'bg-emerald-500', label: 'Coming Soon' },
      ].map(item => (
        <div key={item.label} className="flex items-center gap-1.5">
          <span className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
          <span className="text-xs text-muted-foreground font-medium">
            {item.label}
          </span>
        </div>
      ))}
    </div>
  )
}

export function VehicleEstimateDiagram({
  vehicleImagePath,
  hotspots,
  onServiceToggle,
  selectedServiceIds = new Set(),
}: VehicleEstimateDiagramProps) {
  const [activeZone, setActiveZone] = useState<Hotspot | null>(null)

  // Sort: critical hotspots render on top
  const sortedHotspots = [...hotspots].sort((a, b) => {
    const priority = { critical: 2, recommended: 1, coming_soon: 0 }
    return priority[a.urgency] - priority[b.urgency]
  })

  const totalServices = hotspots.reduce((sum, h) => sum + h.count, 0)
  const criticalCount = hotspots.filter(h => h.urgency === 'critical').length

  return (
    <div className="w-full">
      {/* Header summary */}
      <div className="text-center mb-3">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{totalServices}</span> service{totalServices !== 1 ? 's' : ''} found
          {criticalCount > 0 && (
            <span className="text-red-500 font-semibold">
              {' '}· {criticalCount} critical
            </span>
          )}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Tap a zone to see details
        </p>
      </div>

      {/* Vehicle diagram container */}
      <div className="relative w-full mx-auto max-w-2xl">
        {/* Aspect ratio wrapper */}
        <div className="relative w-full" style={{ aspectRatio: '16 / 9' }}>
          {/* Vehicle image */}
          <Image
            src={vehicleImagePath}
            alt="Vehicle diagram"
            fill
            className="object-contain select-none pointer-events-none"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 80vw, 640px"
            priority
            draggable={false}
          />

          {/* Hotspot overlay layer */}
          <div className="absolute inset-0">
            {sortedHotspots.map(hotspot => (
              <HotspotBubble
                key={hotspot.zone_name}
                hotspot={hotspot}
                onClick={() => setActiveZone(hotspot)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <HotspotLegend />

      {/* Zone services modal */}
      {activeZone && (
        <ZoneServicesModal
          zone={activeZone}
          selectedServiceIds={selectedServiceIds}
          onServiceToggle={onServiceToggle}
          onClose={() => setActiveZone(null)}
        />
      )}
    </div>
  )
}
