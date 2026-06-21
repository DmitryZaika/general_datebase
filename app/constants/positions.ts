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
    description:
      'Employee CRM access. Customers you create are assigned to you as sales rep. You appear in customer, deal, and email filters and on post-install surveys.',
  },
  {
    id: 2,
    name: 'sales_manager',
    displayName: 'Sales Manager',
    description:
      'Sales rep access plus Delete on the Customers list. Used for Telegram lead alerts and assigning incoming leads to reps.',
  },
  {
    id: 3,
    name: 'shop_manager',
    displayName: 'Shop Manager',
    description:
      'Organizational label for shop leadership. Does not lock login to a specific app; pair with Employee or Admin for CRM access.',
  },
  {
    id: 4,
    name: 'shop_worker',
    displayName: 'Shop Worker',
    description:
      'Login is limited to the Shop app: Transactions and Samples. For logging shop sales and stone usage, not the employee CRM.',
  },
  {
    id: 5,
    name: 'manager',
    displayName: 'Manager',
    description:
      'Organizational label only. Does not grant pages or permissions by itself; pair with Employee or Admin for system access.',
  },
  {
    id: 6,
    name: 'installer',
    displayName: 'Installer',
    description:
      'Login goes to the post-install Checklist form. Submit job completion checklists; customers can select you on post-install surveys.',
  },
  {
    id: 7,
    name: 'external_marketing',
    displayName: 'Marketing',
    description:
      'Login goes to External Marketing leads for assigned companies. View and manage marketing leads, walk-ins, and deal stats there.',
  },
  {
    id: 8,
    name: 'check-in',
    displayName: 'Check-In',
    description:
      'Login goes to the shop Check-In form only. Register walk-in customers (shown as walk-ins in Customers and statistics).',
  },
  {
    id: 9,
    name: 'super_admin',
    displayName: 'Super Admin',
    description:
      'Switch companies from the header. In each assigned company you get full admin and employee access (users, customers, deals, settings).',
  },
  {
    id: 10,
    name: 'office_manager',
    displayName: 'Office Manager',
    description:
      'With a CloudTalk phone set, post-install survey links are also sent by SMS from that number when an installer submits a checklist.',
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
