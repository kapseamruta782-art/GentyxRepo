// components/ui/logo.tsx
import React from "react";

interface LogoProps {
    className?: string;
}

export function Logo({ className }: LogoProps) {
    return (
        <div className={`flex items-center select-none ${className}`}>
            <svg
                width="160"
                height="32"
                viewBox="0 0 160 32"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="h-8 w-auto block"
                aria-label="Gentyx Logo"
            >
                <text
                    x="0"
                    y="24"
                    fontFamily="system-ui, -apple-system, sans-serif"
                    fontWeight="800"
                    fontSize="24"
                    fill="#0B1F4B"
                    letterSpacing="1.5"
                >
                    GENTYX
                </text>
                <text
                    x="120"
                    y="24"
                    fontFamily="system-ui, -apple-system, sans-serif"
                    fontWeight="800"
                    fontSize="24"
                    fill="#8CC63F"
                >
                    &gt;
                </text>
            </svg>
        </div>
    );
}
