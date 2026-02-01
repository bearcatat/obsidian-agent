import { tool } from "ai";
import { DESCRIPTION } from "./prompts";
import { z } from 'zod';
import { ToolMessage } from "@/messages/tool-message";
import { useAgentLogic } from "@/hooks/use-agent";
import { QuestionToolMessageCard } from "@/ui/components/agent-view/messages/message/question-tool-message-card";
import { Question } from "@/types";

export const toolName = "askQuestion"

export const QuestionTool = tool({
	title: toolName,
	description: DESCRIPTION,
	inputSchema: z.object({
		question: z.string().describe("你要询问的问题"),
		options: z.array(z.string()).describe("答案选项，最多4个"),
	}),
	execute: async ({ question, options }, { toolCallId }) => {
		const { addMessage } = useAgentLogic()
		try {
			const toolMessage = ToolMessage.from(toolName, toolCallId)
			const questionData: Question = {
				id: toolCallId ?? "",
				question,
				options,
			}

			let resolver: (value: string) => void
			const waitForAnswer = () => new Promise<string>((resolve) => { resolver = resolve })
			const submitAnswer = (answer: string) => { resolver(answer) }

			toolMessage.setChildren(render(questionData, false, null, submitAnswer))
			addMessage(toolMessage)

			const result = await waitForAnswer()

			toolMessage.setChildren(render(questionData, true, result, submitAnswer))
			toolMessage.setContent(result)
			toolMessage.close()
			addMessage(toolMessage)

			return result
		} catch (error) {
			const errorMessage = ToolMessage.createErrorToolMessage2(toolName, toolCallId, error)
			addMessage(errorMessage)
			throw error
		}
	}
})

function render(
	question: Question,
	origin_answered_state: boolean,
	answered: string | null,
	onAnswer: (answer: string) => void
): React.ReactNode {
	return (
		<QuestionToolMessageCard
			question={question}
			origin_answered_state={origin_answered_state}
			answer={answered}
			onAnswer={onAnswer}
		/>
	)
}
