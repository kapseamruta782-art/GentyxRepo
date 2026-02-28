
"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { GripVertical, Plus, Trash2, X } from "lucide-react";

interface SubTask {
    title: string;
    status: string;
}

interface Stage {
    stage_name: string;
    is_required: boolean;
    subtasks?: SubTask[];
}

interface TemplateStageItemProps {
    id: string;
    stage: Stage;
    index: number;
    updateStage: (index: number, updates: Partial<Stage>) => void;
    deleteStage: (index: number) => void;
    updateSubtasks: (index: number, subtasks: SubTask[]) => void;
}

export function TemplateStageItem({
    id,
    stage,
    index,
    updateStage,
    deleteStage,
    updateSubtasks,
}: TemplateStageItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <Card ref={setNodeRef} style={style} className="border bg-slate-50/50 relative">
            <CardHeader className="py-3 pl-2">
                <div className="flex items-center gap-3">
                    <div
                        {...attributes}
                        {...listeners}
                        className="cursor-move p-2 hover:bg-muted rounded text-muted-foreground"
                    >
                        <GripVertical className="h-5 w-5" />
                    </div>

                    <span className="font-mono text-muted-foreground bg-white border px-2 py-1 rounded text-xs">
                        {index + 1}
                    </span>
                    <Input
                        value={stage.stage_name}
                        placeholder="Stage Name"
                        className="font-semibold h-9"
                        onChange={(e) => updateStage(index, { stage_name: e.target.value })}
                    />
                    <div className="flex items-center gap-3 shrink-0">
                        <label className="text-sm flex items-center gap-2 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={stage.is_required}
                                onChange={(e) => updateStage(index, { is_required: e.target.checked })}
                                className="rounded border-gray-300"
                            />
                            Required
                        </label>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => deleteStage(index)}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="pt-0 pb-3 pl-12">
                <div className="ml-2 border-l-2 pl-4 border-dashed border-gray-200">
                    <div className="min-h-[1px] py-2">
                        {stage.subtasks?.map((st, subIdx) => (
                            <div key={subIdx} className="flex gap-2 mb-2 items-center group">
                                <div className="h-1.5 w-1.5 rounded-full bg-gray-300" />
                                <Input
                                    value={st.title}
                                    className="h-8 text-sm bg-white"
                                    placeholder="Subtask title..."
                                    onChange={(e) => {
                                        const newSubtasks = [...(stage.subtasks || [])];
                                        newSubtasks[subIdx] = { ...newSubtasks[subIdx], title: e.target.value };
                                        updateSubtasks(index, newSubtasks);
                                    }}
                                />
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => {
                                        const newSubtasks = (stage.subtasks || []).filter((_, i) => i !== subIdx);
                                        updateSubtasks(index, newSubtasks);
                                    }}
                                >
                                    <X className="h-4 w-4 text-gray-400 hover:text-red-500" />
                                </Button>
                            </div>
                        ))}
                    </div>

                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-primary hover:text-primary hover:bg-primary/10 -ml-2"
                        onClick={() => {
                            const newSubtasks = [...(stage.subtasks || [])];
                            newSubtasks.push({ title: "", status: "Not Started" });
                            updateSubtasks(index, newSubtasks);
                        }}
                    >
                        <Plus className="h-3 w-3 mr-1" /> Add Subtask
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
