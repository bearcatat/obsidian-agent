import { Button } from "../../elements/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../elements/tooltip";
import { Plus } from "lucide-react";
import { useAgentLogic, useAgentState } from "../../../hooks/use-agent";
import { useApp } from "../../../hooks/app-context";

export interface TitleProps { }

export const Title: React.FC<TitleProps> = () => {
	const { title } = useAgentState();
	const { resetForNewChat } = useAgentLogic();
	const app = useApp();
	return (
		<div className="tw-flex tw-w-full tw-px-1 tw-items-center tw-justify-between">
			<div className="tw-flex tw-items-center">
				<span className="tx-text-normal tx-text-small">{title}</span>
			</div>
			<div className="tw-flex tw-items-center">
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
