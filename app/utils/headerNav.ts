import { Location } from "react-router";

export const getMirroredUrl = (isAdminPage: boolean, location: Location) => {
    const segments = location.pathname.split('/').filter(Boolean);

    console.log({ segments})
    
    if (segments.length < 1) return isAdminPage ? "/employee" : "/admin";
    
    const currentRole = segments[0]; 
    const targetRole = currentRole === "admin" ? "employee" : "admin";
    console.log({ currentRole, targetRole})
    
    if (segments.length < 2) return `/${targetRole}`;
    
    const currentSection = segments[1];
    
    const supportedSections = ["stones", "instructions", "sinks", "suppliers", "supports", "documents", "images"];
    
    console.log("BEFORE")
    const search = currentSection === "stones" ? location.search : "";
    if (supportedSections.includes(currentSection)) {
      console.log("INSIDE")
      return `/${targetRole}/${currentSection}${search}`;
    }
    console.log(search)
    return `/${targetRole}`;
  };
  
  export const getCustomerUrl = (isCustomerPage: boolean, location: Location) => {
    return isCustomerPage ? `/employee/stones${location.search}` : `/customer/1/stones${location.search}`;
  };