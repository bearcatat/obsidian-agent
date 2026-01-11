import { cn } from "@/ui/elements/utils";

type Props = {
    has_border?: boolean;
    children: React.ReactNode;
}

export function MessageCard({ has_border=false, children }: Props) {
    return (
        <div className="tw-flex tw-w-full tw-flex-col">
            <div className={cn(
                "tw-group tw-flex tw-rounded-md tw-flex-col tw-p-1",
                has_border && "tw-border tw-border-solid tw-border-border"
            )}>
                {children}
            </div>
        </div>
    )
}