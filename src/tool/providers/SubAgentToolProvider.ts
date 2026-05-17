import { ToolSet } from "ai";
import { ToolProvider } from "../ToolProvider";
import { ToolContext } from "../ToolContext";
import SubAgentManager from "../SubAgent/SubAgentManager";

export default class SubAgentToolProvider implements ToolProvider {
  constructor(private readonly manager: SubAgentManager) {}

  getEnabledTools(context: ToolContext): ToolSet {
    return this.manager.getEnabledTools(context.allTools);
  }
}
