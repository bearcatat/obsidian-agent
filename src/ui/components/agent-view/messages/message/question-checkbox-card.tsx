import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/ui/elements/collapsible";
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/ui/elements/item";
import { Checkbox } from "@/ui/elements/checkbox";
import { Label } from "@/ui/elements/label";
import { Button } from "@/ui/elements/button";
import { TransparentInput } from "@/ui/elements/input";
import React from "react";
import { Question, QuestionOption } from "@/types";
import { ChevronsUpDown } from "lucide-react";

type Props = {
    origin_answered_state: boolean;
    question: Question;
    answer: string[] | null;
    onAnswer: (answer: string[]) => void;
}

const CUSTOM_OPTION_VALUE = "__custom__";
const CUSTOM_ANSWER_PREFIX = "__custom_answer__:";
const CUSTOM_OPTION_ID_PREFIX = "custom-option-";

export const QuestionCheckboxCard = ({ origin_answered_state, question, answer, onAnswer }: Props) => {
    const [isOpen, setIsOpen] = React.useState(!origin_answered_state);
    const [selected, setSelected] = React.useState<string[]>(answer || []);
    const [customInput, setCustomInput] = React.useState("");
    const [isAnswered, setIsAnswered] = React.useState(origin_answered_state);
    const showCustom = question.custom !== false;

    React.useEffect(() => {
        if (answer !== undefined) {
            setSelected(answer || []);
            const customAnswer = answer?.find(a => a.startsWith(CUSTOM_ANSWER_PREFIX));
            if (customAnswer) {
                setCustomInput(customAnswer.replace(CUSTOM_ANSWER_PREFIX, ""));
            }
        }
    }, [answer]);

    const handleOptionChange = (optionValue: string, checked: boolean) => {
        if (isAnswered) return;
        if (checked) {
            setSelected([...selected, optionValue]);
        } else {
            setSelected(selected.filter(s => s !== optionValue));
        }
    };

    const handleCustomChange = (checked: boolean) => {
        if (isAnswered) return;
        if (checked) {
            setSelected([...selected, CUSTOM_OPTION_VALUE]);
        } else {
            setSelected(selected.filter(s => s !== CUSTOM_OPTION_VALUE));
        }
    };

    const handleSubmit = () => {
        if (selected.length === 0) return;

        const result = selected.map(s => {
            if (s === CUSTOM_OPTION_VALUE) {
                if (!customInput.trim()) return null;
                return CUSTOM_ANSWER_PREFIX + customInput;
            }
            return s;
        }).filter((s): s is string => s !== null && s.trim() !== "");

        if (result.length === 0) return;

        setIsOpen(false);
        onAnswer(result);
        setIsAnswered(true);
    };

    const isOptionChecked = (optionValue: string) => {
        return selected.includes(optionValue);
    };

    const isCustomChecked = () => {
        return selected.some(s => s === CUSTOM_OPTION_VALUE || s.startsWith(CUSTOM_ANSWER_PREFIX));
    };

    const getCustomAnswer = () => {
        return selected.find(s => s.startsWith(CUSTOM_ANSWER_PREFIX))?.replace(CUSTOM_ANSWER_PREFIX, "") ?? customInput;
    };

    return (
        <Collapsible
            open={isOpen}
            onOpenChange={setIsOpen}
            className="tw-w-full tw-rounded-md tw-border tw-border-solid tw-border-border tw-py-1"
        >
            <div className="tw-flex tw-items-center tw-justify-between tw-px-2 tw-text-sm tw-py-1">
                <div>
                    {isAnswered ? "Answered" : "Question"}: {question.header ? `${question.header}: ` : ""}{question.question}
                </div>
                {isAnswered && (
                    <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                            <ChevronsUpDown className="tw-size-4" />
                        </Button>
                    </CollapsibleTrigger>
                )}
            </div>
            <CollapsibleContent className="tw-flex tw-flex-col tw-w-full tw-px-1">
                <div className="tw-flex tw-w-full tw-flex-col tw-gap-2">
                    {question.options.map((option, index) => (
                        <CheckboxOption
                            key={index}
                            option={option}
                            option_id={`${question.id}-${index}`}
                            checked={isOptionChecked(option.label)}
                            disabled={isAnswered}
                            onCheckedChange={(checked) => handleOptionChange(option.label, checked)}
                        />
                    ))}
                    {showCustom && (!isAnswered || isAnswered && isCustomChecked()) && (
                        <CustomCheckboxOption
                            checked={isCustomChecked()}
                            disabled={isAnswered}
                            inputValue={getCustomAnswer()}
                            onCheckedChange={handleCustomChange}
                            onInputChange={setCustomInput}
                            optionId={`${CUSTOM_OPTION_ID_PREFIX}${question.id}`}
                            handleOptionChange={handleOptionChange}
                        />
                    )}
                </div>
                {!isAnswered && (
                    <div className="tw-flex tw-justify-start tw-mt-2 tw-px-2">
                        <Button variant="ghost" size="fit" className="tw-text-muted" onClick={handleSubmit}>
                            Submit
                        </Button>
                    </div>
                )}
            </CollapsibleContent>
        </Collapsible>
    );
};

const CheckboxOption = ({
    option,
    option_id,
    checked,
    disabled,
    onCheckedChange,
}: {
    option: QuestionOption;
    option_id: string;
    checked: boolean;
    disabled: boolean;
    onCheckedChange: (checked: boolean) => void;
}) => {
    return (
        <Item asChild variant="outline" size="sm2" className="tw-w-full">
            <Label htmlFor={option_id}>
                <ItemActions>
                    <Checkbox
                        className="tw-p-1"
                        checked={checked}
                        onCheckedChange={onCheckedChange}
                        disabled={disabled}
                        id={option_id}
                    />
                </ItemActions>
                <ItemContent className="tw-p-1">
                    <ItemTitle>
                        <span className={checked ? "tw-font-medium" : ""}>{option.label}</span>
                    </ItemTitle>
                    {option.description && (
                        <ItemDescription className="tw-text-xs tw-text-muted-foreground tw-my-0">
                            {option.description}
                        </ItemDescription>
                    )}
                </ItemContent>
            </Label>
        </Item>
    );
};

const CustomCheckboxOption = ({
    checked,
    disabled,
    inputValue,
    onCheckedChange,
    onInputChange,
    optionId,
    handleOptionChange,
}: {
    checked: boolean;
    disabled: boolean;
    inputValue: string;
    onCheckedChange: (checked: boolean) => void;
    onInputChange: (value: string) => void;
    optionId: string;
    handleOptionChange: (optionValue: string, checked: boolean) => void
}) => {
    return (
        <Item asChild variant="outline" size="sm2" className="tw-w-full">
            <Label htmlFor={optionId} className="tw-w-full">
                <ItemActions>
                    <Checkbox
                        checked={checked}
                        onCheckedChange={onCheckedChange}
                        disabled={disabled}
                        id={optionId}
                    />
                </ItemActions>
                <ItemContent className="tw-w-full">
                    <TransparentInput
                        value={inputValue}
                        onChange={(e: { target: { value: string; }; }) => onInputChange(e.target.value)}
                        placeholder={"Type your own answer"}
                        readOnly={disabled}
                        onFocus={() => { !disabled && onCheckedChange(true) }}
                        className="tw-text-sm"
                    />
                </ItemContent>
            </Label>
        </Item>
    );
};
