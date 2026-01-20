export const getBase = (pathname: string) => {
  if (pathname.startsWith('/admin')) return 'admin'
  if (pathname.startsWith('/employee')) return 'employee'
  if (pathname.startsWith('/shop')) return 'shop'
  if (pathname.startsWith('/customer')) {
    return 'customer'
  }
  if (pathname.startsWith('/contractors')) {
    return 'contractors'
  }
  return undefined
}
