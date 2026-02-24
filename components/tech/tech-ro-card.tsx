'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { ChevronRight, ClipboardCheck, Wrench } from 'lucide-react'
import { jobStateBadgeStyle, getIcon } from '@/lib/job-states'
import type { TechWorkOrder } from '@/lib/tech-helpers'

interface TechROCardProps {
  workOrder: TechWorkOrder
  showAssignedTech?: boolean
  assignedTechName?: string | null
}

export function TechROCard({ workOrder, showAssignedTech, assignedTechName }: TechROCardProps) {
  const hasInspections = workOrder.total_inspections > 0
  const inspectionProgress = hasInspections
    ? `${workOrder.completed_inspections}/${workOrder.total_inspections}`
    : null

  return (
    <Link href={`/tech/${workOrder.id}`}>
      <Card className="p-4 active:bg-muted/50 transition-colors border-border">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Top row: RO number + state badge */}
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-lg text-foreground">{workOrder.ro_number}</span>
              {workOrder.job_state_name && workOrder.job_state_color && (
                <Badge
                  className="text-xs font-medium border"
                  style={jobStateBadgeStyle(workOrder.job_state_color)}
                >
                  {workOrder.job_state_name}
                </Badge>
              )}
            </div>

            {/* Vehicle YMM */}
            <p className="text-sm text-foreground font-medium">
              {workOrder.year} {workOrder.make} {workOrder.model}
            </p>

            {/* Stats row */}
            <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Wrench size={12} />
                {workOrder.service_count} service{workOrder.service_count !== 1 ? 's' : ''}
              </span>
              {inspectionProgress && (
                <span className="flex items-center gap-1">
                  <ClipboardCheck size={12} />
                  {inspectionProgress} inspected
                </span>
              )}
              {showAssignedTech && assignedTechName && (
                <span className="text-xs text-muted-foreground">
                  {assignedTechName}
                </span>
              )}
            </div>
          </div>

          <ChevronRight size={20} className="text-muted-foreground flex-shrink-0" />
        </div>
      </Card>
    </Link>
  )
}
