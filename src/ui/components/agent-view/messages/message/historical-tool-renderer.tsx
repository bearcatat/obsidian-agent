import React from 'react';
import { BashToolMessageCard } from './bash-tool-message-card';
import { FileEditToolMessageCard } from './file-edit-tool-message-card';
import { WriteToolMessageCard } from './write-tool-message-card';
import { QuestionToolMessageCard } from './question-tool-message-card';

export function renderHistoricalToolMessage(toolName: string, contentJson: string): React.ReactNode {
  try {
    const data = JSON.parse(contentJson);
    
    switch (toolName) {
      case 'bash':
        return (
          <BashToolMessageCard
            bashCommand={data.bashCommand}
            decision={data.decision}
            origin_answered_state={true}
          />
        );
      case 'editFile':
        return (
          <FileEditToolMessageCard
            fileEdit={data.fileEdit}
            decision={data.decision}
            origin_answered_state={true}
            onApply={() => {}}
            onReject={() => {}}
          />
        );
      case 'write':
        return (
          <WriteToolMessageCard
            writeResult={data.writeResult}
            decision={data.decision}
            origin_answered_state={true}
            onApply={() => {}}
            onReject={() => {}}
          />
        );
      case 'askQuestion':
        return (
          <div className="tw-flex tw-flex-col tw-gap-2">
            {data.questions.map((question: any, index: number) => (
              <QuestionToolMessageCard
                key={question.id}
                question={question}
                origin_answered_state={true}
                answer={data.results[index] ?? null}
                onAnswer={() => {}}
              />
            ))}
          </div>
        );
      case 'readNoteByPath':
        return `Read note by path: ${data.filePath}`;
      case 'readNoteByLink':
        return `Read note by link: ${data.linkPath}`;
      case 'list': {
        const parts = [`List: ${data.path}`]
        if (data.stats.fileCount > 0 || data.stats.folderCount > 0) {
            parts.push(`(${data.stats.folderCount} folders, ${data.stats.fileCount} files)`)
        }
        if (data.stats.truncated) {
            parts.push("[truncated]")
        }
        return parts.join(" ")
      }
      case 'search':
        return (
          <div className="tw-flex tw-items-center tw-gap-2">
            <span>Search: "{data.params.query}"</span>
            {data.metadata.matchedFiles > 0 && (
              <span className="tw-text-sm tw-text-muted-foreground">
                ({data.metadata.matchedFiles} files, {data.metadata.totalMatches} matches)
              </span>
            )}
          </div>
        );
      default:
        return <div className="tw-p-2 tw-text-muted">No historical renderer for {toolName}. Raw data: {contentJson}</div>;
    }
  } catch (error) {
    // Fallback for tools that were saved with raw string content instead of JSON payload
    // Try to extract useful info or just return a generic text
    if (toolName === 'readNoteByPath' && contentJson.includes('note path:')) {
      const match = contentJson.match(/note path:\s*(.+)/);
      return `📖 Read note: ${match ? match[1].trim() : 'Unknown path'}`;
    }
    if (toolName === 'readNoteByLink' && contentJson.includes('link path:')) {
      const match = contentJson.match(/link path:\s*(.+)/);
      return `🔗 Read note link: ${match ? match[1].trim() : 'Unknown link'}`;
    }
    if (toolName === 'list' && contentJson.includes('/')) {
      return `📁 Listed directory`;
    }
    if (toolName === 'search' && contentJson.includes('Search query:')) {
      const match = contentJson.match(/Search query: "(.+?)"/);
      return `🔍 Search: "${match ? match[1] : 'Unknown query'}"`;
    }

    return <div className="tw-p-2 tw-text-muted tw-italic">Completed: {toolName}</div>;
  }
}
