"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Views, ClassNames, CustomComponents } from "@/types";
import { useScheduler } from "~/providers/scheduler-provider";
import DailyView from "@/components/molecules/schedule/day-view";
import WeeklyView from "@/components/molecules/schedule/week-view";
import MonthView from "@/components/molecules/schedule/month-view";

import AddEventModal from "@/components/molecules/schedule/add-event-modal";

type Period = "day" | "week" | "month";

export default function SchedulerViewFilteration({
  views = {
    views: ["day", "week", "month"],
    mobileViews: ["day"],
  },
  stopDayEventSummary = false,
  CustomComponents,
  classNames,
  period,
  onViewChange,
}: {
  views?: Views;
  stopDayEventSummary?: boolean;
  CustomComponents?: CustomComponents;
  classNames?: ClassNames;
  period?: Period;
  onViewChange?: (period: Period) => void;
}) {
  const [activeView, setActiveView] = useState<string>(
    period || views?.views?.[0] || "day"
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

  // Update active view when period prop changes
  useEffect(() => {
    if (period) {
      setActiveView(period);
    } else if (viewsSelector?.length) {
      setActiveView(viewsSelector[0]);
    }
  }, [period, viewsSelector]);

  // Handle view change with URL navigation if callback is provided
  const handleViewChange = (view: string) => {
    if (onViewChange && (view === "day" || view === "week" || view === "month")) {
      onViewChange(view as Period);
    } else {
      setActiveView(view);
    }
  };

  return (
    <div className="overflow-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 px-1 gap-4">
        <div className="flex flex-wrap gap-2 order-2 sm:order-1">
          {viewsSelector?.map((view) => (
            <Button
              key={view}
              onClick={() => handleViewChange(view)}
              variant={activeView === view ? "default" : "outline"}
              className="capitalize touch-target"
              size="sm"
            >
              {CustomComponents?.customTabs?.[
                `Custom${view.charAt(0).toUpperCase() + view.slice(1)}Tab` as keyof typeof CustomComponents.customTabs
              ] || view}
            </Button>
          ))}
        </div>
        <Button
          onClick={() => handleAddEvent()}
          className="touch-target order-1 sm:order-2"
          size="sm"
        >
          {CustomComponents?.customButtons?.CustomAddEventButton || (
            <span>Add Event</span>
          )}
        </Button>
      </div>

      <div className="min-h-[600px]">
        {activeView === "day" && (
          <DailyView
            prevButton={CustomComponents?.customButtons?.CustomPrevButton}
            nextButton={CustomComponents?.customButtons?.CustomNextButton}
            CustomEventComponent={CustomComponents?.CustomEventComponent as any}
            CustomEventModal={CustomComponents?.CustomEventModal}
            stopDayEventSummary={stopDayEventSummary}
            classNames={classNames?.buttons}
          />
        )}

        {activeView === "week" && (
          <WeeklyView
            prevButton={CustomComponents?.customButtons?.CustomPrevButton}
            nextButton={CustomComponents?.customButtons?.CustomNextButton}
            CustomEventComponent={CustomComponents?.CustomEventComponent as any}
            CustomEventModal={CustomComponents?.CustomEventModal}
            classNames={classNames?.buttons}
          />
        )}

        {activeView === "month" && (
          <MonthView
            prevButton={CustomComponents?.customButtons?.CustomPrevButton}
            nextButton={CustomComponents?.customButtons?.CustomNextButton}
            CustomEventComponent={CustomComponents?.CustomEventComponent as any}
            CustomEventModal={CustomComponents?.CustomEventModal}
            classNames={classNames?.buttons}
          />
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