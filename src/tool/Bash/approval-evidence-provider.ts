import path from "path";

export type BashTargetScope = "inside-vault" | "outside-vault" | "unknown";

export interface BashApprovalEvidence {
  targetScopes: BashTargetScope[];
  notes: string[];
}

const ABSOLUTE_PATH_TOKEN = /(?<![:\w/])(?:[a-z]:[\\/]|\/(?!\/))[^"'`\s;&|()<>]+/gi;

function isDynamicPath(value: string): boolean {
  return /\$\{|\$\(|`|%[\w-]+%|\*|\?/.test(value);
}

function pathModuleFor(value: string, vaultPath: string): typeof path {
  return /^[a-z]:[\\/]/i.test(value) || /^[a-z]:[\\/]/i.test(vaultPath) ? path.win32 : path;
}

function isInsideVault(value: string, vaultPath: string): boolean | null {
  if (!vaultPath) return null;
  const pathApi = pathModuleFor(value, vaultPath);
  const resolvedVault = pathApi.resolve(vaultPath);
  const resolvedTarget = pathApi.resolve(value);
  const relative = pathApi.relative(resolvedVault, resolvedTarget);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${pathApi.sep}`) && !pathApi.isAbsolute(relative));
}

function classifyPath(value: string, vaultPath: string): BashTargetScope {
  if (isDynamicPath(value)) return "unknown";
  const inside = isInsideVault(value, vaultPath);
  if (inside === true) return "inside-vault";
  if (inside === false) return "outside-vault";
  return "unknown";
}

function formatVaultRelativePath(value: string, vaultPath: string): string {
  const pathApi = pathModuleFor(value, vaultPath);
  const inside = isInsideVault(value, vaultPath);
  if (inside === true) {
    const relative = pathApi.relative(pathApi.resolve(vaultPath), pathApi.resolve(value)).replace(/[\\]+/g, "/");
    return relative ? `./${relative}` : "<vault-root>";
  }
  if (inside === false) return "<outside-vault-path>";
  return "<unknown-path>";
}

/** Replace filesystem absolute paths before approval data is sent to a Provider. */
export function sanitizeBashApprovalText(text: string, vaultPath: string): string {
  return text.replace(ABSOLUTE_PATH_TOKEN, (value) => formatVaultRelativePath(value, vaultPath));
}

export function inferBashApprovalEvidence(command: string, vaultPath = ""): BashApprovalEvidence {
  const hasDynamicPath = /\$\{|\$\(|`|%[\w-]+%|\*|\?/.test(command);
  const hasParentPath = /(?:^|[\s"'])\.\.(?:[\\/]|$)/.test(command);
  const targetScopes: BashTargetScope[] = Array.from(command.matchAll(ABSOLUTE_PATH_TOKEN)).map(([value]) => classifyPath(value, vaultPath));
  if (hasParentPath) targetScopes.push("outside-vault");
  if (hasDynamicPath) targetScopes.push("unknown");
  if (targetScopes.length === 0) targetScopes.push("inside-vault");
  return {
    targetScopes: Array.from(new Set(targetScopes)),
    notes: hasDynamicPath ? ["Dynamic path syntax prevents reliable static scope resolution"] : [],
  };
}
