import { query } from '@/lib/db'

export interface Service {
  id: number
  name: string
  estimated_cost: number
  urgency: 'critical' | 'overdue' | 'due_now' | 'recommended' | 'coming_soon'
  urgency_display: string
  description: string
}

export interface Hotspot {
  zone_name: string
  zone_label: string
  top_percent: number
  left_percent: number
  size_px: number
  urgency: 'critical' | 'recommended' | 'coming_soon'
  count: number
  services: Service[]
}

/**
 * Generate zone-based hotspots for a vehicle's recommended services
 */
export async function generateHotspots(
  bodyStyle: string,
  services: Service[]
): Promise<Hotspot[]> {
  // 1. Get zone positions for this body style
  const zonesResult = await query(
    `SELECT zone_name, zone_label, top_percent, left_percent, size_px
     FROM vehicle_zones
     WHERE body_style = $1`,
    [bodyStyle]
  )

  const zones = zonesResult.rows

  // 2. Get all zone mappings for the provided services in one query (case-insensitive)
  const serviceNamesLower = services.map(s => s.name.toLowerCase())
  const mappingResult = await query(
    `SELECT service_name, zone_name
     FROM service_zone_mapping
     WHERE LOWER(service_name) = ANY($1)`,
    [serviceNamesLower]
  )

  // 3. Group services by zone (case-insensitive lookup)
  //    Deduplicate: each service only appears in the first zone it maps to,
  //    so multi-zone mappings don't inflate the service count.
  const serviceByName = new Map(services.map(s => [s.name.toLowerCase(), s]))
  const zoneServiceMap = new Map<string, Service[]>()
  const assignedServices = new Set<string>()

  for (const mapping of mappingResult.rows) {
    const serviceKey = mapping.service_name.toLowerCase()
    if (assignedServices.has(serviceKey)) continue

    const service = serviceByName.get(serviceKey)
    if (!service) continue

    assignedServices.add(serviceKey)

    const list = zoneServiceMap.get(mapping.zone_name)
    if (list) {
      list.push(service)
    } else {
      zoneServiceMap.set(mapping.zone_name, [service])
    }
  }

  // 4. Generate hotspots (only for zones with services)
  const hotspots: Hotspot[] = []

  for (const [zoneName, zoneServices] of zoneServiceMap) {
    const zone = zones.find(z => z.zone_name === zoneName)
    if (!zone) continue

    hotspots.push({
      zone_name: zoneName,
      zone_label: zone.zone_label,
      top_percent: parseFloat(zone.top_percent),
      left_percent: parseFloat(zone.left_percent),
      size_px: zone.size_px,
      urgency: calculateHighestUrgency(zoneServices),
      count: zoneServices.length,
      services: zoneServices,
    })
  }

  return hotspots
}

/**
 * Determine highest urgency level from a list of services.
 * Maps the 5-level service urgency to a 3-level hotspot urgency.
 */
function calculateHighestUrgency(
  services: Service[]
): 'critical' | 'recommended' | 'coming_soon' {
  if (services.some(s => s.urgency === 'critical')) return 'critical'
  if (services.some(s => s.urgency === 'overdue')) return 'critical'
  if (services.some(s => s.urgency === 'due_now')) return 'recommended'
  if (services.some(s => s.urgency === 'recommended')) return 'recommended'
  return 'coming_soon'
}
