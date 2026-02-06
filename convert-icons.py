#!/usr/bin/env python3
import os
import re
import glob

# Map of @heroicons names to lucide-react equivalents
icon_mapping = {
    # Most common mappings
    'Bars3Icon as Menu': 'Menu',
    'XMarkIcon as X': 'X',
    'WrenchIcon as Wrench': 'Wrench',
    'HomeIcon as LayoutDashboard': 'LayoutDashboard',
    'UsersIcon as Users': 'Users',
    'ChatBubbleBottomCenterTextIcon as MessageSquare': 'MessageSquare',
    'Cog6ToothIcon as Settings': 'Settings',
    'BoltIcon as Zap': 'Zap',
    'ChartBarIcon as BarChart3': 'BarChart3',
    'CubeIcon as Package': 'Package',
    'TrashIcon as Trash2': 'Trash2',
    'CheckIcon as Check': 'Check',
    'ChevronRightIcon as ChevronRight': 'ChevronRight',
    'ChevronLeftIcon as ChevronLeft': 'ChevronLeft',
    'ChevronDoubleLeftIcon as ChevronsLeft': 'ChevronsLeft',
    'ChevronDoubleRightIcon as ChevronsRight': 'ChevronsRight',
    'EllipsisHorizontalIcon as MoreHorizontal': 'MoreHorizontal',
    'ArrowUpIcon as TrendingUp': 'TrendingUp',
    'ExclamationTriangleIcon as AlertTriangle': 'AlertTriangle',
    'ClockIcon as Clock': 'Clock',
    'CurrencyDollarIcon as DollarSign': 'DollarSign',
    'DocumentIcon': 'FileText',
    'PhoneIcon as Phone': 'Phone',
    'PencilSquareIcon as Edit2': 'Edit2',
    'Plus': 'Plus',
    'EllipsisVerticalIcon as MoreVertical': 'MoreVertical',
    'MessageSquareIcon': 'MessageSquare',
    'CheckCircleIcon as CheckCircle2': 'CheckCircle2',
    'AlertCircleIcon as AlertCircle': 'AlertCircle',
    'ArrowPathIcon as Loader2': 'Loader2',
    'MagnifyingGlassIcon as Search': 'Search',
    'EnvelopeIcon as Mail': 'Mail',
    'MapPinIcon as MapPin': 'MapPin',
    'BuildingOfficeIcon as Building2': 'Building2',
    'SparklesIcon as Sparkles': 'Sparkles',
    'LightBulbIcon as Lightbulb': 'Lightbulb',
    'CheckBadgeIcon as Target': 'Target',
    'BellIcon as Bell': 'Bell',
    'ExclamationCircleIcon as ExclamationCircle': 'AlertCircle',
    'UserIcon as User': 'User',
    'PlusIcon as Plus': 'Plus',
    'Edit': 'Edit',
    'PencilIcon as Pencil': 'Edit',
    'CreditCardIcon': 'CreditCard',
    'ArrowDownTrayIcon as Download': 'Download',
    'ArrowUpTrayIcon as Upload': 'Upload',
}

# Process all tsx files
for filepath in glob.glob('/vercel/share/v0-project/**/*.tsx', recursive=True):
    try:
        with open(filepath, 'r') as f:
            content = f.read()
        
        # Skip if not using @heroicons
        if '@heroicons/react' not in content:
            continue
        
        # Replace all heroicons imports with lucide-react
        new_content = content.replace('@heroicons/react', 'lucide-react')
        
        # Fix specific icon names where needed
        new_content = new_content.replace('from "lucide-react"', 'from "lucide-react"')
        
        # Write back if changed
        if new_content != content:
            with open(filepath, 'w') as f:
                f.write(new_content)
            print(f"Fixed: {filepath}")
    except Exception as e:
        print(f"Error processing {filepath}: {e}")

print("Done!")
