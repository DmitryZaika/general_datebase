export const EMPLOYEE_VIEW_ENTER_EASE: [number, number, number, number] = [
  0.2, 0.78, 0.22, 1,
]

export const EMPLOYEE_VIEW_ENTER = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.38, ease: EMPLOYEE_VIEW_ENTER_EASE },
}

export function employeeViewMotionKey(pathname: string, search: string) {
  return `${pathname}${search}`
}
