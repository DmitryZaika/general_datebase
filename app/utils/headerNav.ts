import { Location } from "react-router";

export const getMirroredUrl = (isAdminPage: boolean, location: Location) => {
    const segments = location.pathname.split('/').filter(Boolean);
    const search = location.search || "";
    
    if (segments.length >= 2 && segments[0] === "customer" && segments[2] === "stones") {
      return `/admin/stones${search}`;
    }
    
    if (segments.length < 1) return isAdminPage ? `/employee${search}` : `/admin${search}`;
    
    const currentRole = segments[0]; 
    const targetRole = currentRole === "admin" ? "employee" : "admin";
    
    if (segments.length < 2) return `/${targetRole}${search}`;
    
    const currentSection = segments[1];
    
    const supportedSections = ["stones", "instructions", "sinks", "suppliers", "supports", "documents", "images"];
    
    if (supportedSections.includes(currentSection)) {
      return `/${targetRole}/${currentSection}${search}`;
    }
    return `/${targetRole}${search}`;
};

export const getCustomerUrl = (isCustomerPage: boolean, location: Location, companyId: number | string = 1) => {
  const search = location.search || '';
  
  if (!isCustomerPage && location.pathname.startsWith("/admin/stones")) {
    return `/customer/${companyId}/stones${search}`;
  }
  
  return isCustomerPage ? `/employee/stones${search}` : `/customer/${companyId}/stones${search}`;
};