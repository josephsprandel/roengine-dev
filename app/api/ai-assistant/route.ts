import { NextRequest, NextResponse } from 'next/server'

/**
 * AI Assistant API Endpoint
 * 
 * Uses rule-based intent detection for fast, reliable command processing.
 * No external AI calls needed - simple pattern matching works great!
 * 
 * Supported Commands:
 * - Navigation: "go to customers", "open repair orders"
 * - Maintenance: "what services are due", "check maintenance"
 * - Create RO: "create new repair order"
 * - Search: "find customer Bob Johnson"
 * - VIN Lookup: "decode VIN 1HGBH41JXMN109186"
 */

export async function POST(request: NextRequest) {
  try {
    const { command, context } = await request.json()

    if (!command || typeof command !== 'string') {
      return NextResponse.json(
        { error: 'Command is required' },
        { status: 400 }
      )
    }

    console.log('[AI Assistant] Command:', command)
    console.log('[AI Assistant] Context:', context)

    const lowerCommand = command.toLowerCase()
    
    // Navigation commands
    if (lowerCommand.includes('go to') || lowerCommand.includes('open') || lowerCommand.includes('navigate')) {
      // Settings tabs (check specific tabs before generic "settings")
      const settingsTabMap: { keywords: string[]; tab: string; label: string }[] = [
        { keywords: ['scheduling settings', 'scheduling rules', 'schedule settings', 'capacity rules', 'booking settings'], tab: 'scheduling', label: 'Scheduling Settings' },
        { keywords: ['shop settings', 'shop profile', 'shop info', 'shop hours', 'business hours'], tab: 'shop', label: 'Shop Settings' },
        { keywords: ['appearance settings', 'appearance', 'theme', 'dark mode', 'light mode', 'branding'], tab: 'appearance', label: 'Appearance Settings' },
        { keywords: ['business settings', 'billing', 'labor rate', 'tax rate', 'invoicing', 'job states'], tab: 'business', label: 'Business Settings' },
        { keywords: ['vendor settings', 'vendors', 'vendor preferences', 'supplier'], tab: 'vendors', label: 'Vendor Settings' },
        { keywords: ['canned jobs', 'canned job', 'job templates', 'preset jobs'], tab: 'canned-jobs', label: 'Canned Jobs Settings' },
        { keywords: ['recycle bin', 'trash', 'deleted', 'restore'], tab: 'recycle-bin', label: 'Recycle Bin' },
      ]

      for (const entry of settingsTabMap) {
        if (entry.keywords.some(kw => lowerCommand.includes(kw))) {
          return NextResponse.json({
            intent: 'navigation',
            message: `Opening ${entry.label}.`,
            action: 'navigate',
            url: `/settings?tab=${entry.tab}`
          })
        }
      }

      // Main pages
      if (lowerCommand.includes('dashboard') || lowerCommand.includes('home') || lowerCommand.includes('main page')) {
        return NextResponse.json({
          intent: 'navigation',
          message: 'Taking you to the dashboard.',
          action: 'navigate',
          url: '/'
        })
      }
      if (lowerCommand.includes('schedule') || lowerCommand.includes('calendar') || lowerCommand.includes('appointment')) {
        return NextResponse.json({
          intent: 'navigation',
          message: 'Opening the schedule.',
          action: 'navigate',
          url: '/schedule'
        })
      }
      if (lowerCommand.includes('customer')) {
        return NextResponse.json({
          intent: 'navigation',
          message: 'Taking you to the customers page.',
          action: 'navigate',
          url: '/customers'
        })
      }
      if (lowerCommand.includes('repair order') || lowerCommand.includes(' ro')) {
        return NextResponse.json({
          intent: 'navigation',
          message: 'Opening repair orders.',
          action: 'navigate',
          url: '/repair-orders'
        })
      }
      if (lowerCommand.includes('part')) {
        return NextResponse.json({
          intent: 'navigation',
          message: 'Opening parts manager.',
          action: 'navigate',
          url: '/parts-manager'
        })
      }
      if (lowerCommand.includes('communication') || lowerCommand.includes('comms') || lowerCommand.includes('message') || lowerCommand.includes('inbox')) {
        return NextResponse.json({
          intent: 'navigation',
          message: 'Opening communications.',
          action: 'navigate',
          url: '/communications'
        })
      }
      if (lowerCommand.includes('setting')) {
        return NextResponse.json({
          intent: 'navigation',
          message: 'Opening settings.',
          action: 'navigate',
          url: '/settings'
        })
      }
    }

    // Maintenance commands
    if (lowerCommand.includes('service') || 
        lowerCommand.includes('maintenance') || 
        lowerCommand.includes('due')) {
      return NextResponse.json({
        intent: 'maintenance_recommendations',
        message: "Let me check what services are due for your vehicle.",
        action: 'show_maintenance_dialog',
        data: {}
      })
    }

    // Create RO commands
    if (lowerCommand.includes('create') || lowerCommand.includes('new')) {
      if (lowerCommand.includes('repair') || lowerCommand.includes('ro') || lowerCommand.includes('order')) {
        return NextResponse.json({
          intent: 'ro_create',
          message: "Let's create a new repair order.",
          action: 'navigate',
          url: '/repair-orders/new'
        })
      }
    }

    // Search commands - Route to AI Search API
    // Match: "find X", "search X", "search for X", "list X", "show X", "all X"
    const isSearchCommand = lowerCommand.startsWith('find ') || 
                            lowerCommand.startsWith('search ') ||
                            lowerCommand.includes('search for') ||
                            lowerCommand.startsWith('list ') ||
                            lowerCommand.startsWith('show ') ||
                            lowerCommand.startsWith('all ') ||
                            lowerCommand.includes('customers who') ||
                            lowerCommand.includes('repair orders')
    
    if (isSearchCommand) {
      // Use the full command for better AI understanding
      const searchQuery = command
        .replace(/^find\s+/i, '')
        .replace(/^search\s+for\s+/i, '')
        .replace(/^search\s+/i, '')
        .replace(/^list\s+/i, '')
        .replace(/^show\s+/i, '')
        .trim()
      
      console.log('[AI Assistant] Routing to AI search:', searchQuery)
      console.log('[AI Assistant] Full command:', command)
      
      try {
        // Get the host from request headers for internal fetch
        const host = request.headers.get('host') || 'localhost:3000'
        const protocol = host.includes('localhost') ? 'http' : 'https'
        const baseUrl = `${protocol}://${host}`
        
        // Call the AI search endpoint
        const searchResponse = await fetch(
          `${baseUrl}/api/search/ai-search`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query: command, // Use full command for better AI context
              context: context
            })
          }
        )
        
        const searchData = await searchResponse.json()
        
        if (searchData.success) {
          return NextResponse.json({
            intent: 'search',
            message: searchData.interpretation,
            action: 'show_search_results',
            action_data: {
              results: searchData.results,
              entity: searchData.entity,
              query: searchQuery,
              count: searchData.count,
              sql: searchData.sql // For debugging
            }
          })
        } else {
          return NextResponse.json({
            intent: 'search_error',
            message: searchData.error || 'Search failed',
            action: null
          })
        }
      } catch (searchError: any) {
        console.error('[AI Assistant] AI Search error:', searchError)
        return NextResponse.json({
          intent: 'search_error',
          message: 'Search service is unavailable',
          action: null
        })
      }
    }

    // VIN lookup
    const vinMatch = command.match(/\b[A-HJ-NPR-Z0-9]{17}\b/i)
    if (vinMatch || lowerCommand.includes('vin')) {
      return NextResponse.json({
        intent: 'vin_lookup',
        message: "I'll decode that VIN for you.",
        action: 'vin_lookup',
        data: { vin: vinMatch ? vinMatch[0] : '' }
      })
    }

    // Default/Help
    return NextResponse.json({
      intent: 'unknown',
      message: 'Hi there! I can help you navigate pages, check maintenance, or search for customers. What would you like to do?',
      action: null
    })

  } catch (error: any) {
    console.error('[AI Assistant] Error:', error.message)

    return NextResponse.json({
      intent: 'error',
      message: "Sorry, I encountered an error. Please try again.",
      action: null,
      error: error.message
    }, { status: 500 })
  }
}
