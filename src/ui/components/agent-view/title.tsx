import React from "react";
import { useAgentState } from "../../../hooks/use-agent";

export const Title: React.FC = () => {
  const { title } = useAgentState();
  return (
    <div className="tw-flex tw-min-h-7 tw-w-full tw-items-start tw-px-2 tw-py-1">
      <span className="tx-text-normal tx-text-small tw-break-words">{title}</span>
    </div>
  );
};
