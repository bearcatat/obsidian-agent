export const DESCRIPTION = `List files and directories in a given path

Features:
- Lists all files and subdirectories within a folder
- Displays file/folder type indicators
- Supports custom ignore patterns
- Returns tree structure view
- Shows file counts and statistics

Usage scenarios:
1. Explore vault folder structure
2. Find files in specific directories
3. Understand project organization
4. Navigate to relevant folders before searching

Parameters:
- path: folder path relative to vault root (omit for root directory)
- ignore: array of glob patterns to exclude (e.g., [".obsidian", "*.tmp"])

Output format:
- Directories end with "/"
- Files show their names
- Tree structure with indentation

Notes:
- Use this tool to explore the vault structure
- Prefer this over guessing file locations
- Use ignore patterns to exclude noisy directories
- Results are limited to prevent overwhelming output`;
