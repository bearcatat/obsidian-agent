import React from "react";
import { Question } from "@/types";
import { QuestionRadioCard } from "./question-radio-card";
import { QuestionCheckboxCard } from "./question-checkbox-card";

type Props = {
    origin_answered_state: boolean;
    question: Question;
    answer: string | string[] | null;
    onAnswer: (answer: string[]) => void;
}

export const QuestionToolMessageCard = (props: Props) => {
    if (props.question.multiple) {
        const answer = Array.isArray(props.answer) ? props.answer : null;
        return <QuestionCheckboxCard {...props} answer={answer} />;
    }
    const answer = typeof props.answer === "string" ? props.answer : null;
    return <QuestionRadioCard {...props} answer={answer} />;
};
