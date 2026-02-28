"use client"

import { useEffect, useState } from "react"

interface ProgressRingProps {
  value: number
  completedStages?: number
  totalStages?: number
}

export function ProgressRing({
  value,
  completedStages,
  totalStages,
}: ProgressRingProps) {
  const radius = 36
  const stroke = 8
  const normalizedRadius = radius - stroke * 0.5
  const circumference = normalizedRadius * 2 * Math.PI

  const clamped = Math.max(0, Math.min(100, value))

  // ✅ Smooth animation
  const [animatedValue, setAnimatedValue] = useState(0)

  useEffect(() => {
    setAnimatedValue(clamped)
  }, [clamped])

  const strokeDashoffset =
    circumference - (animatedValue / 100) * circumference

  // ✅ COLOR RULES
  const getColor = () => {
    if (animatedValue <= 30) return "#ef4444" // red
    if (animatedValue <= 70) return "#f59e0b" // yellow
    return "#22c55e" // green
  }

  const tooltipText =
    completedStages !== undefined && totalStages !== undefined
      ? `${completedStages} / ${totalStages} Stages Completed`
      : `${animatedValue}% Completed`

  return (
    <div title={tooltipText}>
      <svg height={radius * 2} width={radius * 2}>
        {/* Background Circle */}
        <circle
          stroke="var(--color-muted)"
          fill="transparent"
          strokeWidth={stroke}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />

        {/* Progress Circle */}
        <circle
          stroke={getColor()}
          fill="transparent"
          strokeWidth={stroke}
          strokeLinecap="round"
          r={normalizedRadius}
          cx={radius}
          cy={radius}
          style={{
            strokeDasharray: `${circumference} ${circumference}`,
            strokeDashoffset,
            transition: "stroke-dashoffset 0.8s ease, stroke 0.5s ease",
          }}
        />

        {/* % TEXT INSIDE ONLY */}
        <text
          x="50%"
          y="50%"
          dominantBaseline="middle"
          textAnchor="middle"
          className="fill-foreground text-xs font-semibold"
        >
          {Math.round(animatedValue)}%
        </text>
      </svg>
    </div>
  )
}
 