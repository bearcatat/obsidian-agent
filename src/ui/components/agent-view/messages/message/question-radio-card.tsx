import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/ui/elements/collapsible";
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/ui/elements/item";
import { RadioGroup, RadioGroupItem } from "@/ui/elements/radio-group";
import { Label } from "@/ui/elements/label";
import { Button } from "@/ui/elements/button";
import { TransparentInput } from "@/ui/elements/input";
import React from "react";
import { Question, QuestionOption } from "@/types";
import { ChevronsUpDown } from "lucide-react";

type Props = {
    origin_answered_state: boolean;
    question: Question;
    answer: string | null;
    onAnswer: (answer: string[]) => void;
}

const CUSTOM_OPTION_VALUE = "__custom__";
const CUSTOM_ANSWER_PREFIX = "__custom_answer__:";
const CUSTOM_OPTION_ID_PREFIX = "custom-option-";

export const QuestionRadioCard = ({ origin_answered_state, question, answer, onAnswer }: Props) => {
    const [isOpen, setIsOpen] = React.useState(!origin_answered_state);
    const [selected, setSelected] = React.useState<string | null>(answer);
    const [customInput, setCustomInput] = React.useState("");
    const [isAnswered, setIsAnswered] = React.useState(origin_answered_state);
    const showCustom = question.custom !== false;

    React.useEffect(() => {
        if (answer !== undefined) {
            setSelected(answer);
            if (answer && answer.startsWith(CUSTOM_ANSWER_PREFIX)) {
                setCustomInput(answer.replace(CUSTOM_ANSWER_PREFIX, ""));
            }
        }
    }, [answer]);

    const handleOptionChange = (optionValue: string) => {
        if (isAnswered) return;
        setSelected(optionValue);
    };

    const handleSubmit = () => {
        if (!selected) return;

        let result: string[];
        if (selected === CUSTOM_OPTION_VALUE) {
            if (!customInput.trim()) return;
            result = [CUSTOM_ANSWER_PREFIX + customInput];
        } else {
            result = [selected];
        }

        setIsOpen(false);
        onAnswer(result);
        setIsAnswered(true);
    };

    const isCustomSelected = () => {
        if (!selected) return false;
        return selected.startsWith(CUSTOM_ANSWER_PREFIX) || selected === CUSTOM_OPTION_VALUE;
    };

    const getCustomAnswer = () => {
        if (selected?.startsWith(CUSTOM_ANSWER_PREFIX)) {
            return selected.replace(CUSTOM_ANSWER_PREFIX, "");
        }
        return customInput;
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
                <RadioGroup
                    value={isCustomSelected() ? CUSTOM_OPTION_VALUE : (selected ?? "")}
                    onValueChange={handleOptionChange}
                    className="tw-flex tw-w-full tw-flex-col"
                >
                    {question.options.map((option, index) => (
                        <RadioOption
                            key={index}
                            option={option}
                            option_id={`${question.id}-${index}`}
                            checked={selected === option.label}
                            disabled={isAnswered}
                        />
                    ))}
                    {showCustom && (!isAnswered || isAnswered && isCustomSelected()) && (
                        <CustomRadioOption
                            checked={isCustomSelected()}
                            disabled={isAnswered}
                            inputValue={getCustomAnswer()}
                            onInputChange={setCustomInput}
                            optionId={`${CUSTOM_OPTION_ID_PREFIX}${question.id}`}
                            handleOptionChange={handleOptionChange}
                        />
                    )}
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
    );
};

const RadioOption = ({
    option,
    option_id,
    checked,
    disabled,
}: {
    option: QuestionOption;
    option_id: string;
    checked: boolean;
    disabled: boolean;
}) => {
    return (
        <Item asChild variant="outline" size="sm2" className="tw-w-full">
            <Label htmlFor={option_id}>
                <ItemActions>
                    <RadioGroupItem
                        className="tw-p-1"
                        value={option.label}
                        id={option_id}
                        checked={checked}
                        disabled={disabled}
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
        </Item >
    );
};

const CustomRadioOption = ({
    checked,
    disabled,
    inputValue,
    onInputChange,
    optionId,
    handleOptionChange,
}: {
    checked: boolean;
    disabled: boolean;
    inputValue: string;
    onInputChange: (value: string) => void;
    optionId: string;
    handleOptionChange: (optionValue: string) => void
}) => {
    return (
        <Item asChild variant="outline" size="sm2" className="tw-w-full">
            <Label htmlFor={optionId} className="tw-w-full">
                <ItemActions>
                    <RadioGroupItem
                        className="tw-p-1"
                        value={CUSTOM_OPTION_VALUE}
                        id={optionId}
                        checked={checked}
                        disabled={disabled}
                    />
                </ItemActions>
                <ItemContent className="tw-w-full">
                    <TransparentInput
                        value={inputValue}
                        onChange={(e: { target: { value: string; }; }) => onInputChange(e.target.value)}
                        placeholder={"Type your own answer"}
                        readOnly={disabled}
                        onFocus={() => { !disabled && handleOptionChange(CUSTOM_OPTION_VALUE) }}
                        className="tw-text-sm"
                    />
                </ItemContent>
            </Label>
        </Item>
    );
};
