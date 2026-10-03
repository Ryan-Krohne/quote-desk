const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })

export function formatDollars(amount: number | null | undefined): string {
  return amount == null ? "—" : dollars.format(amount)
}

export function formatRange(low: number | null, high: number | null): string {
  if (low == null || high == null) return "—"
  return low === high ? formatDollars(low) : `${formatDollars(low)} – ${formatDollars(high)}`
}

// "tank_size_gallons" -> "Tank size gallons"
export function labelFromKey(key: string): string {
  const words = key.replace(/_/g, " ")
  return words.charAt(0).toUpperCase() + words.slice(1)
}
