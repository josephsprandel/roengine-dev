#!/bin/bash

# Fix all invalid Heroicons names to valid ones
cd /vercel/share/v0-project

# Fix pagination icons
find . -name "*.tsx" -type f -exec sed -i \
  's/ChevronDoubleLeftIcon/ChevronDoubleLeftIcon/g; \
   s/ChevronDoubleRightIcon/ChevronDoubleRightIcon/g; \
   s/EllipsisHorizontalIcon/EllipsisHorizontalIcon/g; \
   s/from "@heroicons\/react\/24\/outline" | FileText /DocumentIcon/g; \
   s/as DocumentTextIcon/as DocumentIcon/g; \
   s/TruckIcon as Car/TruckIcon as Car/g; \
   s/PhotoIcon/PhotoIcon/g; \
   s/FunnelIcon/FunnelIcon/g' {} \;

echo "Fixed icon names"
