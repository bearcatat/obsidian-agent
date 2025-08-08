import { Button } from "@/ui/elements/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/elements/tables";
import { cn } from "@/ui/elements/utils";
import { closestCenter, DndContext, DragEndEvent, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import React from "react";
import { ModelConfig } from "@/types";
import { useSettingsLogic, useSettingsState } from "@/hooks/use-settings";

const ModelTableRow: React.FC<{
  model: ModelConfig;
  onEdit: (model: ModelConfig) => void;
}> = ({ model, onEdit }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: model.id,
  });
  const { removeModel } = useSettingsLogic();

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
      <TableCell>{model.id}</TableCell>
      <TableCell>{model.name}</TableCell>
      <TableCell>{model.provider}</TableCell>
      <TableCell className="tw-text-center">
        <div className="tw-flex tw-justify-center tw-gap-2">
          {onEdit && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(model)}
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
                await removeModel(model.id);
              } catch (error) {
                console.error('Failed to remove model:', error);
                // 可以在这里添加错误提示
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

interface ModelTableProps {
  onEdit: (model: ModelConfig) => void;
  onAdd: () => void;
}

export const ModelTable: React.FC<ModelTableProps> = ({ onEdit, onAdd }) => {
  const { models } = useSettingsState();
  const { reorderModels } = useSettingsLogic();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Create unified modifier logic
  const createDragModifier = () => (args: any) => {
    const { transform, active, activeNodeRect } = args;
    if (!active || !activeNodeRect) return transform;
    // Get the index of current dragging item
    const currentIndex = models.findIndex((model) => model.id === active.id);
    // Calculate the number of items
    const draggableItemsCount = models.length;
    // Calculate row height
    const rowHeight = activeNodeRect.height;
    // Calculate draggable range
    const minY = (0 - currentIndex) * rowHeight;
    const maxY = (draggableItemsCount - 1 - currentIndex) * rowHeight;
    // Restrict within draggable range
    return {
      ...transform,
      x: 0,
      y: Math.min(Math.max(minY, transform.y), maxY),
    };
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = models.findIndex((model) => model.id === active.id);
      const newIndex = models.findIndex((model) => model.id === over.id);
      // Prevent moving to item positions
      if (newIndex < 0) {
        return;
      }
      const newModels = arrayMove(models, oldIndex, newIndex);
      try {
        await reorderModels(newModels);
      } catch (error) {
        console.error('Failed to reorder models:', error);
        // 可以在这里添加错误提示
      }
    }
  };

  return (
    <div className="tw-mb-4">
      <div className="tw-hidden md:tw-block">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          modifiers={[createDragModifier()]}
        >
          <div className="tw-relative tw-overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="tw-w-6 tw-px-2"></TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="tw-relative">
                <SortableContext
                  items={models.map((model) => model.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {models.map((model) => (
                    <ModelTableRow
                      key={model.id}
                      model={model}
                      onEdit={onEdit}
                    />
                  ))}
                </SortableContext>
              </TableBody>
            </Table>
          </div>
        </DndContext>
      </div>

      <div className="tw-mt-4 tw-flex tw-justify-end tw-gap-2">
        <Button onClick={onAdd} variant="secondary" className="tw-flex tw-items-center tw-gap-2">
          <Plus className="tw-size-4" />
          Add Custom Model
        </Button>
      </div>
    </div>
  );
};
