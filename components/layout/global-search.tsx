'use client'

import { useState, useRef, useEffect } from 'react'
import { MagnifyingGlassIcon as Search, MicrophoneIcon as Mic, MicrophoneIcon as MicOff, ArrowPathIcon as Loader2 } from '@heroicons/react/24/outline'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface GlobalSearchProps {
  className?: string
}

export function GlobalSearch({ className }: GlobalSearchProps) {
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
        console.log('[Voice] Started listening')
        setIsListening(true)
      }

      recognizer.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript
        console.log('[Voice] Transcript:', transcript)
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
        console.log('[Voice] Stopped listening')
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

  const handleVoiceCommand = async (command: string) => {
    console.log('[Voice] Processing command:', command)
    setIsProcessing(true)

    const lowerCommand = command.toLowerCase()

    // Check if it's a SEARCH command - these go directly to search page
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
      console.log('[Search] Navigating to search page for:', command)
      window.location.href = `/search?q=${encodeURIComponent(command)}`
      return
    }

    // Check if it's an AI/action command
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
      'decode vin',
      'go to',
      'navigate to',
      'open'
    ]

    const isAICommand = aiTriggers.some(trigger => 
      lowerCommand.includes(trigger)
    )

    if (isAICommand) {
      // Send to AI assistant for actions
      await processAICommand(command)
    } else {
      // Default: treat as search
      console.log('[Search] Default search for:', command)
      window.location.href = `/search?q=${encodeURIComponent(command)}`
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
      
      console.log('[Voice] AI Response:', data)

      // Speak the response
      if (data.message && 'speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(data.message)
        utterance.rate = 1.1
        utterance.pitch = 1.0
        window.speechSynthesis.speak(utterance)
      }

      // Show visual response (TODO: implement notification/modal system)
      console.log('[Voice] AI Message:', data.message)

      // Execute action if needed
      if (data.action === 'navigate' && data.url) {
        setTimeout(() => {
          window.location.href = data.url
        }, 1000) // Small delay for voice response
      }

      // For maintenance recommendations, we could trigger a modal
      if (data.action === 'show_maintenance_dialog' && data.data) {
        console.log('[Voice] Maintenance data:', data.data)
        // TODO: Trigger maintenance dialog/modal
      }

      // Handle AI-powered search results - navigate to search results page
      if (data.action === 'show_search_results' && data.action_data) {
        console.log('[Search] AI Search Results:', data.action_data)
        
        // Navigate to search results page with the query
        const searchQuery = encodeURIComponent(command)
        window.location.href = `/search?q=${searchQuery}`
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
    // Your existing search logic
    console.log('[Search] Searching for:', searchQuery)
    // TODO: Implement global search across ROs, customers, vehicles
    
    // For now, just log
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
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
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
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : isListening ? (
            <MicOff className="w-5 h-5" />
          ) : (
            <Mic className="w-5 h-5" />
          )}
        </Button>
      )}
    </form>
  )
}
