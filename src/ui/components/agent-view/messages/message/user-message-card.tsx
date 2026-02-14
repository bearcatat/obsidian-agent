import { useRef } from "react";
import { InputEditor, InputEditorRef } from "../../input/InputEditor";
import { MessageCard } from "./message-card";

type Props = {
    content: string;
}

export function UserMessageCard({ content }: Props) {
    const editorRef = useRef<InputEditorRef>(null);

    return (
        <MessageCard has_border={true}>
            <InputEditor
                ref={editorRef}
                value={content}
                onChange={() => {}}
                disabled={true}
                className="tw-max-h-none"
            />
        </MessageCard>
    )
}
