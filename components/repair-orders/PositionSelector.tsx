"use client"

import { cn } from "@/lib/utils"

interface PositionSelectorProps {
  positionType: string
  validPositions: string[]
  value: string | null
  onChange: (value: string) => void
  disabled?: boolean
}

function SegmentedControl({
  options,
  value,
  onChange,
  disabled,
}: {
  options: string[]
  value: string | null
  onChange: (value: string) => void
  disabled?: boolean
}) {
  return (
    <div className="inline-flex rounded-lg border border-border overflow-hidden">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          disabled={disabled}
          onClick={() => onChange(option)}
          className={cn(
            "px-3 py-1.5 text-xs font-medium transition-colors",
            "border-r border-border last:border-r-0",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            value === option
              ? "bg-primary text-primary-foreground"
              : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          {option}
        </button>
      ))}
    </div>
  )
}

function QuadGrid({
  value,
  onChange,
  disabled,
}: {
  value: string | null
  onChange: (value: string) => void
  disabled?: boolean
}) {
  const corners = [
    ["FL", "FR"],
    ["RL", "RR"],
  ]
  return (
    <div className="inline-grid grid-cols-2 gap-1">
      {corners.flat().map((corner) => (
        <button
          key={corner}
          type="button"
          disabled={disabled}
          onClick={() => onChange(corner)}
          className={cn(
            "w-12 h-8 text-xs font-medium rounded-md transition-colors",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            value === corner
              ? "bg-primary text-primary-foreground"
              : "bg-card border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          {corner}
        </button>
      ))}
    </div>
  )
}

export function PositionSelector({
  positionType,
  validPositions,
  value,
  onChange,
  disabled,
}: PositionSelectorProps) {
  if (positionType === "none" || !validPositions || validPositions.length === 0) {
    return null
  }

  if (positionType === "single_corner" || positionType === "single_corner_no_pair") {
    return <QuadGrid value={value} onChange={onChange} disabled={disabled} />
  }

  // axle_pair, side, front_rear — all use segmented control
  return (
    <SegmentedControl
      options={validPositions}
      value={value}
      onChange={onChange}
      disabled={disabled}
    />
  )
}
