import { CompletionContext, CompletionSource, CompletionResult, Completion } from '@codemirror/autocomplete';
import CommandLogic from '@/logic/command-logic';
import { CommandConfig } from '@/types';

const COMMAND_PATTERN = /\/(\w*)$/;

export const createCommandCompletionSource = (): CompletionSource => {
  return (context: CompletionContext): CompletionResult | null => {
    const match = context.matchBefore(COMMAND_PATTERN);
    
    if (!match || (context.explicit && !match)) return null;
    
    const query = match.text.slice(1) || '';
    const from = match.from + 1;
    
    const commands = CommandLogic.getInstance().getAllCommands();
    
    const filteredCommands = query 
      ? commands.filter((cmd: CommandConfig & { builtin?: boolean }) => 
          cmd.name.toLowerCase().includes(query.toLowerCase())
        )
      : commands;
    
    const options: Completion[] = filteredCommands.map((cmd: CommandConfig & { builtin?: boolean }) => ({
      label: `/${cmd.name}`,
      type: cmd.builtin ? 'class' : 'function',
      detail: cmd.description || (cmd.builtin ? 'Builtin command' : 'Custom command'),
      apply: (view, completion, fromPos, toPos) => {
        const insertText = `/${cmd.name} `;
        view.dispatch({
          changes: { from: fromPos - 1, to: toPos, insert: insertText }
        });
      }
    }));

    return {
      from,
      options,
      validFor: /^\w*$/,
    };
  };
};
