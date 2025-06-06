"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import DailyView from "@/components/molecules/schedule/day-view";
import WeeklyView from "@/components/molecules/schedule/week-view";
import MonthView from "@/components/molecules/schedule/month-view";
import { useNavigate } from "react-router";
import { Period } from "~/types";

import AddEventModal from "@/components/molecules/schedule/add-event-modal";

const views: Period[] = ["day", "week", "month"]

export default function SchedulerViewFilteration({
  period,
}: {
  period?: Period;
}) {
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [eventModalDefaults, setEventModalDefaults] = useState<{
    startDate?: Date;
    endDate?: Date;
  }>({});
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
    setShowAddEventModal(true);
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
          {views?.map((view) => (
            <Button
              key={view}
              onClick={() => handleViewChange(view)}
              variant={period === view ? "default" : "outline"}
              className="capitalize touch-target"
              size="sm"
            >
              {view}
            </Button>
          ))}
        </div>
        <Button
          onClick={() => handleAddEvent()}
          className="touch-target order-1 sm:order-2"
          size="sm"
        >
          <span>Add Event</span>
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
        open={showAddEventModal}
        onOpenChange={setShowAddEventModal}
        defaultValues={eventModalDefaults}
      />
    </div>
  );
}