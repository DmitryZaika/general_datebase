export const getBase = (pathname: string) => {
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname.startsWith("/employee")) return "employee";
  if (pathname.startsWith("/customer")) {
    return pathname.split("/").slice(1, 3).join("/");
  }
  return undefined;
};
