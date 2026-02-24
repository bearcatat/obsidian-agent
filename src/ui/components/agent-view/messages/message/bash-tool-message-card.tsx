import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/ui/elements/collapsible";
import { Button } from "@/ui/elements/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/ui/elements/dropdown-menu";
import React from "react";
import { BashCommand } from "@/types";
import { ChevronsUpDown, Check, X, Terminal, AlertTriangle, ChevronDown } from "lucide-react";

type Decision = "apply" | "reject" | "allow" | "deny" | null;

type Props = {
    origin_answered_state: boolean;
    bashCommand: BashCommand;
    decision: Decision;
    onApply?: () => void;
    onReject?: () => void;
    onAlwaysAllow?: () => void;
    onAlwaysDeny?: () => void;
}

export const BashToolMessageCard = ({ origin_answered_state, bashCommand, decision, onApply, onReject, onAlwaysAllow, onAlwaysDeny }: Props) => {
    const [isOpen, setIsOpen] = React.useState(!origin_answered_state);
    const [isAnswered, setIsAnswered] = React.useState(origin_answered_state);
    const [isRememberDropdownOpen, setIsRememberDropdownOpen] = React.useState(false);

    const handleApply = () => {
        setIsOpen(false);
        onApply?.();
        setIsAnswered(true);
    };

    const handleReject = () => {
        setIsOpen(false);
        onReject?.();
        setIsAnswered(true);
    };

    const handleAlwaysAllow = () => {
        setIsOpen(false);
        onAlwaysAllow?.();
        setIsAnswered(true);
    };

    const handleAlwaysDeny = () => {
        setIsOpen(false);
        onAlwaysDeny?.();
        setIsAnswered(true);
    };

    const getStatusText = () => {
        if (isAnswered) {
            if (decision === "apply" || decision === "allow") {
                return bashCommand.exitCode === 0 ? "执行成功" : "执行失败";
            }
            if (decision === "deny") {
                return "已拒绝(记住)";
            }
            return decision === "reject" ? "已拒绝" : "已处理";
        }
        return "待确认";
    };

    const isDangerous = React.useMemo(() => {
        const cmd = bashCommand.command.toLowerCase();
        return cmd.includes('rm') || cmd.includes('del') || cmd.includes('format') || cmd.includes('shutdown') || cmd.includes('reboot');
    }, [bashCommand.command]);

    return (
        <Collapsible
            open={isOpen}
            onOpenChange={setIsOpen}
            className="tw-w-full tw-rounded-md tw-border tw-border-solid tw-border-border tw-py-1"
        >
            <div className="tw-flex tw-items-center tw-justify-between tw-px-2 tw-py-0">
                <div className="tw-flex tw-items-center tw-gap-2">
                    <Terminal className="tw-size-4 tw-text-muted-foreground" />
                    <span>{getStatusText()}:</span>
                    <span className="tw-font-mono tw-text-sm">{bashCommand.workingDirectory || "/"}</span>
                    {isDangerous && (
                        <AlertTriangle className="tw-size-4 tw-text-orange-500" />
                    )}
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
                <div className="tw-w-full tw-mt-2 tw-rounded tw-border tw-border-border tw-overflow-hidden">
                    <div className="tw-font-mono tw-text-sm tw-leading-relaxed tw-max-h-64 tw-overflow-y-auto">
                        <div className="tw-flex tw-items-start">
                            <span className="tw-select-none tw-px-2 tw-py-1 tw-min-w-[2rem] tw-text-center tw-text-green-400">
                                $
                            </span>
                            <span className="tw-flex-1 tw-py-1 tw-pr-2 tw-text-gray-100 tw-whitespace-pre-wrap">
                                {bashCommand.command}
                            </span>
                        </div>
                    </div>
                </div>

                {bashCommand.output && (
                    <div className="tw-w-full tw-mt-2 tw-rounded tw-border tw-border-border tw-overflow-hidden">
                        <div className="tw-font-mono tw-text-xs tw-leading-relaxed tw-max-h-48 tw-overflow-y-auto">
                            <pre className="tw-p-2 tw-text-gray-300 tw-whitespace-pre-wrap tw-break-all">
                                {bashCommand.output}
                            </pre>
                        </div>
                    </div>
                )}

                {bashCommand.error && bashCommand.error !== 'User rejected' && (
                    <div className="tw-w-full tw-mt-2 tw-rounded tw-border tw-border-border tw-overflow-hidden tw-bg-red-900/10 dark:tw-bg-red-900/20">
                        <div className="tw-font-mono tw-text-xs tw-leading-relaxed tw-max-h-32 tw-overflow-y-auto">
                            <pre className="tw-p-2 tw-text-red-400 tw-whitespace-pre-wrap">
                                {bashCommand.error}
                            </pre>
                        </div>
                    </div>
                )}

                {bashCommand.exitCode !== undefined && bashCommand.exitCode !== null && (
                    <div className="tw-mt-2 tw-text-sm">
                        <span className={bashCommand.exitCode === 0 ? "tw-text-green-500" : "tw-text-red-500"}>
                            Exit code: {bashCommand.exitCode}
                        </span>
                    </div>
                )}

                {!isAnswered && (
                    <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-2 tw-mt-2 tw-px-2">
                        <Button 
                            variant="ghost" 
                            size="fit" 
                            className="tw-text-green-600 dark:tw-text-green-400 hover:tw-bg-green-50 dark:hover:tw-bg-green-900/20" 
                            onClick={handleApply}
                        >
                            <Check className="tw-size-4 tw-mr-1" />
                            执行
                        </Button>
                        <Button 
                            variant="ghost" 
                            size="fit" 
                            className="tw-text-red-600 dark:tw-text-red-400 hover:tw-bg-red-50 dark:hover:tw-bg-red-900/20" 
                            onClick={handleReject}
                        >
                            <X className="tw-size-4 tw-mr-1" />
                            拒绝
                        </Button>
                        <div className="tw-w-px tw-h-6 tw-bg-border" />
                        <DropdownMenu open={isRememberDropdownOpen} onOpenChange={setIsRememberDropdownOpen}>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost2" size="fit">
                                    记住...
                                    <ChevronDown className="tw-mt-0.5 tw-size-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                                <DropdownMenuItem onSelect={() => { setIsRememberDropdownOpen(false); handleAlwaysAllow(); }}>
                                    允许并记住
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => { setIsRememberDropdownOpen(false); handleAlwaysDeny(); }}>
                                    拒绝并记住
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                )}
            </CollapsibleContent>
        </Collapsible>
    );
};
