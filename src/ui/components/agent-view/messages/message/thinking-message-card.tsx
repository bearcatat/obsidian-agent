import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/ui/elements/collapsible";
import { Button } from "@/ui/elements/button";
import { AssistantMessageCard } from "./assistant-message-card";
import React, { useState, useEffect } from "react";
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

    return (
        <Collapsible
            open={isOpen}
            onOpenChange={setIsOpen}
            className="tw-flex-col tw-group tw-flex tw-rounded-md tw-p-1 tw-border tw-border-solid tw-border-border"
        >
            <div className="tw-flex tw-items-center tw-justify-between tw-px-2 tw-text-sm">
                <div className="tw-text-muted tw-text-xs">
                    💭 Thinking
                </div>
                <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-8">
                        <ChevronsUpDown className="tw-size-4" />
                    </Button>
                </CollapsibleTrigger>
            </div>
            <CollapsibleContent className="tw-text-muted tw-p-1 tw-rounded-sm tw-bg-primary tw-max-h-64 tw-overflow-y-auto">
                <AssistantMessageCard content={content} />
            </CollapsibleContent>
        </Collapsible>
    );
};