export const DESCRIPTION = `Performs exact string replacements in Obsidian notes.

Usage:
- Use the ReadNoteByPath/ReadNoteByLink tool before editing to understand the note's content
- Provide file_path, old_string, new_string, and optional replaceAll (default false)
- This tool cannot create new notes. Use the write tool to create notes

Important:
- The edit will FAIL if old_string is not found in the note
- The edit will FAIL if old_string is found multiple times (use replaceAll to replace all)
- old_string must uniquely identify the instance - include sufficient surrounding context
- Split large modifications into smaller edit operations
`;
