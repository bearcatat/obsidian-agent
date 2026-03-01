import React from 'react';
import { BashToolMessageCard } from './bash-tool-message-card';
import { FileEditToolMessageCard } from './file-edit-tool-message-card';
import { WriteToolMessageCard } from './write-tool-message-card';
import { QuestionToolMessageCard } from './question-tool-message-card';

interface CreateArtifactResult {
  type: "command" | "skill" | "subagent";
  name: string;
  description: string;
  file_path: string;
  is_new_file: boolean;
  content: string;
}

interface CreateCommandResult {
  name: string;
  description: string;
  file_path: string;
  is_new_file: boolean;
  content: string;
}

interface SkillResult {
  success: boolean;
  name: string;
  description: string;
  content: string;
  message: string;
}

interface TimeInfo {
  formatted: string;
  timezone: string;
  timestamp: number;
}

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
      case 'skill':
        return (
          <div className="tw-p-3 tw-border tw-rounded-lg tw-bg-muted/30">
            <div className="tw-flex tw-items-center tw-gap-2 tw-mb-2">
              <span className="tw-text-lg">🎯</span>
              <span className="tw-font-medium">Load Skill</span>
              <span className="tw-ml-auto tw-text-sm tw-text-green-600">✓ Activated</span>
            </div>
            
            <div className="tw-space-y-1 tw-text-sm tw-mb-3">
              <div>
                <span className="tw-text-muted-foreground">Skill:</span>{' '}
                <code className="tw-px-1 tw-bg-muted tw-rounded">{data.name}</code>
              </div>
              <div>
                <span className="tw-text-muted-foreground">Description:</span> {data.description}
              </div>
            </div>

            <details className="tw-mb-3">
              <summary className="tw-cursor-pointer tw-text-sm tw-text-muted-foreground hover:tw-text-normal">
                View skill content
              </summary>
              <pre className="tw-mt-2 tw-p-2 tw-bg-muted tw-rounded tw-text-xs tw-overflow-x-auto tw-whitespace-pre-wrap">
                {data.content}
              </pre>
            </details>

            <div className="tw-text-xs tw-text-muted-foreground">
              {data.message}
            </div>
          </div>
        );
      case 'createArtifact': {
        const artifactResult = data as CreateArtifactResult;
        const typeLabel = artifactResult.type === "command" ? "Command" : artifactResult.type === "skill" ? "Skill" : "SubAgent";
        const icon = artifactResult.type === "command" ? "📝" : artifactResult.type === "skill" ? "🎯" : "🤖";
        const triggerLabel = artifactResult.type === "command" 
          ? `/${artifactResult.name}` 
          : artifactResult.type === "skill" 
            ? `skill({ name: "${artifactResult.name}" })`
            : `${artifactResult.name}()`;
        
        return (
          <div className="tw-p-3 tw-border tw-rounded-lg tw-bg-muted/30">
            <div className="tw-flex tw-items-center tw-gap-2 tw-mb-2">
              <span className="tw-text-lg">{icon}</span>
              <span className="tw-font-medium">
                {artifactResult.is_new_file ? `Create ${typeLabel}` : `Update ${typeLabel}`}
              </span>
              <span className="tw-ml-auto tw-text-sm tw-text-green-600">✓ Applied</span>
            </div>
            
            <div className="tw-space-y-1 tw-text-sm tw-mb-3">
              <div>
                <span className="tw-text-muted-foreground">Type:</span>{' '}
                <span className="tw-capitalize">{artifactResult.type}</span>
              </div>
              <div>
                <span className="tw-text-muted-foreground">{typeLabel}:</span>{' '}
                <code className="tw-px-1 tw-bg-muted tw-rounded">{triggerLabel}</code>
              </div>
              <div>
                <span className="tw-text-muted-foreground">Description:</span> {artifactResult.description}
              </div>
              <div>
                <span className="tw-text-muted-foreground">File:</span>{' '}
                <code className="tw-px-1 tw-bg-muted tw-rounded tw-text-xs">{artifactResult.file_path}</code>
              </div>
            </div>

            <details className="tw-mb-3">
              <summary className="tw-cursor-pointer tw-text-sm tw-text-muted-foreground hover:tw-text-normal">
                Preview content
              </summary>
              <pre className="tw-mt-2 tw-p-2 tw-bg-muted tw-rounded tw-text-xs tw-overflow-x-auto tw-whitespace-pre-wrap">
                {artifactResult.content}
              </pre>
            </details>
          </div>
        );
      }
      case 'createCommand': {
        const cmdResult = data as CreateCommandResult;
        return (
          <div className="tw-p-3 tw-border tw-rounded-lg tw-bg-muted/30">
            <div className="tw-flex tw-items-center tw-gap-2 tw-mb-2">
              <span className="tw-text-lg">📝</span>
              <span className="tw-font-medium">
                {cmdResult.is_new_file ? 'Create Command' : 'Update Command'}
              </span>
              <span className="tw-ml-auto tw-text-sm tw-text-green-600">✓ Applied</span>
            </div>
            
            <div className="tw-space-y-1 tw-text-sm tw-mb-3">
              <div>
                <span className="tw-text-muted-foreground">Command:</span>{' '}
                <code className="tw-px-1 tw-bg-muted tw-rounded">/{cmdResult.name}</code>
              </div>
              <div>
                <span className="tw-text-muted-foreground">Description:</span> {cmdResult.description}
              </div>
              <div>
                <span className="tw-text-muted-foreground">File:</span>{' '}
                <code className="tw-px-1 tw-bg-muted tw-rounded tw-text-xs">{cmdResult.file_path}</code>
              </div>
            </div>

            <details className="tw-mb-3">
              <summary className="tw-cursor-pointer tw-text-sm tw-text-muted-foreground hover:tw-text-normal">
                Preview content
              </summary>
              <pre className="tw-mt-2 tw-p-2 tw-bg-muted tw-rounded tw-text-xs tw-overflow-x-auto tw-whitespace-pre-wrap">
                {cmdResult.content}
              </pre>
            </details>
          </div>
        );
      }
      case 'webFetch': {
        let url = data.url || '';
        if (!url && contentJson.includes('url:')) {
          const match = contentJson.match(/url:\s*(.+)/);
          if (match) url = match[1].trim();
        }
        return (
          <div className="tw-flex tw-items-center tw-gap-2">
            <span>🌐 Fetched:</span>
            <code className="tw-text-sm tw-bg-muted tw-px-1 tw-rounded">{url}</code>
          </div>
        );
      }
      case 'exaWebSearch': {
        let query = data.query || '';
        if (!query && contentJson.includes('query:')) {
          const match = contentJson.match(/query:\s*(.+)/);
          if (match) query = match[1].trim();
        }
        return (
          <div className="tw-flex tw-items-center tw-gap-2">
            <span>🔍 Exa Search:</span>
            <span className="tw-text-muted-foreground">"{query}"</span>
          </div>
        );
      }
      case 'bochaWebSearch': {
        let query = data.query || '';
        if (!query && contentJson.includes('query:')) {
          const match = contentJson.match(/query:\s*(.+)/);
          if (match) query = match[1].trim();
        }
        return (
          <div className="tw-flex tw-items-center tw-gap-2">
            <span>🔍 Bocha Search:</span>
            <span className="tw-text-muted-foreground">"{query}"</span>
          </div>
        );
      }
      case 'getCurrentTime': {
        let timeInfo: TimeInfo | null = null;
        if (data.formatted) {
          timeInfo = data as TimeInfo;
        } else if (contentJson.includes('Current time:')) {
          const match = contentJson.match(/Current time:\s*(.+)/);
          if (match) {
            timeInfo = { formatted: match[1].trim(), timezone: '', timestamp: 0 };
          }
        }
        return (
          <div className="tw-flex tw-items-center tw-gap-2">
            <span>🕐 {timeInfo?.formatted || 'Current time'}</span>
          </div>
        );
      }
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
    if (toolName === 'webFetch' && contentJson.includes('url:')) {
      const match = contentJson.match(/url:\s*(.+)/);
      return `🌐 Fetched: ${match ? match[1].trim() : 'Unknown URL'}`;
    }
    if (toolName === 'skill' && contentJson.includes('Skill "')) {
      const match = contentJson.match(/Skill "([^"]+)"/);
      return `🎯 Skill loaded: ${match ? match[1] : 'Unknown skill'}`;
    }
    if (toolName === 'getCurrentTime' && contentJson.includes('Current time:')) {
      const match = contentJson.match(/Current time:\s*(.+)/);
      return `🕐 ${match ? match[1].trim() : 'Current time'}`;
    }

    return <div className="tw-p-2 tw-text-muted tw-italic">Completed: {toolName}</div>;
  }
}
