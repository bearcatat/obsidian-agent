import { memo, useMemo, useEffect, cloneElement, useState, forwardRef, useRef, type ComponentPropsWithoutRef } from "react";
import { useAgentState } from "../../../../hooks/use-agent";
import { MessageV2 } from "@/types";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/ui/elements/collapsible";
import { Button } from "@/ui/elements/button";
import { cn } from "@/ui/elements/utils";
import { ChevronsUpDown } from "lucide-react";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";

const VirtuosoScroller = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<"div">>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "tw-box-border tw-flex-1 tw-select-text tw-overflow-x-hidden tw-break-words tw-text-[calc(var(--font-text-size)_-_2px)]",
          className,
        )}
        {...props}
      />
    );
  },
);

VirtuosoScroller.displayName = "VirtuosoScroller";

const VirtuosoList = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<"div">>(
  ({ className, ...props }, ref) => {
    return <div ref={ref} className={cn("tw-flex tw-flex-col tw-gap-1 tw-px-1", className)} {...props} />;
  },
);

VirtuosoList.displayName = "VirtuosoList";

const VirtuosoItem = ({ className, ...props }: ComponentPropsWithoutRef<"div">) => {
  return <div className={cn("tw-w-full", className)} {...props} />;
};

const virtuosoComponents = {
  Scroller: VirtuosoScroller,
  List: VirtuosoList,
  Item: VirtuosoItem,
};

export const Messages = memo(
  () => {
    const { messages, isLoading } = useAgentState();
    const virtuosoRef = useRef<VirtuosoHandle>(null);
    const isAtBottomRef = useRef(true);
    const previousUserMessagesCountRef = useRef(0);

    const initialTopMostItemIndex = useMemo(() => {
      if (messages.length === 0) {
        return undefined;
      }

      return {
        index: messages.length - 1,
        align: "end" as const,
      };
    }, [messages.length]);

    // 检测是否有流式消息正在生成
    const isStreaming = useMemo(() => {
      const hasStreamingMessage = messages.some(message => message.isStreaming);
      return hasStreamingMessage || isLoading;
    }, [messages, isLoading]);

    // 监听用户消息数量变化，新用户消息时恢复自动滚动
    const userMessagesCount = useMemo(() => {
      return messages.filter((msg): msg is MessageV2 => 'role' in msg && msg.role === 'user').length;
    }, [messages]);

    useEffect(() => {
      if (userMessagesCount > previousUserMessagesCountRef.current && messages.length > 0) {
        isAtBottomRef.current = true;
        virtuosoRef.current?.scrollToIndex({
          index: messages.length - 1,
          align: "end",
          behavior: "auto",
        });
      }

      previousUserMessagesCountRef.current = userMessagesCount;
    }, [messages.length, userMessagesCount]);

    return (
      <div className="tw-flex tw-h-full tw-flex-1 tw-flex-col tw-overflow-hidden">
        <Virtuoso
          ref={virtuosoRef}
          data={messages}
          className="tw-w-full tw-flex-1"
          style={{ height: "100%" }}
          components={virtuosoComponents}
          atBottomThreshold={100}
          initialTopMostItemIndex={initialTopMostItemIndex}
          followOutput={(isAtBottom) => {
            return isAtBottom ? "auto" : false;
          }}
          atBottomStateChange={(atBottom) => {
            isAtBottomRef.current = atBottom;
          }}
          totalListHeightChanged={() => {
            if (isStreaming && isAtBottomRef.current) {
              virtuosoRef.current?.autoscrollToBottom();
            }
          }}
          computeItemKey={(_, message) => message.id}
          itemContent={(_, message) => message.render()}
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
      <CollapsibleContent className="tw-text-muted tw-gap-1 tw-px-1 tw-rounded-sm tw-bg-primary tw-max-h-64 tw-overflow-y-auto">
        {messageElements}
      </CollapsibleContent>
    </Collapsible>
  )
})
