// components/widgets/task-complete-modal.tsx
"use client";

import { useState, useRef } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
    Upload,
    File,
    X,
    CheckCircle2,
    AlertCircle,
    Loader2
} from "lucide-react";

type FileType = "PDF" | "XLSX" | "DOCX" | "IMG" | "OTHER";

type Props = {
    open: boolean;
    onClose: () => void;
    onComplete: () => void;
    taskTitle: string;
    taskId: number;
    clientId: string;
    clientName?: string; // Client name for folder structure
    uploaderRole?: "CLIENT" | "CPA" | "SERVICE_CENTER"; // Who is uploading the document
    taskType: "assigned" | "onboarding";
    stageName?: string; // Stage name for onboarding subtasks
    documentMode?: 'stage' | 'subtask'; // For onboarding: 'stage' = one doc for entire stage, 'subtask' = doc per subtask
};

export function TaskCompleteModal({
    open,
    onClose,
    onComplete,
    taskTitle,
    taskId,
    clientId,
    clientName,
    uploaderRole = "CLIENT", // Default to CLIENT for backward compatibility
    taskType,
    stageName,
    documentMode = 'subtask', // Default to subtask mode for backward compatibility
}: Props) {
    const { toast } = useToast();
    const [uploading, setUploading] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [dragActive, setDragActive] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // File handling functions
    function handleFilesSelect(files: FileList | null) {
        if (!files || files.length === 0) return;
        const newFiles = Array.from(files);
        setSelectedFiles(prev => [...prev, ...newFiles]);
    }

    function removeFile(index: number) {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    }

    function handleDrag(e: React.DragEvent) {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(e.type === "dragenter" || e.type === "dragover");
    }

    function handleDrop(e: React.DragEvent) {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            setSelectedFiles(prev => [...prev, ...Array.from(files)]);
        }
    }

    function getFileType(fileName: string): FileType {
        const ext = fileName.split(".").pop()?.toLowerCase() || "";
        const typeMap: Record<string, FileType> = {
            pdf: "PDF",
            xlsx: "XLSX",
            xls: "XLSX",
            docx: "DOCX",
            doc: "DOCX",
            jpg: "IMG",
            jpeg: "IMG",
            png: "IMG",
            gif: "IMG",
            bmp: "IMG",
            webp: "IMG",
            svg: "IMG",
        };
        return typeMap[ext] || "OTHER";
    }

    // Handle complete with upload
    async function handleCompleteTask() {
        if (selectedFiles.length === 0) {
            toast({
                title: "Document Required",
                description: "Please upload at least one document to confirm task completion.",
                variant: "destructive",
            });
            return;
        }

        setUploading(true);
        setUploadProgress(0);

        const totalFiles = selectedFiles.length;
        let successCount = 0;
        let failCount = 0;

        // Upload all files
        for (let i = 0; i < selectedFiles.length; i++) {
            const file = selectedFiles[i];
            setUploadProgress(Math.round((i / totalFiles) * 100));

            const formData = new FormData();
            formData.append("file", file);
            formData.append("clientId", clientId);
            formData.append("fileType", getFileType(file.name));

            // Organize documents into structured folders based on uploader role:
            // - Assigned Task Completion Documents/[Client Name]/[Task Name]/ (for CLIENT uploads)
            // - Assigned Task Completion Documents - CPA/[Client Name]/[Task Name]/ (for CPA uploads)
            // - Assigned Task Completion Documents - Service Center/[Client Name]/[Task Name]/ (for SC uploads)
            // - Onboarding Stage Completion Documents/[Client Name]/[Stage Name]/ (for stage mode)
            let folderPath: string;
            const clientFolder = clientName || `Client-${clientId}`;

            if (taskType === "assigned") {
                // Different root folder based on who is uploading
                let rootFolder = "Assigned Task Completion Documents";
                if (uploaderRole === "CPA") {
                    rootFolder = "Assigned Task Completion Documents - CPA";
                } else if (uploaderRole === "SERVICE_CENTER") {
                    rootFolder = "Assigned Task Completion Documents - Service Center";
                }
                folderPath = `${rootFolder}/${clientFolder}/${taskTitle}`;
            } else {
                // For onboarding, folder structure depends on documentMode
                if (documentMode === 'stage') {
                    // Stage mode: just use stage name
                    folderPath = `Onboarding Stage Completion Documents/${clientFolder}/${stageName || taskTitle}`;
                } else {
                    // Subtask mode: use Stage Name - Subtask Name format
                    const subtaskFolder = stageName ? `${stageName}-${taskTitle}` : taskTitle;
                    folderPath = `Onboarding Stage Completion Documents/${clientFolder}/${subtaskFolder}`;
                }
            }
            formData.append("folderName", folderPath);

            try {
                const res = await fetch("/api/documents/upload", {
                    method: "POST",
                    body: formData,
                });

                const data = await res.json();

                if (data.success) {
                    successCount++;
                } else {
                    failCount++;
                }
            } catch (error) {
                failCount++;
                console.error("Upload error:", error);
            }
        }

        setUploadProgress(100);

        if (failCount > 0 && successCount === 0) {
            toast({
                title: "Upload Failed",
                description: "Failed to upload documents. Please try again.",
                variant: "destructive",
            });
            setUploading(false);
            return;
        }

        if (failCount > 0) {
            toast({
                title: "Partial Upload",
                description: `${successCount} file(s) uploaded successfully, ${failCount} failed. Task will be marked complete.`,
            });
        } else {
            toast({
                title: "Documents Uploaded",
                description: `${successCount} document(s) uploaded successfully.`,
            });
        }

        // Call the onComplete callback to update the task status
        onComplete();

        // Reset and close
        setSelectedFiles([]);
        setUploading(false);
        onClose();
    }

    function handleClose() {
        if (!uploading) {
            setSelectedFiles([]);
            onClose();
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        Complete Task
                    </DialogTitle>
                    <DialogDescription>
                        To mark this task as completed, you must upload supporting documentation.
                    </DialogDescription>
                </DialogHeader>

                {/* Task Info */}
                <div className="bg-muted/50 rounded-lg p-4 border">
                    <p className="text-sm text-muted-foreground">Task:</p>
                    <p className="font-medium">{taskTitle}</p>
                </div>

                {/* Info Alert */}
                <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm">
                        <p className="font-medium text-amber-800">Document Upload Required</p>
                        <p className="text-amber-700 mt-1">
                            Please upload at least one document to confirm task completion.
                            This helps verify the work has been done.
                        </p>
                    </div>
                </div>

                {/* Upload Box */}
                <div className="grid gap-2">
                    <Label>Upload Documents</Label>
                    <div
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`relative rounded-lg border-2 border-dashed p-6 text-center transition-colors cursor-pointer ${dragActive ? "border-primary bg-primary/5" : "border-border"
                            }`}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            onChange={(e) => { handleFilesSelect(e.target.files); e.target.value = ''; }}
                            className="hidden"
                            accept="*"
                            disabled={uploading}
                        />

                        <div className="flex flex-col items-center gap-2">
                            <Upload className="size-6 text-muted-foreground" />
                            <div className="text-sm">
                                <span className="font-medium">Click to upload</span> or drag and drop
                            </div>
                            <div className="text-xs text-muted-foreground">
                                PDF, XLSX, DOCX, Images up to 10MB
                            </div>
                        </div>
                    </div>
                </div>

                {/* Selected Files Preview */}
                {selectedFiles.length > 0 && (
                    <div className="grid gap-2 max-h-32 overflow-y-auto">
                        <Label>Selected Files ({selectedFiles.length})</Label>
                        {selectedFiles.map((file, index) => (
                            <div
                                key={index}
                                className="flex items-center gap-2 rounded-md bg-muted p-2"
                            >
                                <File className="size-4 text-muted-foreground flex-shrink-0" />
                                <div className="flex-1 text-sm min-w-0">
                                    <div className="font-medium truncate">{file.name}</div>
                                    <div className="text-xs text-muted-foreground">
                                        {(file.size / 1024).toFixed(1)} KB
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => removeFile(index)}
                                    className="p-1 hover:bg-destructive/10 rounded-md text-muted-foreground hover:text-destructive transition-colors"
                                    disabled={uploading}
                                >
                                    <X className="size-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Upload Progress */}
                {uploading && (
                    <div className="grid gap-1">
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                            <Loader2 className="size-3 animate-spin" />
                            Uploading... {Math.round(uploadProgress)}%
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div
                                className="h-full bg-primary transition-all"
                                style={{ width: `${uploadProgress}%` }}
                            />
                        </div>
                    </div>
                )}

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button
                        variant="outline"
                        onClick={handleClose}
                        disabled={uploading}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleCompleteTask}
                        disabled={uploading || selectedFiles.length === 0}
                        className="gap-2"
                    >
                        {uploading ? (
                            <>
                                <Loader2 className="size-4 animate-spin" />
                                Uploading...
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="size-4" />
                                Upload & Complete Task
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
