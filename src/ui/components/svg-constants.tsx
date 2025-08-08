import React from 'react';

// SVG图标常量定义
export const SVG_ICONS = {
	OBSIDIAN_AGENT: {
		viewBox: "0 0 100 100",
		content: `
			<!-- 外部对话框形状 -->
			<rect x="10" y="20" width="80" height="60" rx="10" ry="10" fill="none" stroke="currentColor" stroke-width="6"/>
			<!-- 天线 -->
			<circle cx="30" cy="10" r="4" fill="currentColor"/>
			<line x1="30" y1="14" x2="30" y2="20" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
			<!-- 眼睛（微笑眼）-->
			<path d="M35,50 q5,-5 10,0" stroke="currentColor" stroke-width="4" fill="none" stroke-linecap="round"/>
			<path d="M55,50 q5,-5 10,0" stroke="currentColor" stroke-width="4" fill="none" stroke-linecap="round"/>
		`
	}
} as const;

// 生成完整的SVG字符串（用于Obsidian图标注册）
export const generateSvgString = (
	iconKey: keyof typeof SVG_ICONS,
	size: number = 100,
): string => {
	const icon = SVG_ICONS[iconKey];
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${icon.viewBox}">${icon.content}</svg>`;
};

// 生成React SVG元素
export const generateReactSvg = (
	iconKey: keyof typeof SVG_ICONS,
	size: number = 100,
	className: string = '',
): React.JSX.Element => {
	const icon = SVG_ICONS[iconKey];
	return (
		<svg 
			className={className}
			width={size} 
			height={size} 
			viewBox={icon.viewBox}
			xmlns="http://www.w3.org/2000/svg"
			dangerouslySetInnerHTML={{ __html: icon.content }}
		/>
	);
};
