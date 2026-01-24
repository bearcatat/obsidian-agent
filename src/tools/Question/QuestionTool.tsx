import { StructuredToolInterface } from "@langchain/core/tools";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { DESCRIPTION } from "./prompts";
import { MessageV2 } from "@/types";
import { ToolCall } from "@langchain/core/dist/messages/tool";
import { ToolMessage } from "@/messages/tool-message";
import { createToolError } from "@/utils/error-utils";
import { QuestionToolMessageCard } from "@/ui/components/agent-view/messages/message/question-tool-message-card";
import { Question } from "@/types";

export default class QuestionTool {
    private static instance: QuestionTool;
    private tool: StructuredToolInterface;

    static getInstance(): QuestionTool {
        if (!QuestionTool.instance) {
            QuestionTool.instance = new QuestionTool();
        }
        return QuestionTool.instance;
    }

    private constructor() {
        this.tool = tool(this.askQuestion, {
            name: "askQuestion",
            description: DESCRIPTION,
            schema: z.object({
                question: z.string().describe("你要询问的问题"),
                options: z.array(z.string()).describe("答案选项，最多4个"),
            }),
        });
    }

    private async askQuestion({ question, options }: { question: string, options: string[] }): Promise<string> {
        return "success";
    }

    getTool(): StructuredToolInterface {
        return this.tool;
    }

    async *run(toolCall: ToolCall): AsyncGenerator<MessageV2, void> {
        if (!toolCall.id) {
            console.error(`Tool call id is undefined`);
            return;
        }
        try {
            let resolver: (value: string) => void;
            const askQuestion= () => {
                return new Promise<string>((resolve) => {
                    resolver = resolve;
                });
            }
            const submitAnswer = (answer: string) => {
                resolver(answer);
            }
            const toolMessage = ToolMessage.fromToolCall(toolCall);
            const question = this.generateQuestion(toolCall);
            toolMessage.setChildren(this.render(question, false, null, submitAnswer));
            yield toolMessage;
            const result = await askQuestion();
            toolMessage.setChildren(this.render(question, true, result, submitAnswer));
            toolMessage.setContent(result);
            toolMessage.close();
            yield toolMessage;
        } catch (error) {
            yield createToolError(toolCall, error as string);
        }
    }

    private generateQuestion(toolCall: ToolCall): Question {
        return {
            id: toolCall.id ?? "",
            question: toolCall.args.question,
            options: toolCall.args.options,
        }
    }

    private render(question: Question, origin_answered_state: boolean, answered: string | null, onAnswer: (answer: string) => void): React.ReactNode {
        return (
            <QuestionToolMessageCard 
            question={question} 
            origin_answered_state={origin_answered_state} 
            answer={answered} 
            onAnswer={onAnswer} />
        )
    }

}