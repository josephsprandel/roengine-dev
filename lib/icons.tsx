'use client'

import * as HeroIcons from '@heroicons/react/24/outline'
import * as HeroIconsSolid from '@heroicons/react/24/solid'

// Icon mapping from lucide names to heroicons components
// Using outline for general icons, solid for filled states
const ICON_MAP: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  // Navigation
  Menu: HeroIcons.Bars3Icon,
  X: HeroIcons.XMarkIcon,
  LayoutDashboard: HeroIcons.HomeIcon,
  Users: HeroIcons.UsersIcon,
  MessageSquare: HeroIcons.ChatBubbleBottomCenterTextIcon,
  Settings: HeroIcons.Cog6ToothIcon,
  BarChart3: HeroIcons.BarChartIcon,
  Package: HeroIcons.CubeIcon,
  Trash2: HeroIcons.TrashIcon,
  
  // Common actions
  Plus: HeroIcons.PlusIcon,
  Pencil: HeroIcons.PencilIcon,
  Edit2: HeroIcons.PencilSquareIcon,
  Edit: HeroIcons.PencilIcon,
  ChevronDown: HeroIcons.ChevronDownIcon,
  ChevronUp: HeroIcons.ChevronUpIcon,
  ChevronLeft: HeroIcons.ChevronLeftIcon,
  ChevronRight: HeroIcons.ChevronRightIcon,
  ChevronsLeft: HeroIcons.ChevronDoubleLeftIcon,
  ChevronsRight: HeroIcons.ChevronDoubleRightIcon,
  Check: HeroIconsSolid.CheckIcon,
  CheckIcon: HeroIconsSolid.CheckIcon,
  CheckCircle2: HeroIcons.CheckCircleIcon,
  AlertCircle: HeroIcons.ExclamationCircleIcon,
  AlertTriangle: HeroIcons.ExclamationTriangleIcon,
  Search: HeroIcons.MagnifyingGlassIcon,
  
  // Specific features
  Wrench: HeroIcons.WrenchIcon,
  Bell: HeroIcons.BellIcon,
  Clock: HeroIcons.ClockIcon,
  Zap: HeroIcons.BoltIcon,
  Send: HeroIcons.PaperAirplaneIcon,
  Copy: HeroIcons.DocumentDuplicateIcon,
  FileText: HeroIcons.DocumentTextIcon,
  Phone: HeroIcons.PhoneIcon,
  Mail: HeroIcons.EnvelopeIcon,
  User: HeroIcons.UserIcon,
  UserPlus: HeroIcons.UserPlusIcon,
  Car: HeroIcons.TruckIcon,
  MapPin: HeroIcons.MapPinIcon,
  Globe: HeroIcons.GlobeAltIcon,
  Globe2: HeroIcons.GlobeAltIcon,
  Upload: HeroIcons.ArrowUpTrayIcon,
  Download: HeroIcons.ArrowDownTrayIcon,
  Loader2: HeroIcons.ArrowPathIcon,
  Save: HeroIcons.CheckIcon,
  
  // Theme
  Sun: HeroIcons.SunIcon,
  Moon: HeroIcons.MoonIcon,
  Monitor: HeroIcons.ComputerDesktopIcon,
  
  // Extended actions
  MoreHorizontal: HeroIcons.EllipsisHorizontalIcon,
  MoreVertical: HeroIcons.EllipsisVerticalIcon,
  Sparkles: HeroIcons.SparklesIcon,
  Brain: HeroIcons.LightBulbIcon,
  TrendingUp: HeroIcons.ArrowUpIcon,
  ArrowUpRight: HeroIcons.ArrowTopRightOnSquareIcon,
  ArrowLeft: HeroIcons.ArrowLeftIcon,
  ArrowUpDown: HeroIcons.ArrowsUpDownIcon,
  DollarSign: HeroIcons.CurrencyDollarIcon,
  CreditCard: HeroIcons.CreditCardIcon,
  Building2: HeroIcons.BuildingOfficeIcon,
  Shield: HeroIcons.ShieldCheckIcon,
  Calendar: HeroIcons.CalendarIcon,
  
  // Additional mappings
  Mic: HeroIcons.MicrophoneIcon,
  MicOff: HeroIcons.MicrophoneIcon,
  ThumbsUp: HeroIcons.HandThumbUpIcon,
  ThumbsDown: HeroIcons.HandThumbDownIcon,
  Lightbulb: HeroIcons.LightBulbIcon,
  Target: HeroIcons.CheckBadgeIcon,
  GripVertical: HeroIcons.Bars3CenterLeftIcon,
  ExternalLink: HeroIcons.ArrowTopRightOnSquareIcon,
  Camera: HeroIcons.PhotoIcon,
  ShoppingCart: HeroIcons.ShoppingCartIcon,
  Truck: HeroIcons.TruckIcon,
  RotateCcw: HeroIcons.ArrowPathIcon,
  Filter: HeroIcons.FunnelIcon,
  Tag: HeroIcons.TagIcon,
  ImageIcon: HeroIcons.PhotoIcon,
  DatabaseIcon: HeroIcons.CircleStackIcon,
  
  // For UI components
  CircleIcon: HeroIcons.CheckCircleIcon,
  ChevronRightIcon: HeroIcons.ChevronRightIcon,
  ChevronDownIcon: HeroIcons.ChevronDownIcon,
  ChevronUpIcon: HeroIcons.ChevronUpIcon,
  ChevronLeftIcon: HeroIcons.ChevronLeftIcon,
  XIcon: HeroIcons.XMarkIcon,
  CheckCircle: HeroIcons.CheckCircleIcon,
  UserCog: HeroIcons.Cog6ToothIcon,
  RotateCw: HeroIcons.ArrowPathIcon,
}

// Create a dynamic icon component that accepts icon names as strings
export function Icon({ 
  name, 
  ...props 
}: { 
  name: string 
  [key: string]: any 
}) {
  const IconComponent = ICON_MAP[name] || HeroIcons.QuestionMarkCircleIcon
  return <IconComponent {...props} />
}

// Export all icons for direct import
export default ICON_MAP
