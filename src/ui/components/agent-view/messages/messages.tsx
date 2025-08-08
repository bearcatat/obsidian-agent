import { memo, useMemo, useEffect } from "react";
import { SingleMessage } from "./single-message";
import { useAgentState } from "../../../../hooks/use-agent";
import { useAutoScroll } from "../../../../hooks/use-auto-scroll";

export const Messages = memo(
  () => {
    const { messages, isLoading } = useAgentState();
    const { containerRef, handleScroll, autoScroll, resetUserScrolling, isUserScrolling } = useAutoScroll();

    // 使用 useMemo 优化消息列表渲染
    const messageElements = useMemo(() => {
      return messages.map((message) => (
        <SingleMessage key={message.id} message={message} />
      ));
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
      return messages.filter(msg => msg.role === 'user').length;
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