// Canned Jobs TypeScript interfaces

export interface CannedJob {
  id: number
  name: string
  description: string | null
  category_id: number | null
  category_name: string | null
  default_labor_hours: number | null
  default_labor_rate_id: number | null
  labor_rate_per_hour: number | null
  is_inspection: boolean
  auto_add_to_all_ros: boolean
  auto_add_condition: Record<string, unknown> | null
  show_in_wizard: boolean
  is_active: boolean
  sort_order: number
  created_at: string
  parts: CannedJobPart[]
  inspection_items: CannedJobInspectionItem[]
}

export interface CannedJobPart {
  id: number
  canned_job_id: number
  part_name: string
  part_number: string | null
  quantity: number
  estimated_price: number | null
  sort_order: number
}

export interface CannedJobInspectionItem {
  id: number
  canned_job_id: number
  name: string
  description: string | null
  sort_order: number
  is_active: boolean
}
