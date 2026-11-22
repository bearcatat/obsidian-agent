import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const settings = await readFile('src/ui/components/settings/tabs/model-setting.tsx', 'utf8');
const table = await readFile('src/ui/components/settings/tabs/model-table.tsx', 'utf8');
const dialog = await readFile('src/ui/components/settings/tabs/ModelAddOrUpdateDialog.tsx', 'utf8');
const common = await readFile('src/ui/components/settings/tabs/ProviderModelConfig/CommonModelConfig.tsx', 'utf8');
const menu = await readFile('src/ui/components/agent-view/input/buttom.tsx', 'utf8');

// Mirrors the two approved HTML previews: provider row precedes table, source is
// a secondary label under Name, and custom connection fields remain conditional.
assert.ok(settings.indexOf("settings:officialProviders") < settings.indexOf("settings:chatModels"));
assert.match(settings, /hasDeepSeekKey && !isEditingDeepSeekKey/);
assert.match(table, /tw-text-\[10px\].*settings:userSource/s);
assert.doesNotMatch(table, /settings:officialSource/);
assert.doesNotMatch(table, /<TableHead>\{t\('settings:source'\)\}<\/TableHead>/);
assert.match(common, /settings:customBaseUrl/);
assert.match(common, /SettingSwitch/);
assert.match(common, /settings:selectExistingSecret/);
assert.match(common, /NEW_SECRET_VALUE/);
assert.match(dialog, /secretChoice === NEW_SECRET_VALUE/);
assert.match(menu, /settings:deepseekOfficial/);
assert.match(menu, /agent:userModels/);
assert.match(menu, /modelOption\.provider/);
assert.match(menu, /setIsModelDropdownOpen\(false\)/);
assert.match(menu, /tw-w-\[245px\]/);
console.log('Model settings and chat menu UI contract checks passed.');
