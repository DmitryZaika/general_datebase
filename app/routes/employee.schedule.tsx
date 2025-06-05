import SchedulerViewFilteration from "@/components/molecules/schedule/schedular-view-filteration";
import { SchedulerProvider } from "~/providers/scheduler-provider";

export default function EmployeesSchedule() {

  return (
    <SchedulerProvider>
      <div className="m-16 bg-gray-200">
        <SchedulerViewFilteration/>
      </div>
    </SchedulerProvider>
  );
}