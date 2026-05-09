import { MessageV2 } from "@/types";
import { memo, useEffect, useRef } from "react";

type Props = {
  messages: MessageV2[];
  isOpen: boolean;
  isStreaming: boolean;
}

export const NestedMessagesList = memo(({ messages, isOpen, isStreaming }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || !containerRef.current) {
      return;
    }

    const container = containerRef.current;
    const frame = requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });

    return () => cancelAnimationFrame(frame);
  }, [isOpen, isStreaming, messages]);

  return (
    <div
      ref={containerRef}
      className="obsidian-agent-hide-scrollbar tw-box-border tw-max-h-64 tw-w-full tw-select-text tw-overflow-x-hidden tw-overflow-y-auto tw-break-words tw-text-[calc(var(--font-text-size)_-_2px)]"
    >
      <div className="tw-flex tw-flex-col tw-gap-1 tw-px-1">
        {messages.map((message) => (
          <div key={message.id} className="tw-w-full">
            {message.render()}
          </div>
        ))}
      </div>
    </div>
  );
});

NestedMessagesList.displayName = "NestedMessagesList";
