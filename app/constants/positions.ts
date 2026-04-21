export interface PositionInfo {
  id: number
  name: string
  displayName: string
  description?: string
}

export const POSITIONS: PositionInfo[] = [
  {
    id: 1,
    name: 'sales_rep',
    displayName: 'Sales Representative',
    description: 'Can sell stones',
  },
  {
    id: 2,
    name: 'sales_manager',
    displayName: 'Sales Manager',
    description: 'Can get and assign leads in telegram',
  },
  {
    id: 3,
    name: 'shop_manager',
    displayName: 'Shop Manager',
  },
  {
    id: 4,
    name: 'shop_worker',
    displayName: 'Shop Worker',
  },
  {
    id: 5,
    name: 'manager',
    displayName: 'Manager',
  },
  {
    id: 6,
    name: 'installer',
    displayName: 'Installer',
  },
  {
    id: 7,
    name: 'external_marketing',
    displayName: 'Marketing',
  },
  {
    id: 8,
    name: 'check-in',
    displayName: 'Check-In',
  },
  {
    id: 9,
    name: 'super_admin',
    displayName: 'Super Admin',
    description: 'Can switch between multiple companies',
  },
]

export const getPositionById = (id: number): PositionInfo | undefined => {
  return POSITIONS.find(position => position.id === id)
}

export const getPositionByName = (name: string): PositionInfo | undefined => {
  return POSITIONS.find(position => position.name === name)
}

export const getPositionsByIds = (ids: number[]): PositionInfo[] => {
  return POSITIONS.filter(position => ids.includes(position.id))
}
