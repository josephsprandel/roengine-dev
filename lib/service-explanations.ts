import serviceExplanationsData from './service-explanations.json'

export interface ServiceExplanation {
  id: string
  name: string
  aliases: string[]
  level_1: {
    summary: string
  }
  level_2: {
    what: string
    why: string
    consequences: string
  }
  template_vehicle_line: string
}

const explanations: ServiceExplanation[] = serviceExplanationsData.services as ServiceExplanation[]

/**
 * Get explanation for a service by name.
 * Tries exact match, then alias match, then partial/fuzzy match.
 */
export function getServiceExplanation(serviceName: string): ServiceExplanation | null {
  const nameLower = serviceName.toLowerCase().trim()

  // 1. Exact match on primary name
  let explanation = explanations.find(e =>
    e.name.toLowerCase() === nameLower
  )
  if (explanation) return explanation

  // 2. Exact match on aliases
  explanation = explanations.find(e =>
    e.aliases.some(alias => alias.toLowerCase() === nameLower)
  )
  if (explanation) return explanation

  // 3. Partial match — service name contains or is contained by the entry name/aliases
  explanation = explanations.find(e => {
    const eName = e.name.toLowerCase()
    if (nameLower.includes(eName) || eName.includes(nameLower)) return true
    return e.aliases.some(alias => {
      const aLower = alias.toLowerCase()
      return nameLower.includes(aLower) || aLower.includes(nameLower)
    })
  })

  return explanation || null
}

export interface VehicleContext {
  year: number
  make: string
  model: string
  mileage?: number
  engine_type?: string
  drive_type?: string
  fuel_type?: string
}

/**
 * Replace template variables with actual vehicle data.
 */
export function interpolateTemplateVars(
  text: string,
  vehicle: VehicleContext,
): string {
  let result = text

  // Vehicle data
  result = result.replace(/\{\{year\}\}/g, String(vehicle.year))
  result = result.replace(/\{\{make\}\}/g, vehicle.make)
  result = result.replace(/\{\{model\}\}/g, vehicle.model)
  result = result.replace(/\{\{mileage\}\}/g, vehicle.mileage?.toLocaleString() || 'current')
  result = result.replace(/\{\{engine_type\}\}/g, vehicle.engine_type || 'engine')
  result = result.replace(/\{\{drive_type\}\}/g, vehicle.drive_type || 'drivetrain')
  result = result.replace(/\{\{fuel_type\}\}/g, vehicle.fuel_type || 'gasoline')

  return result
}
