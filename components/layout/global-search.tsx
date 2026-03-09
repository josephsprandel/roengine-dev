'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MagnifyingGlass, Microphone, MicrophoneSlash, CircleNotch } from '@phosphor-icons/react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface GlobalSearchProps {
  className?: string
}

// Navigation targets for voice commands — pages and settings tabs
const NAV_ROUTES: { keywords: string[]; path: string; label: string }[] = [
  // Navbar pages
  { keywords: ['dashboard', 'home', 'main page'], path: '/', label: 'Dashboard' },
  { keywords: ['schedule', 'calendar', 'appointments', 'booking'], path: '/schedule', label: 'Schedule' },
  { keywords: ['repair order', 'repair orders', 'ro list', 'r.o.', 'work order', 'work orders'], path: '/repair-orders', label: 'Repair Orders' },
  { keywords: ['customer', 'customers', 'client', 'clients'], path: '/customers', label: 'Customers' },
  { keywords: ['parts', 'parts manager', 'inventory'], path: '/parts-manager', label: 'Parts Manager' },
  { keywords: ['communication', 'communications', 'comms', 'messages', 'sms', 'inbox'], path: '/communications', label: 'Communications' },
  { keywords: ['ai assistant', 'assistant', 'ai help'], path: '/ai-assistant', label: 'AI Assistant' },
  // Settings tabs — more specific matches first
  { keywords: ['scheduling settings', 'scheduling rules', 'schedule settings', 'capacity rules', 'booking settings'], path: '/settings?tab=scheduling', label: 'Scheduling Settings' },
  { keywords: ['shop settings', 'shop profile', 'shop info', 'shop hours', 'business hours'], path: '/settings?tab=shop', label: 'Shop Settings' },
  { keywords: ['appearance settings', 'appearance', 'theme', 'dark mode', 'light mode', 'branding'], path: '/settings?tab=appearance', label: 'Appearance Settings' },
  { keywords: ['business settings', 'billing', 'labor rate', 'tax rate', 'invoicing', 'job states'], path: '/settings?tab=business', label: 'Business Settings' },
  { keywords: ['vendor settings', 'vendors', 'vendor preferences', 'supplier'], path: '/settings?tab=vendors', label: 'Vendor Settings' },
  { keywords: ['canned jobs', 'canned job', 'job templates', 'job template', 'preset jobs'], path: '/settings?tab=canned-jobs', label: 'Canned Jobs Settings' },
  { keywords: ['recycle bin', 'trash', 'deleted', 'restore'], path: '/settings?tab=recycle-bin', label: 'Recycle Bin' },
  // Generic settings last (so specific tabs match first)
  { keywords: ['settings', 'preferences', 'configuration', 'config'], path: '/settings', label: 'Settings' },
]

// Patterns that indicate "open RO for <customer name>"
// Returns the extracted customer name or null
function extractROCustomerName(text: string): string | null {
  const lower = text.toLowerCase()
  // Match patterns like:
  //   "open RO for John Smith"
  //   "pull up RO for Bob"
  //   "show repair order for Johnson"
  //   "RO for Smith"
  //   "open repair order by John"
  //   "pull up work order for Bob Johnson"
  const patterns = [
    /(?:open|pull up|show|get|go to|find)\s+(?:the\s+)?(?:ro|r\.o\.|repair order|work order)s?\s+(?:for|by|under)\s+(.+)/i,
    /(?:ro|r\.o\.|repair order|work order)s?\s+(?:for|by|under)\s+(.+)/i,
  ]
  for (const pattern of patterns) {
    const match = lower.match(pattern)
    if (match?.[1]) {
      return match[1].trim()
    }
  }
  return null
}

// Try to match a navigation command. Returns the route if matched, null otherwise.
function matchNavRoute(text: string): (typeof NAV_ROUTES)[number] | null {
  const lower = text.toLowerCase()
  // Strip common navigation prefixes to get the target
  const stripped = lower
    .replace(/^(go to|navigate to|open|show me|take me to|switch to|jump to)\s+/i, '')
    .replace(/^(the|my)\s+/i, '')
    .trim()

  for (const route of NAV_ROUTES) {
    for (const kw of route.keywords) {
      if (stripped === kw || stripped.includes(kw) || lower.includes(kw)) {
        return route
      }
    }
  }
  return null
}

export function GlobalSearch({ className }: GlobalSearchProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [recognition, setRecognition] = useState<any>(null)
  const [isSupported, setIsSupported] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Check if browser supports speech recognition
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition
      const recognizer = new SpeechRecognition()

      recognizer.continuous = false
      recognizer.interimResults = true
      recognizer.lang = 'en-US'

      recognizer.onstart = () => {
        setIsListening(true)
      }

      recognizer.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript
        setQuery(transcript)
        
        // If final result, process it
        if (event.results[0].isFinal) {
          handleVoiceCommand(transcript)
        }
      }

      recognizer.onerror = (event: any) => {
        console.error('[Voice] Error:', event.error)
        setIsListening(false)
        
        if (event.error === 'not-allowed') {
          alert('Microphone access denied. Please enable microphone permissions in your browser settings.')
        }
      }

      recognizer.onend = () => {
        setIsListening(false)
      }

      setRecognition(recognizer)
      setIsSupported(true)
    } else {
      console.warn('[Voice] Speech recognition not supported in this browser')
      setIsSupported(false)
    }
  }, [])

  const toggleListening = () => {
    if (!recognition) {
      alert('Speech recognition not supported in this browser. Try Chrome or Edge.')
      return
    }

    if (isListening) {
      recognition.stop()
    } else {
      setQuery('') // Clear previous
      recognition.start()
    }
  }

  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 1.1
      window.speechSynthesis.speak(utterance)
    }
  }

  const lookupROByCustomer = async (customerName: string): Promise<boolean> => {
    try {
      speak(`Looking up repair orders for ${customerName}.`)
      const res = await fetch(`/api/work-orders?search=${encodeURIComponent(customerName)}&limit=10`)
      if (!res.ok) return false
      const data = await res.json()
      const orders = data.workOrders || data.work_orders || []

      if (orders.length === 0) {
        speak(`No repair orders found for ${customerName}.`)
        setIsProcessing(false)
        return true
      }

      if (orders.length === 1) {
        speak(`Opening repair order ${orders[0].ro_number} for ${orders[0].customer_name}.`)
        router.push(`/repair-orders/${orders[0].id}`)
        return true
      }

      // Multiple matches — speak the count and navigate to filtered list
      speak(`Found ${orders.length} repair orders for ${customerName}. Showing results.`)
      router.push(`/search?q=${encodeURIComponent(`repair orders for ${customerName}`)}`)
      return true
    } catch {
      return false
    }
  }

  const handleVoiceCommand = async (command: string) => {
    setIsProcessing(true)

    const lowerCommand = command.toLowerCase()

    // 0. Check for "open RO for <customer name>" pattern first
    const roCustomerName = extractROCustomerName(command)
    if (roCustomerName) {
      const handled = await lookupROByCustomer(roCustomerName)
      if (handled) {
        setQuery('')
        setIsProcessing(false)
        return
      }
    }

    // 1. Try client-side navigation first (instant, no API round-trip)
    const navPrefixes = ['go to', 'navigate to', 'open', 'take me to', 'switch to', 'jump to']
    const hasNavIntent = navPrefixes.some(p => lowerCommand.includes(p))

    if (hasNavIntent) {
      const match = matchNavRoute(command)
      if (match) {
        speak(`Opening ${match.label}.`)
        setQuery('')
        setIsProcessing(false)
        router.push(match.path)
        return
      }
    }

    // 2. Check if it's a SEARCH command - these go directly to search page
    const searchTriggers = [
      'find',
      'search',
      'look up',
      'list',
      'show me',
      'all customers',
      'all vehicles',
      'customers who',
      'vehicles that',
      'repair orders',
      'open ro',
      'closed ro'
    ]

    const isSearchCommand = searchTriggers.some(trigger =>
      lowerCommand.includes(trigger)
    )

    // Navigate directly to search results page for search queries
    if (isSearchCommand) {
      router.push(`/search?q=${encodeURIComponent(command)}`)
      setIsProcessing(false)
      return
    }

    // 3. Check if it's an AI/action command
    const aiTriggers = [
      'what services',
      'show maintenance',
      'check maintenance',
      'create ro',
      'new repair order',
      'start ro',
      'add service',
      'send estimate',
      'tell me',
      'decode vin'
    ]

    const isAICommand = aiTriggers.some(trigger =>
      lowerCommand.includes(trigger)
    )

    if (isAICommand) {
      // Send to AI assistant for actions
      await processAICommand(command)
    } else {
      // 4. Last resort: try nav match without explicit prefix (e.g. just "dashboard")
      const loosyMatch = matchNavRoute(command)
      if (loosyMatch) {
        speak(`Opening ${loosyMatch.label}.`)
        setQuery('')
        setIsProcessing(false)
        router.push(loosyMatch.path)
        return
      }
      // Default: treat as search
      router.push(`/search?q=${encodeURIComponent(command)}`)
    }

    setIsProcessing(false)
  }

  const processAICommand = async (command: string) => {
    try {
      const response = await fetch('/api/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command,
          context: {
            page: typeof window !== 'undefined' ? window.location.pathname : '/',
            timestamp: new Date().toISOString()
          }
        })
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const data = await response.json()
      
      // Speak the response
      if (data.message && 'speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(data.message)
        utterance.rate = 1.1
        utterance.pitch = 1.0
        window.speechSynthesis.speak(utterance)
      }

      // Execute action if needed
      if (data.action === 'navigate' && data.url) {
        setTimeout(() => {
          router.push(data.url)
        }, 1000) // Small delay for voice response
      }

      // For maintenance recommendations, we could trigger a modal
      if (data.action === 'show_maintenance_dialog' && data.data) {
        // TODO: Trigger maintenance dialog/modal
      }

      // Handle AI-powered search results - navigate to search results page
      if (data.action === 'show_search_results' && data.action_data) {
        // Navigate to search results page with the query
        const searchQuery = encodeURIComponent(command)
        router.push(`/search?q=${searchQuery}`)
      }

    } catch (error) {
      console.error('[Voice] AI command failed:', error)
      
      // Speak error message
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(
          "Sorry, I encountered an error processing that command. Please try again."
        )
        window.speechSynthesis.speak(utterance)
      }
    }
  }

  const handleSearch = (searchQuery: string) => {
    // TODO: Implement global search across ROs, customers, vehicles
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(
        `Searching for ${searchQuery}`
      )
      window.speechSynthesis.speak(utterance)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      // Route ALL queries through the voice command handler (which checks for AI triggers)
      handleVoiceCommand(query)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`relative flex items-center ${className || ''}`}>
      <div className="relative flex-1">
        <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            isListening 
              ? "🎤 Listening..." 
              : isProcessing
              ? "🤖 Processing..."
              : "Search ROs, customers, vehicles... or ask AI"
          }
          className={`
            pl-10 pr-12
            ${isListening ? 'border-red-500 bg-red-50 dark:bg-red-950/20' : ''}
            ${isProcessing ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' : ''}
          `}
          disabled={isProcessing}
        />
      </div>
      
      {isSupported && (
        <Button
          type="button"
          onClick={toggleListening}
          disabled={isProcessing}
          className={`
            ml-2 transition-all
            ${isListening 
              ? 'bg-red-500 text-white hover:bg-red-600 animate-pulse' 
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }
          `}
          title={isListening ? 'Stop listening' : 'Start voice input'}
          size="icon"
        >
          {isProcessing ? (
            <CircleNotch className="w-5 h-5 animate-spin" />
          ) : isListening ? (
            <MicrophoneSlash className="w-5 h-5" />
          ) : (
            <Microphone className="w-5 h-5" />
          )}
        </Button>
      )}
    </form>
  )
}
