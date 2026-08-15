import { useState } from "react";
import { useSettings } from "@/hooks/use-settings";
import { Button } from "@/ui/elements/button";
import { Input } from "@/ui/elements/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/elements/tables";
import type { BashExecutionPolicy, BashRulePermission, PermissionRule } from "@/types";
import { Trash2, Plus, Check, X, AlertTriangle } from "lucide-react";
import { formatNumber, t } from "../../../../i18n";

const POLICY_DESCRIPTION_KEYS: Record<BashExecutionPolicy, string> = {
  direct: 'bashDirectDescription',
  rules: 'bashRulesDescription',
  ai: 'bashAiDescription',
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
        <span className="tw-text-sm tw-text-muted-foreground">{t('settings:bashPolicyLabel')}</span>
        <Select value={bashPermissions.policy} onValueChange={(value) => handlePolicyChange(value as BashExecutionPolicy)}>
          <SelectTrigger className="tw-w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="direct">{t('settings:directExecution')}</SelectItem>
            <SelectItem value="rules">{t('settings:rulesApproval')}</SelectItem>
            <SelectItem value="ai">{t('settings:aiApproval')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className={`tw-rounded tw-border tw-p-3 tw-text-sm ${bashPermissions.policy === "direct" ? "tw-border-orange-500/50 tw-bg-orange-500/10" : "tw-bg-muted/30"}`}>
        <div className="tw-flex tw-items-start tw-gap-2">
          {bashPermissions.policy === "direct" && <AlertTriangle className="tw-mt-0.5 tw-size-4 tw-shrink-0 tw-text-orange-500" />}
          <div>
            <div>{t(`settings:${POLICY_DESCRIPTION_KEYS[bashPermissions.policy]}`)}</div>
            <div className="tw-mt-1 tw-text-xs tw-text-muted-foreground">{t('settings:shellNotIsolated')}</div>
            {bashPermissions.policy === "ai" && <div className="tw-mt-1 tw-text-xs tw-text-muted-foreground">{t('settings:aiApprovalWarning')}</div>}
          </div>
        </div>
      </div>

      {bashPermissions.policy !== "rules" ? (
        <div className="tw-rounded tw-border tw-border-dashed tw-p-4 tw-text-sm tw-text-muted-foreground">
          {t('settings:rulesRetained', { formattedCount: formatNumber(bashPermissions.rules.length) })}
        </div>
      ) : (
        <>
          <div className="tw-flex tw-items-center tw-justify-between tw-mb-2">
            <div className="tw-text-xs tw-text-muted-foreground">{t('settings:bashPatternHelp')}</div>
            {!isAdding && <Button variant="default" size="icon" aria-label={t('common:add')} onClick={() => setIsAdding(true)}><Plus className="tw-size-4" /></Button>}
          </div>
          <div className="tw-mb-4 tw-h-64 tw-flex tw-flex-col tw-border tw-rounded tw-overflow-hidden">
            <div className="tw-flex-1 tw-overflow-y-auto">
              <Table>
                <TableHeader><TableRow><TableHead className="tw-py-1">{t('settings:commandPattern')}</TableHead><TableHead className="tw-w-32 tw-py-1">{t('settings:permission')}</TableHead><TableHead className="tw-w-16 tw-py-1">{t('common:actions')}</TableHead></TableRow></TableHeader>
                <TableBody>
                  {bashPermissions.rules.length === 0 && !isAdding ? (
                    <TableRow><TableCell colSpan={3} className="tw-text-center tw-text-muted-foreground tw-py-2">{t('settings:noBashRules')}</TableCell></TableRow>
                  ) : bashPermissions.rules.map((rule, index) => (
                    <TableRow key={`${rule.pattern}-${index}`}>
                      <TableCell className="tw-py-1"><span className="tw-font-mono tw-text-sm">{rule.pattern}</span></TableCell>
                      <TableCell className="tw-py-1">
                        <Select value={rule.permission} onValueChange={(value) => handleRulePermissionChange(index, value as BashRulePermission)}>
                          <SelectTrigger className={`tw-w-24 ${permissionColor(rule.permission)}`}><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="allow">{t('settings:allow')}</SelectItem><SelectItem value="ask">{t('settings:ask')}</SelectItem><SelectItem value="deny">{t('settings:deny')}</SelectItem></SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="tw-py-1"><Button variant="ghost" size="icon" aria-label={t('common:remove')} className="tw-size-8 tw-text-muted-foreground hover:tw-text-red-500" onClick={() => handleRemoveRule(index)}><Trash2 className="tw-size-4" /></Button></TableCell>
                    </TableRow>
                  ))}
                  {isAdding && (
                    <TableRow className="tw-bg-muted/50">
                      <TableCell className="tw-py-1"><Input autoFocus placeholder={t('settings:enterCommandPattern')} value={newPattern} onChange={(event) => setNewPattern(event.target.value)} className="tw-w-full" /></TableCell>
                      <TableCell className="tw-py-1"><Select value={newPermission} onValueChange={(value) => setNewPermission(value as BashRulePermission)}><SelectTrigger className={`tw-w-24 ${permissionColor(newPermission)}`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="allow">{t('settings:allow')}</SelectItem><SelectItem value="ask">{t('settings:ask')}</SelectItem><SelectItem value="deny">{t('settings:deny')}</SelectItem></SelectContent></Select></TableCell>
                      <TableCell className="tw-py-1"><div className="tw-flex tw-gap-1"><Button variant="ghost" size="icon" aria-label={t('common:confirm')} className="tw-size-8 tw-text-green-600" onClick={handleAddRule}><Check className="tw-size-4" /></Button><Button variant="ghost" size="icon" aria-label={t('common:cancel')} className="tw-size-8 tw-text-muted-foreground hover:tw-text-red-500" onClick={cancelAdd}><X className="tw-size-4" /></Button></div></TableCell>
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
