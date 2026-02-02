import { tool } from "ai";
import { DESCRIPTION } from "./prompts";
import { z } from 'zod';
import { convertDateToTimeInfo, TimeInfo } from "../common/common";
import { ToolMessage } from "@/messages/tool-message";
import { MessageV2 } from "@/types";

export const toolName = "getCurrentTime"


export const GetCurrentTimeTool = tool({
	title: toolName,
	description: DESCRIPTION,
	inputSchema: z.object({}),
	execute: ({ }, { toolCallId, experimental_context }) => {
		const context = experimental_context as { addMessage: (message: MessageV2) => void }
		const toolMessage = ToolMessage.from(toolName, toolCallId)
		try {
			const timeInfo = getCurrentTime()
			toolMessage.setChildren(render(timeInfo))
			toolMessage.close()
			context.addMessage(toolMessage)
			return timeInfo
		} catch (error) {
			context.addMessage(ToolMessage.createErrorToolMessage2(toolName, toolCallId, error))
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