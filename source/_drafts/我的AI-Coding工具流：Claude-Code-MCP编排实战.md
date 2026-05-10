---
title: 我的 AI Coding 工具流：Claude Code + MCP 编排实战
date: 2026-04-13 15:00:00
categories: '技术'
tags: ['AI', 'Claude Code', 'MCP', '工具流', '效率']
cover: https://blogr2.yiliang.app/2026/04/13/ai-coding-workflow-cover.png
summary: |
  <p>本文系统梳理了我基于 Claude Code 构建的 AI Coding 工具流：以第一性原理驱动工具路由，通过 MCP 服务器编排 context7、Codex、Gemini、Cloudflare、browsermcp 等十余个专项能力，形成"直接执行 + 深度交互"的协作模式。文中包含工具选择决策树、典型场景示例，以及对"AI 辅助 vs AI 替代"边界的思考。</p>
---

> "工具不是目的，思维方式才是护城河。"

过去几个月，我把 AI Coding 的使用方式从"偶尔问问 ChatGPT"彻底重构成了一套可复用的**工具流体系**。核心载体是 [Claude Code](https://claude.ai/code)——Anthropic 的官方 CLI——以及围绕它编排的一组 MCP（Model Context Protocol）服务器和技能插件。

这篇文章不是工具评测，而是**工程实践记录**：我是怎么设计这套流程的，每个工具在什么场景触发，以及踩过哪些坑。

---

## 一、为什么需要"工具流"而不是"一个大模型"

最初的使用模式很简单：遇到问题 → 粘贴代码 → 等回答。这在简单场景下够用，但很快暴露出几个问题：

1. **上下文污染**：一个 8k token 的对话塞满后，模型开始"失忆"
2. **能力错配**：让同一个模型又查文档、又写代码、又截图验 UI，每件事都做得平庸
3. **无法复现**：今天的对话明天消失，没有任何沉淀

解法是**专职化 + 编排**：每个 MCP 工具只做一件事，由 Claude Code 作为"主脑"负责路由和综合。

---

## 二、工具矩阵全景

按触发方式分两层：

### 2a. Skill 插件（`/skill` 命令触发）

这些是封装好的复合能力，一条命令启动一个完整工作流：

| 场景 | Skill | 典型用法 |
|------|-------|---------|
| 需求模糊 / 前端原型 / UI 规划 | `/mcp-gemini` | "帮我澄清这个功能的边界，然后出一个 React 原型" |
| 代码原型 / Review / 后端二次诊断 | `/mcp-codex` | "review 这段 Rust 的生命周期管理，给出 unified diff" |
| 已认证页面自动化 / E2E 测试 | `/mcp-browser` | "登录后台，截图验证部署结果" |
| 图像生成 / 博客封面 / 图标 | `/nano-banana` | "生成这篇文章的封面，科技感蓝紫色调" |
| Cloudflare Workers / Pages / KV | `/cloudflare:cloudflare` | "把这个 Worker 部署到 Cloudflare，配好 KV 绑定" |
| 社交平台操作 | `/opencli` | "把这篇博客摘要发到 Twitter" |

### 2b. MCP Server（直接调用工具函数）

无需 `/skill`，Claude Code 根据上下文自动路由：

| 场景 | MCP Server | 我的使用频率 |
|------|-----------|------------|
| 第三方库文档（React、Prisma、Hexo…） | `context7` | ★★★★★ 最高频 |
| 跨文件语义搜索 | `augment-context-engine` | ★★★★ |
| 网页搜索 / 全文抓取 | `exa` | ★★★★ |
| Cloudflare API 执行 | `cloudflare-api` | ★★★ |
| Workers 构建 CI/CD 日志 | `cloudflare-builds` | ★★★ |
| Workers 日志 / 可观测性 | `cloudflare-observability` | ★★ |
| Gmail / Google Calendar | `claude_ai_Gmail` | ★★ |
| 无登态页面截图 / DOM 操作 | `playwright` | ★★★ |

---

## 三、核心决策树：代码探索怎么走

这是我踩坑最多的地方——一开始总是无脑 `grep`，结果把 8k token 的上下文全填满了无关代码。

现在的决策逻辑：

```
有代码问题？
  ├─ 概念/行为/架构（"这段逻辑影响哪里？"）
  │    └─→ augment-context-engine（语义搜索）
  ├─ 精确符号名但不知位置（"找 handleSubmit 函数"）
  │    └─→ augment-context-engine 先 → 无结果再 Grep
  ├─ 已知精确文件路径
  │    └─→ Read（必须带 offset+limit，禁止无参数读大文件）
  └─ 只需文件列表/存在性验证
       └─→ Glob
```

**硬性规则**：未经语义搜索定位就多轮 Grep，等于让 AI 做全文扫描——这是 token 黑洞。

---

## 四、两个真实场景复盘

### 场景 A：修复博客 CI/CD 流水线

这个 blog 本身就是一个案例。几周前 CI 一直挂，报错模糊。我的处理流程：

1. **`cloudflare-builds`** 拉取最新构建日志，定位到 `npm ci` 因 lockfile 不同步失败
2. **`Read`** 读 `pages.yml`，发现四个问题：Action 版本、缓存 key、lockfile 缺失、构建顺序错误
3. **`Edit`** 精确替换相关行（没有重写整个文件）
4. **`Bash`** 执行 `npm install` 重新生成 lockfile，git commit 推送

全程没有离开 Claude Code 终端，4 步搞定，历史记录沉淀在 claude-mem 的跨会话记忆里。

### 场景 B：第三方库 API 用法确认

写 Hexo 插件时不确定 `hexo.extend.generator` 的签名，以往我会去 Google 找文档，经常找到过时的版本。

现在的流程：

```
context7.resolve-library-id("hexo")
→ context7.query-docs("generator API signature return type")
→ 得到当前版本的精确 API 文档
→ 直接写代码，零猜测
```

context7 的核心价值：**把"凭记忆猜"变成"凭文档写"**，这在依赖快速迭代的 JS 生态里价值极大。

---

## 五、我遵守的几条硬规则

这些规则是反复踩坑后沉淀的，写进了我的全局 CLAUDE.md：

**1. 工具优先，禁止先解释后调用**
有合适工具就立刻调，不要先说"我来帮你……"再调。解释是事后的，不是事前的。

**2. 并行调用所有无依赖工具**
读文件和搜文档可以同时做。顺序调用是在浪费时间。

**3. 外部模型输出仅作逻辑参考**
Codex、Gemini 给的代码不能直接粘贴——我要理解后自己重构，保证风格一致、无冗余。

**4. 改动范围最小化**
Bug fix 不顺手重构周边代码。加功能不加"以备将来"的配置项。这条规则救了我很多次——AI 特别容易过度工程化。

**5. 第三方库调用必须 context7 驱动**
记忆会骗人，文档不会。

---

## 六、claude-mem：跨会话的"工程记忆"

Claude Code 的对话是无状态的——关掉窗口就消失。我用 **claude-mem** 插件解决这个问题：

- 每次解决非显而易见的问题后，把"是什么 + 为什么 + 怎么用"写入记忆
- 下次开新会话，先 `/mem-search` 检索相关历史
- 避免重复踩同一个坑

这篇文章对应的记忆条目里就有本博客 CI/CD 历史修复记录的完整上下文——包括当时的错误日志和每个 fix 的 rationale。

---

## 七、对"AI 替代编程"的边界判断

我的结论是：**AI 擅长执行，人负责判断**。

具体来说：

- ✅ AI 做：文档查找、代码生成初稿、diff 格式化、重复性重构、日志分析
- ✅ 人做：架构决策、需求边界划定、安全审查、"这个抽象是否必要"的判断
- ⚠️ 危险区：让 AI 做架构决策，然后自己不 review 就合并

最容易出问题的是**过度信任 AI 的"以防万一"逻辑**——它会给你加 fallback、加 retry、加 feature flag，每一个单独看都"合理"，合在一起就是过度工程。规则是：三行代码能解决的，不要五个抽象。

---

## 结语

这套工具流不是终态，它还在随着 MCP 生态的扩展持续演化。但核心原则是稳定的：

> **第一性原理 > 经验主义。工具是手段，清晰的思维是护城河。**

如果你也在用 Claude Code，欢迎交流你的工具路由策略——尤其是那些"踩坑之后才沉淀的规则"，那才是真正有价值的东西。
