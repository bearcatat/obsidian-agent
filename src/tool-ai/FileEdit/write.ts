export const DESCRIPTION = `这是一个用于创建或覆盖笔记的工具。

使用场景：
- 创建新笔记
- 覆盖现有笔记的全部内容

使用要求：
1. file_path：笔记路径（相对于 vault 根目录）
2. content：笔记完整内容

重要提示：
- 如果笔记已存在，会完全覆盖原内容
- 如果需要部分修改，请使用 editFile 工具

元数据保护：
- 不会自动添加或修改 YAML frontmatter
- 如需 frontmatter，请在 content 中自行包含
`
