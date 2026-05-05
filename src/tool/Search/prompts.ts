export const DESCRIPTION = `Local file search tool

Features:
- Supports content search and file name search
- Supports full regular expression syntax
- Configurable case sensitivity
- Supports path filtering
- Shows context of matching lines

Usage scenarios:
1. Find notes containing specific keywords in the vault
2. Use regular expressions for complex pattern matching
3. Search files in specific directories
4. Quickly locate related documents

Notes:
- Default searches the entire vault; use the path parameter to limit search scope
- Regular expressions use JavaScript syntax
- Search results are limited to 50 by default; use the limit parameter to adjust
- Large vault searches may take longer

Examples:
1. Simple text search: Search for notes containing "project plan"
2. Regular expression search: Use regex to find date formats
3. File name search: Find files starting with "README"
4. Path-restricted search: Search in "project/docs/" directory

Error handling:
- Invalid regular expressions return clear error messages
- Non-existent search paths prompt path errors
- Search timeouts automatically terminate and return results found so far`;
