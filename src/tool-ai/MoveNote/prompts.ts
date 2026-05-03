export const DESCRIPTION = `Move or rename an Obsidian Markdown note.

Use cases:
- Move a note to another folder
- Rename a note
- Move and rename a note in one operation

Usage requirements:
1. source_path: Existing note path relative to the vault root
2. target_path: Destination note path relative to the vault root, or an existing/ending-with-slash folder path to keep the original filename

Important:
- This tool uses Obsidian's FileManager.renameFile API so internal links/backlinks are updated according to the user's Obsidian settings
- Do not use shell commands like mv, cp, or filesystem adapter operations to move Obsidian notes
- Only Markdown notes (.md) are supported
- The operation fails if the destination already exists
`;
