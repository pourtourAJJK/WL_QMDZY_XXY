# 课程大作业：使用 Git 与 BMAD-Method 工作流完成项目

你现在正在做《未来技术》课程大作业。请严格遵守以下所有规则，这是大作业评分的核心依据，违反任何一条都会扣分或不及格。

---

## 一、BMAD-Method 四阶段工作流（必须完整走一遍）

按「需求分析 → 规划与设计 → 开发实现 → 验证与改进」顺序推进项目。每个阶段必须有**真实产物文件**保存到仓库，并创建**独立 Git 提交**。

### 1.1 产物目录结构（强制，任何迭代必须写入）

```
项目根目录/
├── _bmad-output/                    ← 所有 BMAD 产出只放这里，别散落根目录
│   ├── planning-artifacts/          ← 阶段一、二的产物
│   │   ├── product-brief.md         产品简报（bmad-product-brief）
│   │   ├── prd.md / spec.md         需求规格（bmad-prd / bmad-spec，二选一即可）
│   │   ├── architecture.md          技术架构（bmad-architecture）
│   │   └── epics-and-stories.md     任务拆分（bmad-create-epics-and-stories）
│   │
│   └── implementation-artifacts/    ← 阶段三、四的产物
│       ├── iteration-{N}.md         每次迭代独立写一个，不往 iteration-notes 里追加
│       ├── build-report.md          pnpm build / npm run build 的真实记录
│       ├── test-report.md           沙箱、E2E 测试、审查记录
│       └── code-review.md           （可选）代码审查产物
│
├── AGENTS.md                        ← 本文件（大作业规则）
├── src/ backend/ 等源码目录
├── package.json / requirements.txt
└── README.md
```

**绝对禁止**：产物文件散落在项目根目录、写到 `_bmad/` 安装目录里、或只留在聊天窗口里不提交。

### 1.2 每个阶段必须有独立 Git 提交

| 阶段 | 做了什么 | 提交信息（conventional commit 格式） |
|------|---------|--------------------------------------|
| 需求分析 | 产品简报 + PRD/SPEC | `docs: 完成产品简报与需求规格` |
| 规划与设计 | 架构设计 + 任务拆分 | `docs: 完成技术架构与任务拆分` |
| 开发实现 | 功能代码 + build 通过 | `feat: 完成 XXX 功能（对应任务清单里的哪几项）` |
| 验证与改进 | 沙箱/E2E + 修复 | `test: XXX 沙箱验证 N/N PASS` 或 `fix: 修复 XXX` |

**绝对禁止**：一次性提交所有产物和代码、提交信息写 "update" / "修改" / "作业" 等模糊字眼。

### 1.3 每次迭代写独立的 iteration-{N}.md

- **第一次迭代**（不管做什么）→ `iteration-1.md`
- **第二次迭代** → `iteration-2.md`
- 以此类推
- 每个文件独立成篇，不要往一个 `iteration-notes.md` 里追加写流水账
- 内容格式建议：改动说明 + 技术决策 + 构建/验证结果 + 已知局限

---

## 二、Git 规范（硬约束，不遵守 Git 项 30 分直接扣光）

### 2.1 分支（必须至少一次）

**每开发一个独立功能模块，必须建 feature 分支，做完合并回 main**：
```bash
git checkout -b feature/模块名          # 例：feature/avatar-upload

# ... 写代码 + BMAD 产物 ...
git add -A
git commit -m "feat: 完成 XXX 功能"     # conventional commit
git checkout main
git merge feature/模块名                 # 产生 merge commit 痕迹
git branch -d feature/模块名             # （可选）删除已合并分支
```

Git log 里必须能看到形如 `Merge branch 'feature/avatar-upload' into main` 的记录。

### 2.2 提交信息（conventional commit 格式，强制）

```
<type>: <简短描述>

feat:     新功能
fix:      修复 bug
docs:     文档 / BMAD 产物
refactor: 重构
test:     测试 / 沙箱验证
chore:    构建 / 配置 / 杂项
```

**错误示例（禁止）**：`update`、`修改`、`作业`、`第1版`、`v0.1`
**正确示例**：`docs: 完成产品简报`、`feat: 完成登录认证`、`fix: 修复头像上传 useRef 错误`

### 2.3 提交频率

- BMAD 每个阶段产物写完 → **立即 commit**
- 每实现完一个功能模块 → **立即 commit**
- 发现 bug 修完 → **立即 commit**
- 不要攒一堆改动一起提交

### 2.4 不得伪造历史

- 不得用 `git commit --amend` 改已推送到远端的提交
- 不得 `git rebase -i` 修改历史顺序或合并多人提交
- 不得复制他人仓库或 BMAD 产物
- 不得倒填日期

---

## 三、项目完成程度要求

- 围绕真实/合理需求，**不许做空壳**
- 至少有一条完整核心流程能**当场演示**（如：打开 → 操作 → 看到结果）
- 不能只装框架、只做静态页面
- README 写明项目用途和真实可用的启动方法

---

## 四、禁止行为（触发即不及格）

1. BMAD 产物散落在 `_bmad-output/` 以外的任何地方
2. 没有分支 + 合并痕迹
3. 提交信息全是 "update" / "作业" / 版本号
4. 最终一次性提交所有文件（看不出"需求→规划→实现→验证"过程）
5. 伪造提交历史（修改时间、rebase 改顺序）
6. 在仓库里提交密码、Token、密钥等敏感数据

---

## 五、评分标准（你要瞄准的目标）

| 考核项 | 分值 | 你要做到什么 |
|--------|------|-------------|
| **Git 使用与提交历史** | 30 | 仓库可访问；历史完整真实；提交说明清楚；**有分支+合并痕迹** |
| **BMAD-Method 工作流** | 45 | 四阶段真实产物在仓库里；**每阶段对应独立提交**；产物、代码、运行结果互相对应 |
| **项目功能与运行演示** | 15 | 核心流程能真实运行、可演示 |
| **项目补充说明** | 10 | 填写完整、路径清晰、提交哈希可直接核验 |

---

## 六、第一次对话 Checklist

新项目打开后，按以下顺序做：

1. ✅ `git init` 初始化仓库
2. ✅ 创建 `_bmad-output/planning-artifacts/` 和 `_bmad-output/implementation-artifacts/` 两个目录
3. ✅ 创建本文件 `AGENTS.md`（复制当前这份 prompt 内容）
4. ✅ 创建 `.gitignore`（排除 node_modules、__pycache__、.env、*.sqlite3、backend/media/ 等）
5. ✅ 用 BMAD Skill `bmad-product-brief` 开始**阶段一：需求分析**
6. ✅ 产物写入后立即 `git commit -m "docs: 完成产品简报"`
7. ✅ 进入阶段二：`bmad-spec` 或 `bmad-prd` + `bmad-architecture` + `bmad-create-epics-and-stories`
8. ✅ 阶段二产物写完 → `git commit -m "docs: 完成架构设计与任务拆分"`
9. ✅ 阶段三：建 feature 分支 → 逐个任务实现 → 每个功能 commit
10. ✅ 阶段四：沙箱/E2E 验证 → 修复 bug → 最终 commit
