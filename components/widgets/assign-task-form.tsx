// components/widgets/assign-task-form.tsx
"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  assignTask,
  fetchClients,
  fetchEmailTemplates,
} from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown, Mail, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useUIStore } from "@/store/ui-store";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { mutate } from "swr";


/* -------------------- ZOD SCHEMA -------------------- */
const Schema = z.object({
  title: z.string().min(2, "Task Name is required"),
  clientId: z.string().min(1, "Client is required"),
  assigneeRole: z.enum(["CLIENT", "SERVICE_CENTER", "CPA"]),
  dueDate: z.string().min(1, "Due date is required"), // Made mandatory
});

/* ======================= FORM ======================= */
export function AssignTaskForm({ context }: { context?: Record<string, any> }) {
  const isEditMode = Boolean(context?.taskId);
  const { data: taskData } = useSWR(
    isEditMode ? ["edit-task", context?.taskId] : null,
    async () => {
      if (!context?.taskId) return null;
      const type = context?.taskType || "ASSIGNED";
      const res = await fetch(`/api/tasks/get?taskId=${context.taskId}&taskType=${type}`);
      return res.json();
    }
  );

  const { toast } = useToast();
  const closeDrawer = useUIStore((s) => s.closeDrawer);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);

  // Email notification states
  const [sendEmail, setSendEmail] = useState(false);
  const [selectedEmailTemplate, setSelectedEmailTemplate] = useState("");
  const [templateEmailData, setTemplateEmailData] = useState({ subject: "", body: "" });
  const [customEmailSubject, setCustomEmailSubject] = useState("");
  const [customEmailBody, setCustomEmailBody] = useState("");
  const [emailMode, setEmailMode] = useState<"template" | "custom">("template");

  // Document requirement state
  const [documentRequired, setDocumentRequired] = useState(true); // Default to true for backward compatibility

  /* ------------------- LOAD SQL DATA ------------------- */
  const { data: clients } = useSWR(["clients"], () =>
    fetchClients({ page: 1, pageSize: 100 })
  );

  const { data: emailTemplates } = useSWR(["email-templates"], () =>
    fetchEmailTemplates()
  );

  const prefilledClientId = context?.clientId ? String(context.clientId) : "";

  /* ------------------- FORM SETUP ------------------- */
  const form = useForm<z.infer<typeof Schema>>({
    resolver: zodResolver(Schema),
    defaultValues: {
      title: context?.taskTitle || "",
      clientId: prefilledClientId,
      assigneeRole: context?.assignedToRole || "CLIENT",
      dueDate: context?.dueDate
        ? new Date(context.dueDate).toISOString().split("T")[0]
        : "",
    },
  });

  useEffect(() => {
    if (!isEditMode || !taskData || !taskData.success || !taskData.data || taskData.data.length === 0) return;

    const task = taskData.data[0];

    form.reset({
      title: task.title,
      clientId: String(task.clientId),
      assigneeRole: task.assignedRole,
      dueDate: task.dueDate
        ? new Date(task.dueDate).toISOString().split("T")[0]
        : "",
    });

    // Set document required state from task data (default to true if not set)
    setDocumentRequired(task.documentRequired !== 0 && task.documentRequired !== false);

  }, [taskData, isEditMode]);


  async function onSubmit(values: z.infer<typeof Schema>) {
    console.log("🧩 Assign Task Form Data:", values);

    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      if (!values.title.trim()) {
        toast({
          title: "Error",
          description: "Task Name is required",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      if (!values.clientId) {
        toast({
          title: "Error",
          description: "Client is required",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      if (!values.dueDate) {
        toast({
          title: "Error",
          description: "Due date is required",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      const payload = {
        taskTitle: values.title,
        clientId: Number(values.clientId),
        assignedToRole: values.assigneeRole,
        dueDate: values.dueDate || null,
        description: "",
        orderNumber: 1,
        documentRequired: documentRequired,
      };

      console.log("🚀 Final Payload Sent to assignTask():", payload);

      if (isEditMode) {
        await fetch("/api/tasks/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskId: context?.taskId,
            taskTitle: values.title,
            status: taskData?.data?.[0]?.status || context?.status || "Pending",
            dueDate: values.dueDate || null,
            assignedToRole: values.assigneeRole,
            documentRequired: documentRequired,
          }),
        });

        toast({ title: "Task Updated" });
      } else {
        await assignTask(payload);

        toast({
          title: "Task Assigned",
          description: `Task assigned to ${values.assigneeRole.replace("_", " ")} successfully.`,
        });
      }

      // Send email notification if enabled
      const selectedClient = clients?.data?.find(
        (c: any) => String(c.client_id) === values.clientId
      );

      if (sendEmail && selectedClient?.primary_contact_email) {
        let emailSubject = "";
        let emailBody = "";

        if (emailMode === "template" && selectedEmailTemplate && templateEmailData.subject && templateEmailData.body) {
          // Use the editable template data (which user may have customized)
          emailSubject = templateEmailData.subject;
          emailBody = templateEmailData.body;
        } else if (emailMode === "custom") {
          emailSubject = customEmailSubject;
          emailBody = customEmailBody;
        }

        if (emailSubject && emailBody) {
          // Replace template variables
          emailSubject = emailSubject
            .replace(/\{\{clientName\}\}/gi, selectedClient.client_name || "")
            .replace(/\{\{Client_Name\}\}/gi, selectedClient.client_name || "")
            .replace(/\{\{taskTitle\}\}/gi, values.title)
            .replace(/\{\{dueDate\}\}/gi, values.dueDate);

          emailBody = emailBody
            .replace(/\{\{clientName\}\}/gi, selectedClient.client_name || "")
            .replace(/\{\{Client_Name\}\}/gi, selectedClient.client_name || "")
            .replace(/\{\{taskTitle\}\}/gi, values.title)
            .replace(/\{\{dueDate\}\}/gi, values.dueDate)
            .replace(/\{\{assigneeRole\}\}/gi, values.assigneeRole.replace("_", " "));

          try {
            const emailRes = await fetch("/api/send-email", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                to: selectedClient.primary_contact_email,
                subject: emailSubject,
                body: emailBody,
                clientName: selectedClient.client_name,
              }),
            });

            const emailJson = await emailRes.json();
            if (emailJson.success) {
              toast({
                title: "Email Sent",
                description: `Notification sent to ${selectedClient.primary_contact_email}`,
              });
            } else {
              toast({
                title: "Email Failed",
                description: emailJson.error || "Failed to send notification email",
                variant: "destructive",
              });
            }
          } catch (emailError) {
            console.error("Email send error:", emailError);
            toast({
              title: "Email Failed",
              description: "Task assigned but email notification failed to send.",
              variant: "destructive",
            });
          }
        }
      }

      // 🔄 Refresh UI 
      mutate(["tasks"]);
      mutate(["clients"]);
      mutate(["admin-tasks"]);

      setTimeout(() => {
        closeDrawer();
      }, 400);

    } catch (error: any) {
      console.error("❌ Error assigning task:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to assign task.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const assigneeRole = form.watch("assigneeRole");
  const selectedClientId = form.watch("clientId");

  // Get selected client name for display
  const selectedClient = clients?.data?.find(
    (c: any) => String(c.client_id) === selectedClientId
  );
  const selectedClientName = selectedClient?.client_name;

  /* ======================= UI ======================= */
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-3">

      {/* ✅ DYNAMIC FORM TITLE */}
      <h2 className="text-lg font-semibold mb-2">
        {isEditMode ? "Update Task" : "Assign Task"}
      </h2>

      {/* Task Name - Required */}
      <div className="grid gap-2">
        <Label>
          Task Name <span className="text-red-500">*</span>
        </Label>
        <Input {...form.register("title")} placeholder="Task name" />
        {form.formState.errors.title && (
          <p className="text-xs text-red-500">{form.formState.errors.title.message}</p>
        )}
      </div>

      {/* ✅ CLIENT DROPDOWN - ALWAYS VISIBLE - Required */}
      <div className="grid gap-2">
        <Label>
          Client Name <span className="text-red-500">*</span>
        </Label>

        <Popover open={clientPopoverOpen} onOpenChange={setClientPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              className="w-full justify-between"
            >
              {selectedClientName || "Select client"}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>

          <PopoverContent align="start" side="bottom" className="w-full p-0">
            <Command>
              <CommandInput placeholder="Search client..." />
              <CommandList>
                <CommandEmpty>No client found.</CommandEmpty>

                <CommandGroup className="max-h-64 overflow-y-auto">
                  {clients?.data?.map((c: any) => (
                    <CommandItem
                      key={c.client_id}
                      value={c.client_name}
                      onSelect={() => {
                        form.setValue("clientId", String(c.client_id));
                        setClientPopoverOpen(false);
                      }}
                    >

                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          String(c.client_id) === selectedClientId
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                      />
                      {c.client_name}
                    </CommandItem>
                  ))}
                </CommandGroup>

              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {form.formState.errors.clientId && (
          <p className="text-xs text-red-500">{form.formState.errors.clientId.message}</p>
        )}
      </div>

      {/* Assignee Role - Required */}
      <div className="grid gap-2">
        <Label>
          Assignee Role <span className="text-red-500">*</span>
        </Label>
        <Select
          value={form.watch("assigneeRole")}
          onValueChange={(v) => form.setValue("assigneeRole", v as any)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="CLIENT">Client</SelectItem>
            <SelectItem value="SERVICE_CENTER">Service Center</SelectItem>
            <SelectItem value="CPA">CPA</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Who should complete this task for {selectedClientName || "this client"}?
        </p>
      </div>

      {/* Due Date - Required */}
      <div className="grid gap-2">
        <Label>
          Due Date <span className="text-red-500">*</span>
        </Label>
        <Input
          type="date"
          {...form.register("dueDate")}
          onFocus={(e) => e.currentTarget.showPicker?.()}
        />
        {form.formState.errors.dueDate && (
          <p className="text-xs text-red-500">{form.formState.errors.dueDate.message}</p>
        )}
      </div>

      {/* Document Required Checkbox */}
      <div className="border rounded-lg p-3 bg-amber-50/50 border-amber-200 mt-2">
        <div className="flex items-center gap-3">
          <Checkbox
            id="document-required"
            checked={documentRequired}
            onCheckedChange={(checked) => setDocumentRequired(checked === true)}
          />
          <Label htmlFor="document-required" className="cursor-pointer font-medium text-sm">
            Is Document Required?
          </Label>
        </div>
        <p className="text-xs text-muted-foreground mt-2 ml-7">
          {documentRequired
            ? "Client must upload a document to complete this task."
            : "Client can complete this task without uploading documents."}
        </p>
      </div>

      {/* Email Notification Section - Optional */}
      <div className="border rounded-lg p-3 bg-muted/20 mt-2">
        <div className="flex items-center gap-3">
          <Checkbox
            id="send-email-notification"
            checked={sendEmail}
            onCheckedChange={(checked) => setSendEmail(checked === true)}
          />
          <Label htmlFor="send-email-notification" className="flex items-center gap-2 cursor-pointer text-sm">
            <Mail className="h-4 w-4 text-blue-600" />
            Send Email Notification
          </Label>
          <span className="text-xs text-muted-foreground">(Optional)</span>
        </div>

        {sendEmail && (
          <div className="mt-4 space-y-3 border-t pt-3">
            {/* Email Mode Selection */}
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={emailMode === "template" ? "default" : "outline"}
                onClick={() => setEmailMode("template")}
              >
                Use Template
              </Button>
              <Button
                type="button"
                size="sm"
                variant={emailMode === "custom" ? "default" : "outline"}
                onClick={() => setEmailMode("custom")}
              >
                Custom Message
              </Button>
            </div>

            {emailMode === "template" ? (
              <div className="space-y-3">
                <div>
                  <Label className="text-sm">Select Email Template</Label>
                  <Select
                    value={selectedEmailTemplate}
                    onValueChange={(value) => {
                      setSelectedEmailTemplate(value);
                      // Load template content into editable fields
                      const template = emailTemplates?.find((t: any) => t.id.toString() === value);
                      if (template) {
                        setTemplateEmailData({
                          subject: template.subject || "",
                          body: template.body || ""
                        });
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a template..." />
                    </SelectTrigger>
                    <SelectContent>
                      {emailTemplates?.map((t: any) => (
                        <SelectItem key={t.id} value={t.id.toString()}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Editable Template Content */}
                {selectedEmailTemplate && (
                  <div className="space-y-3 border rounded-lg p-3 bg-white">
                    {/* Auto-fill Button */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-blue-700">
                        <strong>Tip:</strong> Click Auto-Fill to replace variables
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="text-xs"
                        onClick={() => {
                          const taskTitle = form.getValues("title");
                          const dueDate = form.getValues("dueDate");
                          const assigneeRole = form.getValues("assigneeRole");
                          setTemplateEmailData((prev) => ({
                            subject: prev.subject
                              .replace(/\{\{clientName\}\}/gi, selectedClient?.client_name || "")
                              .replace(/\{\{Client_Name\}\}/gi, selectedClient?.client_name || "")
                              .replace(/\{\{taskTitle\}\}/gi, taskTitle || "")
                              .replace(/\{\{dueDate\}\}/gi, dueDate || ""),
                            body: prev.body
                              .replace(/\{\{clientName\}\}/gi, selectedClient?.client_name || "")
                              .replace(/\{\{Client_Name\}\}/gi, selectedClient?.client_name || "")
                              .replace(/\{\{taskTitle\}\}/gi, taskTitle || "")
                              .replace(/\{\{dueDate\}\}/gi, dueDate || "")
                              .replace(/\{\{assigneeRole\}\}/gi, assigneeRole?.replace("_", " ") || "")
                              .replace(/\{\{Company_Name\}\}/gi, "MySage ClientHub")
                              .replace(/\{\{Support_Email\}\}/gi, "support@clienthub.com")
                          }));
                          toast({ title: "Auto-filled", description: "Variables replaced with actual values" });
                        }}
                      >
                        Auto-Fill
                      </Button>
                    </div>

                    {/* Editable Subject */}
                    <div>
                      <Label className="text-xs text-muted-foreground">Subject</Label>
                      <Input
                        value={templateEmailData.subject}
                        onChange={(e) => setTemplateEmailData({ ...templateEmailData, subject: e.target.value })}
                        placeholder="Email subject..."
                        className="mt-1"
                      />
                    </div>

                    {/* Editable Body */}
                    <div>
                      <Label className="text-xs text-muted-foreground">Email Body</Label>
                      <Textarea
                        id="template-email-body"
                        value={templateEmailData.body}
                        onChange={(e) => setTemplateEmailData({ ...templateEmailData, body: e.target.value })}
                        placeholder="Email content..."
                        rows={6}
                        className="mt-1 font-mono text-xs"
                      />
                    </div>

                    {/* Quick Insert Variables */}
                    <div className="flex flex-wrap gap-1">
                      {[
                        { var: "{{clientName}}", label: "Client" },
                        { var: "{{taskTitle}}", label: "Task" },
                        { var: "{{dueDate}}", label: "Due" },
                      ].map((item) => (
                        <button
                          key={item.var}
                          type="button"
                          className="text-xs px-2 py-0.5 bg-muted border rounded hover:bg-primary/10"
                          onClick={() => {
                            const textarea = document.getElementById("template-email-body") as HTMLTextAreaElement;
                            if (textarea) {
                              const start = textarea.selectionStart;
                              const end = textarea.selectionEnd;
                              const newValue = templateEmailData.body.substring(0, start) + item.var + templateEmailData.body.substring(end);
                              setTemplateEmailData((prev) => ({ ...prev, body: newValue }));
                            } else {
                              setTemplateEmailData((prev) => ({ ...prev, body: prev.body + item.var }));
                            }
                          }}
                        >
                          + {item.label}
                        </button>
                      ))}
                    </div>

                    {/* Live Preview */}
                    <div className="border-t pt-2">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Mail className="h-3 w-3" /> Live Preview
                      </Label>
                      <div
                        className="mt-1 p-2 bg-muted/30 rounded text-xs max-h-[120px] overflow-y-auto"
                        style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                        dangerouslySetInnerHTML={{
                          __html: templateEmailData.body
                            .replace(/\{\{clientName\}\}/gi, `<span class="bg-yellow-200 px-0.5 rounded">${selectedClient?.client_name || "{{clientName}}"}</span>`)
                            .replace(/\{\{Client_Name\}\}/gi, `<span class="bg-yellow-200 px-0.5 rounded">${selectedClient?.client_name || "{{Client_Name}}"}</span>`)
                            .replace(/\{\{taskTitle\}\}/gi, `<span class="bg-blue-200 px-0.5 rounded">${form.getValues("title") || "{{taskTitle}}"}</span>`)
                            .replace(/\{\{dueDate\}\}/gi, `<span class="bg-green-200 px-0.5 rounded">${form.getValues("dueDate") || "{{dueDate}}"}</span>`)
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <Label className="text-sm">Email Subject</Label>
                  <Input
                    placeholder="New Task Assigned: {{taskTitle}}"
                    value={customEmailSubject}
                    onChange={(e) => setCustomEmailSubject(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm">Email Body</Label>
                  <Textarea
                    placeholder="Hi {{clientName}}, a new task has been assigned to you..."
                    value={customEmailBody}
                    onChange={(e) => setCustomEmailBody(e.target.value)}
                    rows={4}
                    className="mt-1 text-sm"
                  />
                </div>
                <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
                  <strong>Variables:</strong> {"{{clientName}}"}, {"{{taskTitle}}"}, {"{{dueDate}}"}, {"{{assigneeRole}}"}
                </div>
              </div>
            )}

            {selectedClient?.primary_contact_email && (
              <p className="text-xs text-green-600 flex items-center gap-1">
                <Send className="h-3 w-3" />
                Email will be sent to: {selectedClient.primary_contact_email}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Buttons */}
      <div className="flex justify-end gap-2 mt-3">
        <Button type="button" variant="outline" onClick={closeDrawer}>
          Cancel
        </Button>

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? isEditMode ? "Updating..." : "Assigning..."
            : isEditMode ? "Update Task" : "Assign"}
        </Button>

      </div>
    </form>
  );
}
