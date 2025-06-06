import { useState } from "react";
import { Button } from "@/components/ui/button";
import DailyView from "@/components/molecules/schedule/day-view";
import WeeklyView from "@/components/molecules/schedule/week-view";
import MonthView from "@/components/molecules/schedule/month-view";
import { Link, useNavigate } from "react-router";
import { Period } from "~/types";

import AddEventModal from "@/components/molecules/schedule/add-event-modal";

const views: Period[] = ["day", "week", "month"]

export default function SchedulerViewFilteration({
  period,
}: {
  period?: Period;
}) {
  const [eventModalDefaults, setEventModalDefaults] = useState<{
    startDate: Date;
    endDate: Date;
  } | undefined>(undefined);
  const navigate = useNavigate();

  function handleAddEvent(selectedDay?: number) {
    // Create the start and end dates for the event
    const startDate = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      selectedDay ?? new Date().getDate(),
      0,
      0,
      0,
      0
    );

    const endDate = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      selectedDay ?? new Date().getDate(),
      23,
      59,
      59,
      999
    );

    setEventModalDefaults({ startDate, endDate });
  }

  // Handle view change with URL navigation if callback is provided
  const handleViewChange = (view: Period) => {
      console.log(view);
      navigate(`/employee/schedule/${view}`, { replace: true });
  };

  return (
    <div className="overflow-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 px-1 gap-4">
        <div className="flex flex-wrap gap-2 order-2 sm:order-1">
          {views.map((view) => (
            <Button variant={period === view ? "default" : "outline"} asChild>
            <Link
              key={view}
              to={`/employee/schedule/${view}`}
              className="capitalize touch-target"
            >
              {view}
            </Link>
            </Button>
          ))}
        </div>
        <Button
          onClick={() => handleAddEvent()}
          className="touch-target order-1 sm:order-2"
          size="sm"
        >
          Add Event
        </Button>
      </div>

      <div className="min-h-[600px]">
        {period === "day" && (
          <DailyView />
        )}

        {period === "week" && (
          <WeeklyView />
        )}

        {period === "month" && (
          <MonthView />
        )}
      </div>

      <AddEventModal
        open={!!eventModalDefaults}
        onOpenChange={() => setEventModalDefaults(undefined)}
        defaultValues={eventModalDefaults}
      />
    </div>
  );
}