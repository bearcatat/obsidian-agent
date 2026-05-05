import { cn } from "@/ui/elements/utils";
import { MessageV2 } from "@/types";
import {
  memo,
  useEffect,
  useMemo,
  useRef,
  forwardRef,
  type ComponentPropsWithoutRef,
  type CSSProperties,
} from "react";
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

type VirtualMessagesListProps = {
  messages: MessageV2[];
  isStreaming: boolean;
  className?: string;
  style?: CSSProperties;
  scrollToLatestOnCountIncrease?: number;
}

export const VirtualMessagesList = memo(({
  messages,
  isStreaming,
  className,
  style,
  scrollToLatestOnCountIncrease,
}: VirtualMessagesListProps) => {
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const isAtBottomRef = useRef(true);
  const previousScrollToLatestCountRef = useRef(scrollToLatestOnCountIncrease);

  const initialTopMostItemIndex = useMemo(() => {
    if (messages.length === 0) {
      return undefined;
    }

    return {
      index: messages.length - 1,
      align: "end" as const,
    };
  }, [messages.length]);

  useEffect(() => {
    if (
      scrollToLatestOnCountIncrease !== undefined
      && scrollToLatestOnCountIncrease > (previousScrollToLatestCountRef.current ?? 0)
      && messages.length > 0
    ) {
      isAtBottomRef.current = true;
      virtuosoRef.current?.scrollToIndex({
        index: messages.length - 1,
        align: "end",
        behavior: "auto",
      });
    }

    previousScrollToLatestCountRef.current = scrollToLatestOnCountIncrease;
  }, [messages.length, scrollToLatestOnCountIncrease]);

  return (
    <Virtuoso
      ref={virtuosoRef}
      data={messages}
      className={className}
      style={style}
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
  );
});

VirtualMessagesList.displayName = "VirtualMessagesList";
