"use client"

import { getIcon, jobStateBadgeStyle } from "@/lib/job-states"

interface JobStateBadgeProps {
  name: string
  color: string
  icon: string
  size?: "sm" | "md"
}

export function JobStateBadge({ name, color, icon, size = "md" }: JobStateBadgeProps) {
  const Icon = getIcon(icon)
  const style = jobStateBadgeStyle(color)

  const sizeClasses = size === "sm"
    ? "px-2 py-0.5 text-xs gap-1"
    : "px-2.5 py-1 text-sm gap-1.5"

  const iconSize = size === "sm" ? 12 : 14

  return (
    <span
      className={`inline-flex items-center ${sizeClasses} rounded-full font-medium border`}
      style={style}
    >
      <Icon size={iconSize} />
      {name}
    </span>
  )
}
