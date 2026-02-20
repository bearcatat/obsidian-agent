/**
 * ExaWebSearch tool description
 * Web search tool powered by Exa AI
 * Style reference: OpenCode websearch tool
 */
export const DESCRIPTION = `Search the web for information.

Performs web searches using Exa AI to find relevant information online. Useful for:
- Researching topics that require current information beyond training data cutoff
- Finding documentation, tutorials, or technical articles
- Looking up current events, news, or recent developments
- Gathering information not available in local notes
- Verifying facts or finding authoritative sources

Results include:
- Web page title and URL
- Author and publication date (when available)
- Page content or summary (configurable length)
- Structured XML format for easy parsing

Usage:
- Use websearch when you need to DISCOVER information (search by topic/query)
- Use webfetch when you need to RETRIEVE content from a specific URL
- Keep queries specific and clear for better results
- Results may be truncated for very long pages
- Use English queries for better results (recommended)

Configuration required:
- Exa API key from https://dashboard.exa.ai/api-keys
- Enable in Settings > External Tools > Exa Web Search
- Optional: configure result count, content length, and livecrawl mode`;
