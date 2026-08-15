import { BuiltinToolConfig } from "@/types";
import { useSettings } from "@/hooks/use-settings";
import { SettingSwitch } from "@/ui/elements/setting-switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/elements/tables";
import { getBuiltinToolDisplayDescription, t } from "../../../../i18n";

const BuiltinToolTableRow: React.FC<{
  tool: BuiltinToolConfig;
  onToggle: (enabled: boolean) => void;
}> = ({ tool, onToggle }) => {
  return (
    <TableRow className="tw-transition-colors tw-duration-200 hover:tw-bg-interactive-accent/10">
      <TableCell>
        <div className="tw-text-sm tw-font-medium tw-text-gray-900">
          {tool.name}
        </div>
      </TableCell>
      <TableCell>
        <div className="tw-text-sm tw-text-gray-600">
          {getBuiltinToolDisplayDescription(tool.name, tool.description)}
        </div>
      </TableCell>
      <TableCell className="tw-w-20">
        <SettingSwitch
          checked={tool.enabled}
          onCheckedChange={onToggle}
        />
      </TableCell>
    </TableRow>
  );
};

export const BuiltinToolTable: React.FC = () => {
  const { builtinTools, updateBuiltinTool } = useSettings();

  const handleToggle = async (toolName: string, enabled: boolean) => {
    try {
      await updateBuiltinTool(toolName, enabled);
    } catch (error) {
      console.error('Failed to update builtin tool:', error);
    }
  };

  if (!builtinTools || builtinTools.length === 0) {
    return (
      <div className="tw-space-y-4">
        <div className="tw-text-sm tw-text-gray-500">{t('common:loadingTools')}</div>
      </div>
    );
  }

  return (
    <div className="tw-mb-4">
      <div className="tw-hidden md:tw-block">
        <div className="tw-relative tw-overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('common:toolName')}</TableHead>
                <TableHead>{t('common:description')}</TableHead>
                <TableHead className="tw-w-20">{t('common:status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="tw-relative">
              {builtinTools.map((tool) => (
                <BuiltinToolTableRow
                  key={tool.name}
                  tool={tool}
                  onToggle={(enabled) => handleToggle(tool.name, enabled)}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};
