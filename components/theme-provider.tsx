"use client"

import * as React from "react"

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    // Force light mode cleanup
    document.documentElement.classList.remove("dark")
    localStorage.removeItem("theme")
  }, [])

  return <>{children}</>
}

export const ThemeContext = React.createContext<{ theme: "light" | "dark"; setTheme: (t: "light" | "dark") => void }>({
  theme: "light",
  setTheme: () => { },  
})
