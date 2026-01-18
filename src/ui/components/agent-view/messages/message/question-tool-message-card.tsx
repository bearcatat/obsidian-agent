import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/ui/elements/collapsible";
import { Item, ItemActions, ItemContent, ItemDescription } from "@/ui/elements/item";
import { RadioGroup, RadioGroupItem } from "@/ui/elements/radio-group";
import { Label } from "@/ui/elements/label";
import { Button } from "@/ui/elements/button";
import React from "react";
import { Question } from "@/types";
import { ChevronsUpDown } from "lucide-react";

type Props = {
    origin_answered_state: boolean;
    question: Question;
    answer: string | null;
    onAnswer: (answer: string) => void;

}

export const QuestionToolMessageCard = ({ origin_answered_state, question, answer, onAnswer }: Props) => {
    const [isOpen, setIsOpen] = React.useState(!origin_answered_state)
    const [selected, setSelected] = React.useState<string | null>(answer);
    const [isAnswered, setIsAnswered] = React.useState(origin_answered_state);
    const handleSubmit = () => {
        if (!selected) {
            return;
        }
        setIsOpen(false);
        onAnswer(selected);
        setIsAnswered(true);
    }
    return (
        <Collapsible
            open={isOpen}
            onOpenChange={setIsOpen}
            className="tw-w-full tw-rounded-md tw-border tw-border-solid tw-border-border tw-py-1"
        >
            <div className="tw-flex tw-items-center tw-justify-between tw-px-2 tw-py-0">
                <div>{isAnswered ? "Answered" : "Question"}: {question.question}</div>
                {isAnswered && (
                    <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                            <ChevronsUpDown className="tw-size-4" />
                        </Button>
                    </CollapsibleTrigger>
                )}
            </div>
            <CollapsibleContent className="tw-flex tw-flex-col tw-w-full tw-px-1">
                <RadioGroup className="tw-flex tw-w-full tw-flex-col" onValueChange={setSelected}>
                    {question.options.map((option, index) => (
                        <QuestionOption key={index} option={option} option_id={question.id + "-" + index.toString()} checked={selected === option} isAnswered={isAnswered} />
                    ))}
                </RadioGroup>
                {!isAnswered && (
                    <div className="tw-flex tw-justify-start tw-mt-2 tw-px-2">
                        <Button variant="ghost" size="fit" className="tw-text-muted" onClick={handleSubmit}>
                            Submit
                        </Button>
                    </div>
                )}
            </CollapsibleContent>
        </Collapsible>
    )
}

const QuestionOption = ({ option, option_id, checked, isAnswered }: { option: string, option_id: string, checked: boolean, isAnswered: boolean }) => {
    return (
        <Item asChild variant="outline" size="sm2" className="tw-w-full">
            <Label htmlFor={option_id}>
                <ItemActions>
                    <RadioGroupItem className="tw-p-1" value={option} id={option_id} checked={checked} disabled={isAnswered} />
                </ItemActions>
                <ItemContent>
                    <ItemDescription>
                        {option}
                    </ItemDescription>
                </ItemContent>
            </Label>
        </Item>
    )
}