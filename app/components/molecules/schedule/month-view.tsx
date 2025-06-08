import { useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight } from "lucide-react";
import clsx from "clsx";

import { useScheduler } from "~/providers/scheduler-provider";
import AddEventModal from "@/components/molecules/schedule/add-event-modal";
import EventStyled from "@/components/molecules/schedule/event-styled";
import { useNavigate } from "react-router";

// Define Event interface locally since it's not exported from types
interface Event {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  description?: string;
  variant?: string;
}

const pageTransitionVariants = {
  enter: (direction: number) => ({
    opacity: 0,
  }),
  center: {
    opacity: 1,
  },
  exit: (direction: number) => ({
    opacity: 0,
    transition: {
      opacity: { duration: 0.2, ease: "easeInOut" },
    },
  }),
};

// Helper function to format date as dd-mm-yyyy
function formatDateStr(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

export default function MonthView() {
  const { getters, weekStartsOn } = useScheduler();
  const [open, setOpen] = useState<{startDate: Date, endDate: Date} | null>(null);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [direction, setDirection] = useState<number>(0);
  const navigate = useNavigate();

  const daysInMonth = getters.getDaysInMonth(
    currentDate.getMonth(),
    currentDate.getFullYear()
  );

  const handlePrevMonth = useCallback(() => {
    setDirection(-1);
    const newDate = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() - 1,
      1
    );
    setCurrentDate(newDate);
    navigate(`/employee/schedule/month?date=${formatDateStr(newDate)}`, { replace: true });
  }, [currentDate, navigate]);

  const handleNextMonth = useCallback(() => {
    setDirection(1);
    const newDate = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + 1,
      1
    );
    setCurrentDate(newDate);
    navigate(`/employee/schedule/month?date=${formatDateStr(newDate)}`, { replace: true });
  }, [currentDate, navigate]);

  function handleAddEvent(selectedDay: number) {
    // Don't open add modal if there's already a modal open (like edit modal)
    if (document.querySelector('[role="dialog"]')) {
      return;
    }

    // Create start date at 12:00 AM on the selected day
    const startDate = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      selectedDay,
      0,
      0,
      0
    );

    // Create end date at 11:59 PM on the same day
    const endDate = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      selectedDay,
      23,
      59,
      59
    );
    setOpen({startDate, endDate});
  }

  function handleShowMoreEvents(dayEvents: Event[]) {
    // TODO: Implement this
  }

  const itemVariants = {
    enter: { opacity: 0, y: 20 },
    center: { opacity: 1, y: 0, transition: { duration: 0.3 } },
    exit: { opacity: 0, y: -20, transition: { duration: 0.2 } },
  };

  const daysOfWeek =
    weekStartsOn === "monday"
      ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
      : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const firstDayOfMonth = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    1
  );

  const startOffset =
    (firstDayOfMonth.getDay() - (weekStartsOn === "monday" ? 1 : 0) + 7) % 7;

  // Calculate previous month's last days for placeholders
  const prevMonth = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() - 1,
    1
  );
  const lastDateOfPrevMonth = new Date(
    prevMonth.getFullYear(),
    prevMonth.getMonth() + 1,
    0
  ).getDate();

  return (
    <div className="w-full">
      {/* Mobile-optimized header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
        <motion.h2
          key={currentDate.getMonth()}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="text-2xl sm:text-3xl tracking-tighter font-bold text-center sm:text-left"
        >
          {currentDate.toLocaleString("default", { month: "long" })}{" "}
          {currentDate.getFullYear()}
        </motion.h2>
        
        {/* Mobile-optimized navigation */}
        <div className="flex gap-2 justify-center sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevMonth}
              className={"min-w-[80px] touch-target"}
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">Prev</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextMonth}
              className={"min-w-[80px] touch-target"}
            >
              <span className="hidden sm:inline">Next</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
        </div>
      </div>

      <AnimatePresence initial={false} custom={direction} mode="wait">
        <motion.div
          key={`${currentDate.getFullYear()}-${currentDate.getMonth()}`}
          custom={direction}
          variants={{
            ...pageTransitionVariants,
            center: {
              ...pageTransitionVariants.center,
              transition: {
                opacity: { duration: 0.2 },
                staggerChildren: 0.02,
              },
            },
          }}
          initial="enter"
          animate="center"
          exit="exit"
          className="w-full"
        >
          {/* Mobile-responsive calendar grid */}
          <div className="bg-background border border-border rounded-lg overflow-hidden">
            {/* Days of week header - responsive text */}
            <div className="grid grid-cols-7 bg-muted/30 border-b border-border">
              {daysOfWeek.map((day, idx) => (
                <div
                  key={idx}
                  className="p-2 sm:p-3 text-center text-xs sm:text-sm font-medium text-muted-foreground border-r border-border last:border-r-0"
                >
                  <span className="hidden sm:inline">{day}</span>
                  <span className="sm:hidden">{day.slice(0, 1)}</span>
                </div>
              ))}
            </div>

            {/* Calendar body */}
            <div className="grid grid-cols-7">
              {/* Previous month's trailing days */}
              {Array.from({ length: startOffset }).map((_, idx) => (
                <div 
                  key={`offset-${idx}`} 
                  className="h-20 sm:h-24 md:h-32 lg:h-36 border-r border-b border-border last:border-r-0 p-1 sm:p-2 bg-muted/10"
                >
                  <div className="text-xs sm:text-sm text-muted-foreground">
                    {lastDateOfPrevMonth - startOffset + idx + 1}
                  </div>
                </div>
              ))}

              {/* Current month's days */}
              {daysInMonth.map((dayObj: any) => {
                const dayEvents: Event[] = getters.getEventsForDay(dayObj.day, currentDate);
                const isToday =
                  new Date().getDate() === dayObj.day &&
                  new Date().getMonth() === currentDate.getMonth() &&
                  new Date().getFullYear() === currentDate.getFullYear();

                return (
                  <motion.div
                    className="h-20 sm:h-24 md:h-32 lg:h-36 border-r border-b border-border last:border-r-0 group cursor-pointer hover:bg-muted/20 transition-colors touch-target relative"
                    key={dayObj.day}
                    variants={itemVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    onClick={(e) => {
                      // Don't open add modal if clicking on an event element
                      const target = e.target as HTMLElement;
                      if (target.closest('[data-event-element]')) {
                        return;
                      }
                      handleAddEvent(dayObj.day);
                    }}
                  >
                    <div className="p-1 sm:p-2 h-full flex flex-col relative">
                      {/* Day number */}
                      <div className="flex justify-between items-start mb-1">
                        <span
                          className={clsx(
                            "text-xs sm:text-sm font-medium leading-none",
                            isToday && "bg-primary text-primary-foreground rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-xs",
                            dayEvents.length > 0 && !isToday && "text-primary font-semibold",
                            dayEvents.length === 0 && !isToday && "text-foreground"
                          )}
                        >
                          {dayObj.day}
                        </span>
                      </div>

                      {/* Events - mobile optimized */}
                      <div className="flex-1 overflow-hidden">
                        <AnimatePresence mode="wait">
                          {dayEvents?.length > 0 && (
                            <motion.div
                              key={dayEvents[0].id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              transition={{ duration: 0.3 }}
                              className="h-full"
                            >
                                                             {/* Mobile: Show only dots/indicators for small screens */}
                               <div className="sm:hidden">
                                 <div className="flex gap-1 flex-wrap">
                                   {dayEvents.slice(0, 3).map((event: Event) => (
                                     <div
                                       key={event.id}
                                       className={clsx(
                                         "w-2 h-2 rounded-full",
                                         event.variant === "primary" && "bg-blue-500",
                                         event.variant === "danger" && "bg-red-500",
                                         event.variant === "success" && "bg-green-500",
                                         event.variant === "warning" && "bg-yellow-500",
                                         !event.variant && "bg-gray-500"
                                       )}
                                     />
                                   ))}
                                   {dayEvents.length > 3 && (
                                     <span className="text-xs text-muted-foreground">+</span>
                                   )}
                                 </div>
                               </div>

                                                             {/* Desktop: Show full event styling */}
                               <div className="hidden sm:block">
                                 <EventStyled
                                   event={{
                                     ...dayEvents[0],
                                     minmized: true,
                                   }}
                                 />
                               </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* More events indicator */}
                        {dayEvents.length > 1 && (
                          <Badge
                            onClick={(e) => {
                              e.stopPropagation();
                              handleShowMoreEvents(dayEvents);
                            }}
                            variant="outline"
                            className={clsx(
                              "absolute bottom-1 right-1 text-xs px-1 py-0 h-auto cursor-pointer hover:bg-accent transition-colors touch-target",
                              "hidden sm:inline-flex" // Hide on mobile, show on larger screens
                            )}
                          >
                            +{dayEvents.length - 1}
                          </Badge>
                        )}
                      </div>

                      {/* Mobile: Show event count */}
                      {dayEvents.length > 0 && (
                        <div className="sm:hidden text-xs text-muted-foreground mt-1">
                          {dayEvents.length} event{dayEvents.length > 1 ? "s" : ""}
                        </div>
                      )}

                      {/* Hover text for empty days */}
                      {dayEvents.length === 0 && (
                        <div className="absolute inset-0 bg-primary/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded">
                          <span className="text-xs sm:text-sm font-medium text-primary">
                            <span className="hidden sm:inline">Add Event</span>
                            <span className="sm:hidden">+</span>
                          </span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Modal */}
      {open && (
      <AddEventModal
        open={true}
        onOpenChange={(isOpen) => !isOpen && setOpen(null)}
        defaultValues={{
          startDate: open?.startDate,
          endDate: open?.endDate,
        }}
      />
      )}
    </div>
  );
}