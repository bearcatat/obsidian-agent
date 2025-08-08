import { addIcon } from 'obsidian';
import { generateSvgString } from './components/svg-constants';

export class IconManager {
	private static readonly ICON_NAME = 'obsidian-agent';

	static registerIcons(): void {
		// 使用SVG常量生成图标
		const iconHtml = generateSvgString('OBSIDIAN_AGENT', 100);
		addIcon(this.ICON_NAME, iconHtml);
	}

	static getIconName(): string {
		return this.ICON_NAME;
	}
}
