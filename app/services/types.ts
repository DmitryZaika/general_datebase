export interface ParsedAddress {
  street: string
  city: string | null
  state: string | null
  zip: string | null
}

export interface Description {
  text: string
}

export interface FinalSuggestion {
  description: Description
  place_id: string
  address: ParsedAddress
}

interface UserVariableData {
  name?: string | null
  email?: string | null
  phone_number?: string | null // Preserved snake_case from Rust
}

// Reusable interface for matching customer and company data shapes
interface InfoVariableData {
  name?: string | null
  address?: string | null
}

export interface TemplateVariableData {
  user: UserVariableData // This is required, though its inner fields are optional
  customer?: InfoVariableData | null
  company?: InfoVariableData | null
}
