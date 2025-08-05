export const replaceZero = (value: string): number | string => {
  if (!value) return value
  const num = Math.round(Number(value) * 100) / 100
  return Number.isInteger(num) || value.endsWith('.00') ? num.toString() : value
}
