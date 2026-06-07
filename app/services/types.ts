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
