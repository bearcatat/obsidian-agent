import { tool } from "ai";
import { DESCRIPTION } from "./prompts";
import { z } from 'zod';
import { ToolMessage } from "@/messages/tool-message";
import { getGlobalApp } from "@/utils";
import { MessageV2 } from "@/types";
import { TFolder, TFile, TAbstractFile } from "obsidian";

export const toolName = "list"

const DEFAULT_IGNORE_PATTERNS = [
	".obsidian",
	".trash",
	".git",
]

const LIMIT = 200

export const ListTool = tool({
	title: toolName,
	description: DESCRIPTION,
	inputSchema: z.object({
		path: z.string().describe("The folder path relative to vault root (omit for root directory)").optional(),
		ignore: z.array(z.string()).describe("List of glob patterns to ignore").optional(),
	}),
	execute: async ({ path, ignore }, { toolCallId, experimental_context }) => {
		const context = experimental_context as { addMessage: (message: MessageV2) => void }
		try {
			const toolMessage = ToolMessage.from(toolName, toolCallId)
			const result = await listDirectory(path || "/", ignore)
			
			// Save standardized JSON payload for history instead of raw string
			const payload = {
				toolName,
				path: path || "/",
				stats: result.stats
			}
			toolMessage.setContent(JSON.stringify(payload))
			
			toolMessage.setChildren(render(path || "/", result.stats))
			toolMessage.close()
			context.addMessage(toolMessage)
			return result.content
		} catch (error) {
			const errorMessage = ToolMessage.createErrorToolMessage2(toolName, toolCallId, error)
			context.addMessage(errorMessage)
			throw error
		}
	}
})

interface ListResult {
	content: string;
	stats: {
		fileCount: number;
		folderCount: number;
		truncated: boolean;
	};
}

interface TreeNode {
	name: string;
	path: string;
	isFolder: boolean;
	children: TreeNode[];
}

async function listDirectory(path: string, ignorePatterns?: string[]): Promise<ListResult> {
	const app = getGlobalApp()
	const vault = app.vault

	const normalizedPath = path === "/" ? "" : path.replace(/^\/+|\/+$/g, "")

	let targetFolder: TFolder
	if (normalizedPath === "") {
		targetFolder = vault.getRoot()
	} else {
		const file = vault.getAbstractFileByPath(normalizedPath)
		if (!file) {
			throw new Error(`Path not found: "${path}"`)
		}
		if (!(file instanceof TFolder)) {
			throw new Error(`Path is not a folder: "${path}"`)
		}
		targetFolder = file
	}

	const ignoreSet = new Set([...DEFAULT_IGNORE_PATTERNS, ...(ignorePatterns || [])])

	const stats = { fileCount: 0, folderCount: 0, truncated: false }
	let totalItems = 0

	function shouldIgnore(name: string): boolean {
		for (const pattern of ignoreSet) {
			if (matchGlob(name, pattern)) {
				return true
			}
		}
		return false
	}

	function matchGlob(name: string, pattern: string): boolean {
		const regexPattern = pattern
			.replace(/\./g, '\\.')
			.replace(/\*/g, '.*')
			.replace(/\?/g, '.')
		const regex = new RegExp(`^${regexPattern}$`)
		return regex.test(name)
	}

	function buildTree(folder: TFolder, depth: number): TreeNode[] {
		const nodes: TreeNode[] = []
		const children = folder.children

		children.sort((a, b) => {
			const aIsFolder = a instanceof TFolder
			const bIsFolder = b instanceof TFolder
			if (aIsFolder !== bIsFolder) {
				return aIsFolder ? -1 : 1
			}
			return a.name.localeCompare(b.name)
		})

		for (const child of children) {
			if (totalItems >= LIMIT) {
				stats.truncated = true
				break
			}

			if (shouldIgnore(child.name)) {
				continue
			}

			totalItems++

			if (child instanceof TFolder) {
				stats.folderCount++
				nodes.push({
					name: child.name,
					path: child.path,
					isFolder: true,
					children: buildTree(child, depth + 1)
				})
			} else {
				stats.fileCount++
				nodes.push({
					name: child.name,
					path: child.path,
					isFolder: false,
					children: []
				})
			}
		}

		return nodes
	}

	const tree = buildTree(targetFolder, 0)

	function renderTree(nodes: TreeNode[], indent: string = ""): string {
		let output = ""
		for (const node of nodes) {
			if (node.isFolder) {
				output += `${indent}${node.name}/\n`
				if (node.children.length > 0) {
					output += renderTree(node.children, indent + "  ")
				}
			} else {
				output += `${indent}${node.name}\n`
			}
		}
		return output
	}

	const header = normalizedPath === "" ? "/" : normalizedPath
	const treeOutput = renderTree(tree)
	const content = `${header}/\n${treeOutput}`

	return { content, stats }
}

function render(path: string, stats: { fileCount: number; folderCount: number; truncated: boolean }): React.ReactNode {
	const parts = [`List: ${path || "/"}`]
	if (stats.fileCount > 0 || stats.folderCount > 0) {
		parts.push(`(${stats.folderCount} folders, ${stats.fileCount} files)`)
	}
	if (stats.truncated) {
		parts.push("[truncated]")
	}
	return parts.join(" ")
}
