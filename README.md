# RO Engine - Automotive Repair Management System

[![GitHub Repository](https://img.shields.io/badge/GitHub-roengine--dev-blue?style=for-the-badge&logo=github)](https://github.com/josephsprandel/roengine-dev)
[![Production](https://img.shields.io/badge/Production-arologik.com-green?style=for-the-badge)](https://arologik.com)

## Overview

RO Engine is a comprehensive automotive repair management system designed for modern auto repair shops. This system handles customer management, vehicle tracking, work orders, parts inventory, and AI-powered repair recommendations.

## Features

- **Customer & Vehicle Management**: Track customers and their vehicles with complete service history
- **Work Order System**: Create and manage repair orders with services and parts
- **Parts Inventory**: Comprehensive parts catalog with ~18,000 items and AI-powered label scanning
- **AI Assistant**: Intelligent repair recommendations and maintenance scheduling
- **Labor Rate Management**: Configure shop labor rates and service pricing
- **Search & Analytics**: Powerful search across customers, vehicles, and work orders

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript
- **UI Components**: Radix UI, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL
- **AI**: Google Gemini AI
- **Deployment**: PM2 Process Manager

## Production Deployment

The application is currently running in production at **[https://arologik.com](https://arologik.com)**

### Deployment Process

After making code changes, always run:

```bash
# Full deployment
cd /home/jsprandel/roengine
git add .
git commit -m "Your commit message"
git push origin main
npm run build
pm2 restart ai-automotive-repair

# Check status
pm2 status ai-automotive-repair
pm2 logs ai-automotive-repair --lines 50
```

## Local Development

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your database credentials and API keys

# Run development server
npm run dev

# Open http://localhost:3000
```

## Database

The application uses PostgreSQL with the following main tables:
- `parts_inventory` - Parts catalog
- `customers` - Customer records
- `vehicles` - Vehicle information
- `work_orders` - Repair orders
- `work_order_services` - Services on orders
- `work_order_items` - Parts used on orders

### Database Migrations

```bash
# Apply migrations
psql -d shopops3 -U shopops -f db/migrations/XXX_migration_name.sql
```

## API Endpoints

Key API routes:
- `/api/inventory/parts` - Parts search and management
- `/api/inventory/scan-label` - AI label scanning
- `/api/customers` - Customer management
- `/api/vehicles` - Vehicle management
- `/api/work-orders` - Work order management

## Project Structure

```
roengine/
├── app/                 # Next.js app router
│   ├── api/            # API routes
│   ├── inventory/      # Inventory pages
│   ├── customers/      # Customer pages
│   └── repair-orders/  # Work order pages
├── components/          # React components
├── lib/                # Utilities and helpers
├── db/migrations/      # Database migrations
└── scripts/            # Utility scripts
```

## Repository

This is a fresh repository created from the production codebase. The old repository (v0-ai-automotive-repair) has been deprecated in favor of this clean, properly configured repository.

**GitHub**: [https://github.com/josephsprandel/roengine-dev](https://github.com/josephsprandel/roengine-dev)

## Testing

Since we test directly in production:
1. Always check browser console for errors after deployment
2. Test API endpoints with curl
3. Verify database changes with psql
4. Check PM2 logs for any runtime errors

## License

Private - All rights reserved
