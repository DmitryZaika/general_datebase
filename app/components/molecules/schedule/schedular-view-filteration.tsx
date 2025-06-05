"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Views, ClassNames, CustomComponents } from "@/types";
import { useScheduler } from "~/providers/scheduler-provider";
import DailyView from "@/components/molecules/schedule/day-view";
import WeeklyView from "@/components/molecules/schedule/week-view";
import MonthView from "@/components/molecules/schedule/month-view";

import AddEventModal from "@/components/molecules/schedule/add-event-modal";

export default function SchedulerViewFilteration({
  views = {
    views: ["day", "week", "month"],
    mobileViews: ["day"],
  },
  stopDayEventSummary = false,
  CustomComponents,
  classNames,
}: {
  views?: Views;
  stopDayEventSummary?: boolean;
  CustomComponents?: CustomComponents;
  classNames?: ClassNames;
}) {
  const [activeView, setActiveView] = useState<string>(
    views?.views?.[0] || "day"
  );
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [eventModalDefaults, setEventModalDefaults] = useState<{
    startDate?: Date;
    endDate?: Date;
  }>({});

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

  const viewsSelector = views?.views;

  // Set initial active view
  useEffect(() => {
    if (viewsSelector?.length) {
      setActiveView(viewsSelector[0]);
    }
  }, []);

  return (
    <div className="overflow-auto">
      <div className="flex justify-between items-center mb-4 px-1">
        <div className="flex space-x-2">
          {viewsSelector?.map((view) => (
            <Button
              key={view}
              onClick={() => setActiveView(view)}
              variant={activeView === view ? "default" : "outline"}
              className="capitalize"
            >
              {CustomComponents?.customTabs?.[
                `Custom${view.charAt(0).toUpperCase() + view.slice(1)}Tab` as keyof typeof CustomComponents.customTabs
              ] || view}
            </Button>
          ))}
        </div>
        <Button
          onClick={() => handleAddEvent()}
        >
          {CustomComponents?.customButtons?.CustomAddEventButton || (
            <span>Add Event</span>
          )}
        </Button>
      </div>

             {activeView === "day" && (
         <DailyView
           prevButton={CustomComponents?.customButtons?.CustomPrevButton}
           nextButton={CustomComponents?.customButtons?.CustomNextButton}
           CustomEventComponent={CustomComponents?.CustomEventComponent}
           CustomEventModal={CustomComponents?.CustomEventModal}
           stopDayEventSummary={stopDayEventSummary}
         />
       )}

       {activeView === "week" && (
         <WeeklyView
           prevButton={CustomComponents?.customButtons?.CustomPrevButton}
           nextButton={CustomComponents?.customButtons?.CustomNextButton}
           CustomEventComponent={CustomComponents?.CustomEventComponent}
           CustomEventModal={CustomComponents?.CustomEventModal}
         />
       )}

       {activeView === "month" && (
         <MonthView
           prevButton={CustomComponents?.customButtons?.CustomPrevButton}
           nextButton={CustomComponents?.customButtons?.CustomNextButton}
           CustomEventComponent={CustomComponents?.CustomEventComponent}
           CustomEventModal={CustomComponents?.CustomEventModal}
         />
       )}

      <AddEventModal
        open={showAddEventModal}
        onOpenChange={setShowAddEventModal}
        defaultValues={eventModalDefaults}
      />
    </div>
  );
}