"use client";

import React, { useRef, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { ArrowLeft, ArrowRight } from "lucide-react";

import { useScheduler } from "~/providers/scheduler-provider";
import AddEventModal from "@/components/molecules/schedule/add-event-modal";
import EventStyled from "@/components/molecules/schedule/event-styled";
import { CustomEventModal } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// Define Event interface locally since it's not exported from types
interface Event {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  description?: string;
  variant?: string;
}

// Generate hours in 12-hour format
const hours = Array.from({ length: 24 }, (_, i) => {
  const hour = i % 12 || 12;
  const ampm = i < 12 ? "AM" : "PM";
  return `${hour}:00 ${ampm}`;
});

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05, // Stagger effect between children
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 5 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.12 } },
};

const pageTransitionVariants = {
  enter: (direction: number) => ({
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    opacity: 0,
    transition: {
      opacity: { duration: 0.2, ease: "easeInOut" },
    },
  }),
};

// Precise time-based event grouping function
const groupEventsByTimePeriod = (events: Event[] | undefined) => {
  if (!events || events.length === 0) return [];
  
  // Sort events by start time
  const sortedEvents = [...events].sort((a, b) => 
    new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );
  
  // Precise time overlap checking function
  const eventsOverlap = (event1: Event, event2: Event) => {
    const start1 = new Date(event1.startDate).getTime();
    const end1 = new Date(event1.endDate).getTime();
    const start2 = new Date(event2.startDate).getTime();
    const end2 = new Date(event2.endDate).getTime();
    
    // Strict time overlap - one event starts before the other ends
    return (start1 < end2 && start2 < end1);
  };
  
  // Use a graph-based approach to find connected components (overlapping event groups)
  const buildOverlapGraph = (events: Event[]) => {
    // Create adjacency list
    const graph: Record<string, string[]> = {};
    
    // Initialize graph
    events.forEach(event => {
      graph[event.id] = [];
    });
    
    // Build connections
    for (let i = 0; i < events.length; i++) {
      for (let j = i + 1; j < events.length; j++) {
        if (eventsOverlap(events[i], events[j])) {
          graph[events[i].id].push(events[j].id);
          graph[events[j].id].push(events[i].id);
        }
      }
    }
    
    return graph;
  };
  
  // Find connected components using DFS
  const findConnectedComponents = (graph: Record<string, string[]>, events: Event[]) => {
    const visited: Record<string, boolean> = {};
    const components: Event[][] = [];
    
    // DFS function to traverse the graph
    const dfs = (nodeId: string, component: string[]) => {
      visited[nodeId] = true;
      component.push(nodeId);
      
      for (const neighbor of graph[nodeId]) {
        if (!visited[neighbor]) {
          dfs(neighbor, component);
        }
      }
    };
    
    // Find all connected components
    for (const event of events) {
      if (!visited[event.id]) {
        const component: string[] = [];
        dfs(event.id, component);
        
        // Map IDs back to events
        const eventGroup = component.map(id => 
          events.find(e => e.id === id)!
        );
        
        components.push(eventGroup);
      }
    }
    
    return components;
  };
  
  // Build the overlap graph
  const graph = buildOverlapGraph(sortedEvents);
  
  // Find connected components (groups of overlapping events)
  const timeGroups = findConnectedComponents(graph, sortedEvents);
  
  // Sort events within each group by start time
  return timeGroups.map(group => 
    group.sort((a, b) => 
      new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    )
  );
};

export default function DailyView({
  prevButton,
  nextButton,
  CustomEventComponent,
  CustomEventModal,
  classNames,
  stopDayEventSummary,
}: {
  prevButton?: React.ReactNode;
  nextButton?: React.ReactNode;
  CustomEventComponent?: React.FC<Event>;
  CustomEventModal?: CustomEventModal;
  classNames?: { prev?: string; next?: string; addEvent?: string };
  stopDayEventSummary?: boolean;
}) {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [direction, setDirection] = useState<number>(0);
  const { getters, handlers } = useScheduler();
  const [open, setOpen] = useState<{startDate: Date, endDate: Date} | null>(null);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const hourHeight = rect.height / 24;
      const hourFloat = y / hourHeight;
      const hour = Math.floor(hourFloat);
      const minutes = Math.floor((hourFloat - hour) * 60);

      // Format the time
      const displayHour = hour % 12 || 12;
      const ampm = hour < 12 ? "AM" : "PM";
      const formattedMinutes = minutes.toString().padStart(2, '0');
      
      setDetailedHour(`${displayHour}:${formattedMinutes} ${ampm}`);
      setTimelinePosition(y);
    },
    []
  );

  const [detailedHour, setDetailedHour] = useState<string | null>(null);
  const [timelinePosition, setTimelinePosition] = useState<number>(0);
  const hoursColumnRef = useRef<HTMLDivElement>(null);

  const dayEvents: Event[] = getters.getEventsForDay(
    currentDate.getDate(),
    currentDate
  ) || [];

  function handleAddEvent(event?: Partial<Event>) {
    // Create the modal content with the provided event data or defaults
    const startDate = event?.startDate || new Date();
    const endDate = event?.endDate || new Date(startDate.getTime() + 60 * 60 * 1000);

    setOpen({startDate, endDate});
  }

  function getFormattedDayTitle() {
    return currentDate.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  function handleAddEventDay(detailedHour: string) {
    // Parse the time from detailedHour (e.g., "2:30 PM")
    const [time, period] = detailedHour.split(" ");
    const [hourStr, minuteStr] = time.split(":");
    let hour = parseInt(hourStr);
    const minute = parseInt(minuteStr);

    // Convert to 24-hour format
    if (period === "PM" && hour !== 12) {
      hour += 12;
    } else if (period === "AM" && hour === 12) {
      hour = 0;
    }

    const date = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      currentDate.getDate(),
      hour,
      minute
    );

    handleAddEvent({
      startDate: date,
      endDate: new Date(date.getTime() + 60 * 60 * 1000), // 1-hour duration
      title: "",
      id: "",
      variant: "primary",
    });
  }

  const handleNextDay = useCallback(() => {
    setDirection(1);
    const nextDay = new Date(currentDate);
    nextDay.setDate(currentDate.getDate() + 1);
    setCurrentDate(nextDay);
  }, [currentDate]);

  const handlePrevDay = useCallback(() => {
    setDirection(-1);
    const prevDay = new Date(currentDate);
    prevDay.setDate(currentDate.getDate() - 1);
    setCurrentDate(prevDay);
  }, [currentDate]);

  return (
    <div className="w-full px-2 sm:px-4">
      {/* Mobile-responsive header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-2">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-center sm:text-left leading-tight">
          {getFormattedDayTitle()}
        </h1>

        <div className="flex gap-2 justify-center sm:justify-end">
          {prevButton ? (
            <div onClick={handlePrevDay} className="cursor-pointer">
              {prevButton}
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevDay}
              className={`min-w-[80px] touch-target ${classNames?.prev || ""}`}
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">Prev</span>
            </Button>
          )}
          {nextButton ? (
            <div onClick={handleNextDay} className="cursor-pointer">
              {nextButton}
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextDay}
              className={`min-w-[80px] touch-target ${classNames?.next || ""}`}
            >
              <span className="hidden sm:inline">Next</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </div>

      <AnimatePresence initial={false} custom={direction} mode="wait">
        <motion.div
          key={currentDate.toISOString()}
          custom={direction}
          variants={pageTransitionVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            x: { type: "spring", stiffness: 300, damping: 30 },
            opacity: { duration: 0.2 },
          }}
          className="space-y-4"
        >
          {/* Events Summary - Mobile optimized */}
          {!stopDayEventSummary && (
            <div className="bg-muted/30 rounded-lg p-3 sm:p-4">
              <h3 className="text-sm font-medium mb-2 text-muted-foreground">
                {dayEvents.length > 0 
                  ? `${dayEvents.length} event${dayEvents.length > 1 ? "s" : ""} today`
                  : "No events today"
                }
              </h3>
              
              {dayEvents.length > 0 ? (
                <div className="space-y-2">
                  <AnimatePresence initial={false}>
                    {dayEvents.slice(0, 3).map((event: Event, eventIndex) => (
                      <motion.div
                        key={event.id}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="w-full"
                      >
                        <EventStyled
                          event={{
                            ...event,
                            CustomEventComponent,
                            minmized: false,
                          }}
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  
                  {dayEvents.length > 3 && (
                    <div className="text-xs text-muted-foreground text-center pt-2">
                      +{dayEvents.length - 3} more events below
                    </div>
                  )}
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddEvent()}
                  className="w-full sm:w-auto touch-target"
                >
                  Add Event
                </Button>
              )}
            </div>
          )}

          {/* Daily Schedule Grid - Mobile responsive */}
          <div className="bg-background border border-border rounded-lg overflow-hidden">
            <motion.div
              className="relative flex"
              ref={hoursColumnRef}
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setDetailedHour(null)}
            >
              {/* Hours Column - Responsive width */}
              <div className="w-12 sm:w-16 border-r border-border bg-muted/20 flex-shrink-0">
                {hours.map((hour, index) => (
                  <motion.div
                    key={`hour-${index}`}
                    variants={itemVariants}
                    className="h-12 sm:h-16 border-b border-border/50 flex items-start justify-center pt-1 text-xs text-muted-foreground"
                  >
                    <span className="hidden sm:inline">{hour}</span>
                    <span className="sm:hidden text-xs">
                      {hour.split(':')[0]}{hour.includes('AM') ? 'A' : 'P'}
                    </span>
                  </motion.div>
                ))}
              </div>

              {/* Events Column - Responsive */}
              <div className="flex-1 relative">
                {/* Hour Grid Lines */}
                {Array.from({ length: 24 }).map((_, index) => (
                  <div
                    onClick={() => {
                      handleAddEventDay(detailedHour as string);
                    }}
                    key={`hour-${index}`}
                    className={"cursor-pointer w-full relative border-b border-border/30 hover:bg-muted/20 transition-colors duration-300 h-12 sm:h-16 group"}
                  >
                    {/* Add Event Overlay - Touch friendly */}
                    <div className="absolute inset-0 bg-primary/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 touch-target">
                      <span className="text-primary text-xs sm:text-sm font-medium">
                        <span className="hidden sm:inline">Add Event</span>
                        <span className="sm:hidden">+</span>
                      </span>
                    </div>
                  </div>
                ))}

                {/* Events - Mobile optimized positioning */}
                <AnimatePresence initial={false}>
                  {dayEvents.map((event: Event, eventIndex) => {
                    const {
                      height,
                      left,
                      maxWidth,
                      minWidth,
                      top,
                      zIndex,
                    } = handlers.handleEventStyling ? 
                      handlers.handleEventStyling(
                        event, 
                        dayEvents,
                        {
                          eventsInSamePeriod: 1,
                          periodIndex: 0,
                          adjustForPeriod: true
                        }
                      ) : {
                        height: "48px",
                        left: "0px", 
                        maxWidth: "100%",
                        minWidth: "100%",
                        top: "0px",
                        zIndex: 1
                      };

                    return (
                      <motion.div
                        key={event.id}
                        style={{
                          minHeight: height,
                          top: top,
                          left: left,
                          maxWidth: maxWidth,
                          minWidth: minWidth,
                          padding: "0 4px",
                          boxSizing: "border-box",
                        }}
                        className="flex flex-col absolute"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.2 }}
                      >
                        <EventStyled
                          event={{
                            ...event,
                            CustomEventComponent,
                            minmized: true,
                          }}
                        />
                      </motion.div>
                    );
                  })}
                </AnimatePresence>

                {/* Timeline indicator - Mobile optimized */}
                {detailedHour && (
                  <div
                    className="absolute left-0 w-full h-0.5 bg-primary/60 pointer-events-none z-50"
                    style={{ top: `${timelinePosition}px` }}
                  >
                    <Badge
                      variant="outline"
                      className="absolute -translate-y-1/2 bg-background border-primary/60 left-2 text-xs px-2 py-0.5"
                    >
                      {detailedHour}
                    </Badge>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Add Event Modal */}
      <AddEventModal
        open={!!open}
        onOpenChange={(isOpen) => !isOpen && setOpen(null)}
        defaultValues={{
          startDate: open?.startDate,
          endDate: open?.endDate,
        }}
      />
    </div>
  );
}