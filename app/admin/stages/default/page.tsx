// app/admin/stages/default/page.tsx
"use client";

import { useEffect, useState } from "react";
import {
  fetchDefaultStageTemplates,
  createDefaultStageTemplate,
  fetchDefaultStagesByTemplate,
  saveDefaultStages,
} from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, X, ArrowLeft } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { TemplateStageItem } from "./template-stage-item";

import { useRouter } from "next/navigation";

export default function DefaultStagesPage() {
  const { toast } = useToast();
  const router = useRouter();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  function handleDragEnd(event: any) {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = stages.findIndex((_, i) => `stage-${i}` === active.id);
    const newIndex = stages.findIndex((_, i) => `stage-${i}` === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      setStages((items) => arrayMove(items, oldIndex, newIndex));
    }
  }

  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [stages, setStages] = useState<any[]>([]);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [isSaving, setIsSaving] = useState(false);


  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    const res = await fetchDefaultStageTemplates();
    if (res.success) setTemplates(res.data);
  }

  async function selectTemplate(t: any) {
    setSelectedTemplate(t);
    const res = await fetchDefaultStagesByTemplate(t.template_id);
    if (res.success) setStages(res.data);
  }

  async function addTemplate() {
    if (!newTemplateName.trim()) return;

    const res = await createDefaultStageTemplate({
      template_name: newTemplateName.trim(),
    });

    if (res.success) {
      setNewTemplateName("");
      toast({ title: "Template created" });

      // Refresh left list
      await loadTemplates();

      // Auto-select new template and load its (empty) stages
      setSelectedTemplate(res.data);
      setStages([]);
    } else {
      toast({
        title: res.error || "Failed to create template",
        variant: "destructive",
      });
    }
  }

  function addStage() {
    setStages((prev) => [
      ...prev,
      { stage_name: "", is_required: false },
    ]);
  }
  async function saveStages() {
    if (!selectedTemplate || isSaving) return;

    setIsSaving(true);

    const payload = {
      templateId: selectedTemplate.template_id,
      stages,
    };

    try {
      const res = await saveDefaultStages(payload);

      if (res.success) {
        toast({ title: "Default stages saved" });
        await selectTemplate(selectedTemplate); // reload clean data
      } else {
        toast({
          title: "Save failed",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Error saving stages",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => router.push("/admin/stages")}
              className="h-8 w-8"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            Default Stage Templates
          </CardTitle>
        </CardHeader>

        <CardContent className="grid grid-cols-4 gap-6">
          {/* LEFT: Templates */}
          <div className="col-span-1 border-r pr-4">
            <div className="flex gap-2 mb-4">
              <Input
                placeholder="New template name"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
              />
              <Button onClick={addTemplate} size="icon">
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Template List Header */}
            <p className="text-sm font-semibold text-gray-500 mb-2">
              Default Templates
            </p>

            <div className="space-y-2">
              {templates.map((t) => (
                <Button
                  key={t.template_id}
                  variant={
                    selectedTemplate?.template_id === t.template_id
                      ? "default"
                      : "outline"
                  }
                  className="w-full justify-start truncate"
                  onClick={() => selectTemplate(t)}
                >
                  {t.template_name}
                </Button>
              ))}
            </div>

          </div>

          {/* RIGHT: Stages */}
          <div className="col-span-3">
            {selectedTemplate ? (
              <>
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-xl font-bold">
                      {selectedTemplate.template_name}
                    </h3>
                    <p className="text-sm text-muted-foreground">Manage stages and subtasks for this template</p>
                  </div>
                  <Button onClick={addStage}>
                    <Plus className="mr-2 h-4 w-4" /> Add Stage
                  </Button>
                </div>

                <div className="space-y-4">
                  <SortableContext
                    items={stages.map((_, i) => `stage-${i}`)}
                    strategy={verticalListSortingStrategy}
                  >
                    {stages.map((s, idx) => (
                      <TemplateStageItem
                        key={`stage-${idx}`}
                        id={`stage-${idx}`}
                        stage={s}
                        index={idx}
                        updateStage={(index, updates) => {
                          const copy = [...stages];
                          copy[index] = { ...copy[index], ...updates };
                          setStages(copy);
                        }}
                        deleteStage={(index) => {
                          const copy = [...stages];
                          copy.splice(index, 1);
                          setStages(copy);
                        }}
                        updateSubtasks={(index, subtasks) => {
                          const copy = [...stages];
                          copy[index].subtasks = subtasks;
                          setStages(copy);
                        }}
                      />
                    ))}
                  </SortableContext>

                  {stages.length === 0 && (
                    <div className="text-center py-12 border-2 border-dashed rounded-lg text-muted-foreground bg-muted/10">
                      No stages yet. Click "Add Stage" to begin.
                    </div>
                  )}
                </div>

                <div className="mt-8 flex justify-end">
                  <Button
                    onClick={saveStages}
                    disabled={isSaving}
                    size="lg"
                    className="w-40"
                  >
                    {isSaving ? "Saving..." : "Save Template"}
                  </Button>

                </div>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-12 border-2 border-dashed rounded-xl bg-muted/10">
                <p className="text-lg font-medium">Select a template to manage</p>
                <p className="text-sm">Or create a new one from the left sidebar</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </DndContext>
  );

}
