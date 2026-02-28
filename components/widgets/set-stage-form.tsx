// components/widgets/set-stage-form.tsx
"use client"

import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { setStage } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useUIStore } from "@/store/ui-store"
import { mockStages } from "@/lib/mock"
import { mutate } from "swr";


const Schema = z.object({
  clientId: z.string().min(1, "Client ID required"),
  stage: z.string().min(1, "Stage required"),
})

export function SetStageForm({ context }: { context?: Record<string, any> }) {
  const { toast } = useToast()
  const closeDrawer = useUIStore((s) => s.closeDrawer)
  const form = useForm<z.infer<typeof Schema>>({
    resolver: zodResolver(Schema),
    defaultValues: {
      clientId: context?.clientId || "",
      stage: context?.stage || "",
    },
  })

async function onSubmit(values: z.infer<typeof Schema>) {
  try {
      await setStage({
        clientId: Number(values.clientId),
        stageName: values.stage, // 🔥 send the name, not ID
      });

    mutate(["stages", values.clientId]); // refresh UI

    toast({
      title: "Success",
      description: "Stage updated and progress recalculated",
    });

    closeDrawer();
  } catch (error) {
    toast({
      title: "Error",
      description: "Failed to update stage",
      variant: "destructive",
    });
  }
}

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-3">
      <div className="grid gap-2">
        <Label htmlFor="clientId">Client ID</Label>
        <input id="clientId" {...form.register("clientId")} className="px-3 py-2 border rounded-md text-sm" readOnly />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="stage">Stage</Label>
        <Select value={form.watch("stage")} onValueChange={(v) => form.setValue("stage", v)}>
          <SelectTrigger id="stage">
            <SelectValue placeholder="Select stage" />
          </SelectTrigger>
          <SelectContent>
            {mockStages.map((s) => (
              // <SelectItem key={s.id} value={s.name}>
              <SelectItem key={s.id} value={String(s.id)}>
  
              {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {form.formState.errors.stage && (
          <span className="text-xs text-destructive">{form.formState.errors.stage.message}</span>
        )}
      </div>

      <div className="mt-2 flex justify-end gap-2">
        <Button variant="outline" type="button" onClick={() => closeDrawer()}>
          Cancel
        </Button>
        <Button type="submit">Set Stage</Button>
      </div>
    </form>
  )
}
