---
name: note-must-be-written-to-file
description: 处理 Spring 笔记时必须将内容写入 .md 文件并 git commit，严禁仅在对话框中输出
metadata:
  type: feedback
---

#1 规则：笔记内容必须落盘为 `.md` 文件，绝对不允许只在对话框里输出。

**Why:** 用户在 CLAUDE.md 中已明确写了 "MUST NOT DO: NEVER output the formatted note to the conversation dialog"，但新开对话时仍然出现不在文件里写、直接发对话框的问题。用户强调这不是可选项，是铁律。

**How to apply:** 每次处理 Spring 文档笔记时，必须用 Write 工具写入项目对应目录的 `.md` 文件，然后 git commit。最终回复只给文件路径 + 简短摘要，不给完整笔记内容。处理流程以 Write + git commit 收尾才算完成。
