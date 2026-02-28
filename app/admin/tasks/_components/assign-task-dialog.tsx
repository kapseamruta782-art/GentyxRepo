// app/admin/tasks/_components/assign-task-dialog.tsx
"use client";

import { useState } from "react";
import { useUIStore } from "@/store/ui-store";
import { assignTask, fetchClients, fetchEmailTemplates } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import useSWR from "swr";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Mail, Send } from "lucide-react";

export function AssignTaskDialog() {
  const { closeDrawer } = useUIStore();
  const { toast } = useToast();

  // Task fields - all required
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [assigneeRole, setAssigneeRole] = useState("CLIENT");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");

  // Document requirement - optional
  const [documentRequired, setDocumentRequired] = useState(true); // Default to true for backward compatibility

  // Email notification - optional
  const [sendEmail, setSendEmail] = useState(false);
  const [selectedEmailTemplate, setSelectedEmailTemplate] = useState("");
  const [customEmailSubject, setCustomEmailSubject] = useState("");
  const [customEmailBody, setCustomEmailBody] = useState("");
  const [emailMode, setEmailMode] = useState<"template" | "custom">("template");

  const [isAssigning, setIsAssigning] = useState(false);

  // Fetch clients
  const { data: clientsData } = useSWR("clients-mini", () =>
    fetchClients({ page: 1, pageSize: 100 })
  );
  const clients = clientsData?.data || [];

  // Fetch email templates
  const { data: emailTemplates } = useSWR("email-templates", () =>
    fetchEmailTemplates()
  );

  // Get selected client details (for email)
  const selectedClient = clients.find(
    (c: any) => String(c.client_id) === clientId
  );

  async function handleAssign() {
    // Validate required fields
    if (!title.trim()) {
      toast({
        title: "Missing Field",
        description: "Task Name is required.",
        variant: "destructive",
      });
      return;
    }

    if (!clientId) {
      toast({
        title: "Missing Field",
        description: "Please select a client.",
        variant: "destructive",
      });
      return;
    }

    if (!assigneeRole) {
      toast({
        title: "Missing Field",
        description: "Please select an assignee role.",
        variant: "destructive",
      });
      return;
    }

    if (!dueDate) {
      toast({
        title: "Missing Field",
        description: "Due date is required.",
        variant: "destructive",
      });
      return;
    }

    setIsAssigning(true);

    try {
      // 1. Assign the task
      await assignTask({
        clientId: Number(clientId),
        taskTitle: title,
        assignedToRole: assigneeRole,
        dueDate: dueDate,
        description: description,
        documentRequired: documentRequired,
      });

      // 2. Send email notification if enabled
      if (sendEmail && selectedClient?.primary_contact_email) {
        let emailSubject = "";
        let emailBody = "";

        // Both template and custom modes now use the editable fields
        // Templates are loaded into these fields when selected
        if (emailMode === "template" && selectedEmailTemplate) {
          // Use the edited template content from the editable fields
          emailSubject = customEmailSubject;
          emailBody = customEmailBody;
        } else if (emailMode === "custom") {
          emailSubject = customEmailSubject;
          emailBody = customEmailBody;
        }


        if (emailSubject && emailBody) {
          // Replace template variables
          emailSubject = emailSubject
            .replace(/\{\{clientName\}\}/gi, selectedClient.client_name || "")
            .replace(/\{\{taskTitle\}\}/gi, title)
            .replace(/\{\{dueDate\}\}/gi, dueDate);

          emailBody = emailBody
            .replace(/\{\{clientName\}\}/gi, selectedClient.client_name || "")
            .replace(/\{\{Client_Name\}\}/gi, selectedClient.client_name || "")
            .replace(/\{\{taskTitle\}\}/gi, title)
            .replace(/\{\{dueDate\}\}/gi, dueDate)
            .replace(/\{\{assigneeRole\}\}/gi, assigneeRole);

          try {
            await fetch("/api/send-email", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                to: selectedClient.primary_contact_email,
                subject: emailSubject,
                body: emailBody,
                clientName: selectedClient.client_name,
              }),
            });
            toast({
              title: "Email Sent",
              description: `Notification sent to ${selectedClient.primary_contact_email}`,
            });
          } catch (emailError) {
            console.error("Email send error:", emailError);
            // Don't fail the task assignment if email fails
            toast({
              title: "Email Failed",
              description: "Task assigned but email notification failed to send.",
              variant: "destructive",
            });
          }
        }
      }

      toast({ title: "Success", description: "Task assigned successfully." });
      closeDrawer();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to assign task",
        variant: "destructive",
      });
    } finally {
      setIsAssigning(false);
    }
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-semibold">Assign Task</h2>

      {/* Task Name - Required */}
      <div className="grid gap-2">
        <Label>
          Task Name <span className="text-red-500">*</span>
        </Label>
        <Input
          placeholder="Enter task name"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      {/* Client Name - Required */}
      <div className="grid gap-2">
        <Label>
          Client Name <span className="text-red-500">*</span>
        </Label>
        <Select onValueChange={(v) => setClientId(v)} value={clientId}>
          <SelectTrigger>
            <SelectValue placeholder="Select client" />
          </SelectTrigger>
          <SelectContent>
            {clients.map((c: any) => (
              <SelectItem key={c.client_id} value={String(c.client_id)}>
                {c.client_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Assignee Role - Required */}
      <div className="grid gap-2">
        <Label>
          Assignee Role <span className="text-red-500">*</span>
        </Label>
        <Select value={assigneeRole} onValueChange={(v) => setAssigneeRole(v)}>
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
          Who should complete this task for this client?
        </p>
      </div>

      {/* Due Date - Required */}
      <div className="grid gap-2">
        <Label>
          Due Date <span className="text-red-500">*</span>
        </Label>
        <Input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
      </div>

      {/* Description - Optional */}
      <div className="grid gap-2">
        <Label>Description (Optional)</Label>
        <Textarea
          placeholder="Enter task description..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />
      </div>

      {/* Document Required Checkbox - Optional */}
      <div className="border rounded-lg p-3 bg-amber-50/50 border-amber-200">
        <div className="flex items-center gap-3">
          <Checkbox
            id="document-required"
            checked={documentRequired}
            onCheckedChange={(checked) => setDocumentRequired(checked === true)}
          />
          <Label htmlFor="document-required" className="cursor-pointer font-medium">
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
      <div className="border rounded-lg p-3 bg-muted/20">
        <div className="flex items-center gap-3">
          <Checkbox
            id="send-email"
            checked={sendEmail}
            onCheckedChange={(checked) => setSendEmail(checked === true)}
          />
          <Label htmlFor="send-email" className="flex items-center gap-2 cursor-pointer">
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
                <div className="space-y-2">
                  <Label className="text-sm">Select Email Template</Label>
                  <Select
                    value={selectedEmailTemplate}
                    onValueChange={(value) => {
                      setSelectedEmailTemplate(value);
                      // Load template content into editable fields
                      const template = emailTemplates?.find((t: any) => t.id.toString() === value);
                      if (template) {
                        setCustomEmailSubject(template.subject || "");
                        setCustomEmailBody(template.body || "");
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

                {selectedEmailTemplate && (
                  <>
                    {/* Auto-fill Button */}
                    <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-lg text-xs">
                      <span className="text-blue-700 flex-1">
                        <strong>Tip:</strong> Click Auto-Fill to replace variables
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="bg-white border-blue-300 text-blue-700 hover:bg-blue-100 h-7 text-xs"
                        onClick={() => {
                          setCustomEmailSubject((prev) =>
                            prev
                              .replace(/\{\{clientName\}\}/gi, selectedClient?.client_name || "")
                              .replace(/\{\{Client_Name\}\}/gi, selectedClient?.client_name || "")
                              .replace(/\{\{taskTitle\}\}/gi, title || "")
                              .replace(/\{\{dueDate\}\}/gi, dueDate || "")
                          );
                          setCustomEmailBody((prev) =>
                            prev
                              .replace(/\{\{clientName\}\}/gi, selectedClient?.client_name || "")
                              .replace(/\{\{Client_Name\}\}/gi, selectedClient?.client_name || "")
                              .replace(/\{\{taskTitle\}\}/gi, title || "")
                              .replace(/\{\{dueDate\}\}/gi, dueDate || "")
                              .replace(/\{\{assigneeRole\}\}/gi, assigneeRole || "")
                              .replace(/\{\{Company_Name\}\}/gi, "Legacy ClientHub")
                              .replace(/\{\{Support_Email\}\}/gi, "support@legacyclienthub.com")
                              .replace(/\{\{LC\}\}/gi, "Legacy ClientHub Team")
                              .replace(/\{\{Admin_Email\}\}/gi, "admin@legacyclienthub.com")
                          );
                        }}
                      >
                        Auto-Fill
                      </Button>
                    </div>

                    {/* Editable Subject */}
                    <div>
                      <Label className="text-sm">Subject</Label>
                      <Input
                        value={customEmailSubject}
                        onChange={(e) => setCustomEmailSubject(e.target.value)}
                        placeholder="Email subject..."
                        className="mt-1"
                      />
                    </div>

                    {/* Editable Body */}
                    <div>
                      <Label className="text-sm">Email Body</Label>
                      <Textarea
                        value={customEmailBody}
                        onChange={(e) => setCustomEmailBody(e.target.value)}
                        placeholder="Email content..."
                        rows={6}
                        className="mt-1 text-sm font-mono"
                      />
                    </div>
                  </>
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
              <div className="p-2 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-xs text-green-700 flex items-center gap-1">
                  <Send className="h-3 w-3" />
                  Email will be sent to: <strong>{selectedClient.primary_contact_email}</strong>
                </p>
                <p className="text-xs text-green-600 mt-1">
                  ✓ Email will include branded header &amp; © 2026 Legacy ClientHub footer
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Buttons */}
      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={closeDrawer}>
          Cancel
        </Button>
        <Button onClick={handleAssign} disabled={isAssigning}>
          {isAssigning ? "Assigning..." : "Assign"}
        </Button>
      </div>
    </div>
  );
}
