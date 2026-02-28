"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeft, ChevronRight, HelpCircle, Edit } from "lucide-react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { ROLE_CONTENT, RoleHelpContent, ICON_MAP } from "./help-content"
import { useUIStore } from "@/store/ui-store"

export default function HelpPage() {
  const [selectedRole, setSelectedRole] = useState<RoleHelpContent | null>(null)
  const [helpData, setHelpData] = useState<Record<string, RoleHelpContent>>(ROLE_CONTENT)
  const role = useUIStore((s) => s.role)

  useEffect(() => {
    async function fetchHelpContent() {
      try {
        const res = await fetch("/api/help")
        const json = await res.json()
        if (json.success && json.data && json.data.length > 0) {
          const transformed: Record<string, RoleHelpContent> = {}
          json.data.forEach((r: any) => {
            transformed[r.role_key] = {
              id: r.role_key,
              title: r.title,
              description: r.description,
              icon: ICON_MAP[r.icon_name] || ICON_MAP.HelpCircle,
              color: r.color_class,
              responsibilities: r.responsibilities.map((x: any) => x.description),
              flow: r.flow.map((x: any) => ({
                title: x.title,
                description: x.description,
                icon: x.icon,
                type: x.type
              })),
              faqs: r.faqs.map((f: any) => ({ question: f.question, answer: f.answer }))
            }
          })
          setHelpData(transformed)
        }
      } catch (err) {
        console.error("Failed to fetch help content", err)
      }
    }
    fetchHelpContent()
  }, [])

  useEffect(() => {
    if (role && role !== "ADMIN") {
      const targetRole = role === "SERVICE_CENTER" ? "SERVICE_CENTER" : role;
      if (helpData[targetRole]) {
        setSelectedRole(helpData[targetRole]);
      }
    }
  }, [role, helpData])

  // Animation variants for staggered list items
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Help & Process Flows</h1>
          <p className="text-muted-foreground mt-2">
            Select your role to view detailed workflows, responsibilities, and FAQs.
          </p>
        </div>
        {role === "ADMIN" && (
          <Button asChild variant="outline">
            <Link href="/admin/settings">
              <Edit className="w-4 h-4 mr-2" />
              Edit in Settings
            </Link>
          </Button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {!selectedRole ? (
          <motion.div
            key="selection"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid gap-6 md:grid-cols-2 lg:grid-cols-4"
          >
            {Object.values(helpData).map((role) => {
              const Icon = role.icon
              return (
                <Card
                  key={role.id}
                  className="cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02] border-2 hover:border-primary/50 group"
                  onClick={() => setSelectedRole(role)}
                >
                  <CardHeader className="space-y-4">
                    <div className={`p-3 w-fit rounded-lg bg-muted ${role.color} bg-opacity-10 group-hover:bg-opacity-20 transition-all`}>
                      <Icon className={`w-8 h-8 ${role.color}`} />
                    </div>
                    <div>
                      <CardTitle className="text-xl">{role.title}</CardTitle>
                      <CardDescription className="mt-2 line-clamp-3">
                        {role.description}
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm font-medium text-primary flex items-center gap-1 group/btn">
                      View Guide
                      <ChevronRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </motion.div>
        ) : (
          <motion.div
            key="detail"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            {role === "ADMIN" && (
              <Button
                variant="ghost"
                className="group pl-0 hover:pl-2 transition-all"
                onClick={() => setSelectedRole(null)}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Role Selection
              </Button>
            )}

            <div className="grid gap-6 md:grid-cols-3">
              {/* Left Column: Role Info */}
              <div className="md:col-span-1 space-y-6">
                <Card className="h-full border-t-4" style={{ borderTopColor: "var(--primary)" }}>
                  <CardHeader>
                    <div className={`p-4 w-fit rounded-xl bg-muted ${selectedRole.color} bg-opacity-10 mb-4`}>
                      <selectedRole.icon className={`w-10 h-10 ${selectedRole.color}`} />
                    </div>
                    <CardTitle className="text-2xl">{selectedRole.title}</CardTitle>
                    <CardDescription className="text-base">{selectedRole.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      Key Responsibilities
                    </h3>
                    <ul className="space-y-3">
                      {selectedRole.responsibilities.map((resp, i) => (
                        <li key={i} className="flex gap-3 text-sm text-muted-foreground bg-muted/50 p-2 rounded-md">
                          <div className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${updatedColor(selectedRole.color)}`} />
                          {resp}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column: Process Flow & FAQ */}
              <div className="md:col-span-2 space-y-6">
                {/* Workflow Card */}
                <Card>
                  <CardHeader>
                    <CardTitle>Guide</CardTitle>
                    <CardDescription>Step-by-step guide for the {selectedRole.title} role</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <motion.div
                      className="relative pl-8 border-l-2 border-muted space-y-12 my-6 ml-4"
                      variants={containerVariants}
                      initial="hidden"
                      animate="visible"
                    >
                      {selectedRole.flow.map((step, idx) => (
                        <motion.div key={idx} className="relative" variants={itemVariants}>
                          {/* Timeline Node */}
                          <div className={`absolute -left-[41px] top-0 flex items-center justify-center w-8 h-8 rounded-full border-2 bg-background font-bold text-sm ${updatedColor(selectedRole.color).replace('text-', 'border-').replace('dark:text-', 'dark:border-')}`}>
                            {idx + 1}
                          </div>

                          <div className="space-y-2">
                            <h3 className="text-lg font-bold leading-none">{step.title}</h3>
                            <p className="text-muted-foreground">{step.description}</p>
                          </div>

                          {/* Connector Line for next step (except last) */}
                          {idx < selectedRole.flow.length - 1 && (
                            <div className="absolute left-[3px] top-8 bottom-0 w-0.5" />
                          )}
                        </motion.div>
                      ))}
                    </motion.div>
                  </CardContent>
                </Card>

                {/* FAQ Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <HelpCircle className="w-5 h-5 text-muted-foreground" />
                      Frequently Asked Questions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Accordion type="single" collapsible className="w-full">
                      {selectedRole.faqs.map((faq, i) => (
                        <AccordionItem key={i} value={`item-${i}`}>
                          <AccordionTrigger className="text-left font-medium">
                            {faq.question}
                          </AccordionTrigger>
                          <AccordionContent className="text-muted-foreground">
                            {faq.answer}
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </CardContent>
                </Card>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function updatedColor(colorString: string) {
  // Helper to extract the base color name for border usage
  return colorString.replace("text-", "bg-").replace("dark:text-", "dark:bg-");
}
