type Props = {
    children?: React.ReactNode;
};

export const ToolMessageCard = ({ children }: Props) => {
    return (
        <div className="tw-group tw-flex tw-w-full tw-flex-col tw-py-0">
            <div className="tw-break-words tw-text-[calc(var(--font-text-size)_-_4px)] tw-font-Thin">
                {children}
            </div>
        </div>
    )
};