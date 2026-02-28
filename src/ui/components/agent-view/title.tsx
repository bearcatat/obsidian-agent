import { Button } from "../../elements/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../elements/tooltip";
import { Plus, History, Trash2 } from "lucide-react";
import { useAgentLogic, useAgentState } from "../../../hooks/use-agent";
import { useApp } from "../../../hooks/app-context";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../../elements/dialog";
import React, { useState, useEffect } from "react";
import { SessionLogic, SessionMetadata } from "@/logic/session-logic";
import { agentStore } from "@/state/agent-state-impl";

export interface TitleProps { }

export const Title: React.FC<TitleProps> = () => {
	const { title } = useAgentState();
	const { resetForNewChat } = useAgentLogic();
	const app = useApp();
	
	const [isHistoryOpen, setIsHistoryOpen] = useState(false);
	const [sessions, setSessions] = useState<SessionMetadata[]>([]);

	useEffect(() => {
		if (isHistoryOpen) {
			SessionLogic.getInstance().listSessions().then(setSessions);
		}
	}, [isHistoryOpen]);

	const handleLoadSession = async (sessionId: string) => {
		const state = await SessionLogic.getInstance().loadSession(sessionId);
		if (state) {
			// 将重构好的历史状态强制覆盖当前状态机，触发 UI 全面重新渲染
			agentStore.setState(state);
			setIsHistoryOpen(false);
		}
	};

	const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
		e.stopPropagation();
		await SessionLogic.getInstance().deleteSession(sessionId);
		setSessions(sessions.filter(s => s.id !== sessionId));
	};

	return (
		<div className="tw-flex tw-w-full tw-px-1 tw-items-center tw-justify-between">
			<div className="tw-flex tw-items-center tw-truncate tw-flex-1 tw-min-w-0">
				<span className="tx-text-normal tx-text-small tw-truncate tw-pr-2">{title}</span>
			</div>
			<div className="tw-flex tw-items-center tw-gap-1 tw-flex-shrink-0">
				<Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
					<Tooltip>
						<TooltipTrigger asChild>
							<DialogTrigger asChild>
								<Button variant="ghost2" size="icon">
									<History className="tw-w-4 tw-h-4" />
								</Button>
							</DialogTrigger>
						</TooltipTrigger>
						<TooltipContent side="bottom">Chat History</TooltipContent>
					</Tooltip>
					<DialogContent className="tw-max-h-[80vh] tw-flex tw-flex-col">
						<DialogHeader>
							<DialogTitle>Chat History</DialogTitle>
						</DialogHeader>
						<div className="tw-flex tw-flex-col tw-gap-2 tw-overflow-y-auto tw-flex-1 tw-min-h-0 tw-pr-2">
							{sessions.length === 0 ? (
								<div className="tw-text-center tw-text-muted tw-py-4">No history found</div>
							) : (
								sessions.map(session => (
									<div 
										key={session.id} 
										className="tw-flex tw-items-center tw-justify-between tw-p-3 tw-rounded-md tw-border tw-border-border hover:tw-bg-secondary tw-cursor-pointer tw-transition-colors"
										onClick={() => handleLoadSession(session.id)}
									>
										<div className="tw-flex tw-flex-col tw-truncate tw-pr-2">
											<span className="tw-font-medium tw-truncate">{session.title}</span>
											<span className="tw-text-xs tw-text-muted">
												{new Date(session.updatedAt).toLocaleString()}
											</span>
										</div>
										<Button 
											variant="ghost2" 
											size="icon" 
											className="tw-text-error hover:tw-text-error/80 tw-flex-shrink-0"
											onClick={(e) => handleDeleteSession(e, session.id)}
										>
											<Trash2 className="tw-w-4 tw-h-4" />
										</Button>
									</div>
								))
							)}
						</div>
					</DialogContent>
				</Dialog>

				<Tooltip>
					<TooltipTrigger asChild>
						<Button variant="ghost2" size="icon" onClick={() => resetForNewChat(app)}>
							<Plus className="tw-w-4 tw-h-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent side="bottom">New Chat</TooltipContent>
				</Tooltip>
			</div>
		</div>
	);
};
