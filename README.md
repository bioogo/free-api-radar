# free-api-radar（免费 API 雷达）

全平台「免费可调用 API / 免费大模型 API」自动拉取插件（DeepSeek Harness / dsh）。

像华为 **WorkSwarm** 那样聚合各家模型能力 —— 但这次把「免费 API 目录」变成你自己的、自动更新的本地数据：引擎从各平台**公开的模型目录接口**和**社区免费 API 清单**拉取数据，归一化成统一 schema，过滤出免费可调用条目，输出 JSON + Markdown 报告，并记录每个数据源的健康度。

> ⚠️ 免费额度、限速、定价随时变动：本插件只负责"自动拉取 + 快照"，**一切以各平台官网为准**。

---

## 一、它解决什么问题

| 问题 | 本插件做法 |
| --- | --- |
| 各家免费模型/API 信息分散，靠记忆容易过期 | 从平台公开目录接口自动拉取（OpenRouter、Gemini、GitHub Models、SiliconFlow、智谱、百炼、Cloudflare、社区清单） |
| 华为 WorkSwarm 等暂无公开目录接口的平台 | 人工维护的 curated 条目 + 快速事实表（见 `data/curated.json`），有公开接口后只需在 `data/sources.json` 启用并加一个解析器 |
| 想定时自动更新 | `loop` 子命令 / Windows 计划任务 / cron |
| 想让 dsh 智能体直接回答"有哪些免费 API" | 技能插件 `free-api-radar`（零安装）+ 可选工具插件 `free_api_radar` |

## 二、目录结构

```
插件/
├── .dsh/skills/free-api-radar/SKILL.md   # 技能插件（推荐，零安装，dsh 自动发现）
├── package.json                          # bundle 元信息（可选安装方式用）
├── cordis.patch.yml                      # bundle 补丁：注册 free_api_radar 工具
├── lib/index.js                          # bundle 工具插件（调用引擎）
├── .github/workflows/
│   ├── refresh.yml                       # 每日自动刷新并提交数据快照（GitHub Actions）
│   └── ci.yml                            # 语法 + 离线冒烟测试
├── scripts/
│   ├── fetch-free-apis.mjs               # ★ 核心引擎（零依赖，Node ≥18）
│   ├── fetch-free-apis.ps1               # PowerShell 包装
│   ├── install-scheduler.ps1             # Windows 计划任务自动刷新
│   └── publish.ps1                       # 一键发布到 GitHub（需本机装 git）
├── data/
│   ├── sources.json                      # 数据源注册表（可编辑，可加平台）
│   ├── curated.json                      # 人工维护种子数据（离线兜底）
│   ├── free-apis.json                    # 【生成】统一免费 API 索引
│   ├── free-apis.md                      # 【生成】人读报告
│   ├── state.json                        # 【生成】运行状态/源健康度
│   └── references/                       # 【生成】社区清单 README 副本
└── LICENSE / .gitignore
```

## 三、安装（三种方式）

### 方式 A：技能插件（推荐，零安装）

技能自动发现目录（dsh 会实时监听）：
- 项目级：本目录的 `.dsh/skills/`（在 `D:\新建文件夹\插件` 打开 dsh 即生效）
- 全局级：把 `.dsh/skills/free-api-radar` 复制到 `C:\Users\<你>\.dsh\skills\free-api-radar`

生效后，问智能体"有哪些免费模型 API？"即可触发技能；智能体会运行引擎并基于最新数据回答。

### 方式 B：bundle 工具插件（本地）

```sh
# 在插件目录执行（profile 名按你的实际配置，如 web）
dsh plugin --profile web add .
# 然后重启 dsh（让 Host 挂载新 bundle），会话中会出现 free_api_radar 工具
```

> 需要 pnpm；bundle 依赖 `@deepseek-ai/dsh-tools`（dsh 安装自带，profile 的 fallback node_modules 已包含）。
> 移除：`dsh plugin --profile web remove free-api-radar`

### 方式 C：从 GitHub 安装（发布后）

```sh
dsh plugin add git+https://github.com/<你的用户名>/free-api-radar.git
```

仓库里已由 GitHub Actions 每天自动刷新并提交 `data/free-apis.*` 快照，克隆下来即可离线使用。

**发布到 GitHub（无需预装 git）**：本目录旁已放了便携版 git（`.tools\MinGit`），发布脚本会自动找到它。两步：

1. 在 GitHub 网页新建空仓库 `free-api-radar`（Public）；
2. 运行：
   ```sh
   pwsh scripts/publish.ps1 -RepoUrl "https://github.com/<你的用户名>/free-api-radar.git"
   ```
   推送时按提示输入 GitHub 用户名，密码处粘贴 PAT（Settings → Developer settings → Personal access tokens，勾选 `repo`，用后即撤）。
   装了 GitHub CLI 的可用 `pwsh scripts/publish.ps1 -CreateRepo free-api-radar -Visibility public` 自动建仓；只想本地提交不推送用 `-SkipPush` 预演。

## 四、使用

```sh
node scripts/fetch-free-apis.mjs refresh                  # 在线拉取全部源并生成报告
node scripts/fetch-free-apis.mjs refresh --stale-hours 6  # 6 小时内刷新过则跳过
node scripts/fetch-free-apis.mjs refresh --offline        # 离线（curated + 缓存）
node scripts/fetch-free-apis.mjs refresh --only openrouter,curated
node scripts/fetch-free-apis.mjs list --free-only         # 列出免费条目
node scripts/fetch-free-apis.mjs list --platform workswarm
node scripts/fetch-free-apis.mjs search gemini
node scripts/fetch-free-apis.mjs status                   # 数据源健康度
node scripts/fetch-free-apis.mjs loop --minutes 1440      # 每 24h 自动刷新（挂后台）
```

### 定时自动更新

- Windows：`pwsh scripts/install-scheduler.ps1`（注册计划任务，默认每 1440 分钟一次；卸载见脚本注释）
- Linux/macOS cron：
  ```
  0 6 * * * cd /path/to/free-api-radar && node scripts/fetch-free-apis.mjs refresh --stale-hours 0 >> data/refresh.log 2>&1
  ```

### 需要密钥的源（从环境变量读取，缺失自动跳过）

| 平台 | 环境变量 | 申请入口 |
| --- | --- | --- |
| Google AI Studio | `GEMINI_API_KEY` | https://aistudio.google.com/apikey |
| GitHub Models | `GITHUB_TOKEN` | https://github.com/settings/tokens |
| SiliconFlow | `SILICONFLOW_API_KEY` | https://cloud.siliconflow.cn/account/ak |
| 智谱 | `BIGMODEL_API_KEY` | https://open.bigmodel.cn/usercenter/apikeys |
| 阿里百炼 | `DASHSCOPE_API_KEY` | https://bailian.console.aliyun.com/#/api-key |
| Cloudflare | `CF_API_TOKEN` + `CF_ACCOUNT_ID` | https://dash.cloudflare.com/profile/api-tokens |
| OpenRouter | `OPENROUTER_API_KEY`（免费模型可不带 Key） | https://openrouter.ai/keys |
| NVIDIA NIM | `NVIDIA_API_KEY` | https://build.nvidia.com |
| Groq | `GROQ_API_KEY` | https://console.groq.com |
| Mistral | `MISTRAL_API_KEY` | https://console.mistral.ai |
| Kimi | `MOONSHOT_API_KEY` | https://platform.moonshot.cn |
| 阶跃星辰 | `STEP_API_KEY` | https://platform.stepfun.com |
| Cerebras | `CEREBRAS_API_KEY` | https://cloud.cerebras.ai |
| Together AI | `TOGETHER_API_KEY` | https://www.together.ai |
| DeepSeek 官方（对照项） | `DEEPSEEK_API_KEY` | https://platform.deepseek.com |
| 百度千帆 | `QIANFAN_ACCESS_KEY` | https://console.bce.baidu.com/qianfan |

## 五、数据源与可信度

| 级别 | 含义 | 例子 |
| --- | --- | --- |
| live | 刚从平台公开目录拉到 | OpenRouter 全量目录（含定价判定）、Gemini 模型列表，以及 Groq / NVIDIA NIM / Mistral / Kimi / Step / Cerebras / Together / DeepSeek / 百度千帆 等 OpenAI 兼容目录 |
| curated | 人工维护的种子/额度说明 | WorkSwarm、MiniMax、Cohere（无目录接口或免费名单靠人工） |
| community | 社区机器可读清单 | mnfst/awesome-free-llm-apis 的 data.json |
| reference | 只保存副本供参考 | open-free-llm-api/awesome-freellm-apis README（134+ 免费 API 大全） |

**扩展新平台**：`data/sources.json` 加一条（含 endpoint、authEnv、免费名单），再在 `scripts/fetch-free-apis.mjs` 的 `PARSERS` 里实现同名解析器即可；OpenAI 兼容平台可直接复用 `genericOpenAICompatible`（免费判定：`freeModelIds` 精确命中 > `freeIdPatterns` 包含命中 > `defaultFree` 兜底）。

### GitHub Actions 自动刷新（发布到 GitHub 后自动生效）

`.github/workflows/refresh.yml` 每天 02:00 UTC 自动：
1. 用仓库 Secrets 里的各平台密钥在线刷新（没配的源自动跳过）；
2. 把 `data/free-apis.{json,md}`、`state.json`、`references/` 提交回仓库。

这样所有 `dsh plugin add git+...` 安装的用户克隆下来就是最新快照。密钥配置：仓库 Settings → Secrets and variables → Actions，键名见 `refresh.yml` 的 `env:` 映射。

## 六、华为 WorkSwarm 说明

WorkSwarm 是华为的 AI 办公平台，通过**开发者招募计划提供免费 Token** 聚合模型能力（免费政策以官方公告为准）。目前没有公开的模型目录 REST 接口，所以本插件把它作为 **curated 人工条目**维护（`data/curated.json` 的 `workswarm` 条目 + `quickFacts` 表）。一旦有公开目录接口，在 `data/sources.json` 把 `workswarm` 的 `enabled` 改为 `true` 并实现解析器即可自动拉取。

## 七、免责声明

- 本插件不提供、不存储任何 API Key；密钥只从环境变量读取。
- 免费模型/额度/限速信息具有时效性，请以各平台官网为准。
- 社区清单数据版权归其维护者所有，仅作参考。
