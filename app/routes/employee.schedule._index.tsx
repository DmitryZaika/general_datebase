import { redirect } from "react-router";

export async function loader() {
  // Redirect to the default schedule view (month)
  throw redirect("/employee/schedule/month");
}

// This component won't be rendered due to the redirect
export default function EmployeesScheduleIndex() {
  return null;
} 