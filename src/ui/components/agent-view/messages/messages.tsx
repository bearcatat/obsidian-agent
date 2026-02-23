import { memo, useMemo, useEffect, cloneElement, useState } from "react";
import { useAgentState } from "../../../../hooks/use-agent";
import { useAutoScroll } from "../../../../hooks/use-auto-scroll";
import { MessageV2 } from "@/types";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/ui/elements/collapsible";
import { Button } from "@/ui/elements/button";
import { ChevronsUpDown } from "lucide-react";

export const Messages = memo(
  () => {
    const { messages, isLoading } = useAgentState();
    const { containerRef, handleScroll, autoScroll, resetUserScrolling, isUserScrolling } = useAutoScroll();

    // 使用 useMemo 优化消息列表渲染
    const messageElements = useMemo(() => {
      return messages.map((message: MessageV2) => {
        return cloneElement(message.render(), { key: message.id });
      });
    }, [messages]);

    // 检测是否有流式消息正在生成
    const isStreaming = useMemo(() => {
      const hasStreamingMessage = messages.some(message => message.isStreaming);
      return hasStreamingMessage || isLoading;
    }, [messages, isLoading]);

    // 监听消息变化，处理自动滚动
    useEffect(() => {
      if (isStreaming) {
        autoScroll(true);
      }
    }, [messages, autoScroll, isUserScrolling]);

    // 监听用户消息数量变化，新用户消息时恢复自动滚动
    const userMessagesCount = useMemo(() => {
      return messages.filter((msg): msg is MessageV2 => 'role' in msg && msg.role === 'user').length;
    }, [messages]);

    useEffect(() => {
      if (userMessagesCount > 0) {
        resetUserScrolling();
      }
    }, [userMessagesCount, resetUserScrolling]);

    return (
      <div className="tw-flex tw-h-full tw-flex-1 tw-flex-col tw-overflow-hidden">
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="tw-mt-auto tw-box-border tw-flex tw-w-full tw-flex-1 tw-select-text tw-flex-col tw-items-start tw-justify-start tw-overflow-y-auto tw-scroll-smooth tw-break-words tw-text-[calc(var(--font-text-size)_-_2px)] tw-gap-1"
        >
          {messageElements}
        </div>
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

  const messageElements = useMemo(() => {
    return messages.map((message: MessageV2) => {
      return cloneElement(message.render(), { key: message.id });
    });
  }, [messages]);

  const toolCallCount = useMemo(() => {
    return messages.filter((msg): msg is MessageV2 => 'role' in msg && msg.role === 'tool').length;
  }, [messages]);

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="tw-flex-col tw-group tw-flex tw-rounded-md tw-p-1 tw-border tw-border-solid tw-border-border"
    >
      <div className="tw-flex tw-items-center tw-justify-between tw-px-2 tw-text-sm">
        <div className="tw-text-muted tw-text-xs">
          🤖 {name} {isStreaming ? '(running)' : ''} {!isOpen && toolCallCount > 0 ? `(${toolCallCount} tool calls)` : ''}
        </div>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8">
            <ChevronsUpDown className="tw-size-4" />
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="tw-text-muted tw-p-1 tw-rounded-sm tw-bg-primary tw-max-h-64 tw-overflow-y-auto">
        {messageElements}
      </CollapsibleContent>
    </Collapsible>
  )
})