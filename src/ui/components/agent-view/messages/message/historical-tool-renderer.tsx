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
      default:
        return <div className="tw-p-2 tw-text-muted">No historical renderer for {toolName}. Raw data: {contentJson}</div>;
    }
  } catch (error) {
    return <div className="tw-p-2 tw-text-error">Failed to parse historical tool data: {contentJson}</div>;
  }
}
