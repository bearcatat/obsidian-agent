import path from "path";

export type BashHardGuardCode =
  | "raw-disk-write"
  | "system-power"
  | "privilege-escalation"
  | "outside-vault-delete"
  | "outside-vault-permissions"
  | "remote-code-pipe"
  | "encoded-shell"
  | "process-explosion";

export type BashHardGuardResult =
  | { blocked: false }
  | { blocked: true; code: BashHardGuardCode; reason: string };

const REASONS: Record<BashHardGuardCode, string> = {
  "raw-disk-write": "Raw disk or filesystem destruction is blocked",
  "system-power": "System power, boot, or recovery changes are blocked",
  "privilege-escalation": "Privilege escalation is blocked",
  "outside-vault-delete": "Recursive or broad deletion outside the Vault is blocked",
  "outside-vault-permissions": "Recursive permission changes outside the Vault are blocked",
  "remote-code-pipe": "Downloading remote content directly into an interpreter is blocked",
  "encoded-shell": "Encoded shell payloads are blocked",
  "process-explosion": "Known recursive process explosion payloads are blocked",
};

function blocked(code: BashHardGuardCode): BashHardGuardResult {
  return { blocked: true, code, reason: REASONS[code] };
}

function unquote(value: string): string {
  return value.replace(/^["']|["']$/g, "");
}

function isRootLike(target: string): boolean {
  const value = unquote(target.trim()).replace(/\\/g, "/");
  return value === "/" || value === "/*" || /^[a-z]:\/?$/i.test(value) || value === ".." || value.startsWith("../");
}

function isOutsideVaultLiteral(target: string, vaultPath: string): boolean {
  const value = unquote(target.trim());
  if (isRootLike(value)) return true;
  if (!path.isAbsolute(value) || !vaultPath) return false;
  const resolvedVault = path.resolve(vaultPath);
  const resolvedTarget = path.resolve(value);
  const relative = path.relative(resolvedVault, resolvedTarget);
  return relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative);
}

function commandTargetsOutsideVault(command: string, vaultPath: string): boolean {
  const tokens: string[] = Array.from(command.match(/"[^"]*"|'[^']*'|[^\s;&|]+/g) ?? []);
  return tokens.some((token) => !token.startsWith("-") && isOutsideVaultLiteral(token, vaultPath));
}

export function checkBashHardGuard(command: string, vaultPath: string): BashHardGuardResult {
  const normalized = command.replace(/\s+/g, " ").trim();

  if (/\b(?:mkfs(?:\.[\w-]+)?|fdisk|parted|wipefs|diskpart)\b/i.test(normalized)
    || /\bformat(?:\.com)?\s+(?:[a-z]:|\/)/i.test(normalized)
    || /\bdd\b[^\r\n;&|]*\bof\s*=\s*\/dev\//i.test(normalized)
    || /(?:^|[;&|])\s*>+\s*\/dev\//i.test(normalized)) {
    return blocked("raw-disk-write");
  }
  if (/\b(?:shutdown|reboot|halt|poweroff|bcdedit)\b/i.test(normalized)
    || /\bvssadmin\b[^\r\n;&|]*\bdelete\s+shadows\b/i.test(normalized)
    || /\bwbadmin\b[^\r\n;&|]*\bdelete\b/i.test(normalized)) {
    return blocked("system-power");
  }
  if (/(?:^|[;&|]\s*|\s)(?:sudo|doas|runas)(?:\s|$)/i.test(normalized)
    || /(?:^|[;&|]\s*|\s)su(?:\s+-|\s+root|\s*$)/i.test(normalized)) {
    return blocked("privilege-escalation");
  }
  if (/\bpowershell(?:\.exe)?\b[^\r\n;&|]*(?:-encodedcommand|-enc)\b/i.test(normalized)) {
    return blocked("encoded-shell");
  }
  if (/:\s*\(\s*\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/i.test(normalized)) {
    return blocked("process-explosion");
  }
  if (/\b(?:curl|wget|invoke-webrequest|iwr)\b[\s\S]*(?:\||\$\(|<\()[\s\S]*\b(?:sh|bash|zsh|pwsh|powershell|cmd|eval)\b/i.test(normalized)) {
    return blocked("remote-code-pipe");
  }

  const destructiveDelete = /(?:^|[;&|]\s*)(?:rm\s+(?=[^;&|]*(?:-[a-z]*r[a-z]*f|-{1,2}recursive))|(?:del|erase|rd|rmdir)\b|(?:remove-item|ri)\b(?=[^;&|]*-recurse))/i.test(normalized);
  if (destructiveDelete && commandTargetsOutsideVault(normalized, vaultPath)) {
    return blocked("outside-vault-delete");
  }
  const recursivePermissions = /(?:^|[;&|]\s*)(?:chmod|chown)\b(?=[^;&|]*(?:-[a-z]*r|--recursive))|(?:icacls|takeown)\b(?=[^;&|]*(?:\/t|\/r))/i.test(normalized);
  if (recursivePermissions && commandTargetsOutsideVault(normalized, vaultPath)) {
    return blocked("outside-vault-permissions");
  }

  return { blocked: false };
}
