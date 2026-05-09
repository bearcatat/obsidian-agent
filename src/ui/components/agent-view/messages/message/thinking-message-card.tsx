import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/ui/elements/collapsible";
import { Button } from "@/ui/elements/button";
import { MessageV2 } from "@/types";
import { AssistantMessageCard } from "./assistant-message-card";
import { NestedMessagesList } from "../nested-messages-list";
import { useState, useEffect, useMemo } from "react";
import { ChevronsUpDown } from "lucide-react";

type Props = {
    content: string;
    isStreaming: boolean;
};

export const ThinkingMessageCard = ({ content, isStreaming }: Props) => {
    const [isOpen, setIsOpen] = useState(isStreaming);

    useEffect(() => {
        setIsOpen(isStreaming);
    }, [isStreaming]);

    const thinkingMessages = useMemo<MessageV2[]>(() => {
        return [{
            id: "thinking-message-card",
            role: "thinking",
            isStreaming,
            content,
            render: () => <AssistantMessageCard content={content} />,
        }];
    }, [content, isStreaming]);

    return (
        <Collapsible
            open={isOpen}
            onOpenChange={setIsOpen}
            className="tw-flex-col tw-group tw-flex tw-rounded-md tw-py-1 tw-border tw-border-solid tw-border-border"
        >
            <div className="tw-flex tw-items-center tw-justify-between tw-px-2 tw-text-sm">
                <div className="tw-text-muted tw-text-xs">
                    💭 Thinking
                </div>
                <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="icon" className="tw-size-8">
                        <ChevronsUpDown className="tw-size-4" />
                    </Button>
                </CollapsibleTrigger>
            </div>
            <CollapsibleContent className="tw-text-muted tw-rounded-sm tw-bg-primary tw-overflow-hidden">
                <NestedMessagesList
                    messages={thinkingMessages}
                    isOpen={isOpen}
                    isStreaming={isStreaming}
                />
            </CollapsibleContent>
        </Collapsible>
    );
};
