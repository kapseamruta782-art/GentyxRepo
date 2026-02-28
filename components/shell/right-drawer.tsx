// components/shell/right-drawer.tsx
"use client"

import { Drawer, DrawerClose, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { useUIStore } from "@/store/ui-store"
import { AssignTaskForm } from "@/components/widgets/assign-task-form"
import { SetStageForm } from "@/components/widgets/set-stage-form"
import { UploadDocForm } from "@/components/widgets/upload-doc-form"
import { AssignTaskDialog } from "@/app/admin/tasks/_components/assign-task-dialog";


export function RightDrawer() {
  const rightDrawerOpen = useUIStore((s) => s.rightDrawerOpen)
  const drawerView = useUIStore((s) => s.drawerView)
  const drawerContext = useUIStore((s) => s.drawerContext)
  const closeDrawer = useUIStore((s) => s.closeDrawer)

  return (
    <Drawer open={rightDrawerOpen} direction="right" onOpenChange={(o) => !o && closeDrawer()}>
      <DrawerContent className="fixed right-0 top-0 h-screen w-full max-w-md border-l bg-background flex flex-col">
        <DrawerHeader className="flex items-center justify-between flex-shrink-0">
          {/* <DrawerTitle>
            {drawerView === "assignTask" && "Assign Task"}
            {drawerView === "setStage" && "Set Stage"}
            {drawerView === "uploadDoc" && "Upload Document"}
          </DrawerTitle> */}
          <DrawerTitle>
            {drawerView === "assignTask" &&
              (drawerContext?.taskId ? "Update Task" : "Assign Task")}

            {drawerView === "setStage" && "Set Stage"}
            {drawerView === "uploadDoc" && "Upload Document"}
          </DrawerTitle>

          <DrawerClose asChild>
            <Button variant="ghost">Close</Button>
          </DrawerClose>
        </DrawerHeader>
        <div className="p-4 flex-1 overflow-y-auto">
          {drawerView === "assignTask" && <AssignTaskForm context={drawerContext} />}
          {drawerView === "setStage" && <SetStageForm context={drawerContext} />}
          {drawerView === "uploadDoc" && <UploadDocForm context={drawerContext} />}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
