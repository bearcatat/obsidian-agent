import React from 'react';
import { BashToolMessageCard } from './bash-tool-message-card';
import { FileEditToolMessageCard } from './file-edit-tool-message-card';
import { WriteToolMessageCard } from './write-tool-message-card';
import { QuestionToolMessageCard } from './question-tool-message-card';
import { renderBochaWebSearchMessage } from '@/tool-ai/BochaSearch/BochaSearchTool';
import { renderCreateArtifactMessage } from '@/tool-ai/CreateArtifact/CreateArtifactTool';
import { renderExaWebSearchMessage } from '@/tool-ai/ExaSearch/ExaSearchTool';
import { renderListMessage } from '@/tool-ai/List/ListTool';
import { renderReadNoteByLinkMessage } from '@/tool-ai/ReadNote/ReadNoteByLink/ReadNoteByLinkTool';
import { renderReadNoteByPathMessage } from '@/tool-ai/ReadNote/ReadNoteByPath/ReadNoteByPathTool';
import { renderSearchMessage } from '@/tool-ai/Search/SearchTool';
import { renderSkillMessage } from '@/tool-ai/Skill/SkillTool';
import { renderTelegramFeedbackMessage } from './telegram-feedback-message-card';
import { renderGetCurrentTimeMessage } from '@/tool-ai/Time/GetCurrentTime/GetCurrentTimeTool';
import { renderWebFetchMessage } from '@/tool-ai/WebFetch/WebFetchTool';

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
        return renderReadNoteByPathMessage(data.filePath);
      case 'readNoteByLink':
        return renderReadNoteByLinkMessage(data.linkPath);
      case 'list':
        return renderListMessage(data.path, data.stats);
      case 'search':
        return renderSearchMessage(data.params.query, data.metadata);
      case 'skill':
        return renderSkillMessage(data);
      case 'createArtifact':
        return renderCreateArtifactMessage(data as CreateArtifactResult, true, "apply", () => {}, () => {});
      case 'createCommand': {
        // Fallback renderer for older histories that still have 'createCommand' tool messages
        return (
          <div className="tw-p-3 tw-border tw-rounded-lg tw-bg-muted/30">
            <div className="tw-flex tw-items-center tw-gap-2 tw-mb-2">
              <span className="tw-text-lg">📝</span>
              <span className="tw-font-medium">
                {data.is_new_file ? 'Create Command' : 'Update Command'}
              </span>
              <span className="tw-ml-auto tw-text-sm tw-text-green-600">✓ Applied</span>
            </div>
            <div className="tw-space-y-1 tw-text-sm tw-mb-3">
              <div>
                <span className="tw-text-muted-foreground">Command:</span>{' '}
                <code className="tw-px-1 tw-bg-muted tw-rounded">/{data.name}</code>
              </div>
              <div>
                <span className="tw-text-muted-foreground">Description:</span> {data.description}
              </div>
              <div>
                <span className="tw-text-muted-foreground">File:</span>{' '}
                <code className="tw-px-1 tw-bg-muted tw-rounded tw-text-xs">{data.file_path}</code>
              </div>
            </div>
          </div>
        );
      }
      case 'webFetch': {
        let url = data.url || '';
        if (!url && contentJson.includes('url:')) {
          const match = contentJson.match(/url:\s*(.+)/);
          if (match) url = match[1].trim();
        }
        return renderWebFetchMessage(url);
      }
      case 'exaWebSearch': {
        let query = data.query || '';
        if (!query && contentJson.includes('query:')) {
          const match = contentJson.match(/query:\s*(.+)/);
          if (match) query = match[1].trim();
        }
        return renderExaWebSearchMessage(query);
      }
      case 'bochaWebSearch': {
        let query = data.query || '';
        if (!query && contentJson.includes('query:')) {
          const match = contentJson.match(/query:\s*(.+)/);
          if (match) query = match[1].trim();
        }
        return renderBochaWebSearchMessage(query);
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
        return renderGetCurrentTimeMessage(timeInfo as any);
      }
      case 'telegramFeedback':
        return renderTelegramFeedbackMessage(data);
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
