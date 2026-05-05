export const DESCRIPTION = `Reads linked notes from the Obsidian vault.

# Note Link Definition
Note links use [[note name]] syntax in Markdown. Extract the main link from between [[ and ]]:
- Note name: [[Project Plan]] → "Project Plan"
- Sub-path: [[Folder A/Sub Note]] → "Folder A/Sub Note"
- Header jump: [[Reading Notes#Highlights]] → "Reading Notes"
- Display text: [[2025-07-27|Today's Note]] → "2025-07-27"
- Block link: [[Note Name^Block Name]] → "Note Name"

Usage:
- linkPath: The extracted note path from [[link]] format (without brackets)
- filePath: The current note's full path for resolving the link
- Returns formatted note content with metadata

Key requirements:
- Deduplication: Call this tool only once for the same note link
- Priority: Use this tool when encountering [[note name]] links
- Warning: Do not use if you already know the note content

File type: Only supports .md files
`;

