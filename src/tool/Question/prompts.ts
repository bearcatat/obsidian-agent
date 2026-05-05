export const DESCRIPTION = `Use this tool when you need to ask the user questions during execution. This allows you to:
1. Gather user preferences or requirements
2. Clarify ambiguous instructions
3. Get decisions on implementation choices as you work
4. Offer choices to the user about what direction to take.
5. Test the user's knowledge or understanding of a topic when they explicitly request it

Usage notes:
- When \`custom\` is enabled (default), a "Type your own answer" option is added automatically; don't include "Other" or catch-all options
- Answers are returned as arrays of labels; set \`multiple: true\` to allow selecting more than one
- If you recommend a specific option, make that the first option in the list and add "(Recommended)" at the end of the label

Usage notes for knowledge testing:
- When user explicitly requests a knowledge quiz, confirm the topic and difficulty level before proceeding
- For quiz responses, provide immediate feedback on correctness and offer explanations when requested

Parameters:
- questions: Array of questions to ask. Each question contains:
  - question: Complete question text (must be clear and unambiguous)
  - header: Very short label (max 30 chars) - optional, for quick context
  - options: Array of choices, each with:
    - label: Display text (1-5 words, concise)
    - description: Explanation of choice - optional
  - multiple: Allow selecting multiple choices - optional, default false
  - custom: Allow typing a custom answer - optional, default true`
