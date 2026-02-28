// app/client/stages/sortable-stage-item.tsx

"use client";

import { CSS } from "@dnd-kit/utilities";
import { useSortable, defaultAnimateLayoutChanges } from "@dnd-kit/sortable";
import { GripVertical, Edit2, Trash2, Plus, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Popover,
    PopoverTrigger,
    PopoverContent,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { TaskCompleteModal } from "@/components/widgets/task-complete-modal";
import { useRouter } from "next/navigation";

/* ---------------- TYPES ---------------- */

export interface Subtask {
    title: string;
    status: string;
    due_date?: string | null;
    document_required?: boolean; // Only relevant when parent stage's document_mode is 'subtask'
}

export interface SortableStageItemProps {
    stage: {
        id: string;
        name: string;
        order: number;
        isRequired: boolean;
        status: string;

        start_date?: string | null;
        completed_at?: string | null;
        document_required?: boolean;
        document_mode?: 'stage' | 'subtask';
    };

    subtasks: Record<string, Subtask[]>;
    clientId: string; // Added for document upload

    updateSubtask: (
        stageId: string,
        index: number,
        updates: Partial<Subtask>
    ) => void;

    addSubtask: (stageId: string, title: string) => void;
    removeSubtask: (stageId: string, index: number) => void;

    onEdit: (stage: any) => void;
    onDelete: (id: string) => void;

    onStageStatusChange: (id: string, status: string) => void;

    onStageStartDateChange: (stageId: string, startDate: string | null) => void;
}

/* -------------- STAGE STATUSES --------------- */

const STATUS_OPTIONS = ["Not Started", "In Progress", "Completed"];

/* ---------------- COMPONENT ---------------- */

export function SortableStageItem({
    stage,
    subtasks,
    clientId,
    addSubtask,
    removeSubtask,
    onEdit,
    onDelete,
    onStageStatusChange,
    updateSubtask,
    onStageStartDateChange,
}: SortableStageItemProps) {
    const router = useRouter();
    const [showStartDate, setShowStartDate] = useState(false);

    // State for task completion modal
    const [completeModalOpen, setCompleteModalOpen] = useState(false);
    const [pendingSubtask, setPendingSubtask] = useState<{
        index: number;
        title: string;
    } | null>(null);

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: stage.id,
        animateLayoutChanges: defaultAnimateLayoutChanges,
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    };

    const stageStatus = stage.status || "Not Started";
    const stageSubtasks: Subtask[] = subtasks[stage.id] || [];

    // Handle subtask status change - conditionally show document upload modal based on document requirements
    const handleSubtaskStatusChange = (index: number, value: string) => {
        if (value === "Completed") {
            const subtask = stageSubtasks[index];

            // Determine if document upload is required for this completion
            let requiresDocument = false;

            if (stage.document_required) {
                if (stage.document_mode === 'stage') {
                    // Stage-level document: Show modal only when completing the LAST subtask of the stage
                    const otherSubtasksCompleted = stageSubtasks.every((st, i) =>
                        i === index || (st.status || '').toLowerCase() === 'completed'
                    );
                    requiresDocument = otherSubtasksCompleted;
                } else if (stage.document_mode === 'subtask') {
                    // Subtask-level document: EVERY subtask requires document upload
                    requiresDocument = true;
                }
            }

            if (requiresDocument) {
                setPendingSubtask({
                    index,
                    title: subtask.title || `Subtask ${index + 1}`,
                });
                setCompleteModalOpen(true);
            } else {
                // No document required, complete directly
                updateSubtask(stage.id.toString(), index, { status: value });
            }
        } else {
            updateSubtask(stage.id.toString(), index, { status: value });
        }
    };

    // Handle task completion after document upload
    const handleTaskComplete = () => {
        if (pendingSubtask !== null) {
            updateSubtask(stage.id.toString(), pendingSubtask.index, { status: "Completed" });
            setPendingSubtask(null);
        }
    };

    // Navigate to documents folder for this task
    const viewDocuments = (subtaskTitle: string) => {
        // Navigate to documents page with specific folder path: Onboarding Stage Completion Documents/[Stage]-[Subtask]
        const folderPath = encodeURIComponent(
            `Onboarding Stage Completion Documents/${stage.name}-${subtaskTitle}`
        );
        router.push(`/client/documents?folder=${folderPath}`);
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="rounded-md border p-3 bg-white shadow-sm"
        >
            {/* HEADER */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <div
                        {...attributes}
                        {...listeners}
                        className="cursor-grab active:cursor-grabbing"
                    >
                        <GripVertical className="size-4 text-muted-foreground" />
                    </div>

                    <div className="font-medium">{stage.name}</div>

                    {stage.isRequired && (
                        <span className="rounded bg-muted px-2 py-0.5 text-xs">
                            Required
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                        Order {stage.order}
                    </span>

                    {/* START DATE PICKER (POPOVER) */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                size="sm"
                                variant="outline"
                                className={
                                    "h-7 text-xs justify-start text-left font-normal " +
                                    (!stage.start_date && "text-muted-foreground")
                                }
                            >
                                {stage.start_date ? (
                                    `Start: ${stage.start_date}`
                                ) : (
                                    <span>Start Date</span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                            <Calendar
                                mode="single"
                                selected={
                                    stage.start_date
                                        ? new Date(stage.start_date + "T00:00:00") // Force local midnight parsing if YYYY-MM-DD
                                        : undefined
                                }
                                onSelect={(date) => {
                                    if (date) {
                                        const year = date.getFullYear();
                                        const month = String(date.getMonth() + 1).padStart(2, "0");
                                        const day = String(date.getDate()).padStart(2, "0");
                                        const isoDate = `${year}-${month}-${day}`;
                                        onStageStartDateChange(stage.id, isoDate);
                                    } else {
                                        onStageStartDateChange(stage.id, null);
                                    }
                                }}
                                initialFocus
                            />
                            <div className="p-2 border-t border-border">
                                <Button
                                    variant="ghost"
                                    className="w-full h-6 text-xs text-destructive"
                                    onClick={() => onStageStartDateChange(stage.id, null)}
                                >
                                    Clear Date
                                </Button>
                            </div>
                        </PopoverContent>
                    </Popover>

                    <Button size="sm" variant="ghost" onClick={() => onEdit(stage)}>
                        <Edit2 className="size-4" />
                    </Button>

                    <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => onDelete(stage.id)}
                    >
                        <Trash2 className="size-4" />
                    </Button>
                </div>
            </div>

            {/* STAGE STATUS */}
            <div className="ml-6 mb-3 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Stage Status</span>

                <Select
                    value={stageStatus}
                    onValueChange={(value: string) => onStageStatusChange(stage.id, value)}
                >
                    <SelectTrigger className="h-7 w-40 text-xs">
                        <SelectValue />
                    </SelectTrigger>

                    <SelectContent>
                        {STATUS_OPTIONS.map((s) => (
                            <SelectItem key={s} value={s}>
                                {s}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* SUBTASKS */}
            <div className="ml-6 mt-2 border-t pt-2">
                <div className="text-xs font-semibold text-muted-foreground mb-2">
                    Sub-Tasks
                </div>

                {/* SUBTASK LIST */}
                <div className="grid gap-1 mb-2">
                    <AnimatePresence>
                        {stageSubtasks.map((t, index: number) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ duration: 0.2 }}
                                className="flex items-center bg-gray-100 rounded px-2 py-1 text-sm gap-3"
                            >
                                {/* Task Name - takes about 45% */}
                                <div className="w-[45%] min-w-0">
                                    <Input
                                        value={t.title}
                                        className={`h-7 text-xs w-full ${!t.title?.trim() ? 'border-red-300 focus:border-red-500' : ''}`}
                                        placeholder="Sub-Task*"
                                        required
                                        onChange={(e) =>
                                            updateSubtask(stage.id.toString(), index, {
                                                title: e.target.value,
                                            })
                                        }
                                    />
                                </div>

                                {/* Due Date - takes about 25% */}
                                <div className="w-[25%] flex-shrink-0">
                                    <Input
                                        type="date"
                                        value={t.due_date ?? ""}
                                        className={`h-7 text-xs w-full ${!t.due_date ? 'border-red-300 focus:border-red-500' : ''}`}
                                        required
                                        onChange={(e) =>
                                            updateSubtask(stage.id.toString(), index, {
                                                due_date: e.target.value,
                                            })
                                        }
                                    />
                                </div>

                                {/* Status - takes about 15% */}
                                <div className="w-[15%] flex-shrink-0">
                                    <Select
                                        value={t.status || "Not Started"}
                                        onValueChange={(value) =>
                                            handleSubtaskStatusChange(index, value)
                                        }
                                    >
                                        <SelectTrigger className="h-7 w-full text-xs">
                                            <SelectValue placeholder="Status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Not Started">Not Started</SelectItem>
                                            <SelectItem value="In Progress">In Progress</SelectItem>
                                            <SelectItem value="Completed">Completed</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Action buttons - fixed width */}
                                <div className="flex items-center gap-1 flex-shrink-0 justify-end">
                                    {/* View Documents button - only show for completed */}
                                    {(t.status || "").toLowerCase() === "completed" && (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-6 w-6 p-0 text-primary"
                                            onClick={() => viewDocuments(t.title)}
                                            title="View Documents"
                                        >
                                            <Eye className="size-4" />
                                        </Button>
                                    )}

                                    {/* Delete button */}
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 w-6 p-0 text-destructive"
                                        onClick={() => removeSubtask(stage.id, index)}
                                    >
                                        <Trash2 className="size-4" />
                                    </Button>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>

                <Button
                    size="sm"
                    variant="outline"
                    className="h-7 flex items-center gap-1 text-xs"
                    onClick={() => addSubtask(stage.id.toString(), "")}
                >
                    <Plus className="size-4" />
                    Add task
                </Button>
            </div>

            {/* Task Completion Modal - requires document upload */}
            {clientId && pendingSubtask && (
                <TaskCompleteModal
                    open={completeModalOpen}
                    onClose={() => {
                        setCompleteModalOpen(false);
                        setPendingSubtask(null);
                    }}
                    onComplete={handleTaskComplete}
                    taskTitle={pendingSubtask.title}
                    taskId={pendingSubtask.index}
                    clientId={clientId}
                    taskType="onboarding"
                    stageName={stage.name}
                />
            )}
        </div>
    );
}
