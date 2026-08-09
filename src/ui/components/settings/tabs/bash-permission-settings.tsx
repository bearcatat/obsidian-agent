import { useState } from "react";
import { useSettings } from "@/hooks/use-settings";
import { Button } from "@/ui/elements/button";
import { Input } from "@/ui/elements/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/elements/tables";
import type { BashExecutionPolicy, BashRulePermission, PermissionRule } from "@/types";
import { Trash2, Plus, Check, X, AlertTriangle } from "lucide-react";

const POLICY_DESCRIPTIONS: Record<BashExecutionPolicy, string> = {
  direct: "底线安全拦截通过后直接执行；不读取权限规则，也不会询问用户。",
  rules: "按“拒绝 > 允许 > 请求确认”解析全部匹配规则；未匹配时询问用户。",
  ai: "不读取权限规则；把命令和裁剪后的当前 conversation 上下文再次发送给当前模型，失败或不确定时询问用户。",
};

export const BashPermissionSettings: React.FC = () => {
  const { bashPermissions, updateBashPermissions } = useSettings();
  const [newPattern, setNewPattern] = useState("");
  const [newPermission, setNewPermission] = useState<BashRulePermission>("ask");
  const [isAdding, setIsAdding] = useState(false);

  const handlePolicyChange = async (policy: BashExecutionPolicy) => {
    await updateBashPermissions({ ...bashPermissions, policy });
  };
  const handleAddRule = async () => {
    const pattern = newPattern.trim();
    if (!pattern) return;
    const rule: PermissionRule = { pattern, permission: newPermission };
    await updateBashPermissions({
      ...bashPermissions,
      rules: [...bashPermissions.rules.filter((item) => item.pattern !== pattern), rule],
    });
    setNewPattern("");
    setNewPermission("ask");
    setIsAdding(false);
  };
  const handleRemoveRule = async (index: number) => {
    await updateBashPermissions({ ...bashPermissions, rules: bashPermissions.rules.filter((_, itemIndex) => itemIndex !== index) });
  };
  const handleRulePermissionChange = async (index: number, permission: BashRulePermission) => {
    const rules = bashPermissions.rules.map((rule, itemIndex) => itemIndex === index ? { ...rule, permission } : rule);
    await updateBashPermissions({ ...bashPermissions, rules });
  };
  const permissionColor = (permission: BashRulePermission) => permission === "allow"
    ? "tw-text-green-600"
    : permission === "deny" ? "tw-text-red-600" : "tw-text-yellow-600";
  const cancelAdd = () => {
    setNewPattern("");
    setNewPermission("ask");
    setIsAdding(false);
  };

  return (
    <div className="tw-space-y-4">
      <div className="tw-flex tw-items-center tw-gap-4">
        <span className="tw-text-sm tw-text-muted-foreground">执行策略:</span>
        <Select value={bashPermissions.policy} onValueChange={(value) => handlePolicyChange(value as BashExecutionPolicy)}>
          <SelectTrigger className="tw-w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="direct">直接执行</SelectItem>
            <SelectItem value="rules">规则审批</SelectItem>
            <SelectItem value="ai">智能审批</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className={`tw-rounded tw-border tw-p-3 tw-text-sm ${bashPermissions.policy === "direct" ? "tw-border-orange-500/50 tw-bg-orange-500/10" : "tw-bg-muted/30"}`}>
        <div className="tw-flex tw-items-start tw-gap-2">
          {bashPermissions.policy === "direct" && <AlertTriangle className="tw-mt-0.5 tw-size-4 tw-shrink-0 tw-text-orange-500" />}
          <div>
            <div>{POLICY_DESCRIPTIONS[bashPermissions.policy]}</div>
            <div className="tw-mt-1 tw-text-xs tw-text-muted-foreground">当前 shell executor 未隔离；Vault 根目录只是工作目录，不是 sandbox。</div>
            {bashPermissions.policy === "ai" && <div className="tw-mt-1 tw-text-xs tw-text-muted-foreground">每条命令最多增加一次模型调用，会带来额外延迟和费用；AI 判断不是安全保证。</div>}
          </div>
        </div>
      </div>

      {bashPermissions.policy !== "rules" ? (
        <div className="tw-rounded tw-border tw-border-dashed tw-p-4 tw-text-sm tw-text-muted-foreground">
          已保留 {bashPermissions.rules.length} 条规则，但当前策略不会使用。切换到“规则审批”后可继续编辑。
        </div>
      ) : (
        <>
          <div className="tw-flex tw-items-center tw-justify-between tw-mb-2">
            <div className="tw-text-xs tw-text-muted-foreground">匹配整条命令；拒绝 &gt; 允许 &gt; 请求确认。`*` 匹配任意字符，`?` 匹配单个字符。</div>
            {!isAdding && <Button variant="default" size="icon" onClick={() => setIsAdding(true)}><Plus className="tw-size-4" /></Button>}
          </div>
          <div className="tw-mb-4 tw-h-64 tw-flex tw-flex-col tw-border tw-rounded tw-overflow-hidden">
            <div className="tw-flex-1 tw-overflow-y-auto">
              <Table>
                <TableHeader><TableRow><TableHead className="tw-py-1">命令模式</TableHead><TableHead className="tw-w-32 tw-py-1">权限</TableHead><TableHead className="tw-w-16 tw-py-1">操作</TableHead></TableRow></TableHeader>
                <TableBody>
                  {bashPermissions.rules.length === 0 && !isAdding ? (
                    <TableRow><TableCell colSpan={3} className="tw-text-center tw-text-muted-foreground tw-py-2">暂无规则</TableCell></TableRow>
                  ) : bashPermissions.rules.map((rule, index) => (
                    <TableRow key={`${rule.pattern}-${index}`}>
                      <TableCell className="tw-py-1"><span className="tw-font-mono tw-text-sm">{rule.pattern}</span></TableCell>
                      <TableCell className="tw-py-1">
                        <Select value={rule.permission} onValueChange={(value) => handleRulePermissionChange(index, value as BashRulePermission)}>
                          <SelectTrigger className={`tw-w-24 ${permissionColor(rule.permission)}`}><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="allow">允许</SelectItem><SelectItem value="ask">请求确认</SelectItem><SelectItem value="deny">拒绝</SelectItem></SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="tw-py-1"><Button variant="ghost" size="icon" className="tw-size-8 tw-text-muted-foreground hover:tw-text-red-500" onClick={() => handleRemoveRule(index)}><Trash2 className="tw-size-4" /></Button></TableCell>
                    </TableRow>
                  ))}
                  {isAdding && (
                    <TableRow className="tw-bg-muted/50">
                      <TableCell className="tw-py-1"><Input autoFocus placeholder="命令模式 (如: git *)" value={newPattern} onChange={(event) => setNewPattern(event.target.value)} className="tw-w-full" /></TableCell>
                      <TableCell className="tw-py-1"><Select value={newPermission} onValueChange={(value) => setNewPermission(value as BashRulePermission)}><SelectTrigger className={`tw-w-24 ${permissionColor(newPermission)}`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="allow">允许</SelectItem><SelectItem value="ask">请求确认</SelectItem><SelectItem value="deny">拒绝</SelectItem></SelectContent></Select></TableCell>
                      <TableCell className="tw-py-1"><div className="tw-flex tw-gap-1"><Button variant="ghost" size="icon" className="tw-size-8 tw-text-green-600" onClick={handleAddRule}><Check className="tw-size-4" /></Button><Button variant="ghost" size="icon" className="tw-size-8 tw-text-muted-foreground hover:tw-text-red-500" onClick={cancelAdd}><X className="tw-size-4" /></Button></div></TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
