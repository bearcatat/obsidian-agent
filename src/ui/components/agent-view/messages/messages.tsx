import { memo, useMemo, useEffect, cloneElement } from "react";
import { useAgentState } from "../../../../hooks/use-agent";
import { useAutoScroll } from "../../../../hooks/use-auto-scroll";
import { MessageV2 } from "@/types";

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
          className="tw-mt-auto tw-box-border tw-flex tw-w-full tw-flex-1 tw-select-text tw-flex-col tw-items-start tw-justify-start tw-overflow-y-auto tw-scroll-smooth tw-break-words tw-text-[calc(var(--font-text-size)_-_2px)]"
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
}

export const SubAgentMessagesCard = memo(({ name, messages }: Props) => {
  const messageElements = useMemo(() => {
    return messages.map((message: MessageV2) => {
      return cloneElement(message.render(), { key: message.id });
    });
  }, [messages]);

  // 检测是否有流式消息正在生成
  const isStreaming = useMemo(() => {
    return messages.some(message => message.isStreaming);
  }, [messages]);

  return (
    <details className="tw-flex-col tw-group tw-flex tw-rounded-md tw-p-1 tw-border tw-border-solid tw-border-border" open={isStreaming}>
      <summary className="tw-cursor-pointer tw-text-muted tw-text-xs tw-select-none">🤖 {name}</summary>
      <div className="tw-text-muted tw-p-1 tw-rounded-sm tw-bg-primary tw-max-h-64 tw-overflow-y-auto">
        {messageElements}
      </div>
    </details>
  )
})