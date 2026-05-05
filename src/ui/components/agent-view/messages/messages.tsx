import { memo, useMemo, useEffect, useState } from "react";
import { useAgentState } from "../../../../hooks/use-agent";
import { MessageV2 } from "@/types";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/ui/elements/collapsible";
import { Button } from "@/ui/elements/button";
import { ChevronsUpDown } from "lucide-react";
import { VirtualMessagesList } from "./virtual-messages-list";

export const Messages = memo(
  () => {
    const { messages, isLoading } = useAgentState();

    // 检测是否有流式消息正在生成
    const isStreaming = useMemo(() => {
      const hasStreamingMessage = messages.some(message => message.isStreaming);
      return hasStreamingMessage || isLoading;
    }, [messages, isLoading]);

    // 监听用户消息数量变化，新用户消息时恢复自动滚动
    const userMessagesCount = useMemo(() => {
      return messages.filter((msg): msg is MessageV2 => 'role' in msg && msg.role === 'user').length;
    }, [messages]);

    return (
      <div className="tw-flex tw-h-full tw-flex-1 tw-flex-col tw-overflow-hidden">
        <VirtualMessagesList
          messages={messages}
          isStreaming={isStreaming}
          className="tw-w-full tw-flex-1"
          style={{ height: "100%" }}
          scrollToLatestOnCountIncrease={userMessagesCount}
        />
      </div>
    )
  }
)


type Props = {
  name: string;
  messages: MessageV2[];
  isStreaming: boolean;
}

export const SubAgentMessagesCard = memo(({ name, messages, isStreaming }: Props) => {
  const [isOpen, setIsOpen] = useState(isStreaming);

  useEffect(() => {
    setIsOpen(isStreaming);
  }, [isStreaming]);

  const toolCallCount = useMemo(() => {
    return messages.filter((msg): msg is MessageV2 => 'role' in msg && msg.role === 'tool').length;
  }, [messages]);

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="tw-flex-col tw-group tw-flex tw-rounded-md tw-p-1 tw-border tw-border-solid tw-border-border"
    >
      <div className="tw-flex tw-items-center tw-justify-between tw-px-1 tw-text-sm">
        <div className="tw-text-muted tw-text-xs">
          🤖 {name} {isStreaming ? '(running)' : ''} {!isOpen && toolCallCount > 0 ? `(${toolCallCount} tool calls)` : ''}
        </div>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="icon" className="tw-size-8">
            <ChevronsUpDown className="tw-size-4" />
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="tw-text-muted tw-rounded-sm tw-bg-primary tw-overflow-hidden">
        <VirtualMessagesList
          messages={messages}
          isStreaming={isStreaming}
          className="obsidian-agent-hide-scrollbar tw-w-full"
          style={{ height: "16rem" }}
        />
      </CollapsibleContent>
    </Collapsible>
  )
})
