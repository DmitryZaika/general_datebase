export const getBase = (pathname: string) => {
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname.startsWith("/employee")) return "employee";
  if (pathname.startsWith("/customer")) {
    return "customer";
  }
  return undefined;
};
