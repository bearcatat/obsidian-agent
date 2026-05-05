import { ToolSet } from "ai";

export function mergeTools(
    userTools: ToolSet,
    builtinTools: ToolSet | undefined,
    logPrefix: string
): ToolSet {
    if (!builtinTools) {
        return userTools;
    }

    const mergedTools = { ...userTools };

    for (const [toolName, tool] of Object.entries(builtinTools)) {
        if (mergedTools[toolName]) {
            console.warn(`${logPrefix} 内置工具 "${toolName}" 已覆盖用户自定义工具`);
        }
        mergedTools[toolName] = tool;
    }

    return mergedTools;
}
