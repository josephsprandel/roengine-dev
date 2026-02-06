"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Send, Sparkles, CheckCircle, XCircle, Clock } from "lucide-react"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"

interface LogEntry {
  timestamp: string
  type: 'info' | 'prompt' | 'response' | 'error' | 'success'
  title: string
  content: string
}

export default function AIMaintenanceDebugPage() {
  // Form inputs
  const [vin, setVin] = useState("1HGCV1F30JA123456")
  const [year, setYear] = useState("2020")
  const [make, setMake] = useState("Honda")
  const [model, setModel] = useState("Accord")
  const [mileage, setMileage] = useState("45000")

  // State
  const [loading, setLoading] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [prompt, setPrompt] = useState("")
  const [response, setResponse] = useState("")
  const [duration, setDuration] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const addLog = (type: LogEntry['type'], title: string, content: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs(prev => [...prev, { timestamp, type, title, content }])
  }

  const clearLogs = () => {
    setLogs([])
    setPrompt("")
    setResponse("")
    setDuration(null)
    setError(null)
  }

  const handleTest = async () => {
    clearLogs()
    setLoading(true)
    setError(null)

    const startTime = Date.now()

    try {
      // Step 1: Validate inputs
      addLog('info', 'Step 1: Validating Inputs', 
        `VIN: ${vin || 'N/A'}\nYear: ${year}\nMake: ${make}\nModel: ${model}\nMileage: ${mileage}`)

      if (!mileage || isNaN(parseInt(mileage))) {
        throw new Error('Valid mileage is required')
      }

      const hasVIN = vin && vin.trim().length > 0
      const hasYMM = year && make && model

      if (!hasVIN && !hasYMM) {
        throw new Error('Must provide either VIN or year/make/model')
      }

      addLog('success', 'Validation Passed', 
        hasVIN ? 'Using VIN-based lookup' : 'Using Year/Make/Model lookup')

      // Step 2: Build request
      const requestBody: any = {
        mileage: parseInt(mileage)
      }

      if (hasVIN) {
        requestBody.vin = vin.trim()
      } else {
        requestBody.year = parseInt(year)
        requestBody.make = make.trim()
        requestBody.model = model.trim()
      }

      addLog('info', 'Step 2: Building Request', JSON.stringify(requestBody, null, 2))

      // Step 3: Call API
      addLog('info', 'Step 3: Calling Gemini API', 'Sending request to /api/maintenance-recommendations')

      const response = await fetch('/api/maintenance-recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      setDuration(parseFloat(elapsed))

      addLog('info', 'API Response Received', 
        `Status: ${response.status} ${response.statusText}\nDuration: ${elapsed}s`)

      // Step 4: Parse response
      const data = await response.json()

      if (!response.ok) {
        addLog('error', 'API Error', JSON.stringify(data, null, 2))
        throw new Error(data.error || `API error: ${response.status}`)
      }

      addLog('success', 'Step 4: Response Parsed', 
        `Services found: ${data.services?.length || data.variants?.length || 0}`)

      // Display prompt (reconstructed from what we know the API sends)
      const reconstructedPrompt = buildPrompt(requestBody)
      setPrompt(reconstructedPrompt)
      addLog('prompt', 'Gemini Prompt (Reconstructed)', reconstructedPrompt)

      // Display response
      const formattedResponse = JSON.stringify(data, null, 2)
      setResponse(formattedResponse)
      addLog('response', 'Gemini Response', formattedResponse)

      // Step 5: Process results
      if (data.multiple_variants) {
        addLog('info', 'Multiple Variants Detected', 
          `Found ${data.variants.length} engine variants:\n${data.variants.map((v: any, i: number) => 
            `${i + 1}. ${v.engine_displacement} ${v.engine_type} - ${v.transmission_type}`
          ).join('\n')}`)
      } else if (data.services) {
        addLog('success', 'Services Extracted', 
          `${data.services.length} maintenance services due:\n${data.services.map((s: any, i: number) => 
            `${i + 1}. ${s.service_name} (${s.urgency}) - ${s.mileage_interval.toLocaleString()} mi`
          ).join('\n')}`)
      }

      addLog('success', 'Test Complete', 
        `Total duration: ${elapsed}s\nSource: ${data.source}`)

    } catch (err: any) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      setDuration(parseFloat(elapsed))
      setError(err.message)
      addLog('error', 'Test Failed', err.message)
    } finally {
      setLoading(false)
    }
  }

  const buildPrompt = (requestBody: any): string => {
    const hasVIN = !!requestBody.vin
    const mileage = requestBody.mileage

    let prompt = `You have access to web search and can read PDFs from the web.

Task: Find the owner's manual and extract maintenance recommendations.

`

    if (hasVIN) {
      prompt += `VIN: ${requestBody.vin}
Current mileage: ${mileage} miles
Driving conditions: SEVERE (short trips, stop-and-go, extreme temps, dusty, towing)

Steps:
1. Decode the VIN to determine:
   - Year, Make, Model
   - Engine displacement and type (1.5L, 2.0L, V6, etc.)
   - Engine code (L15BE, K20C4, etc.) if determinable
   - Transmission type (CVT, manual, automatic, 10AT, etc.)
   - Drivetrain (FWD, RWD, AWD)
   - Trim level if possible

2. If VIN cannot be decoded to a SPECIFIC engine variant:
   - Return all possible engine options for this vehicle
   - Label each variant clearly (1.5L CVT, 2.0L Manual, etc.)
   - User will select correct variant in UI

3. Search the web for the owner's manual PDF for this exact configuration

4. Read the owner's manual PDF directly from the web (you can access PDFs at URLs)`
    } else {
      prompt += `Vehicle: ${requestBody.year} ${requestBody.make} ${requestBody.model}
Current mileage: ${mileage} miles
Driving conditions: SEVERE (short trips, stop-and-go, extreme temps, dusty, towing)

IMPORTANT: This vehicle may have multiple engine/transmission options.

Steps:
1. Identify ALL possible engine variants for ${requestBody.year} ${requestBody.make} ${requestBody.model}
   Examples:
   - 1.5L Turbocharged I4 with CVT
   - 2.0L Turbocharged I4 with 6-speed Manual
   - 3.5L V6 with 10-speed Automatic

2. For EACH variant, search for the owner's manual PDF

3. Read each owner's manual PDF directly from the web`
    }

    prompt += `

5. Find the "Maintenance Schedule" or "Service Intervals" section

6. Extract services due at or before ${mileage} miles for SEVERE driving conditions
   - Always use SEVERE schedule if manual has both normal and severe
   - Severe = short trips, stop-and-go, extreme temps, dusty, towing

[... full prompt continues with detailed instructions ...]

Return JSON with maintenance services, parts list, labor hours, and urgency levels.`

    return prompt
  }

  const getLogIcon = (type: LogEntry['type']) => {
    switch (type) {
      case 'success': return <CheckCircle className="text-green-600" size={16} />
      case 'error': return <XCircle className="text-red-600" size={16} />
      case 'prompt': return <Sparkles className="text-purple-600" size={16} />
      case 'response': return <Sparkles className="text-blue-600" size={16} />
      default: return <Clock className="text-gray-600" size={16} />
    }
  }

  const getLogColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'success': return 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
      case 'error': return 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
      case 'prompt': return 'bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800'
      case 'response': return 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800'
      default: return 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800'
    }
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-900">
                <Sparkles size={24} className="text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">AI Maintenance Debug Console</h1>
                <p className="text-sm text-muted-foreground">
                  Test and debug the Gemini AI maintenance recommendations system
                </p>
              </div>
            </div>

            {/* Test Form */}
            <Card className="p-6 border-border">
              <h2 className="text-lg font-semibold mb-4">Test Parameters</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="vin">VIN (Optional)</Label>
                  <Input
                    id="vin"
                    value={vin}
                    onChange={(e) => setVin(e.target.value)}
                    placeholder="1HGCV1F30JA123456"
                    disabled={loading}
                  />
                  <p className="text-xs text-muted-foreground">Leave empty to use Y/M/M</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="year">Year</Label>
                  <Input
                    id="year"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    placeholder="2020"
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="make">Make</Label>
                  <Input
                    id="make"
                    value={make}
                    onChange={(e) => setMake(e.target.value)}
                    placeholder="Honda"
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="model">Model</Label>
                  <Input
                    id="model"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="Accord"
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mileage">Mileage *</Label>
                  <Input
                    id="mileage"
                    type="number"
                    value={mileage}
                    onChange={(e) => setMileage(e.target.value)}
                    placeholder="45000"
                    disabled={loading}
                    required
                  />
                </div>

                <div className="flex items-end">
                  <Button 
                    onClick={handleTest} 
                    disabled={loading}
                    className="w-full gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="animate-spin" size={16} />
                        Testing...
                      </>
                    ) : (
                      <>
                        <Send size={16} />
                        Run Test
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {duration !== null && (
                <div className="mt-4 p-3 rounded-lg bg-muted">
                  <p className="text-sm font-medium">
                    Duration: <span className="text-primary">{duration}s</span>
                    {error && <span className="ml-4 text-destructive">Error: {error}</span>}
                  </p>
                </div>
              )}
            </Card>

            {/* Execution Logs */}
            {logs.length > 0 && (
              <Card className="p-6 border-border">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Execution Log</h2>
                  <Button variant="outline" size="sm" onClick={clearLogs}>
                    Clear
                  </Button>
                </div>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {logs.map((log, i) => (
                    <div 
                      key={i}
                      className={`p-3 rounded-lg border ${getLogColor(log.type)}`}
                    >
                      <div className="flex items-start gap-3">
                        {getLogIcon(log.type)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-muted-foreground">{log.timestamp}</span>
                            <span className="font-medium text-sm">{log.title}</span>
                          </div>
                          <pre className="text-xs font-mono whitespace-pre-wrap break-words overflow-x-auto">
                            {log.content}
                          </pre>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Gemini Prompt */}
            {prompt && (
              <Card className="p-6 border-border">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Sparkles className="text-purple-600" size={20} />
                  Gemini Prompt Sent
                </h2>
                <Textarea
                  value={prompt}
                  readOnly
                  className="font-mono text-xs min-h-[400px] bg-muted"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  This is the prompt sent to Gemini AI to extract maintenance data from owner's manuals
                </p>
              </Card>
            )}

            {/* Gemini Response */}
            {response && (
              <Card className="p-6 border-border">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Sparkles className="text-blue-600" size={20} />
                  Gemini Response Received
                </h2>
                <Textarea
                  value={response}
                  readOnly
                  className="font-mono text-xs min-h-[400px] bg-muted"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Raw JSON response from Gemini AI with maintenance services, parts, and labor hours
                </p>
              </Card>
            )}

            {/* Documentation */}
            <Card className="p-6 border-border bg-muted/30">
              <h2 className="text-lg font-semibold mb-4">How It Works</h2>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  <strong>1. VIN Decode:</strong> Gemini identifies the exact engine variant from the VIN
                </p>
                <p>
                  <strong>2. Manual Lookup:</strong> Searches the web for the vehicle's owner's manual PDF
                </p>
                <p>
                  <strong>3. PDF Extraction:</strong> Reads the maintenance schedule from the PDF
                </p>
                <p>
                  <strong>4. Service Analysis:</strong> Extracts services due at or before current mileage
                </p>
                <p>
                  <strong>5. Parts Matching:</strong> Finds OEM part numbers and specifications
                </p>
                <p>
                  <strong>6. Labor Estimation:</strong> Determines labor hours from manual or industry standards
                </p>
              </div>
            </Card>
          </div>
        </main>
      </div>
    </div>
  )
}
