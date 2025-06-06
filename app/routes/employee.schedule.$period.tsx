import { LoaderFunctionArgs, redirect } from "react-router";
import { useLoaderData, useNavigate, useParams } from "react-router";
import SchedulerViewFilteration from "@/components/molecules/schedule/schedular-view-filteration";
import { SchedulerProvider } from "~/providers/scheduler-provider";

type Period = "day" | "week" | "month";

const validPeriods: Period[] = ["day", "week", "month"];

export async function loader({ params }: LoaderFunctionArgs) {
  const period = params.period as string;
  
  // Validate the period parameter
  if (!period || !validPeriods.includes(period as Period)) {
    // Redirect to default view if invalid period
    throw redirect("/employee/schedule/month");
  }
  
  return {
    period: period as Period,
  };
}

export default function EmployeesSchedule() {
  const { period } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  
  const handleViewChange = (newPeriod: Period) => {
    navigate(`/employee/schedule/${newPeriod}`, { replace: true });
  };

  return (
    <SchedulerProvider>
      <div className="m-4 sm:m-8 lg:m-16 bg-gray-50 dark:bg-gray-900 min-h-screen">
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
          <SchedulerViewFilteration
            period={period}
            onViewChange={handleViewChange}
          />
        </div>
      </div>
    </SchedulerProvider>
  );
} 