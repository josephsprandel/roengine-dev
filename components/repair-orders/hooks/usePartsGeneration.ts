"use client"

import { useState, useCallback } from "react"

interface UsePartsGenerationReturn {
  // State
  servicesWithParts: any[]
  generating: boolean
  loadingStep: string

  // Dialog state
  dialogOpen: boolean
  setDialogOpen: (open: boolean) => void

  // Actions
  generateParts: () => Promise<void>
  confirmPartsSelection: (servicesWithSelectedParts: any[]) => Promise<void>
}

interface PartsGenerationVehicle {
  year: number
  make: string
  model: string
  vin: string
}

/**
 * Hook: usePartsGeneration
 *
 * Extracts all parts generation logic from ro-detail-view.
 * Handles the 4-step loading UX, parts list generation via AI,
 * and adding services + parts to the work order.
 *
 * @param workOrderId - The work order database ID
 * @param selectedAiServices - Currently selected AI services (from useAIRecommendations)
 * @param servicesCount - Current number of services on the RO (for display_order)
 * @param vehicle - Vehicle info for parts generation API
 * @param onReloadServices - Callback to reload services from database after adding
 * @param showToast - Callback to show toast notifications
 */
export function usePartsGeneration(
  workOrderId: number | undefined,
  selectedAiServices: any[],
  servicesCount: number,
  vehicle: PartsGenerationVehicle | null,
  onReloadServices: () => Promise<void>,
  showToast: (message: string, type: "success" | "error") => void
): UsePartsGenerationReturn {
  // Parts generation states
  const [dialogOpen, setDialogOpen] = useState(false)
  const [servicesWithParts, setServicesWithParts] = useState<any[]>([])
  const [generating, setGenerating] = useState(false)
  const [loadingStep, setLoadingStep] = useState<string>('')

  /**
   * NEW FLOW: Generate parts list with AI + PartsTech pricing
   *
   * This replaces the old "add services with labor only" flow.
   * Now we:
   * 1. Generate parts list via AI
   * 2. Look up pricing via PartsTech
   * 3. Show parts selection modal
   * 4. Add services + parts to RO
   */
  const generateParts = useCallback(async () => {
    if (!workOrderId || selectedAiServices.length === 0) return

    console.log('=== GENERATING PARTS LIST FOR SERVICES ===')
    console.log('Selected services:', selectedAiServices.length)

    setGenerating(true)

    try {
      // Step 1: Analyzing services
      setLoadingStep('Analyzing services...')
      await new Promise(resolve => setTimeout(resolve, 300))

      // Step 2: Generating parts list with AI
      setLoadingStep('Generating parts list with AI...')
      const partsResponse = await fetch('/api/services/generate-parts-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          services: selectedAiServices.map(s => ({
            service_name: s.service_name,
            service_description: s.service_description
          })),
          vehicle: vehicle ? {
            year: vehicle.year,
            make: vehicle.make,
            model: vehicle.model,
            engine: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
            vin: vehicle.vin
          } : undefined
        })
      })

      if (!partsResponse.ok) {
        const errorText = await partsResponse.text()
        console.error('Parts API Error:', errorText)
        throw new Error(`Failed to generate parts list: ${errorText}`)
      }

      // Step 3: Looking up pricing
      setLoadingStep('Looking up pricing...')
      const { servicesWithParts: generatedParts } = await partsResponse.json()
      console.log('✓ Parts generated for', generatedParts.length, 'services')

      // Step 4: Preparing selection
      setLoadingStep('Preparing selection...')
      await new Promise(resolve => setTimeout(resolve, 200))

      // Done - Show parts selection modal
      setServicesWithParts(generatedParts)
      setDialogOpen(true)

    } catch (error: any) {
      console.error('Failed to generate parts:', error)
      showToast(error.message || 'Failed to generate parts list', 'error')
    } finally {
      setGenerating(false)
      setLoadingStep('')
    }
  }, [selectedAiServices, workOrderId, vehicle, showToast])

  /**
   * Confirm parts selection and add services + parts to RO
   */
  const confirmPartsSelection = useCallback(async (servicesWithSelectedParts: any[]) => {
    if (!workOrderId) return

    console.log('=== ADDING SERVICES WITH PARTS ===')
    setDialogOpen(false)

    // Save each service with its selected parts
    for (let i = 0; i < servicesWithSelectedParts.length; i++) {
      const serviceData = servicesWithSelectedParts[i]
      const aiService = selectedAiServices[i]

      try {
        console.log('Creating service:', serviceData.serviceName)

        // Step 1: Create service record
        const serviceResponse = await fetch(`/api/work-orders/${workOrderId}/services`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: serviceData.serviceName,
            description: aiService.service_description || '',
            display_order: servicesCount + i,
            ai_generated: true
          })
        })

        if (!serviceResponse.ok) {
          console.error('✗ Failed to create service:', serviceData.serviceName)
          continue
        }

        const serviceResult = await serviceResponse.json()
        const serviceId = serviceResult.service?.id
        console.log('✓ Service created - ID:', serviceId)

        // Step 2: Add labor item
        await fetch(`/api/work-orders/${workOrderId}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            item_type: 'labor',
            description: serviceData.serviceName,
            notes: aiService.service_description,
            labor_hours: aiService.estimated_labor_hours || 1,
            labor_rate: 160, // TODO: Move to shop settings
            is_taxable: false, // TODO: Move to shop settings
            service_id: serviceId
          })
        })
        console.log('✓ Labor item added')

        // Step 3: Add part items
        for (const part of serviceData.parts) {
          if (!part.selectedOption) {
            console.log('⚠️ No pricing for:', part.description, '- skipping')
            continue
          }

          await fetch(`/api/work-orders/${workOrderId}/items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              item_type: 'part',
              description: part.selectedOption.description || part.description,
              quantity: part.quantity,
              unit_price: part.selectedOption.retailPrice,
              is_taxable: true, // TODO: Move to shop settings
              service_id: serviceId
            })
          })
          console.log('✓ Part added:', part.description)
        }
      } catch (error) {
        console.error('Error adding service:', error)
      }
    }

    // Reload services from database
    console.log('Reloading services...')
    try {
      await onReloadServices()
      showToast('Services and parts added to RO', 'success')
    } catch (error) {
      console.error('Error reloading services:', error)
    }

    console.log('=== SAVE COMPLETE ===')
  }, [workOrderId, selectedAiServices, servicesCount, onReloadServices, showToast])

  return {
    // State
    servicesWithParts,
    generating,
    loadingStep,

    // Dialog state
    dialogOpen,
    setDialogOpen,

    // Actions
    generateParts,
    confirmPartsSelection,
  }
}
