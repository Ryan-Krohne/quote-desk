// Supported trades and the job facts each one needs (docs/contract.md, section 5).
// list_trades returns this list; submit_job and request_quotes check it.

export type FactDefinition = {
  name: string
  type: 'string' | 'integer'
  required: boolean
  values?: string[]
  description?: string
}

export type TradeDefinition = {
  trade: string
  label: string
  facts: FactDefinition[]
}

export const TRADES: TradeDefinition[] = [
  {
    trade: 'water_heater',
    label: 'Water heater',
    facts: [
      { name: 'fuel_type', type: 'string', required: true, values: ['gas', 'electric', 'propane', 'unknown'] },
      { name: 'tank_size_gallons', type: 'integer', required: true },
      {
        name: 'age_years',
        type: 'integer',
        required: true,
        description: 'Calculate from the serial number on the label when possible.',
      },
      {
        name: 'venting_type',
        type: 'string',
        required: true,
        values: ['atmospheric', 'power_vent', 'direct_vent', 'none_electric', 'unknown'],
      },
      { name: 'location', type: 'string', required: true, values: ['garage', 'basement', 'closet', 'attic', 'other'] },
      { name: 'leak_location', type: 'string', required: false, values: ['top', 'bottom', 'valve', 'none', 'unknown'] },
      { name: 'requested_service', type: 'string', required: false, values: ['replace', 'repair', 'unsure'] },
      { name: 'brand', type: 'string', required: false },
      { name: 'model_number', type: 'string', required: false },
      { name: 'access_notes', type: 'string', required: false, description: 'For example: "Narrow stairs".' },
    ],
  },
]

export const TRADE_NAMES = TRADES.map((t) => t.trade) as [string, ...string[]]

export function findTrade(trade: string): TradeDefinition | undefined {
  return TRADES.find((t) => t.trade === trade)
}

// Required facts that are absent or empty. "unknown" counts as given: the
// homeowner does not know, so the business's desk decides what to do.
export function missingFacts(trade: string, facts: Record<string, unknown>): string[] {
  const definition = findTrade(trade)
  if (!definition) return []
  return definition.facts
    .filter((f) => f.required)
    .filter((f) => facts[f.name] === undefined || facts[f.name] === null || facts[f.name] === '')
    .map((f) => f.name)
}
