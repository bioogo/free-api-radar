# 全平台免费可调用 API 雷达（free-api-radar）

> 生成时间：2026-08-24T05:37:32.667Z（在线拉取）
> 共收录 **41** 条免费条目 / **497** 条模型记录（curated 种子 11 条，缓存 0 条）。
> ⚠️ 免费额度、限速与定价会随时调整，**以各平台官网为准**；标注 "unknown" 的条目表示接口未返回定价信息，需自行核实。

## 源状态

| 源 | 状态 | 条目数 | 说明 |
| --- | --- | --- | --- |
| OpenCode Zen（WorkSwarm 同源免费网关） | ok | 64 |  |
| OpenRouter | ok | 422 |  |
| SiliconFlow 硅基流动 | skipped | 0 | 缺少 SILICONFLOW_API_KEY（SiliconFlow 模型目录接口需要密钥） |
| GitHub Models | skipped | 0 | 目录端点返回 404（可能已变动或需要登录态），请核对 https://models.github.ai 的当前端点 |
| Google AI Studio (Gemini) | skipped | 0 | 缺少 GEMINI_API_KEY（AI Studio 免费额度需密钥，可到 aistudio.google.com 申请） |
| 智谱 GLM 开放平台 | skipped | 0 | 缺少 BIGMODEL_API_KEY |
| 阿里云百炼 (通义) | skipped | 0 | 缺少 DASHSCOPE_API_KEY |
| Cloudflare Workers AI | skipped | 0 | 缺少 CF_API_TOKEN / CF_ACCOUNT_ID |
| NVIDIA NIM | skipped | 0 | 缺少 NVIDIA_API_KEY（模型目录接口需要密钥） |
| Groq | skipped | 0 | 缺少 GROQ_API_KEY（模型目录接口需要密钥） |
| Mistral | skipped | 0 | 缺少 MISTRAL_API_KEY（模型目录接口需要密钥） |
| 月之暗面 Kimi | skipped | 0 | 缺少 MOONSHOT_API_KEY（模型目录接口需要密钥） |
| 阶跃星辰 Step | skipped | 0 | 缺少 STEP_API_KEY（模型目录接口需要密钥） |
| Cerebras | skipped | 0 | 缺少 CEREBRAS_API_KEY（模型目录接口需要密钥） |
| Together AI | skipped | 0 | 缺少 TOGETHER_API_KEY（模型目录接口需要密钥） |
| DeepSeek 官方 | skipped | 0 | 缺少 DEEPSEEK_API_KEY（模型目录接口需要密钥） |
| 百度千帆 | skipped | 0 | 缺少 QIANFAN_ACCESS_KEY（模型目录接口需要密钥） |
| 社区清单 mnfst/awesome-free-llm-apis (data.json) | error | 0 | timeout after 15000ms |
| awesome-freellm-apis (134+ 免费 LLM API 大全 README) | ok | 0 | D:\新建文件夹\插件\data\references\awesome-freellm-apis.md |

## 免费可调用条目（按平台）

### 百度千帆（baidu-qianfan）

| 模型 | 类别 | 免费类型 | 上下文 | 认证 | 备注 |
| --- | --- | --- | --- | --- | --- |
| 文心 ERNIE 4.0 Turbo（`ernie-4.0-turbo-8k`） | chat | quota | 8192 | 需要 Key（QIANFAN_ACCESS_KEY） | 以千帆控制台为准 |

### Cohere（cohere）

| 模型 | 类别 | 免费类型 | 上下文 | 认证 | 备注 |
| --- | --- | --- | --- | --- | --- |
| Command R+（`command-r-plus`） | chat | trial | 128000 | 需要 Key（COHERE_API_KEY） | 以 cohere.com 为准 |

### Groq（groq）

| 模型 | 类别 | 免费类型 | 上下文 | 认证 | 备注 |
| --- | --- | --- | --- | --- | --- |
| Llama 3.3 70B Versatile（`llama-3.3-70b-versatile`） | chat | quota | 131072 | 需要 Key（GROQ_API_KEY） | 模型名单以 console.groq.com 为准 |
| Whisper Large V3 (ASR)（`whisper-large-v3`） | asr | quota | — | 需要 Key（GROQ_API_KEY） |  |

### MiniMax（minimax）

| 模型 | 类别 | 免费类型 | 上下文 | 认证 | 备注 |
| --- | --- | --- | --- | --- | --- |
| abab6.5s-chat（`abab6.5s-chat`） | chat | trial | 245760 | 需要 Key（MINIMAX_API_KEY） | 赠额用尽后按量付费 |

### Mistral（mistral）

| 模型 | 类别 | 免费类型 | 上下文 | 认证 | 备注 |
| --- | --- | --- | --- | --- | --- |
| Mistral Small（`mistral-small-latest`） | chat | quota | 128000 | 需要 Key（MISTRAL_API_KEY） | 以 console.mistral.ai 为准 |

### 月之暗面 Kimi（moonshot）

| 模型 | 类别 | 免费类型 | 上下文 | 认证 | 备注 |
| --- | --- | --- | --- | --- | --- |
| Moonshot v1 8K（`moonshot-v1-8k`） | chat | trial | 8192 | 需要 Key（MOONSHOT_API_KEY） | 赠额用尽后按量付费 |

### NVIDIA NIM（nvidia-nim）

| 模型 | 类别 | 免费类型 | 上下文 | 认证 | 备注 |
| --- | --- | --- | --- | --- | --- |
| Llama 3.1 Nemotron 70B Instruct（`nvidia/llama-3.1-nemotron-70b-instruct`） | chat | trial | 131072 | 需要 Key（NVIDIA_API_KEY） | 以 build.nvidia.com 当前模型列表为准 |

### OpenCode Zen（WorkSwarm 同源免费网关）（opencode）

| 模型 | 类别 | 免费类型 | 上下文 | 认证 | 备注 |
| --- | --- | --- | --- | --- | --- |
| deepseek-v4-flash-free（`deepseek-v4-flash-free`） | chat | permanent | — | 无需 Key | OpenCode Zen 网关（opencode.ai/zen），华为 WorkSwarm 免费模型的同源网关；免密钥，OpenAI 兼容。 |
| hy3-free（`hy3-free`） | chat | permanent | — | 无需 Key | OpenCode Zen 网关（opencode.ai/zen），华为 WorkSwarm 免费模型的同源网关；免密钥，OpenAI 兼容。 |
| laguna-s-2.1-free（`laguna-s-2.1-free`） | chat | permanent | — | 无需 Key | OpenCode Zen 网关（opencode.ai/zen），华为 WorkSwarm 免费模型的同源网关；免密钥，OpenAI 兼容。 |
| mimo-v2.5-free（`mimo-v2.5-free`） | chat | permanent | — | 无需 Key | OpenCode Zen 网关（opencode.ai/zen），华为 WorkSwarm 免费模型的同源网关；免密钥，OpenAI 兼容。 |
| muse-spark-1.2-contributor-free（`muse-spark-1.2-contributor-free`） | chat | permanent | — | 无需 Key | OpenCode Zen 网关（opencode.ai/zen），华为 WorkSwarm 免费模型的同源网关；免密钥，OpenAI 兼容。 |
| nemotron-3-ultra-free（`nemotron-3-ultra-free`） | chat | permanent | — | 无需 Key | OpenCode Zen 网关（opencode.ai/zen），华为 WorkSwarm 免费模型的同源网关；免密钥，OpenAI 兼容。 |
| nemotron-3.5-lightning-free（`nemotron-3.5-lightning-free`） | chat | permanent | — | 无需 Key | OpenCode Zen 网关（opencode.ai/zen），华为 WorkSwarm 免费模型的同源网关；免密钥，OpenAI 兼容。 |
| x-preview-f-free（`x-preview-f-free`） | chat | permanent | — | 无需 Key | OpenCode Zen 网关（opencode.ai/zen），华为 WorkSwarm 免费模型的同源网关；免密钥，OpenAI 兼容。 |

### OpenRouter（openrouter）

| 模型 | 类别 | 免费类型 | 上下文 | 认证 | 备注 |
| --- | --- | --- | --- | --- | --- |
| Cohere: North Mini Code (free)（`cohere/north-mini-code:free`） | code | permanent | 256000 | 无需 Key |  |
| DeepSeek R1 (free)（`deepseek/deepseek-r1:free`） | reasoning | permanent | 163840 | 无需 Key | 种子数据；refresh 时会被 OpenRouter 实时目录覆盖 |
| Dots Studio: Dots3-Note Preview (free)（`dots-studio/dots-3-note-preview:free`） | chat | permanent | 512000 | 无需 Key |  |
| Google: Gemma 4 26B A4B  (free)（`google/gemma-4-26b-a4b-it:free`） | chat | permanent | 262144 | 无需 Key |  |
| Google: Gemma 4 31B (free)（`google/gemma-4-31b-it:free`） | chat | permanent | 262144 | 无需 Key |  |
| Google: Lyria 3 Clip Preview（`google/lyria-3-clip-preview`） | chat | permanent | 1048576 | 无需 Key |  |
| Google: Lyria 3 Pro Preview（`google/lyria-3-pro-preview`） | chat | permanent | 1048576 | 无需 Key |  |
| LiquidAI: LFM2.5-2.6B (free)（`liquid/lfm-2.5-2.6b:free`） | chat | permanent | 65536 | 无需 Key |  |
| NVIDIA: Nemotron 3 Nano 30B A3B (free)（`nvidia/nemotron-3-nano-30b-a3b:free`） | chat | permanent | 256000 | 无需 Key |  |
| NVIDIA: Nemotron 3 Nano Omni (free)（`nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free`） | reasoning | permanent | 256000 | 无需 Key |  |
| NVIDIA: Nemotron 3 Super (free)（`nvidia/nemotron-3-super-120b-a12b:free`） | chat | permanent | 262144 | 无需 Key |  |
| NVIDIA: Nemotron 3 Ultra (free)（`nvidia/nemotron-3-ultra-550b-a55b:free`） | chat | permanent | 1000000 | 无需 Key |  |
| NVIDIA: Nemotron 3.5 Content Safety (free)（`nvidia/nemotron-3.5-content-safety:free`） | chat | permanent | 128000 | 无需 Key |  |
| NVIDIA: Nemotron 3.5 Lightning (free)（`nvidia/nemotron-3.5-lightning:free`） | chat | permanent | 1000000 | 无需 Key |  |
| NVIDIA: Nemotron Nano 12B 2 VL (free)（`nvidia/nemotron-nano-12b-v2-vl:free`） | chat | permanent | 128000 | 无需 Key |  |
| NVIDIA: Nemotron Nano 9B V2 (free)（`nvidia/nemotron-nano-9b-v2:free`） | chat | permanent | 128000 | 无需 Key |  |
| Free Models Router（`openrouter/free`） | chat | permanent | 200000 | 无需 Key |  |
| Poolside: Laguna S 2.1 (free)（`poolside/laguna-s-2.1:free`） | chat | permanent | 262144 | 无需 Key |  |
| Poolside: Laguna XS 2.1 (free)（`poolside/laguna-xs-2.1:free`） | chat | permanent | 262144 | 无需 Key |  |
| Ox Alpha（`stealth/ox-alpha`） | chat | permanent | 1048576 | 无需 Key |  |
| Thinking Machines: Inkling Small (free)（`thinkingmachines/inkling-small:free`） | reasoning | permanent | 262144 | 无需 Key |  |
| Thinking Machines: Inkling (free)（`thinkingmachines/inkling:free`） | reasoning | permanent | 262144 | 无需 Key |  |
| Z.ai: GLM 5.2 (free)（`z-ai/glm-5.2:free`） | chat | permanent | 256000 | 无需 Key |  |

### 阶跃星辰 Step（stepfun）

| 模型 | 类别 | 免费类型 | 上下文 | 认证 | 备注 |
| --- | --- | --- | --- | --- | --- |
| Step-1 8K（`step-1-8k`） | chat | trial | 8192 | 需要 Key（STEP_API_KEY） | 赠额用尽后按量付费 |

### 华为 WorkSwarm（workswarm）

| 模型 | 类别 | 免费类型 | 上下文 | 认证 | 备注 |
| --- | --- | --- | --- | --- | --- |
| WorkSwarm 开发者免费 Token 计划（`workswarm-free-token-program`） | other | trial | — | 需要 Key（WORKSWARM_TOKEN） | WorkSwarm 免费模型的真实来源已逆向确认：OpenCode Zen 网关。请使用 opencode 自动源获取实时免费模型列表。 |

## 各平台免费额度速览（人工维护，以官网为准）

| 平台 | 免费机制 | 官方入口 |
| --- | --- | --- |
| 华为 WorkSwarm | AI 办公平台，开发者招募计划提供免费 Token，聚合多模型能力（额度与模型名单以官方公告为准） | https://www.huawei.com/ |
| OpenRouter | 提供大量 :free 免费模型变体（0 美元），OpenAI 兼容端点，无需 Key 可试调 | https://openrouter.ai/models |
| Google AI Studio | Gemini 全系模型免费配额档（Tier 1），需 API Key | https://aistudio.google.com/apikey |
| GitHub Models | GitHub 账号免费额度，可试调 GPT/Claude/Gemini/DeepSeek 等（有限速） | https://models.github.ai |
| NVIDIA NIM | build.nvidia.com 提供免费 API Key，可调用 Llama、Nemotron、DeepSeek 等推理微服务 | https://build.nvidia.com |
| Cloudflare Workers AI | 免费档每天 10,000 神经元 | https://developers.cloudflare.com/workers-ai/ |
| Groq | 免费额度档，Llama-3、Gemma、Whisper 等超低延迟推理 | https://console.groq.com |
| Cerebras | 免费额度档，Llama 系列极速推理 | https://cloud.cerebras.ai |
| Together AI | 免费模型（id 带 -Free 后缀，限速） | https://www.together.ai |
| Mistral | La Plateforme 免费档（有速率限制） | https://console.mistral.ai |
| Cohere | 开发者免费额度（trial key），支持生成/嵌入/RAG | https://cohere.com |
| SiliconFlow 硅基流动 | 多个小参数开源模型长期免费 | https://cloud.siliconflow.cn/models |
| 智谱 GLM | GLM-4-Flash 系列长期免费；新用户另有赠额 | https://open.bigmodel.cn/pricing |
| 阿里云百炼 | qwen-flash / qwen-turbo 等有免费额度；新用户赠额 | https://bailian.console.aliyun.com/ |
| 百度千帆 | 文心系列有免费额度（随活动变动） | https://console.bce.baidu.com/qianfan |
| 月之暗面 Kimi | 新用户赠送额度（moonshot-v1 系列） | https://platform.moonshot.cn |
| MiniMax | 新用户赠送额度（abab 系列） | https://platform.minimaxi.com |
| 阶跃星辰 Step | 注册赠送额度（step 系列） | https://platform.stepfun.com |
| DeepSeek 官方 | 官方 API 为按量付费；充值/赠送政策见官网，不属免费档 | https://platform.deepseek.com |

## 如何获取密钥

- OpenRouter：https://openrouter.ai/keys（免费模型可不带 Key 试调，建议申请）
- Google AI Studio：https://aistudio.google.com/apikey（Gemini 免费配额档）
- GitHub Models：https://github.com/settings/tokens（GitHub Models 免费额度）
- NVIDIA NIM：https://build.nvidia.com（免费 API Key）
- 智谱：https://open.bigmodel.cn/usercenter/apikeys
- 阿里百炼：https://bailian.console.aliyun.com/#/api-key
- Cloudflare：https://dash.cloudflare.com/profile/api-tokens（+ Account ID）
- SiliconFlow：https://cloud.siliconflow.cn/account/ak
- 华为 WorkSwarm：开发者招募计划免费 Token，详见官方公告

## 命令行速查

```sh
node scripts/fetch-free-apis.mjs refresh          # 立即拉取并生成报告
node scripts/fetch-free-apis.mjs list --free-only # 列出全部免费条目
node scripts/fetch-free-apis.mjs search gemini    # 搜索
node scripts/fetch-free-apis.mjs loop --minutes 1440  # 每 24h 自动刷新
```
