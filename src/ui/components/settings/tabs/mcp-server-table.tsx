import { Button } from "@/ui/elements/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/elements/tables";
import { cn } from "@/ui/elements/utils";
import { closestCenter, DndContext, DragEndEvent, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Plus, Trash2, Settings } from "lucide-react";
import React from "react";
import { MCPServerConfig } from "@/types";
import { useSettingsLogic, useSettingsState } from "@/hooks/use-settings";

const MCPServerTableRow: React.FC<{
  server: MCPServerConfig;
  onEdit: (server: MCPServerConfig) => void;
  onManageTools: (server: MCPServerConfig) => void;
}> = ({ server, onEdit, onManageTools }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: server.name,
  });
  const { removeMCPServer } = useSettingsLogic();

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
      <TableCell>{server.name}</TableCell>
      <TableCell>{server.transport}</TableCell>
      <TableCell>
        <div className="tw-text-sm tw-text-gray-600">
          {server.transport === "stdio" ? (
            <div className="tw-truncate" title={`${server.command} ${server.args?.join(" ")}`}>
              {server.command} {server.args?.join(" ")}
            </div>
          ) : (
            <div className="tw-truncate" title={server.url}>
              {server.url}
            </div>
          )}
          {server.tools && server.tools.length > 0 && (
            <div className="tw-text-xs tw-text-blue-500 tw-mt-1">
              Tools: {server.tools.filter(t => t.enabled).length}/{server.tools.length} enabled
            </div>
          )}
        </div>
      </TableCell>
      <TableCell className="tw-text-center">
        <div className="tw-flex tw-justify-center tw-gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onManageTools(server)}
            className="tw-shadow-sm tw-transition-shadow hover:tw-shadow-md"
            title="Manage Tools"
          >
            <Settings className="tw-size-4" />
          </Button>
          {onEdit && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(server)}
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
                await removeMCPServer(server.name);
              } catch (error) {
                console.error('Failed to remove MCP server:', error);
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

interface MCPServerTableProps {
  onEdit: (server: MCPServerConfig) => void;
  onAdd: () => void;
  onManageTools: (server: MCPServerConfig) => void;
}

export const MCPServerTable: React.FC<MCPServerTableProps> = ({ onEdit, onAdd, onManageTools }) => {
  const { mcpServers } = useSettingsState();
  const { reorderMCPServers } = useSettingsLogic();

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
    const currentIndex = mcpServers.findIndex((server) => server.name === active.id);
    // Calculate the number of items
    const draggableItemsCount = mcpServers.length;
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
      const oldIndex = mcpServers.findIndex((server) => server.name === active.id);
      const newIndex = mcpServers.findIndex((server) => server.name === over.id);
      // Prevent moving to item positions
      if (newIndex < 0) {
        return;
      }
      const newServers = arrayMove(mcpServers, oldIndex, newIndex);
      try {
        await reorderMCPServers(newServers);
      } catch (error) {
        console.error('Failed to reorder MCP servers:', error);
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
                  <TableHead>Name</TableHead>
                  <TableHead>Transport</TableHead>
                  <TableHead>Configuration</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="tw-relative">
                <SortableContext
                  items={mcpServers.map((server) => server.name)}
                  strategy={verticalListSortingStrategy}
                >
                  {mcpServers.map((server) => (
                    <MCPServerTableRow
                      key={server.name}
                      server={server}
                      onEdit={onEdit}
                      onManageTools={onManageTools}
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
          Add MCP Server
        </Button>
      </div>
    </div>
  );
};
