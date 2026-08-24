---
name: free-api-radar
description: 用户询问"有哪些免费可调用的大模型 API / 免费模型 / 免费额度 / 免费 Key"、"帮我拉取全平台免费 API 列表"、"OpenRouter 免费模型有哪些"、"WorkSwarm 免费 Token 怎么用"、"怎么白嫖各家模型 API"、"更新免费 API 清单"等涉及全平台免费 LLM API 聚合、额度、密钥获取的问题时使用。通过运行 fetch-free-apis.mjs 自动拉取各平台公开目录并生成/更新免费 API 雷达报告（data/free-apis.json 与 data/free-apis.md），据此回答。
whenToUse: 用户需要最新、全平台、可核对的免费 LLM/开放 API 清单或额度信息，而不是凭记忆泛泛而谈时。
metadata:
  plugin: free-api-radar
  version: 1.0.0
  engines: [dsh, claude-code, codex, cursor, gemini-cli]
---

# free-api-radar —— 全平台免费可调用 API 雷达

本技能是 `free-api-radar` 插件（位于本工作区 `D:\新建文件夹\插件`）的智能体入口。插件核心是一个零依赖 Node 引擎 `scripts/fetch-free-apis.mjs`，它从各平台公开的模型目录接口 + 社区免费 API 清单自动拉取数据，归一化后输出：

- `data/free-apis.json` —— 机器可读的统一索引（推荐先读这个做精确回答）
- `data/free-apis.md` —— 人读报告（按平台分组、含密钥获取指引）
- `data/state.json` —— 最近一次运行状态（各源健康度、时间戳）

## 何时使用

- 用户问"有哪些免费模型/免费 API/免费额度/免费 Key"，或点名某平台（OpenRouter、Gemini、GitHub Models、NVIDIA NIM、WorkSwarm、智谱、百炼、硅基流动…）。
- 用户要求"更新/刷新免费 API 清单"。
- 用户要比较"哪个免费模型适合跑 XX 任务"。

## 标准流程

1. **刷新（数据可能旧时）**：若 `data/state.json` 不存在，或距今超过 24 小时，先运行：
   ```sh
   node scripts/fetch-free-apis.mjs refresh --stale-hours 24
   ```
   - 本机网络可用时，该命令会在线拉取 OpenRouter、SiliconFlow、GitHub Models、Google AI Studio、智谱、百炼、Cloudflare、社区清单等源；`--stale-hours 24` 保证 24 小时内只拉一次，避免频繁请求。
   - 无网络 / 想用缓存时加 `--offline`。
   - 只看某个源：`--only openrouter,curated`。

2. **读取**：优先 `data/free-apis.json`（结构统一），报告格式看 `data/free-apis.md`，源健康度看 `data/state.json`。

3. **回答**：
   - 用表格按平台列出免费条目（模型 id、类别、免费类型、上下文、是否需要 Key、备注）。
   - 明确指出数据源状态（哪些在线拉取成功、哪些缺密钥跳过、哪些是人工维护的 curated 条目）。
   - 提醒用户：**免费额度/限速/定价随时变动，最终以各平台官网为准**；标注 `unknown` 的条目表示接口没返回定价，需自行核实。
   - 涉及"怎么拿 Key"时，给出官方入口（见 `free-apis.md` 的"如何获取密钥"一节），并提醒不要把 Key 明文写进对话或仓库。

## 常用命令

```sh
node scripts/fetch-free-apis.mjs refresh                 # 在线拉取并生成报告
node scripts/fetch-free-apis.mjs refresh --stale-hours 6 # 6 小时内刷新过则跳过
node scripts/fetch-free-apis.mjs refresh --offline       # 离线（只用 curated + 缓存）
node scripts/fetch-free-apis.mjs refresh --only openrouter
node scripts/fetch-free-apis.mjs list --free-only        # 列出全部免费条目
node scripts/fetch-free-apis.mjs list --platform openrouter --json
node scripts/fetch-free-apis.mjs search gemini           # 关键词搜索
node scripts/fetch-free-apis.mjs status                  # 各源健康度
node scripts/fetch-free-apis.mjs loop --minutes 1440     # 每 24h 自动刷新（挂后台）
```

Windows 下也可用 PowerShell 包装：`pwsh scripts/fetch-free-apis.ps1 refresh`。

## 定时自动更新

- 临时：后台跑 `node scripts/fetch-free-apis.mjs loop --minutes 1440`（或 dsh 的 `run_in_background`）。
- 持久：Windows 用 `scripts/install-scheduler.ps1` 注册计划任务；Linux/macOS 用 cron：
  ```
  0 6 * * * cd /path/to/plugin && node scripts/fetch-free-apis.mjs refresh --stale-hours 0 >> data/refresh.log 2>&1
  ```

## 数据可信度分级（回答时标注）

| 级别 | 含义 | 来源 |
| --- | --- | --- |
| live | 刚从平台公开目录接口拉到 | `*-live` |
| curated | 人工维护的种子/额度说明 | `curated` |
| community | 社区清单收录 | `community-list` |
| reference | 只保存了 README 副本，未结构化 | `data/references/` |

## 安全与边界

- 绝不打印、提交任何 API Key / Token；需要密钥的源只在 `authEnv` 指定的环境变量里读。
- 不承诺免费：免费状态会变，报告只是"快照 + 官网为准"。
- 不爬取需要登录的私有接口；所有源都是公开目录或用户自己提供的密钥。

## 安装与分发

- 本目录即插件仓库：技能方式（零安装）直接使用；bundle 方式 `dsh plugin --profile <name> add .`。
- 发布到 GitHub 后：`dsh plugin add git+https://github.com/<owner>/free-api-radar.git`，仓库内置 GitHub Actions 每天自动刷新数据快照（见 `.github/workflows/refresh.yml`），克隆即得最新索引。
- 数据源覆盖（除首批 9 个外新增）：NVIDIA NIM、Groq、Mistral、Kimi、阶跃星辰、Cerebras、Together AI、DeepSeek 官方（对照）、百度千帆，均走通用 OpenAI 兼容解析器。
