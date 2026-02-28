"use client";

import { useEffect, useState } from "react";

export function DateTimeDisplay() {
    const [DateTime, setDateTime] = useState<Date | null>(null);

    useEffect(() => {
        // Set initial date on client only to match hydration
        setDateTime(new Date());

        const timer = setInterval(() => {
            setDateTime(new Date());
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    if (!DateTime) return null;

    const formattedDate = DateTime.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    });

    const formattedTime = DateTime.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
    });

    return (
        <div className="flex flex-col justify-center h-full pl-2">
            <div className="text-sm font-medium text-slate-700">{formattedDate}</div>
            <div className="text-xs text-slate-500">{formattedTime}</div>
        </div>
    );
}
