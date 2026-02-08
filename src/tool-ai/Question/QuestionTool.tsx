import { tool } from "ai";
import { DESCRIPTION } from "./prompts";
import { z } from 'zod';
import { ToolMessage } from "@/messages/tool-message";
import { QuestionToolMessageCard } from "@/ui/components/agent-view/messages/message/question-tool-message-card";
import { Question, MessageV2 } from "@/types";

export const toolName = "askQuestion"

export const QuestionTool = tool({
	title: toolName,
	description: DESCRIPTION,
	inputSchema: z.object({
		questions: z.array(z.object({
			question: z.string().describe("Complete question"),
			header: z.string().describe("Very short label (max 30 chars)").optional(),
			options: z.array(z.object({
				label: z.string().describe("Display text (1-5 words, concise)"),
				description: z.string().describe("Explanation of choice").optional(),
			})).describe("Available choices"),
			multiple: z.boolean().optional().describe("Allow selecting multiple choices"),
			custom: z.boolean().optional().describe("Allow typing a custom answer (default: true)"),
		})).describe("Questions to ask"),
	}),
	execute: async ({ questions }, { toolCallId, experimental_context }) => {
		const context = experimental_context as { addMessage: (message: MessageV2) => void }
		try {
			const toolMessage = ToolMessage.from(toolName, toolCallId)
			const questionData: Question[] = questions.map((q, index) => ({
				id: `${toolCallId ?? ""}-${index}`,
				question: q.question,
				options: q.options,
				header: q.header,
				multiple: q.multiple,
				custom: q.custom,
			}))

			let resolvers: ((value: string[]) => void)[] = []
			const promises: Promise<string[]>[] = questions.map(
				() =>
					new Promise<string[]>((resolve) => {
						resolvers.push(resolve)
					})
			)
			const submitAnswer = (index: number, answer: string[]) => {
				if (resolvers[index]) {
					resolvers[index](answer)
					resolvers[index] = null as any
				}
			}

			toolMessage.setChildren(render(questionData, false, [], submitAnswer))
			context.addMessage(toolMessage)

			const results: string[][] = await Promise.all(promises)
			
			toolMessage.setChildren(render(questionData, true, results, submitAnswer))
			toolMessage.setContent(JSON.stringify(results))
			toolMessage.close()
			context.addMessage(toolMessage)

			return results
		} catch (error) {
			const errorMessage = ToolMessage.createErrorToolMessage2(toolName, toolCallId, error)
			context.addMessage(errorMessage)
			throw error
		}
	}
})

function render(
	questions: Question[],
	origin_answered_state: boolean,
	answered: string[][],
	onAnswer: (index: number, answer: string[]) => void
): React.ReactNode {
	return (
		<div className="tw-flex tw-flex-col tw-gap-2">
			{questions.map((question, index) => (
				<QuestionToolMessageCard
					key={question.id}
					question={question}
					origin_answered_state={origin_answered_state}
					answer={answered[index] ?? null}
					onAnswer={(answer) => onAnswer(index, answer)}
				/>
			))}
		</div>
	)
}
