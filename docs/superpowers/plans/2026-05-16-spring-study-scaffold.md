# Spring Framework Study Notes Scaffold — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the directory structure and verify template readiness for the Spring study notes workflow.

**Architecture:** Module-based directory tree (core/aop/mvc/boot) with `.gitkeep` placeholders. No code—just filesystem scaffolding and template verification.

**Tech Stack:** Markdown files, git

---

### Task 1: Create module directory scaffolding

**Files:**
- Create: `core/01-ioc-container/.gitkeep`
- Create: `aop/.gitkeep`
- Create: `mvc/.gitkeep`
- Create: `boot/.gitkeep`

- [ ] **Step 1: Create all directories and .gitkeep files**

PowerShell:
```powershell
$dirs = @(
    "core/01-ioc-container",
    "aop",
    "mvc",
    "boot"
)
foreach ($d in $dirs) {
    New-Item -ItemType Directory -Force -Path $d | Out-Null
    New-Item -ItemType File -Force -Path "$d/.gitkeep" | Out-Null
}
```

- [ ] **Step 2: Verify directory structure**

PowerShell:
```powershell
Get-ChildItem -Recurse -Directory -Name | Sort-Object
```

Expected output:
```
aop
boot
core
core/01-ioc-container
docs
docs/superpowers
docs/superpowers/plans
docs/superpowers/specs
mvc
templates
```

- [ ] **Step 3: Commit scaffold**

```bash
git add core/ aop/ mvc/ boot/
git commit -m "feat: scaffold module directory structure

Create placeholder directories for core/ioc-container, aop, mvc, boot modules.
"
```

---

### Task 2: Verify template completeness

**Files:**
- Read: `templates/note-template.md`

- [ ] **Step 1: Confirm template matches spec**

Check that `templates/note-template.md` contains all five sections from the spec:
- `## 核心理解`
- `## 关键点`
- `## 句子解析`
- `## 术语表`
- Source URL placeholder at top

No action needed if template is correct. Template already committed in prior commit `2904243`.

---

### Task 3: Verify README accuracy

**Files:**
- Modify: `README.md` (if needed)

- [ ] **Step 1: Read README and verify it reflects the agreed design**

Check:
- Module directories listed match what was created
- Workflow description is accurate
- No stale references to discarded options (e.g., no mention of vocabulary.md)

Fix any discrepancies found.

- [ ] **Step 2: Commit any README fixes**

```bash
git add README.md
git commit -m "docs: update README to match final design"
```

Only if changes were made.
