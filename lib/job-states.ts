import type { LucideIcon } from "lucide-react"
import {
  FileText,
  LogIn,
  Wrench,
  AlertCircle,
  ListOrdered,
  CheckCircle,
  Lock,
  Circle,
  Clock,
  Truck,
  Eye,
  Shield,
  Settings,
  Star,
  Flag,
  Zap,
  Heart,
  Bell,
  Search,
  Send,
  Archive,
  Clipboard,
  PenTool,
  Tag,
  User,
  Users,
  Car,
  Hammer,
  PackageCheck,
  CircleDot,
  Play,
  Pause,
  SquareCheck,
} from "lucide-react"

// ============================================================================
// Types
// ============================================================================

export interface JobState {
  id: number
  name: string
  slug: string
  color: string
  icon: string
  sort_order: number
  is_initial: boolean
  is_terminal: boolean
  notify_roles: string[]
  is_system: boolean
  is_active: boolean
}

export interface JobTransfer {
  id: number
  work_order_id: number
  from_user_id: number | null
  from_user_name: string | null
  to_user_id: number
  to_user_name: string
  from_state_id: number | null
  from_state_name: string | null
  from_state_color: string | null
  to_state_id: number
  to_state_name: string
  to_state_color: string
  note: string | null
  transferred_at: string
  accepted_at: string | null
}

export interface JobStateTransition {
  id: number
  from_state_id: number | null
  to_state_id: number
  to_state_name: string
  to_state_color: string
  to_state_icon: string
  allowed_roles: string[]
}

// ============================================================================
// Icon Map (curated subset of Lucide icons for auto shop workflows)
// ============================================================================

export const ICON_MAP: Record<string, LucideIcon> = {
  "file-text": FileText,
  "log-in": LogIn,
  "wrench": Wrench,
  "alert-circle": AlertCircle,
  "list-ordered": ListOrdered,
  "check-circle": CheckCircle,
  "lock": Lock,
  "circle": Circle,
  "clock": Clock,
  "truck": Truck,
  "eye": Eye,
  "shield": Shield,
  "settings": Settings,
  "star": Star,
  "flag": Flag,
  "zap": Zap,
  "heart": Heart,
  "bell": Bell,
  "search": Search,
  "send": Send,
  "archive": Archive,
  "clipboard": Clipboard,
  "pen-tool": PenTool,
  "tag": Tag,
  "user": User,
  "users": Users,
  "car": Car,
  "hammer": Hammer,
  "package-check": PackageCheck,
  "circle-dot": CircleDot,
  "play": Play,
  "pause": Pause,
  "square-check": SquareCheck,
}

export const ICON_NAMES = Object.keys(ICON_MAP)

export function getIcon(iconName: string): LucideIcon {
  return ICON_MAP[iconName] || Circle
}

// ============================================================================
// Color utilities
// ============================================================================

export function jobStateBadgeStyle(color: string) {
  return {
    backgroundColor: `${color}20`,
    color: color,
    borderColor: `${color}40`,
  }
}

// Preset colors for the color picker in settings
export const PRESET_COLORS = [
  "#6b7280", // gray
  "#374151", // slate
  "#ef4444", // red
  "#f97316", // orange
  "#f59e0b", // amber
  "#eab308", // yellow
  "#84cc16", // lime
  "#22c55e", // green
  "#14b8a6", // teal
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#a855f7", // purple
  "#d946ef", // fuchsia
  "#ec4899", // pink
]

// ============================================================================
// Slug generation (client-side mirror of DB trigger)
// ============================================================================

export function generateSlug(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")
}
