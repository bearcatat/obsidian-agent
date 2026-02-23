import { useState } from "react";
import { useSettings } from "@/hooks/use-settings";
import { Button } from "@/ui/elements/button";
import { Input } from "@/ui/elements/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/elements/tables";
import { PermissionRule, PermissionLevel } from "@/types";
import { Trash2, Plus, Check, X } from "lucide-react";

export const BashPermissionSettings: React.FC = () => {
  const { bashPermissions, updateBashPermissions } = useSettings();
  const [newPattern, setNewPattern] = useState("");
  const [newPermission, setNewPermission] = useState<PermissionLevel>("ask");
  const [isAdding, setIsAdding] = useState(false);

  const handleDefaultChange = async (value: PermissionLevel) => {
    await updateBashPermissions({
      ...bashPermissions,
      default: value,
    });
  };

  const handleAddRule = async () => {
    if (!newPattern.trim()) return;
    
    const newRule: PermissionRule = {
      pattern: newPattern.trim(),
      permission: newPermission,
    };

    await updateBashPermissions({
      ...bashPermissions,
      rules: [...bashPermissions.rules, newRule],
    });

    setNewPattern("");
    setNewPermission("ask");
    setIsAdding(false);
  };

  const handleRemoveRule = async (index: number) => {
    const newRules = [...bashPermissions.rules];
    newRules.splice(index, 1);
    await updateBashPermissions({
      ...bashPermissions,
      rules: newRules,
    });
  };

  const handleRulePermissionChange = async (index: number, permission: PermissionLevel) => {
    const newRules = [...bashPermissions.rules];
    newRules[index] = { ...newRules[index], permission };
    await updateBashPermissions({
      ...bashPermissions,
      rules: newRules,
    });
  };

  const getPermissionColor = (permission: PermissionLevel) => {
    switch (permission) {
      case "allow":
        return "tw-text-green-600";
      case "ask":
        return "tw-text-yellow-600";
      case "deny":
        return "tw-text-red-600";
    }
  };

  const handleCancelAdd = () => {
    setNewPattern("");
    setNewPermission("ask");
    setIsAdding(false);
  };

  return (
    <div className="tw-space-y-4">
      <div className="tw-flex tw-items-center tw-gap-4">
        <span className="tw-text-sm tw-text-muted-foreground">默认策略:</span>
        <Select value={bashPermissions.default} onValueChange={handleDefaultChange}>
          <SelectTrigger className="tw-w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="allow">允许 (Allow)</SelectItem>
            <SelectItem value="ask">询问 (Ask)</SelectItem>
            <SelectItem value="deny">拒绝 (Deny)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="tw-flex tw-items-center tw-justify-between tw-mb-2">
        <div className="tw-text-xs tw-text-muted-foreground">
          规则按顺序匹配，最后匹配的规则优先级最高。使用 * 匹配任意字符，? 匹配单个字符。
        </div>
        {!isAdding && (
          <Button variant="default" size="icon" onClick={() => setIsAdding(true)}>
            <Plus className="tw-size-4" />
          </Button>
        )}
      </div>

      <div className="tw-mb-4 tw-h-64 tw-flex tw-flex-col tw-border tw-rounded tw-overflow-hidden">
        <div className="tw-flex-1 tw-overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="tw-py-1">命令模式</TableHead>
                <TableHead className="tw-w-32 tw-py-1">权限</TableHead>
                <TableHead className="tw-w-16 tw-py-1">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bashPermissions.rules.length === 0 && !isAdding ? (
                <TableRow>
                  <TableCell colSpan={3} className="tw-text-center tw-text-muted-foreground tw-py-2">
                    暂无规则
                  </TableCell>
                </TableRow>
              ) : (
                bashPermissions.rules.map((rule, index) => (
                  <TableRow key={index}>
                    <TableCell className="tw-py-1">
                      <span className="tw-font-mono tw-text-sm">{rule.pattern}</span>
                    </TableCell>
                    <TableCell className="tw-py-1">
                      <Select
                        value={rule.permission}
                        onValueChange={(value) => handleRulePermissionChange(index, value as PermissionLevel)}
                      >
                        <SelectTrigger className={`tw-w-24 ${getPermissionColor(rule.permission)}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="allow">允许</SelectItem>
                          <SelectItem value="ask">询问</SelectItem>
                          <SelectItem value="deny">拒绝</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="tw-py-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="tw-size-8 tw-text-muted-foreground hover:tw-text-red-500"
                        onClick={() => handleRemoveRule(index)}
                      >
                        <Trash2 className="tw-size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}

              {isAdding && (
                <TableRow className="tw-bg-muted/50">
                  <TableCell className="tw-py-1">
                    <Input
                      autoFocus
                      placeholder="命令模式 (如: git *)"
                      value={newPattern}
                      onChange={(e) => setNewPattern(e.target.value)}
                      className="tw-w-full"
                    />
                  </TableCell>
                  <TableCell className="tw-py-1">
                    <Select
                      value={newPermission}
                      onValueChange={(value) => setNewPermission(value as PermissionLevel)}
                    >
                      <SelectTrigger className={`tw-w-24 ${getPermissionColor(newPermission)}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="allow">允许</SelectItem>
                        <SelectItem value="ask">询问</SelectItem>
                        <SelectItem value="deny">拒绝</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="tw-py-1">
                    <div className="tw-flex tw-gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="tw-size-8 tw-text-green-600 hover:tw-bg-green-50"
                        onClick={handleAddRule}
                      >
                        <Check className="tw-size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="tw-size-8 tw-text-muted-foreground hover:tw-text-red-500"
                        onClick={handleCancelAdd}
                      >
                        <X className="tw-size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};
