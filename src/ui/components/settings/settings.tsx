import { TabContent, TabItem, type TabItem as TabItemType } from "../../elements/tab";
import { Bot, Wrench, Terminal, Target, Users, ShieldCheck, Brain } from "lucide-react";
import { ModelSetting } from "./tabs/model-setting";
import { useTab } from "../../../hooks/TabContext";
import { ToolSetting } from "./tabs/tool-setting";
import { CommandSetting } from "./tabs/command-setting";
import { SkillSetting } from "./tabs/skill-setting";
import { SubAgentSetting } from "./tabs/subagent-setting";
import { RuleSetting } from "./tabs/rule-setting";
import { MemorySetting } from "./tabs/memory-setting";
import { useTranslation } from "../../../i18n/react";

const TAB_IDS = ["model","tool","command","skill","subagent","rule","memory"] as const;
type TabId = (typeof TAB_IDS)[number];

const icons: Record<TabId, React.ReactNode> = {
  model: <Bot className="tw-size-5" />,
  tool: <Wrench className="tw-size-5" />,
  command: <Terminal className="tw-size-5" />,
  skill: <Target className="tw-size-5" />,
  subagent: <Users className="tw-size-5" />,
  rule: <ShieldCheck className="tw-size-5" />,
  memory: <Brain className="tw-size-5" />,
};

const components: Record<TabId, React.FC> = {
  model: () => <ModelSetting />,
  tool: () => <ToolSetting />,
  command: () => <CommandSetting />,
  skill: () => <SkillSetting />,
  subagent: () => <SubAgentSetting />,
  rule: () => <RuleSetting />,
  memory: () => <MemorySetting />,
};

const tabLabelKeys: Record<TabId, string> = {
  model: 'models',
  tool: 'tool',
  command: 'command',
  skill: 'skill',
  subagent: 'subagent',
  rule: 'rule',
  memory: 'memory',
};

const SettingsContent: React.FC = () => {
  const { selectedTab, setSelectedTab } = useTab();
  const { t } = useTranslation("settings");
  const tabs: TabItemType[] = TAB_IDS.map((id) => ({
    id,
    icon: icons[id],
    label: t(tabLabelKeys[id]),
  }));

  return (
    <div className="tw-flex tw-min-w-0 tw-max-w-full tw-flex-col">
      <div className="tw-inline-flex tw-max-w-full tw-overflow-x-auto tw-rounded-lg">
        {tabs.map((tab, index) => (
          <TabItem
            key={tab.id}
            tab={tab}
            isSelected={selectedTab === tab.id}
            onClick={() => setSelectedTab(tab.id as TabId)}
            isFirst={index === 0}
            isLast={index === tabs.length - 1}
          />
        ))}
      </div>
      <div className="tw-w-full tw-border tw-border-solid" />

      <div className="tw-min-w-0 tw-max-w-full">
        {TAB_IDS.map((id) => {
          const Component = components[id];
          return (
            <TabContent key={id} id={id} isSelected={selectedTab === id}>
              <Component />
            </TabContent>
          );
        })}
      </div>
    </div>
  );
};

interface SettingsProps {
}

export const Settings: React.FC<SettingsProps> = () => {
  const { t } = useTranslation("settings");

  return (
    <div className="tw-min-w-0 tw-max-w-full tw-overflow-x-hidden">
      <div className="tw-flex tw-flex-col tw-gap-2">
        <h1 className="tw-flex tw-flex-col tw-gap-2 sm:tw-flex-row sm:tw-items-center sm:tw-justify-between">
          <div className="tw-flex tw-items-center tw-gap-2">
            <span>{t("agentSettings")}</span>
          </div>
        </h1>
      </div>
      <SettingsContent />
    </div>
  );
}
