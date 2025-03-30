import { Location } from "react-router";

export const getMirroredUrl = (isAdminPage: boolean, location: Location) => {
    const segments = location.pathname.split('/').filter(Boolean);
    
    if (segments.length < 1) return isAdminPage ? "/employee" : "/admin";
    
    const currentRole = segments[0]; 
    const targetRole = currentRole === "admin" ? "employee" : "admin";
    
    if (segments.length < 2) return `/${targetRole}`;
    
    const currentSection = segments[1];
    
    const supportedSections = ["stones", "instructions", "sinks", "suppliers", "supports", "documents", "images"];
    
    const search = currentSection === "stones" ? location.search : "";
    if (supportedSections.includes(currentSection)) {
      return `/${targetRole}/${currentSection}${search}`;
    }
    return `/${targetRole}`;
  };
  
  export const getCustomerUrl = (isCustomerPage: boolean, location: Location) => {
    return isCustomerPage ? `/employee/stones${location.search}` : `/customer/1/stones${location.search}`;
  };