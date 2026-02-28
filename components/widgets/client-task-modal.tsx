// components/widgets/client-task-modal.tsx
"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusPill } from "@/components/widgets/status-pill";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

// ✅ UPDATED PROPS TYPE
type Props = {
  open: boolean;
  onClose: () => void;
  clientName: string;
  clientId: number | null;   // ✅ REQUIRED FOR VIEW CLIENT
  tasks: any[];
};

export function ClientTaskModal({
  open,
  onClose,
  clientName,
  clientId,
  tasks,
}: Props) {

  // ✅ REQUIRED FOR REDIRECTION
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">

        {/* ✅ HEADER WITH TOP-RIGHT VIEW CLIENT BUTTON */}
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle>Tasks — {clientName}</DialogTitle>

          {clientId && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                onClose();
                router.push(`/admin/clients/${clientId}`);
              }}
            >
              View Client
            </Button>
          )}
        </DialogHeader>

        <div className="border rounded-md overflow-hidden max-h-[60vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted sticky top-0 z-10">
              <tr>
                <th className="p-2 text-left">Task</th>
                <th className="p-2 text-center">Type</th>
                <th className="p-2 text-center">Due</th>
                <th className="p-2 text-center">Status</th>
              </tr>
            </thead>

            <tbody>
              {tasks.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-4 text-center">
                    No tasks found
                  </td>
                </tr>
              ) : (
                tasks.map((t) => {
                  const isOnboarding = t.taskType === "ONBOARDING";
                  return (
                    <tr key={t.id}>
                      <td className="p-2">{t.title}</td>

                      <td className="p-2 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${isOnboarding
                            ? "bg-indigo-50 text-indigo-700"
                            : "bg-slate-100 text-slate-700"
                            }`}
                        >
                          {isOnboarding ? "Onboarding" : "Assigned"}
                        </span>
                      </td>

                      <td className="p-2 text-center">
                        {t.dueDate
                          ? new Date(t.dueDate).toLocaleDateString()
                          : "-"}
                      </td>

                      <td className="p-2 text-center">
                        <StatusPill status={t.status} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end mt-4">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>

      </DialogContent>
    </Dialog>
  );
}
