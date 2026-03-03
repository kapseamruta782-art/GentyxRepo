// components/ui/logo.tsx
import React from "react";

interface LogoProps {
    className?: string;
}

export function Logo({ className }: LogoProps) {
    return (
        <div className={`flex items-center select-none ${className}`}>
            <img
                src="/images/gentyxfinallogo.png"
                alt="Gentyx Logo"
                className="h-10 w-auto block object-contain"
            />
        </div>
    );
}
