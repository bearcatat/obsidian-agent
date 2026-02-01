import { tool } from "ai";
import { DESCRIPTION } from "./prompts";
import { z } from 'zod';
import { convertDateToTimeInfo, TimeInfo } from "../common/common";
import { ToolMessage } from "@/messages/tool-message";
import { useAgentLogic } from "@/hooks/use-agent";

export const toolName = "getCurrentTime"


export const GetCurrentTimeTool = tool({
	title: toolName,
	description: DESCRIPTION,
	inputSchema: z.object({}),
	execute: ({ }, { toolCallId }) => {
		const toolMessage = ToolMessage.from(toolName, toolCallId)
		const { addMessage } = useAgentLogic()
		try {
			const timeInfo = getCurrentTime()
			toolMessage.setChildren(render(timeInfo))
			toolMessage.close()
			addMessage(toolMessage)
			return timeInfo
		} catch (error) {
			addMessage(ToolMessage.createErrorToolMessage2(toolName, toolCallId, error))
			throw (error)
		}
	}
})

function getCurrentTime(): TimeInfo {
	const now = new Date();
	return convertDateToTimeInfo(now);
}

function render(timeInfo: TimeInfo): React.ReactNode {
	return (
		`Current time: ${timeInfo.formatted}`
	)
}