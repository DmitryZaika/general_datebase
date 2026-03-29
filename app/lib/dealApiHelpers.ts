export const buildActivityApiAction = (dealId: number): string =>
  `/api/deal-activities/${dealId}`

export const buildNoteApiAction = (dealId: number): string => `/api/deal-notes/${dealId}`
