#!/usr/bin/env python3
import os
import re
from pathlib import Path

# Mapping of heroicons imports to lucide-react
replacements = [
    (r'from\s+["\']@heroicons/react/24/(?:outline|solid)["\']', 'from "lucide-react"'),
    (r'Bars3Icon\s+as\s+Menu', 'Menu'),
    (r'XMarkIcon\s+as\s+X', 'X'),
    (r'WrenchIcon\s+as\s+Wrench', 'Wrench'),
    (r'HomeIcon\s+as\s+LayoutDashboard', 'LayoutDashboard'),
    (r'UsersIcon\s+as\s+Users', 'Users'),
    (r'ChatBubbleBottomCenterTextIcon\s+as\s+MessageSquare', 'MessageSquare'),
    (r'Cog6ToothIcon\s+as\s+Settings', 'Settings'),
    (r'BoltIcon\s+as\s+Zap', 'Zap'),
    (r'ChartBarIcon\s+as\s+BarChart3', 'BarChart3'),
    (r'CubeIcon\s+as\s+Package', 'Package'),
    (r'TrashIcon\s+as\s+Trash2', 'Trash2'),
    # Add more as needed...
]

def revert_file(filepath):
    try:
        with open(filepath, 'r') as f:
            content = f.read()
        
        original_content = content
        
        # Replace all heroicons imports with lucide-react
        content = re.sub(r'from\s+["\']@heroicons/react/24/(?:outline|solid)["\']', 
                         'from "lucide-react"', content)
        
        # Clean up complex alias chains - just use simple icon names
        # Replace patterns like: Icon as alias to just: alias
        if '@heroicons' not in content and 'lucide-react' in content:
            # Already converted, now just clean it up
            pass
        
        if content != original_content:
            with open(filepath, 'w') as f:
                f.write(content)
            return True
    except:
        pass
    return False

# Find all TSX files
tsx_files = Path('/vercel/share/v0-project').rglob('*.tsx')
count = 0
for filepath in tsx_files:
    if revert_file(str(filepath)):
        count += 1

print(f"Reverted {count} files")
