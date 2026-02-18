'use client'

import { useState } from 'react'
import { X, ChevronDown, ChevronUp, CheckCircle, Plus, HelpCircle, AlertTriangle } from 'lucide-react'
import type { Hotspot, Service } from '@/lib/generate-hotspots'
import { getServiceExplanation, interpolateTemplateVars, type VehicleContext } from '@/lib/service-explanations'

interface ZoneServicesModalProps {
  zone: Hotspot
  selectedServiceIds: Set<number>
  onServiceToggle: (serviceId: number) => void
  onClose: () => void
  vehicle?: VehicleContext
}

const urgencyConfig = {
  critical: {
    label: 'Critical',
    bg: 'bg-red-500',
    text: 'text-red-600 dark:text-red-400',
    lightBg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-800',
    pill: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  },
  overdue: {
    label: 'Overdue',
    bg: 'bg-red-500',
    text: 'text-red-600 dark:text-red-400',
    lightBg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-800',
    pill: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  },
  due_now: {
    label: 'Due Now',
    bg: 'bg-amber-500',
    text: 'text-amber-600 dark:text-amber-400',
    lightBg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-800',
    pill: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  },
  recommended: {
    label: 'Recommended',
    bg: 'bg-amber-500',
    text: 'text-amber-600 dark:text-amber-400',
    lightBg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-800',
    pill: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  },
  coming_soon: {
    label: 'Coming Soon',
    bg: 'bg-emerald-500',
    text: 'text-emerald-600 dark:text-emerald-400',
    lightBg: 'bg-emerald-50 dark:bg-emerald-950/30',
    border: 'border-emerald-200 dark:border-emerald-800',
    pill: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
}

const zoneUrgencyConfig = {
  critical: {
    label: 'Needs Attention',
    headerBg: 'bg-red-500',
    headerText: 'text-white',
  },
  recommended: {
    label: 'Recommended',
    headerBg: 'bg-amber-500',
    headerText: 'text-white',
  },
  coming_soon: {
    label: 'Coming Soon',
    headerBg: 'bg-emerald-500',
    headerText: 'text-white',
  },
}

function ServiceCard({
  service,
  isSelected,
  onToggle,
  vehicle,
}: {
  service: Service
  isSelected: boolean
  onToggle: () => void
  vehicle?: VehicleContext
}) {
  const [expanded, setExpanded] = useState(false)
  const config = urgencyConfig[service.urgency]
  const explanation = getServiceExplanation(service.name)

  // Helper to interpolate text with vehicle data
  const t = (text: string) =>
    vehicle ? interpolateTemplateVars(text, vehicle) : text

  return (
    <div
      className={`rounded-xl border-2 transition-all duration-200 ${
        isSelected
          ? 'border-primary bg-primary/5 shadow-sm'
          : 'border-border bg-card'
      }`}
    >
      {/* Service header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h4 className="text-base font-semibold text-foreground leading-tight">
                {service.name}
              </h4>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.pill}`}>
                {config.label}
              </span>
            </div>
            <p className="text-lg font-bold text-foreground">
              ${service.estimated_cost.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Level 1 summary — always visible if available */}
        {!expanded && explanation && (
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            {explanation.level_1.summary}
          </p>
        )}

        {/* Fallback to service.description if no explanation */}
        {!expanded && !explanation && service.description && (
          <p className="text-sm text-muted-foreground mt-2 line-clamp-2 leading-relaxed">
            {service.description}
          </p>
        )}

        {/* Expanded — Level 2 rich explanation */}
        {expanded && explanation && (
          <div className="mt-3 space-y-3">
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
              <p className="font-semibold text-sm text-blue-800 dark:text-blue-300 mb-1.5">
                🔧 What is it?
              </p>
              <p className="text-sm text-foreground leading-relaxed">
                {t(explanation.level_2.what)}
              </p>
            </div>

            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <p className="font-semibold text-sm text-amber-800 dark:text-amber-300 mb-1.5">
                ⏰ Why now?
              </p>
              <p className="text-sm text-foreground leading-relaxed">
                {t(explanation.level_2.why)}
              </p>
            </div>

            <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800">
              <p className="font-semibold text-sm text-orange-800 dark:text-orange-300 mb-1.5 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                What happens if you wait?
              </p>
              <p className="text-sm text-foreground leading-relaxed">
                {t(explanation.level_2.consequences)}
              </p>
            </div>
          </div>
        )}

        {/* Fallback expanded description */}
        {expanded && !explanation && service.description && (
          <div className={`mt-3 p-3 rounded-lg ${config.lightBg} border ${config.border}`}>
            <p className="text-sm text-foreground leading-relaxed">
              {service.description}
            </p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={onToggle}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all active:scale-[0.97] ${
              isSelected
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-foreground hover:bg-muted/80'
            }`}
          >
            {isSelected ? (
              <>
                <CheckCircle className="w-4 h-4" />
                Added
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Add This
              </>
            )}
          </button>

          {(explanation || service.description) && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors active:scale-[0.97]"
            >
              <HelpCircle className="w-4 h-4" />
              {expanded ? (
                <>
                  Less <ChevronUp className="w-3 h-3" />
                </>
              ) : (
                <>
                  What is it? <ChevronDown className="w-3 h-3" />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function ZoneServicesModal({
  zone,
  selectedServiceIds,
  onServiceToggle,
  onClose,
  vehicle,
}: ZoneServicesModalProps) {
  const zoneConfig = zoneUrgencyConfig[zone.urgency]

  const selectedCount = zone.services.filter(s =>
    selectedServiceIds.has(s.id)
  ).length

  const totalCost = zone.services
    .filter(s => selectedServiceIds.has(s.id))
    .reduce((sum, s) => sum + s.estimated_cost, 0)

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-in fade-in-0 duration-200"
        onClick={onClose}
      />

      {/* Modal — bottom sheet on mobile, centered on desktop */}
      <div
        className="fixed z-50 
          inset-x-0 bottom-0 
          sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2
          sm:max-w-md sm:w-full sm:mx-4
          animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:fade-in-0 sm:zoom-in-95 duration-300"
      >
        <div className="bg-background rounded-t-2xl sm:rounded-2xl shadow-2xl border border-border overflow-hidden max-h-[85vh] flex flex-col">
          {/* Drag handle — mobile only */}
          <div className="flex justify-center pt-3 sm:hidden">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>

          {/* Header */}
          <div className={`px-5 py-4 flex items-center justify-between ${zoneConfig.headerBg}`}>
            <div>
              <h3 className={`text-lg font-bold ${zoneConfig.headerText}`}>
                {zone.zone_label}
              </h3>
              <p className={`text-sm ${zoneConfig.headerText} opacity-90`}>
                {zone.count} service{zone.count !== 1 ? 's' : ''} · {zoneConfig.label}
              </p>
            </div>
            <button
              onClick={onClose}
              className={`p-2 rounded-full ${zoneConfig.headerText} opacity-80 hover:opacity-100 hover:bg-white/20 transition-all active:scale-90`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Services list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {zone.services.map(service => (
              <ServiceCard
                key={service.id}
                service={service}
                isSelected={selectedServiceIds.has(service.id)}
                onToggle={() => onServiceToggle(service.id)}
                vehicle={vehicle}
              />
            ))}
          </div>

          {/* Footer summary */}
          <div className="border-t border-border px-5 py-4 bg-card">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {selectedCount} of {zone.services.length} selected
              </span>
              <span className="text-lg font-bold text-foreground">
                ${totalCost.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
