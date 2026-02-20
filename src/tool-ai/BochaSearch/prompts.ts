/**
 * BochaWebSearch tool description
 * Web search tool powered by Bocha AI
 * Style reference: OpenCode websearch tool
 */
export const DESCRIPTION = `Search the web for information using Bocha AI (Chinese search engine optimized for Chinese content).

Performs web searches using Bocha Search API to find relevant information online. Useful for:
- Searching Chinese websites and content (especially effective)
- Researching topics that require current information
- Finding documentation, tutorials, or technical articles
- Looking up current events, news, or recent developments
- Gathering information not available in local notes

Results include:
- Web page title and URL
- Website name (siteName)
- Page summary/description
- Publication date (when available)
- Structured text format for easy reading

Usage:
- Use bochaWebSearch when you need to DISCOVER information (search by topic/query)
- Use webfetch when you need to RETRIEVE content from a specific URL
- Keep queries specific and clear for better results
- Results may be truncated for very long pages
- Use English queries for better results (recommended)
- Especially effective for Chinese content and websites

Configuration required:
- Bocha API key from https://open.bochaai.com
- Enable in Settings > External Tools > Bocha Web Search
- Optional: configure result count (1-50) and time range filter`;
