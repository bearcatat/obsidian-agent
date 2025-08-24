import { Button } from "@/ui/elements/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/elements/tables";
import { cn } from "@/ui/elements/utils";
import { closestCenter, DndContext, DragEndEvent, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Plus, Trash2, Settings } from "lucide-react";
import React from "react";
import { SubAgentConfig } from "@/types";
import { useSettingsLogic, useSettingsState } from "@/hooks/use-settings";
import { SettingSwitch } from "@/ui/elements/setting-switch";

const SubAgentTableRow: React.FC<{
  subAgent: SubAgentConfig;
  onEdit: (subAgent: SubAgentConfig) => void;
  onManageTools: (subAgent: SubAgentConfig) => void;
}> = ({ subAgent, onEdit, onManageTools }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: subAgent.name,
  });
  const { removeSubAgent, addOrUpdateSubAgent } = useSettingsLogic();

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={cn(
        "tw-transition-colors tw-duration-200 hover:tw-bg-interactive-accent/10",
        isDragging &&
        "tw-relative tw-z-[100] tw-cursor-grabbing tw-shadow-lg tw-backdrop-blur-sm tw-border-accent/50 tw-bg-primary/90"
      )}
    >
      <TableCell className="tw-w-6 tw-px-2">
        <Button
          variant="ghost"
          size="icon"
          className="tw-size-6 tw-cursor-grab tw-touch-none tw-p-0 hover:tw-cursor-grab active:tw-cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="tw-size-4 tw-transition-colors" />
        </Button>
      </TableCell>
      <TableCell>{subAgent.name}</TableCell>
      <TableCell>{subAgent.modelId}</TableCell>
      <TableCell className="tw-max-w-xs">
        <div className="tw-text-sm tw-text-gray-600">
          <div
            className="tw-truncate tw-whitespace-nowrap tw-overflow-hidden"
            title={subAgent.systemPrompt}
          >
            {subAgent.systemPrompt}
          </div>
          {subAgent.tools && subAgent.tools.length > 0 && (
            <div className="tw-text-xs tw-text-blue-500 tw-mt-1">
              Tools: {subAgent.tools.filter(t => t.enabled).length}/{subAgent.tools.length} enabled
            </div>
          )}
        </div>
      </TableCell>
      <TableCell className="tw-text-center">
        <SettingSwitch
          checked={subAgent.enabled}
          onCheckedChange={async (checked) => {
            try {
              const updatedSubAgent = { ...subAgent, enabled: checked };
              await addOrUpdateSubAgent(updatedSubAgent, subAgent.name);
            } catch (error) {
              console.error('Failed to toggle SubAgent enabled status:', error);
            }
          }}
        />
      </TableCell>
      <TableCell className="tw-text-center">
        <div className="tw-flex tw-justify-center tw-gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onManageTools(subAgent)}
            className="tw-shadow-sm tw-transition-shadow hover:tw-shadow-md"
            title="Manage Tools"
          >
            <Settings className="tw-size-4" />
          </Button>
          {onEdit && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(subAgent)}
              className="tw-shadow-sm tw-transition-shadow hover:tw-shadow-md"
            >
              <Pencil className="tw-size-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={async () => {
              try {
                await removeSubAgent(subAgent.name);
              } catch (error) {
                console.error('Failed to remove SubAgent:', error);
              }
            }}
            className="tw-shadow-sm tw-transition-shadow hover:tw-shadow-md"
          >
            <Trash2 className="tw-size-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
};

export const SubAgentTable: React.FC<{
  onEdit: (subAgent: SubAgentConfig) => void;
  onAdd: () => void;
  onManageTools: (subAgent: SubAgentConfig) => void;
}> = ({ onEdit, onAdd, onManageTools }) => {
  const { subAgents } = useSettingsState();
  const { reorderSubAgents } = useSettingsLogic();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = subAgents.findIndex((item) => item.name === active.id);
      const newIndex = subAgents.findIndex((item) => item.name === over?.id);

      const newSubAgents = arrayMove(subAgents, oldIndex, newIndex);
      try {
        await reorderSubAgents(newSubAgents);
      } catch (error) {
        console.error('Failed to reorder SubAgents:', error);
      }
    }
  };

  return (
    <div className="tw-space-y-4">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="tw-border tw-rounded-lg tw-overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="tw-w-6"></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Model</TableHead>
                <TableHead className="tw-max-w-xs">System Prompt</TableHead>
                <TableHead className="tw-text-center">Status</TableHead>
                <TableHead className="tw-text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="tw-relative">
              <SortableContext
                items={subAgents.map((subAgent) => subAgent.name)}
                strategy={verticalListSortingStrategy}
              >
                {subAgents.map((subAgent) => (
                  <SubAgentTableRow
                    key={subAgent.name}
                    subAgent={subAgent}
                    onEdit={onEdit}
                    onManageTools={onManageTools}
                  />
                ))}
              </SortableContext>
            </TableBody>
          </Table>
        </div>
      </DndContext>
      <div className="tw-mt-4 tw-flex tw-justify-end tw-gap-2">
        <Button onClick={onAdd} variant="secondary" className="tw-flex tw-items-center tw-gap-2">
          <Plus className="tw-size-4" />
          Add SubAgent
        </Button>
      </div>
    </div>
  );
};
