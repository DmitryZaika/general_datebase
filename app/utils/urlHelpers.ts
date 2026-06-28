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

// Base path for the CloudTalk SMS page; any non-admin base resolves to /employee.
export const cloudtalkBasePath = (
  pathname: string,
): '/admin/cloudtalk' | '/employee/cloudtalk' =>
  getBase(pathname) === 'admin' ? '/admin/cloudtalk' : '/employee/cloudtalk'
