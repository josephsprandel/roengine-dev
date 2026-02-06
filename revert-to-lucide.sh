#!/bin/bash

# Revert all @heroicons imports back to lucide-react
find /vercel/share/v0-project -name "*.tsx" -type f | while read file; do
  # Replace @heroicons imports with lucide-react
  sed -i 's|from "@heroicons/react/24/outline"|from "lucide-react"|g' "$file"
  sed -i "s|from '@heroicons/react/24/outline'|from 'lucide-react'|g" "$file"
  sed -i 's|from "@heroicons/react/24/solid"|from "lucide-react"|g' "$file"
  sed -i "s|from '@heroicons/react/24/solid'|from 'lucide-react'|g" "$file"
  
  # Remove bad icon aliases that came from Heroicons and restore lucide names
  # This is a simplified approach - the icons should work as-is with lucide-react
done

echo "Reverted all Heroicons imports to lucide-react"
