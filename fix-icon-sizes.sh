#!/bin/bash

# Convert lucide-react size props to Heroicons Tailwind classes
# This script updates all TSX files to use className instead of size prop

cd /vercel/share/v0-project

# Replace various size values with corresponding Tailwind classes
find . -name "*.tsx" -type f ! -path "./node_modules/*" -exec sed -i \
  -e 's/size={12}/className="w-3 h-3"/g' \
  -e 's/size={14}/className="w-3.5 h-3.5"/g' \
  -e 's/size={16}/className="w-4 h-4"/g' \
  -e 's/size={18}/className="w-4.5 h-4.5"/g' \
  -e 's/size={20}/className="w-5 h-5"/g' \
  -e 's/size={22}/className="w-5.5 h-5.5"/g' \
  -e 's/size={24}/className="w-6 h-6"/g' \
  -e 's/size={32}/className="w-8 h-8"/g' \
  {} \;

echo "Icon sizes fixed!"
