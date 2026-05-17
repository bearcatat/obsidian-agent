import { ToolSet } from "ai";
import { ToolContext } from "./ToolContext";

export interface ToolProvider {
  getAllTools?(context: ToolContext): Promise<ToolSet> | ToolSet;
  getEnabledTools(context: ToolContext): Promise<ToolSet> | ToolSet;
  dispose?(): Promise<void> | void;
}
