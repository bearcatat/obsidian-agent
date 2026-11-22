import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const labels = {
  'settings:officialProviders': 'Official Providers', 'settings:chatModels': 'Chat Models',
  'settings:officialSource': 'Official preset', 'settings:userSource': 'User-defined',
  'settings:deepseekOfficial': 'DeepSeek', 'settings:secretStored': 'Saved in Keychain',
  'settings:deepseekApiKeyPlaceholder': 'DeepSeek API key', 'settings:officialSecretDescription': 'Stored securely',
  'settings:changeOfficialKey': 'Change', 'settings:customBaseUrl': 'Custom Base URL',
  'settings:customConnectionHint': 'Choose a Keychain key for this address.',
  'settings:officialConnectionHint': 'Uses the provider official address and shared key.',
  'settings:officialConnectionKeyMissingHint': 'Save a key in provider settings.',
  'settings:customConnectionSecret': 'Keychain key', 'settings:selectExistingSecret': 'Select an existing key',
  'settings:createNewSecret': 'Create a new key…', 'settings:newSecretName': 'New key name',
  'settings:newSecretNamePlaceholder': 'for example: work-proxy', 'settings:newSecretValue': 'Key value',
  'settings:legacyApiKeyDescription': 'This model uses a legacy key.', 'settings:addModel': 'Add Model',
  'settings:updateModel': 'Update Model', 'settings:addModelDescription': 'Add a new model.',
  'settings:updateModelDescription': 'Update an existing model.', 'settings:addCustomModel': 'Add Custom Model',
  'settings:modelSettings': 'Model Settings', 'settings:defaultAgentModel': 'Default Agent Model',
  'settings:titleGenerationModel': 'Title Generation Model', 'settings:imageAnalysisModel': 'Image Analysis Model',
  'settings:automaticallyCompactContext': 'Automatically compact context', 'settings:autoCompactionDescription': 'Auto compact description',
  'settings:firstAvailableModel': 'First available model', 'settings:defaultAgentModelFallback': 'Default agent model',
  'settings:noModelConfigured': 'No model configured', 'settings:provider': 'Provider',
  'settings:modelId': 'Display name', 'settings:modelName': 'Model name', 'settings:baseUrl': 'Custom URL',
  'settings:contextWindow': 'Context Window', 'settings:unknown': 'Unknown', 'settings:saveModel': 'Save Model',
  'common:id': 'ID', 'common:name': 'Name', 'common:actions': 'Actions', 'common:move': 'Move',
  'common:edit': 'Edit', 'common:delete': 'Delete', 'common:save': 'Save', 'common:clear': 'Clear',
  'common:selectModel': 'Select Model', 'agent:noModelsOpenSettings': 'No models are available. Open settings.',
  'agent:userModels': 'Customize', 'agent:officialPresets': 'Official presets',
};

const mock = {
  'obsidian': 'export class Notice { constructor() {} }',
  '@/i18n': `export const t=(key, options={})=>key === 'agent:vaultRagHistoryResults' ? String(options.count ?? '') + ' results' : (${JSON.stringify(labels)})[key] ?? key; export const formatDateTime=String; export const formatNumber=String; export const getErrorMessage=String;`,
  '../../../../i18n': `export const t=(key, options={})=>key === 'agent:vaultRagHistoryResults' ? String(options.count ?? '') + ' results' : (${JSON.stringify(labels)})[key] ?? key; export const formatDateTime=String; export const formatNumber=String;`,
  '@/hooks/use-settings': `export const useSettingsState=()=>globalThis.__modelUiState; export const useSettingsLogic=()=>globalThis.__modelUiLogic;`,
  '../../../../hooks/use-settings': `export const useSettingsState=()=>globalThis.__modelUiState; export const useSettingsLogic=()=>globalThis.__modelUiLogic;`,
  '@/hooks/TabContext': `export const useTab=()=>({modalContainer:null});`,
  '@/hooks/use-agent': `export const useAgentState=()=>globalThis.__agentUiState; export const useAgentLogic=()=>({setModel:()=>{},setBashApprovalMode:()=>{},retryContextCompaction:()=>{},stopLoading:()=>{}});`,
  '@model-ui-test/agent': `export const useAgentState=()=>globalThis.__agentUiState; export const useAgentLogic=()=>({setModel:()=>{},setBashApprovalMode:()=>{},retryContextCompaction:()=>{},stopLoading:()=>{}});`,
  '../../../../hooks/use-agent': `export const useAgentState=()=>globalThis.__agentUiState; export const useAgentLogic=()=>({setModel:()=>{},setBashApprovalMode:()=>{},retryContextCompaction:()=>{},stopLoading:()=>{}});`,
  '@/hooks/app-context': `export const useApp=()=>({setting:{open(){},openTabById(){}}});`,
  '@model-ui-test/app': `export const useApp=()=>({setting:{open(){},openTabById(){}}});`,
  '@model-ui-test/settings': `export const useSettingsState=()=>globalThis.__modelUiState; export const useSettingsLogic=()=>globalThis.__modelUiLogic;`,
  '@model-ui-test/i18n': `export const t=(key, options={})=>key === 'agent:vaultRagHistoryResults' ? String(options.count ?? '') + ' results' : (${JSON.stringify(labels)})[key] ?? key; export const formatDateTime=String; export const formatNumber=String;`,
  '@model-ui-test/bash': `export const isBashHostPlatformSupported=()=>false;`,
  '@model-ui-test/bash-menu': `export const BashApprovalModeDropdown=()=>null;`,
  '@model-ui-test/settings-logic': `export const SettingsLogic={getInstance:()=>globalThis.__modelUiLogic};`,
  '@model-ui-test/dropdown': `import React from 'react'; const wrap=(tag)=>({children,asChild,...p})=>React.createElement(tag,p,children); export const DropdownMenu=wrap('div'); export const DropdownMenuContent=wrap('div'); export const DropdownMenuItem=wrap('button'); export const DropdownMenuSub=wrap('div'); export const DropdownMenuSubContent=wrap('div'); export const DropdownMenuSubTrigger=wrap('button'); export const DropdownMenuTrigger=wrap('div');`,
  '@model-ui-test/tooltip': `import React from 'react'; const wrap=(tag)=>({children,asChild,delayDuration,...p})=>React.createElement(tag,p,children); export const Tooltip=wrap('span'); export const TooltipContent=wrap('span'); export const TooltipProvider=wrap('span'); export const TooltipTrigger=wrap('span');`,
  '../../../../hooks/app-context': `export const useApp=()=>({setting:{open(){},openTabById(){}}});`,
  '@/tool/Bash/execute-command': `export const isBashHostPlatformSupported=()=>false;`,
  './bash-approval-mode-dropdown': `export const BashApprovalModeDropdown=()=>null;`,
  '@dnd-kit/core': `import React from 'react'; export const DndContext=({children})=>React.createElement(React.Fragment,null,children); export const closestCenter=()=>null; export const KeyboardSensor=class {}; export const PointerSensor=class {}; export const useSensor=()=>({}); export const useSensors=(...s)=>s;`,
  '@dnd-kit/sortable': `import React from 'react'; export const SortableContext=({children})=>React.createElement(React.Fragment,null,children); export const verticalListSortingStrategy={}; export const sortableKeyboardCoordinates=()=>null; export const arrayMove=(items,from,to)=>{const copy=[...items]; copy.splice(to,0,copy.splice(from,1)[0]); return copy}; export const useSortable=()=>({attributes:{},listeners:{},setNodeRef:()=>{},transform:null,transition:'',isDragging:false});`,
  '@dnd-kit/utilities': `export const CSS={Transform:{toString:()=>''}};`,
  '@/ui/elements/dialog': `import React from 'react'; export const Dialog=({children})=>React.createElement('section',{'data-dialog':'true'},children); export const DialogContent=({children,...p})=>React.createElement('div',p,children); export const DialogHeader=({children})=>React.createElement('header',null,children); export const DialogTitle=({children})=>React.createElement('h2',null,children); export const DialogDescription=({children})=>React.createElement('p',null,children);`,
  '@/ui/elements/select': `import React from 'react'; export const Select=({children})=>React.createElement('div',{'data-select':'true'},children); export const SelectContent=({children})=>React.createElement('div',null,children); export const SelectItem=({children})=>React.createElement('div',null,children); export const SelectTrigger=({children})=>React.createElement('button',{type:'button'},children); export const SelectValue=({placeholder})=>React.createElement('span',null,placeholder);`,
  '@/ui/elements/dropdown-menu': `import React from 'react'; const wrap=(tag)=>({children,asChild,...p})=>React.createElement(tag,p,children); export const DropdownMenu=wrap('div'); export const DropdownMenuContent=wrap('div'); export const DropdownMenuItem=wrap('button'); export const DropdownMenuSub=wrap('div'); export const DropdownMenuSubContent=wrap('div'); export const DropdownMenuSubTrigger=wrap('button'); export const DropdownMenuTrigger=wrap('div');`,
  '@/ui/elements/tooltip': `import React from 'react'; const wrap=(tag)=>({children,asChild,delayDuration,...p})=>React.createElement(tag,p,children); export const Tooltip=wrap('span'); export const TooltipContent=wrap('span'); export const TooltipProvider=wrap('span'); export const TooltipTrigger=wrap('span');`,
};

const plugin = {
  name: 'model-ui-render-mocks',
  setup(buildApi) {
    buildApi.onResolve({ filter: /.*/ }, (args) => {
      const path = args.path.replaceAll('\\', '/');
      if (path.endsWith('hooks/use-agent')) return { path: '@/hooks/use-agent', namespace: 'model-ui-render-mock' };
      if (path.endsWith('hooks/use-settings')) return { path: '@/hooks/use-settings', namespace: 'model-ui-render-mock' };
      if (path.endsWith('hooks/app-context')) return { path: '@/hooks/app-context', namespace: 'model-ui-render-mock' };
      if (path.endsWith('/i18n') || path === '@/i18n') return { path: '@/i18n', namespace: 'model-ui-render-mock' };
      return mock[args.path] ? ({ path: args.path, namespace: 'model-ui-render-mock' }) : null;
    });
    buildApi.onLoad({ filter: /.*/, namespace: 'model-ui-render-mock' }, (args) => ({ contents: mock[args.path], loader: 'tsx' }));
  },
};

const bundle = await build({
  stdin: { contents: `export { ModelSetting } from './src/ui/components/settings/tabs/model-setting'; export { ModelAddOrUpdateDialog } from './src/ui/components/settings/tabs/ModelAddOrUpdateDialog'; export { CommonModelConfig, NEW_SECRET_VALUE } from './src/ui/components/settings/tabs/ProviderModelConfig/CommonModelConfig';`, resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'cjs', platform: 'node', write: false, tsconfig: 'tsconfig.json', plugins: [plugin], external: ['react', 'react-dom', 'react-dom/server', 'lucide-react'],
});
const module = { exports: {} };
new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
const { ModelSetting, ModelAddOrUpdateDialog, CommonModelConfig, NEW_SECRET_VALUE } = module.exports;

const official = { id: 'official:deepseek:deepseek-flash', name: 'deepseek-flash', displayName: 'DeepSeek Flash', provider: 'deepseek', source: 'official', connectionMode: 'official' };
const user = { id: 'DeepSeek Flash', name: 'deepseek-flash', provider: 'deepseek', source: 'user', connectionMode: 'custom', baseUrl: 'https://proxy.example/v1', credentialRef: 'work-key' };
globalThis.__modelUiState = { models: [user], defaultAgentModel: official, defaultAgentModelVariant: 'high', titleModel: null, titleModelVariant: null, imageModel: null, imageModelVariant: null, autoContextCompaction: true, officialModelCatalog: { version: 1, provider: 'deepseek', models: [] }, builtinTools: [] };
globalThis.__modelUiLogic = { getOfficialModels: () => [official], setDeepSeekOfficialSecret: async () => {}, setDefaultAgentModel: async () => {}, setTitleModel: async () => {}, setImageModel: async () => {}, setAutoContextCompaction: async () => {}, addOrUpdateModel: async () => {}, removeModel: async () => {}, reorderModels: async () => {}, createCustomSecret: () => {}, listSecretIds: () => ['work-key'] };
globalThis.__agentUiState = { model: official, messages: [], variant: 'high', contextRuntimeState: { status: 'idle' }, contextCheckpoint: null, bashApprovalMode: 'ask', isLoading: false };

const settingsHtml = renderToStaticMarkup(React.createElement(ModelSetting));
assert.ok(settingsHtml.indexOf('Official Providers') < settingsHtml.indexOf('Chat Models'));
assert.match(settingsHtml, /DeepSeek/); assert.match(settingsHtml, /Saved in Keychain/);
const modelTable = settingsHtml.match(/<table\b[^>]*>[\s\S]*?<\/table>/)?.[0];
assert.ok(modelTable);
assert.doesNotMatch(modelTable, /official:deepseek:|Official preset/);
assert.match(modelTable, /DeepSeek Flash/);
assert.match(modelTable, /User-defined/);
assert.match(modelTable, /aria-label="Edit"/);
assert.doesNotMatch(settingsHtml, />Source</);
assert.match(settingsHtml, /Default Agent Model/);

const customHtml = renderToStaticMarkup(React.createElement(CommonModelConfig, { model: user, setModel: () => {}, dialogElement: null, secretIds: ['work-key'], secretChoice: NEW_SECRET_VALUE, setSecretChoice: () => {}, newSecretId: '', setNewSecretId: () => {}, newSecretValue: '', setNewSecretValue: () => {} }));
assert.match(customHtml, /Custom Base URL/); assert.match(customHtml, /Custom URL/); assert.match(customHtml, /Keychain key/); assert.match(customHtml, /New key name/); assert.match(customHtml, /Key value/);
const dialogHtml = renderToStaticMarkup(React.createElement(ModelAddOrUpdateDialog, { initialModel: { id: '', name: '', provider: 'deepseek', connectionMode: 'official' }, isUpdate: false, open: true, close: () => {} }));
assert.match(dialogHtml, /Add Model/); assert.match(dialogHtml, /Custom Base URL/); assert.doesNotMatch(dialogHtml, /Custom URL/);

const inputSource = (await readFile('src/ui/components/agent-view/input/buttom.tsx', 'utf8'))
  .replace('"../../../../hooks/use-agent"', '"@model-ui-test/agent"')
  .replace('"../../../../hooks/use-settings"', '"@model-ui-test/settings"')
  .replace('"@/hooks/app-context"', '"@model-ui-test/app"')
  .replace('"../../../../i18n"', '"@model-ui-test/i18n"')
  .replace("'@/tool/Bash/execute-command'", "'@model-ui-test/bash'")
  .replace("'./bash-approval-mode-dropdown'", "'@model-ui-test/bash-menu'")
  .replace("'@/logic/settings-logic'", "'@model-ui-test/settings-logic'")
  .replace('"../../../elements/dropdown-menu"', '"@model-ui-test/dropdown"')
  .replace('"../../../elements/tooltip"', '"@model-ui-test/tooltip"');
const inputBundle = await build({ stdin: { contents: inputSource, resolveDir: `${process.cwd()}/src/ui/components/agent-view/input`, loader: 'tsx' }, bundle: true, format: 'cjs', platform: 'node', write: false, tsconfig: 'tsconfig.json', plugins: [plugin], external: ['react', 'react-dom', 'react-dom/server', 'lucide-react'] });
const inputModule = { exports: {} };
new Function('require', 'module', 'exports', inputBundle.outputFiles[0].text)(createRequire(import.meta.url), inputModule, inputModule.exports);
const InputButtom = inputModule.exports.InputButtom;
const menuHtml = renderToStaticMarkup(React.createElement(InputButtom, { onSend: () => {} }));
const deepSeekHeading = menuHtml.match(/<div class="([^"]+)">DeepSeek<\/div>/);
const userHeading = menuHtml.match(/<div class="([^"]+)">Customize<\/div>/);
assert.ok(deepSeekHeading && userHeading);
assert.equal(userHeading[1], deepSeekHeading[1]);
assert.doesNotMatch(userHeading[1], /tw-border/);
assert.match(menuHtml, /deepseek/); assert.match(menuHtml, /DeepSeek Flash \| High/);
globalThis.__modelUiState = { ...globalThis.__modelUiState, models: [], officialModelCatalog: undefined };
globalThis.__modelUiLogic = { ...globalThis.__modelUiLogic, getOfficialModels: () => [] };
const emptyHtml = renderToStaticMarkup(React.createElement(InputButtom, { onSend: () => {} }));
assert.match(emptyHtml, /No models are available\. Open settings\./);

console.log('Rendered model settings, model table, connection dialog, chat groups, and empty-state checks passed.');
