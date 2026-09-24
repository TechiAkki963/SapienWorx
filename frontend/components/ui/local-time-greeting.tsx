"use client";

import { useSyncExternalStore } from "react";

import { getTimeOfDayGreeting } from "@/lib/time-of-day-greeting";

function subscribe(onChange: () => void) {
  let previousGreeting = getTimeOfDayGreeting();
  const timer = window.setInterval(() => {
    const nextGreeting = getTimeOfDayGreeting();
    if (nextGreeting !== previousGreeting) {
      previousGreeting = nextGreeting;
      onChange();
    }
  }, 60_000);

  return () => window.clearInterval(timer);
}

function getSnapshot() {
  return getTimeOfDayGreeting();
}

function getServerSnapshot() {
  return "Good morning";
}

export function LocalTimeGreeting({ firstName }: { firstName: string }) {
  const greeting = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return <>{greeting}, {firstName}</>;
}
