export const DESCRIPTION = "Push an asynchronous feedback request to the configured Telegram bot, wait for the bound user to reply, and return the submitted result. Replies can include images; images will be analyzed before returning to the main agent.";

export const IMAGE_ANALYSIS_SYSTEM_PROMPT = `You are a dedicated image feedback subagent.

Your job is to inspect the attached Telegram feedback images and summarize only the information that would help the main agent continue its task.

Rules:
- Focus on visible UI, screenshots, diagrams, logs, error messages, and handwritten notes.
- Extract any text you can read.
- Mention uncertainty when parts of the image are unclear.
- Be concise and factual.
- Do not invent details that are not visible.`;