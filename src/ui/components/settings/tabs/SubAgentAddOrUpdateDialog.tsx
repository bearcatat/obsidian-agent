import { Button } from "@/ui/elements/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/ui/elements/dialog";
import { Input } from "@/ui/elements/input";
import { Textarea } from "@/ui/elements/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/select";
import { FormField } from "@/ui/elements/form-field";
import { useState, useEffect } from "react";
import { SubAgentConfig, ModelConfig } from "@/types";
import { useSettingsLogic, useSettingsState } from "@/hooks/use-settings";
import { useTab } from "@/hooks/TabContext";

interface SubAgentAddOrUpdateDialogProps {
  initialSubAgent: SubAgentConfig;
  isUpdate: boolean;
  open: boolean;
  close: () => void;
}

export const SubAgentAddOrUpdateDialog: React.FC<SubAgentAddOrUpdateDialogProps> = ({
  initialSubAgent,
  isUpdate,
  open,
  close,
}) => {
  const { modalContainer } = useTab();
  const { addOrUpdateSubAgent } = useSettingsLogic();
  const { models } = useSettingsState();
  
  const [subAgent, setSubAgent] = useState<SubAgentConfig>(initialSubAgent);
  const [error, setError] = useState<string | null>(null);

  // 参考MCP的实现方式，直接依赖initialSubAgent
  useEffect(() => {
    setSubAgent(initialSubAgent);
    setError(null);
  }, [initialSubAgent]);

  const getCleanedSubAgent = (subAgentData: SubAgentConfig): SubAgentConfig => {
    return {
      name: subAgentData.name.trim(),
      systemPrompt: subAgentData.systemPrompt.trim(),
      enabled: initialSubAgent.enabled, // 保持原始状态，不受表单影响
      modelId: subAgentData.modelId.trim(),
      tools: subAgentData.tools || [],
    };
  };

  const onSave = async () => {
    const cleanedSubAgent = getCleanedSubAgent(subAgent);
    
    // 验证必填字段
    if (!cleanedSubAgent.name) {
      setError("Name is required");
      return;
    }
    if (!cleanedSubAgent.systemPrompt) {
      setError("System prompt is required");
      return;
    }
    if (!cleanedSubAgent.modelId) {
      setError("Model is required");
      return;
    }

    try {
      if (isUpdate) {
        // 更新模式：传递原始名称
        await addOrUpdateSubAgent(cleanedSubAgent, initialSubAgent.name);
      } else {
        // 添加模式：不传递原始名称
        await addOrUpdateSubAgent(cleanedSubAgent);
      }
      close();
    } catch (error) {
      console.error('Failed to save SubAgent:', error);
      setError(error instanceof Error ? error.message : 'Failed to save SubAgent');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && close()}>
      <DialogContent 
        className="sm:tw-max-w-[425px]"
        container={modalContainer}
      >
        <DialogHeader>
          <DialogTitle>
            {isUpdate ? "Edit SubAgent" : "Add SubAgent"}
          </DialogTitle>
        </DialogHeader>

        <div className="tw-space-y-3">
          {/* Name */}
          <FormField label="Name" required>
            <Input
              id="name"
              value={subAgent.name}
              onChange={(e) => setSubAgent({ ...subAgent, name: e.target.value })}
              placeholder="Enter SubAgent name"
            />
          </FormField>

          {/* Model Selection */}
          <FormField label="Model" required>
            <Select
              value={subAgent.modelId}
              onValueChange={(value) => setSubAgent({ ...subAgent, modelId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent>
                {models.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.name} ({model.provider})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          {/* System Prompt */}
          <FormField label="System Prompt" required>
            <Textarea
              id="systemPrompt"
              value={subAgent.systemPrompt}
              onChange={(e) => setSubAgent({ ...subAgent, systemPrompt: e.target.value })}
              placeholder="Enter system prompt for the SubAgent"
              rows={6}
            />
          </FormField>


          {/* Error Message */}
          {error && (
            <div className="tw-text-red-500 tw-text-sm">{error}</div>
          )}

          {/* Action Buttons */}
          <div className="tw-flex tw-justify-end tw-gap-2 tw-pt-4">
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button onClick={onSave}>
              {isUpdate ? "Update" : "Add"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
