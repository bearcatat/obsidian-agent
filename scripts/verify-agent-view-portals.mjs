import { readFileSync } from 'node:fs';
import path from 'node:path';

const source = readFileSync(path.join(process.cwd(), 'src/ui/components/agent-view/agent-view.tsx'), 'utf8');

for (const required of [
  'PortalContainerProvider',
  'const portalContainer = container.ownerDocument.body;',
  '<PortalContainerProvider container={portalContainer}>',
]) {
  if (!source.includes(required)) throw new Error(`AgentView portal ownership is missing ${required}`);
}

if (source.includes('activeDocument')) {
  throw new Error('AgentView must not select a portal through global activeDocument');
}

console.log('AgentView portal ownership checks passed');
