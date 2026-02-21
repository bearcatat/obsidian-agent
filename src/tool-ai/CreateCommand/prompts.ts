export const DESCRIPTION = `Create a new custom command file.

This tool creates a command file in the obsidian-agent/commands/ folder.

Usage:
- name: Command name (lowercase, use underscores for spaces, e.g., "translate_text")
- description: Brief description of what the command does
- template: The prompt template content

Template features:
- Use \`$ARGUMENTS\` to include all user arguments
- Use \`$1\`, \`$2\`, \`$3\` for positional arguments
- Use \`@filepath\` to reference note file contents

The tool will:
1. Validate the command name
2. Check for existing commands with the same name
3. Create the file with proper frontmatter format
`;
