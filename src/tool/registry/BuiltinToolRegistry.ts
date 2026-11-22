import { ToolSet } from "ai";
import { ReadNoteByPathTool, toolName as ReadNoteByPathToolName } from "../ReadNote/ReadNoteByPath/ReadNoteByPathTool";
import { ReadNoteByLinkTool, toolName as ReadNoteByLinkToolName } from "../ReadNote/ReadNoteByLink/ReadNoteByLinkTool";
import { QuestionTool, toolName as QuestionToolName } from "../Question/QuestionTool";
import { FileEditTool, toolName as FileEditToolName } from "../FileEdit/FileEditTool";
import { WriteTool, toolName as WriteToolName } from "../FileEdit/WriteTool";
import { MoveNoteTool, toolName as MoveNoteToolName } from "../MoveNote/MoveNoteTool";
import { WebFetchTool, toolName as WebFetchToolName } from "../WebFetch/WebFetchTool";
import { SearchTool, toolName as SearchToolName } from "../Search/SearchTool";
import { ListTool, toolName as ListToolName } from "../List/ListTool";
import { SkillTool, toolName as SkillToolName } from "../Skill/SkillTool";
import { BashTool, toolName as BashToolName } from "../Bash/BashTool";

export const BUILTIN_TOOL_REGISTRY: ToolSet = {
  [ReadNoteByPathToolName]: ReadNoteByPathTool,
  [ReadNoteByLinkToolName]: ReadNoteByLinkTool,
  [QuestionToolName]: QuestionTool,
  [FileEditToolName]: FileEditTool,
  [WriteToolName]: WriteTool,
  [MoveNoteToolName]: MoveNoteTool,
  [WebFetchToolName]: WebFetchTool,
  [SearchToolName]: SearchTool,
  [ListToolName]: ListTool,
  [SkillToolName]: SkillTool,
  [BashToolName]: BashTool,
};
