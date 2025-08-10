export const replaceZero = (value: string): number | string => {
  if (!value) return value
  const num = Math.round(Number(value) * 100) / 100
  return Number.isInteger(num) || value.endsWith('.00') ? num.toString() : value
}

// Remove $ and commas, return numeric string with two decimals max
export const updateNumber = (value: string): string => {
  if (!value) return value
  const cleaned = value.replace(/[^0-9.]/g, '')
  const num = parseFloat(cleaned)
  if (Number.isNaN(num)) return ''
  return (Math.round(num * 100) / 100).toString()
}

// Format number or numeric string with thousand separators
export const formatMoney = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined || value === '') return '0'
  const num = typeof value === 'number' ? value : parseFloat(value)
  if (Number.isNaN(num)) return '0'
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 })
}
