#!/usr/bin/env node
/**
 * free-api-radar —— 全平台「免费可调用 API / 免费模型」自动拉取引擎
 * =================================================================
 * 一个零依赖的 Node 脚本：从多个平台公开的模型目录接口（以及社区维护的
 * 免费 API 清单）拉取数据，归一化成统一 schema，过滤出「免费可调用」的
 * 条目，输出 data/free-apis.json（机器可读）与 data/free-apis.md（人读报告），
 * 并把每次运行的源状态写入 data/state.json。
 *
 * 设计目标：
 *  - 离线可用：curated 种子数据 + 上次成功缓存永远兜底，单源失败不中断。
 *  - 自动更新：`loop` 子命令循环刷新；README 附 Windows 计划任务 / cron 注册。
 *  - 可扩展：新增平台 = 在 data/sources.json 加一条 + 本文件加一个 parser。
 *
 * 用法：
 *   node scripts/fetch-free-apis.mjs refresh            # 拉取全部启用源并重新生成输出
 *   node scripts/fetch-free-apis.mjs refresh --offline  # 只用缓存/curated，不联网
 *   node scripts/fetch-free-apis.mjs refresh --only openrouter,curated
 *   node scripts/fetch-free-apis.mjs refresh --stale-hours 6   # 6 小时内刷新过则跳过
 *   node scripts/fetch-free-apis.mjs list --free-only --platform openrouter
 *   node scripts/fetch-free-apis.mjs search gemini
 *   node scripts/fetch-free-apis.mjs status
 *   node scripts/fetch-free-apis.mjs loop --minutes 1440        # 每 24h 自动刷新一次
 *
 * 需要密钥的源从环境变量读取（见 data/sources.json 的 authEnv），没有密钥
 * 的源自动跳过并记录状态，不影响其他源。
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DATA_DIR = join(ROOT, "data");
const REF_DIR = join(DATA_DIR, "references");

const FILE_JSON = join(DATA_DIR, "free-apis.json");
const FILE_MD = join(DATA_DIR, "free-apis.md");
const FILE_STATE = join(DATA_DIR, "state.json");

const FETCH_TIMEOUT_MS = 15000;
const RETRY = 2;
const UA = "free-api-radar/1.0 (+dsh skill plugin)";

/* ------------------------------------------------------------------ */
/* 基础工具                                                             */
/* ------------------------------------------------------------------ */

function loadJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
}

function atomicWrite(path, content) {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, content);
  renameSync(tmp, path);
}

async function fetchWithRetry(url, { headers = {}, timeoutMs = FETCH_TIMEOUT_MS, json = true } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= RETRY; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: { "user-agent": UA, accept: "application/json", ...headers },
        signal: controller.signal
      });
      if (!res.ok) {
        const err = new Error(`HTTP ${res.status} ${res.statusText}`);
        err.status = res.status;
        throw err;
      }
      return json ? await res.json() : await res.text();
    } catch (error) {
      lastError = error;
      if (error.name === "AbortError") lastError = new Error(`timeout after ${timeoutMs}ms`);
      if (attempt < RETRY) await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

function env(name) {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

function nowIso() {
  return new Date().toISOString();
}

/** 把 "128K" / "1M" / 131072 之类上下文长度解析成 token 数字；解析不了返回 null。 */
function parseContext(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const m = /^\s*(\d+(?:\.\d+)?)\s*([KMkm]?)\s*$/.exec(value);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  if (unit === "k") return Math.round(n * 1024);
  if (unit === "m") return Math.round(n * 1024 * 1024);
  return Math.round(n);
}

function classifyCategory(id) {
  const s = id.toLowerCase();
  if (s.includes("embedding") || s.includes("embed")) return "embedding";
  if (s.includes("rerank")) return "rerank";
  if (s.includes("image") && (s.includes("generation") || s.includes("draw") || s.includes("flux") || s.includes("stable") || s.includes("dall") || s.includes("cogview") || s.includes("wan") || s.includes("sana"))) return "image";
  if (s.includes("tts") || s.includes("speech") || s.includes("audio") || s.includes("voice")) return "audio";
  if (s.includes("asr") || s.includes("stt") || s.includes("whisper")) return "asr";
  if (s.includes("reasoning") || s.includes("think")) return "reasoning";
  if (s.includes("code") || s.includes("coder")) return "code";
  return "chat";
}

/* ------------------------------------------------------------------ */
/* 数据源解析器：每个源一个 parse 函数，返回 { entries, extra? }           */
/* 所有解析器都必须宽容：任何异常只影响该源，不中断整体。                    */
/* ------------------------------------------------------------------ */

/**
 * 通用 OpenAI 兼容解析器：GET {baseUrl}{listEndpoint} → { data: [{ id, name, ... }] }
 * 适用于 Groq / Mistral / Kimi / Step / Cerebras / Together / NVIDIA NIM /
 * DeepSeek 官方 / 百度千帆 等提供 /v1/models 的开放平台。
 * 免费判定优先级：freeModelIds 精确命中 > freeIdPatterns 包含命中 >
 *   defaultFree 兜底（"free" 全标免费 / "unknown" 标未知 / "paid" 全标付费）。
 */
async function genericOpenAICompatible(source) {
  const key = env(source.authEnv ?? "");
  if (!key) return { entries: [], skipped: `缺少 ${source.authEnv}（模型目录接口需要密钥）` };
  const headers = { authorization: `Bearer ${key}` };
  const body = await fetchWithRetry(`${source.baseUrl}${source.listEndpoint}`, { headers });
  const freeIds = new Set(source.freeModelIds ?? []);
  const patterns = source.freeIdPatterns ?? [];
  const entries = (body.data ?? []).map((m) => {
    const id = String(m.id ?? "");
    const inList = freeIds.has(id);
    const inPattern = patterns.some((p) => id.includes(p));
    const free = inList || inPattern || source.defaultFree === "free";
    const freeKind = inList || inPattern ? (source.freeKind ?? "quota") : source.defaultFree === "free" ? (source.freeKind ?? "quota") : "unknown";
    return {
      id: `${source.id}:${id}`,
      platform: source.id,
      platformLabel: source.label,
      modelId: id,
      displayName: m.name ?? id,
      category: classifyCategory(id),
      free,
      freeKind,
      freeDetail: free ? (source.freeDetail ?? "平台免费额度档内可调用（以官网为准）") : "按量付费（未收录为免费）",
      contextWindow: m.context_length ?? null,
      baseUrl: source.baseUrl,
      apiStyle: "openai-compatible",
      authRequired: true,
      authEnv: source.authEnv,
      rateLimit: source.rateLimit ?? null,
      notes: source.note ?? "",
      source: `${source.id}-live`,
      verifiedAt: nowIso(),
      link: source.link ?? ""
    };
  });
  return { entries };
}

const PARSERS = {
  /**
   * OpenRouter —— 公开模型目录，无需密钥。
   * GET /api/v1/models → { data: [{ id, name, context_length, pricing: {prompt, completion}, ... }] }
   * 免费判定：pricing 全 0，或 id 以 ":free" 结尾。
   */
  async openrouter(source) {
    const body = await fetchWithRetry(`${source.baseUrl}${source.listEndpoint}`);
    const entries = (body.data ?? []).map((m) => {
      const pricing = m.pricing ?? {};
      const prompt = Number(pricing.prompt ?? NaN);
      const completion = Number(pricing.completion ?? NaN);
      const free = (Number.isFinite(prompt) && prompt === 0) && (Number.isFinite(completion) && completion === 0);
      const id = String(m.id ?? "");
      const isFreeTag = id.endsWith(":free");
      return {
        id: `openrouter:${id}`,
        platform: "openrouter",
        platformLabel: source.label,
        modelId: id,
        displayName: m.name ?? id,
        category: classifyCategory(id),
        free: free || isFreeTag,
        freeKind: free || isFreeTag ? "permanent" : "paid",
        freeDetail: free ? "价格 $0（OpenRouter 目录标注免费）" : isFreeTag ? "OpenRouter :free 变体" : "付费模型（未收录）",
        contextWindow: m.context_length ?? null,
        baseUrl: source.baseUrl,
        apiStyle: "openai-compatible",
        authRequired: false,
        authEnv: null,
        rateLimit: null,
        notes: "",
        source: "openrouter-live",
        verifiedAt: nowIso(),
        link: `https://openrouter.ai/models/${encodeURIComponent(id)}`
      };
    });
    return { entries };
  },

  /**
   * SiliconFlow 硅基流动 —— 目录接口需要可选密钥；免费模型名单容易变动，
   * 因此免费判定以 curated 中的 FREE_MODEL_IDS 映射为准，接口只负责取到
   * 最新模型清单。
   * GET /v1/models → { data: [{ id, owned_by, ... }] }
   */
  async siliconflow(source) {
    const key = env(source.authEnv ?? "");
    if (!key) return { entries: [], skipped: `缺少 ${source.authEnv}（SiliconFlow 模型目录接口需要密钥）` };
    const headers = { authorization: `Bearer ${key}` };
    const body = await fetchWithRetry(`${source.baseUrl}${source.listEndpoint}`, { headers });
    const freeIds = new Set(source.freeModelIds ?? []);
    const entries = (body.data ?? []).map((m) => {
      const id = String(m.id ?? "");
      const isFree = freeIds.has(id) || source.freeIdPatterns?.some((p) => id.includes(p));
      return {
        id: `siliconflow:${id}`,
        platform: "siliconflow",
        platformLabel: source.label,
        modelId: id,
        displayName: id,
        category: classifyCategory(id),
        free: isFree,
        freeKind: isFree ? "permanent" : "unknown",
        freeDetail: isFree ? "平台标注免费模型" : "是否免费需以官网定价页为准",
        contextWindow: null,
        baseUrl: source.baseUrl,
        apiStyle: "openai-compatible",
        authRequired: true,
        authEnv: source.authEnv,
        rateLimit: null,
        notes: key ? "" : "未提供密钥，仅能取到模型清单，免费判定依赖维护名单",
        source: "siliconflow-live",
        verifiedAt: nowIso(),
        link: "https://cloud.siliconflow.cn/models"
      };
    });
    return { entries };
  },

  /**
   * GitHub Models —— 公开目录 https://models.github.ai/api/models（需 GitHub
   * 登录态 / PAT，401 时记录未授权）。免费额度模型由 curated 名单标注。
   */
  async "github-models"(source) {
    const token = env(source.authEnv ?? "");
    const headers = token ? { authorization: `Bearer ${token}` } : {};
    let body;
    try {
      body = await fetchWithRetry(`${source.baseUrl}${source.listEndpoint}`, { headers });
    } catch (error) {
      if (error.status === 401) return { entries: [], skipped: "需要 GitHub 令牌（未提供或无效）" };
      if (error.status === 404) return { entries: [], skipped: "目录端点返回 404（可能已变动或需要登录态），请核对 https://models.github.ai 的当前端点" };
      throw error;
    }
    const list = Array.isArray(body) ? body : body.data ?? body.models ?? [];
    const freeIds = new Set(source.freeModelIds ?? []);
    const entries = list.map((m) => {
      const id = String(m.id ?? m.name ?? "");
      const isFree = freeIds.has(id) || source.freeIdPatterns?.some((p) => id.includes(p));
      return {
        id: `github-models:${id}`,
        platform: "github-models",
        platformLabel: source.label,
        modelId: id,
        displayName: m.displayName ?? m.friendlyName ?? id,
        category: classifyCategory(id),
        free: isFree,
        freeKind: isFree ? "quota" : "unknown",
        freeDetail: isFree ? "GitHub Models 免费额度内可调用（有限速）" : "免费额度以官方说明为准",
        contextWindow: m.contextWindow ?? null,
        baseUrl: source.baseUrl,
        apiStyle: "openai-compatible",
        authRequired: true,
        authEnv: source.authEnv,
        rateLimit: "GitHub Models 有请求速率限制",
        notes: "",
        source: "github-models-live",
        verifiedAt: nowIso(),
        link: "https://models.github.ai"
      };
    });
    return { entries };
  },

  /**
   * Google AI Studio / Gemini —— 需要 GEMINI_API_KEY。
   * GET /v1beta/models?key=… → { models: [{ name, supportedGenerationMethods }] }
   * Google 对 Gemini 模型提供免费配额档，全部标注为 quota 类免费。
   */
  async "google-ai-studio"(source) {
    const key = env(source.authEnv ?? "");
    if (!key) return { entries: [], skipped: `缺少 ${source.authEnv}（AI Studio 免费额度需密钥，可到 aistudio.google.com 申请）` };
    const body = await fetchWithRetry(`${source.baseUrl}${source.listEndpoint}?key=${encodeURIComponent(key)}`);
    const entries = (body.models ?? []).map((m) => {
      const id = String(m.name ?? "").replace(/^models\//, "");
      const methods = m.supportedGenerationMethods ?? [];
      const canChat = methods.includes("generateContent") || methods.includes("streamGenerateContent");
      const canEmbed = methods.includes("embedContent");
      return {
        id: `google-ai-studio:${id}`,
        platform: "google-ai-studio",
        platformLabel: source.label,
        modelId: id,
        displayName: m.displayName ?? id,
        category: canEmbed ? "embedding" : canChat ? "chat" : "other",
        free: true,
        freeKind: "quota",
        freeDetail: "Gemini API 免费配额档（Tier 1，随账号等级变化，以官方为准）",
        contextWindow: null,
        baseUrl: "https://generativelanguage.googleapis.com/v1beta",
        apiStyle: "native",
        authRequired: true,
        authEnv: source.authEnv,
        rateLimit: "免费档有 RPM/TPM 限制",
        notes: "",
        source: "google-ai-studio-live",
        verifiedAt: nowIso(),
        link: `https://ai.google.dev/gemini-api/docs/models/${encodeURIComponent(id)}`
      };
    });
    return { entries };
  },

  /**
   * OpenCode Zen —— 华为 WorkSwarm 免费模型的真实同源网关，公开目录、无需密钥。
   * GET /zen/v1/models → { data: [{ id, object, created, owned_by }] }
   * 免费判定：id 以 "-free" 结尾（WorkSwarm 的免费模型即此类：hy3-free、
   * deepseek-v4-flash-free、nemotron-3.5-lightning-free 等，输入/输出 $0）。
   * 已实测（2026-08-24）：hy3-free / x-preview-f-free / nemotron-3-ultra-free /
   * nemotron-3.5-lightning-free / laguna-s-2.1-free 可调用；deepseek-v4-flash-free
   * 上游暂不可用（Model is unavailable）、muse-spark-1.2-contributor-free 有地区限制。
   */
  async opencode(source) {
    const body = await fetchWithRetry(`${source.baseUrl}${source.listEndpoint}`);
    const entries = (body.data ?? []).map((m) => {
      const id = String(m.id ?? "");
      const isFree = id.endsWith("-free");
      return {
        id: `opencode:${id}`,
        platform: "opencode",
        platformLabel: source.label,
        modelId: id,
        displayName: id,
        category: classifyCategory(id),
        free: isFree,
        freeKind: isFree ? "permanent" : "paid",
        freeDetail: isFree ? "OpenCode Zen 网关免费模型（输入/输出 $0，有限速）" : "付费模型（未收录）",
        contextWindow: null,
        baseUrl: source.baseUrl,
        apiStyle: "openai-compatible",
        authRequired: false,
        authEnv: null,
        rateLimit: "Zen 免费模型有限速",
        notes: "OpenCode Zen 网关（opencode.ai/zen），华为 WorkSwarm 免费模型的同源网关；免密钥，OpenAI 兼容。",
        source: "opencode-live",
        verifiedAt: nowIso(),
        link: "https://opencode.ai/zen"
      };
    });
    return { entries };
  },

  /** 智谱 GLM 开放平台 —— 需要 BIGMODEL_API_KEY；免费模型名单来自 curated。 */
  async zhipu(source) {
    const key = env(source.authEnv ?? "");
    if (!key) return { entries: [], skipped: `缺少 ${source.authEnv}` };
    const body = await fetchWithRetry(`${source.baseUrl}${source.listEndpoint}`, { headers: { authorization: `Bearer ${key}` } });
    const freeIds = new Set(source.freeModelIds ?? []);
    const entries = (body.data ?? []).map((m) => {
      const id = String(m.id ?? "");
      const isFree = freeIds.has(id);
      return {
        id: `zhipu:${id}`,
        platform: "zhipu",
        platformLabel: source.label,
        modelId: id,
        displayName: m.name ?? id,
        category: classifyCategory(id),
        free: isFree,
        freeKind: isFree ? "permanent" : "unknown",
        freeDetail: isFree ? "平台免费模型（如 GLM-4-Flash 系列）" : "是否免费以官网为准",
        contextWindow: null,
        baseUrl: source.baseUrl,
        apiStyle: "openai-compatible",
        authRequired: true,
        authEnv: source.authEnv,
        rateLimit: null,
        notes: "",
        source: "zhipu-live",
        verifiedAt: nowIso(),
        link: "https://open.bigmodel.cn/pricing"
      };
    });
    return { entries };
  },

  /** 阿里云百炼 —— 需要 DASHSCOPE_API_KEY；免费模型名单来自 curated。 */
  async dashscope(source) {
    const key = env(source.authEnv ?? "");
    if (!key) return { entries: [], skipped: `缺少 ${source.authEnv}` };
    const body = await fetchWithRetry(`${source.baseUrl}${source.listEndpoint}`, { headers: { authorization: `Bearer ${key}` } });
    const freeIds = new Set(source.freeModelIds ?? []);
    const entries = (body.data ?? []).map((m) => {
      const id = String(m.id ?? "");
      const isFree = freeIds.has(id) || source.freeIdPatterns?.some((p) => id.includes(p));
      return {
        id: `dashscope:${id}`,
        platform: "dashscope",
        platformLabel: source.label,
        modelId: id,
        displayName: m.name ?? id,
        category: classifyCategory(id),
        free: isFree,
        freeKind: isFree ? "permanent" : "unknown",
        freeDetail: isFree ? "百炼免费模型（新用户另有免费额度）" : "是否免费以官网为准",
        contextWindow: null,
        baseUrl: source.baseUrl,
        apiStyle: "openai-compatible",
        authRequired: true,
        authEnv: source.authEnv,
        rateLimit: null,
        notes: "",
        source: "dashscope-live",
        verifiedAt: nowIso(),
        link: "https://bailian.console.aliyun.com/"
      };
    });
    return { entries };
  },

  /**
   * Cloudflare Workers AI —— 需要 CF_API_TOKEN + CF_ACCOUNT_ID。
   * 目录接口：/accounts/{id}/ai/models/search；Workers AI 免费档每天 1 万神经元。
   */
  async "cloudflare-workers-ai"(source) {
    const token = env(source.authEnv ?? "");
    const account = env(source.accountEnv ?? "");
    if (!token || !account) return { entries: [], skipped: `缺少 ${source.authEnv} / ${source.accountEnv}` };
    const body = await fetchWithRetry(
      `${source.baseUrl}/accounts/${encodeURIComponent(account)}/ai/models/search?per_page=50`,
      { headers: { authorization: `Bearer ${token}` } }
    );
    const entries = (body.result ?? []).map((m) => {
      const id = String(m.name ?? "");
      return {
        id: `cloudflare-workers-ai:${id}`,
        platform: "cloudflare-workers-ai",
        platformLabel: source.label,
        modelId: id,
        displayName: m.name ?? id,
        category: classifyCategory(id),
        free: true,
        freeKind: "quota",
        freeDetail: "Workers AI 免费档：每天 10,000 神经元额度",
        contextWindow: null,
        baseUrl: `https://api.cloudflare.com/client/v4/accounts/${account}/ai/run`,
        apiStyle: "native",
        authRequired: true,
        authEnv: source.authEnv,
        rateLimit: "免费档 10,000 neurons/天",
        notes: "",
        source: "cloudflare-live",
        verifiedAt: nowIso(),
        link: "https://developers.cloudflare.com/workers-ai/"
      };
    });
    return { entries };
  },

  /**
   * 社区免费 API 清单（mnfst/awesome-free-llm-apis 的 data.json）——
   * 机器可读，作为结构化补充源。
   * 结构：{ lastUpdated, providers: [{ name, category, url, baseUrl, description, models: [{ id, name, context, maxOutput, modality, rateLimit }] }] }
   */
  async "mnfst-awesome-free-llm-apis"(source) {
    const text = await fetchWithRetry(source.rawUrl, { json: false });
    mkdirSync(REF_DIR, { recursive: true });
    atomicWrite(join(REF_DIR, `${source.id}.json`), text);
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      return { entries: [], skipped: "清单不是合法 JSON（可能接口变动）" };
    }
    const providers = Array.isArray(body) ? body : body.providers ?? body.models ?? body.data ?? [];
    const entries = [];
    for (const provider of providers) {
      const providerName = String(provider.name ?? provider.provider ?? "community");
      const platform = source.providerMap?.[providerName] ?? `community:${providerName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
      const providerBase = String(provider.baseUrl ?? provider.base_url ?? provider.endpoint ?? "");
      const description = String(provider.description ?? "").slice(0, 200);
      for (const m of provider.models ?? []) {
        const modelId = String(m.id ?? m.model ?? m.name ?? "");
        if (!modelId) continue;
        entries.push({
          id: `${platform}:${modelId}`,
          platform,
          platformLabel: providerName,
          modelId,
          displayName: m.name ?? modelId,
          category: classifyCategory(modelId),
          free: true,
          freeKind: "permanent",
          freeDetail: description || "社区清单收录的永久免费 API",
          contextWindow: parseContext(m.context),
          baseUrl: providerBase,
          apiStyle: "openai-compatible",
          authRequired: true,
          authEnv: null,
          rateLimit: m.rateLimit ?? m.rate_limit ?? provider.rateLimit ?? null,
          notes: String(m.modality ?? ""),
          source: "community-list",
          verifiedAt: nowIso(),
          link: String(provider.url ?? m.url ?? "")
        });
      }
    }
    return { entries };
  },

  /**
   * open-free-llm-api/awesome-freellm-apis 的 README —— 免费 LLM API 大全
   * （134+ 条，40+ 平台）。README 是给人看的，这里只保存副本并在报告中
   * 引用，不强行结构化解析（避免虚假精度）。
   */
  async "awesome-freellm-apis-readme"(source) {
    const text = await fetchWithRetry(source.rawUrl, { json: false });
    mkdirSync(REF_DIR, { recursive: true });
    atomicWrite(join(REF_DIR, "awesome-freellm-apis.md"), text);
    return { entries: [], reference: { id: source.id, label: source.label, path: join(REF_DIR, "awesome-freellm-apis.md") } };
  },

  /* ---- OpenAI 兼容平台：共享 genericOpenAICompatible 解析器 ---- */
  "nvidia-nim": genericOpenAICompatible,
  groq: genericOpenAICompatible,
  mistral: genericOpenAICompatible,
  moonshot: genericOpenAICompatible,
  stepfun: genericOpenAICompatible,
  cerebras: genericOpenAICompatible,
  together: genericOpenAICompatible,
  deepseek: genericOpenAICompatible,
  "baidu-qianfan": genericOpenAICompatible
};

/* ------------------------------------------------------------------ */
/* 核心流程                                                             */
/* ------------------------------------------------------------------ */

function loadSources() {
  const config = loadJson(join(DATA_DIR, "sources.json"), { sources: [] });
  return Array.isArray(config.sources) ? config.sources : [];
}

function loadCurated() {
  const curated = loadJson(join(DATA_DIR, "curated.json"), { entries: [] });
  const entries = Array.isArray(curated.entries) ? curated.entries : [];
  return entries.map((e) => ({
    ...e,
    free: e.free !== false,
    source: e.source ?? "curated",
    verifiedAt: e.verifiedAt ?? curated.meta?.updatedAt ?? nowIso()
  }));
}

function loadCache() {
  return loadJson(FILE_JSON, { entries: [] }).entries ?? [];
}

/** 主刷新：遍历启用源 → 收集条目 → 归一化 → 与 curated/缓存合并 → 输出。 */
async function refresh({ only = null, offline = false, outDir = DATA_DIR } = {}) {
  const sources = loadSources().filter((s) => s.enabled !== false);
  const selected = only ? only.split(",").map((s) => s.trim()).filter(Boolean) : null;
  const perSource = {};
  const collected = [];

  // 1) curated 与上次缓存先打底（离线永远可用）
  const curated = loadCurated();
  collected.push(...curated);
  const cache = offline ? loadCache() : [];
  if (offline) collected.push(...cache);

  // 2) 在线拉取（仅非离线模式；offline 时所有在线源标记为跳过）
  for (const source of sources) {
    const sid = source.id;
    if (selected && !selected.includes(sid) && !selected.includes("all")) continue;
    if (offline) {
      perSource[sid] = { status: "skipped", skipped: "offline 模式（未联网）" };
      continue;
    }
    const parser = PARSERS[sid];
    if (!parser) {
      perSource[sid] = { status: "no-parser", error: `未实现解析器（数据源 id=${sid}）` };
      continue;
    }
    const started = Date.now();
    try {
      const result = await parser(source);
      collected.push(...(result.entries ?? []));
      perSource[sid] = {
        status: result.skipped ? "skipped" : "ok",
        count: (result.entries ?? []).length,
        durationMs: Date.now() - started,
        ...(result.skipped ? { skipped: result.skipped } : {}),
        ...(result.reference ? { reference: result.reference } : {})
      };
    } catch (error) {
      perSource[sid] = { status: "error", error: String(error.message ?? error), durationMs: Date.now() - started };
    }
  }

  // 3) 归一化 + 去重（live 优先于 curated；同平台同 modelId 取后者覆盖前者）
  const byKey = new Map();
  for (const entry of collected) {
    const platform = String(entry.platform ?? "unknown");
    const modelId = String(entry.modelId ?? entry.id ?? "");
    if (!modelId) continue;
    const key = `${platform}:${modelId}`;
    const previous = byKey.get(key);
    if (!previous) {
      byKey.set(key, { ...entry, id: key, platform, modelId });
    } else if (entry.source !== "curated") {
      byKey.set(key, { ...previous, ...entry, id: key, platform, modelId });
    }
  }
  const entries = [...byKey.values()].sort((a, b) =>
    (a.platformLabel ?? a.platform).localeCompare(b.platformLabel ?? b.platform) ||
    a.modelId.localeCompare(b.modelId)
  );

  // 4) 统计与状态
  const freeEntries = entries.filter((e) => e.free);
  const byPlatform = {};
  for (const e of entries) byPlatform[e.platform] = (byPlatform[e.platform] ?? 0) + 1;
  const freeByPlatform = {};
  for (const e of freeEntries) freeByPlatform[e.platform] = (freeByPlatform[e.platform] ?? 0) + 1;

  const state = {
    lastRunAt: nowIso(),
    mode: offline ? "offline" : "online",
    totals: {
      entries: entries.length,
      free: freeEntries.length,
      platforms: Object.keys(byPlatform).length,
      byPlatform,
      freeByPlatform
    },
    perSource,
    stale: false
  };

  // 5) 写输出
  mkdirSync(outDir, { recursive: true });
  atomicWrite(join(outDir, "state.json"), JSON.stringify(state, null, 2));
  const payload = { meta: { generatedAt: nowIso(), mode: state.mode, freeCount: freeEntries.length, totalCount: entries.length, note: "免费状态与额度以各平台官网为准；本文件由 free-api-radar 自动生成" }, entries };
  atomicWrite(join(outDir, "free-apis.json"), JSON.stringify(payload, null, 2));
  atomicWrite(join(outDir, "free-apis.md"), renderMarkdown(state, entries, freeEntries, sources, curated.length, cache.length));

  return state;
}

/* ------------------------------------------------------------------ */
/* 报告渲染                                                             */
/* ------------------------------------------------------------------ */

function renderMarkdown(state, entries, freeEntries, sources, curatedCount, cacheCount) {
  const L = [];
  const byPlatform = new Map();
  for (const e of freeEntries) {
    const list = byPlatform.get(e.platform) ?? [];
    list.push(e);
    byPlatform.set(e.platform, list);
  }
  L.push("# 全平台免费可调用 API 雷达（free-api-radar）");
  L.push("");
  L.push(`> 生成时间：${state.lastRunAt}（${state.mode === "offline" ? "离线模式，数据可能过期" : "在线拉取"}）`);
  L.push(`> 共收录 **${freeEntries.length}** 条免费条目 / **${entries.length}** 条模型记录（curated 种子 ${curatedCount} 条，缓存 ${cacheCount} 条）。`);
  L.push(`> ⚠️ 免费额度、限速与定价会随时调整，**以各平台官网为准**；标注 "unknown" 的条目表示接口未返回定价信息，需自行核实。`);
  L.push("");
  L.push("## 源状态");
  L.push("");
  L.push("| 源 | 状态 | 条目数 | 说明 |");
  L.push("| --- | --- | --- | --- |");
  for (const s of sources) {
    const st = state.perSource[s.id] ?? { status: "not-run" };
    L.push(`| ${s.label} | ${st.status} | ${st.count ?? 0} | ${st.error ?? st.skipped ?? st.reference?.path ?? ""} |`);
  }
  L.push("");
  L.push("## 免费可调用条目（按平台）");
  L.push("");
  for (const [platform, list] of [...byPlatform.entries()].sort()) {
    const label = list[0]?.platformLabel ?? platform;
    L.push(`### ${label}（${platform}）`);
    L.push("");
    L.push("| 模型 | 类别 | 免费类型 | 上下文 | 认证 | 备注 |");
    L.push("| --- | --- | --- | --- | --- | --- |");
    for (const e of list) {
      const ctx = e.contextWindow ? String(e.contextWindow) : "—";
      const auth = e.authRequired ? `需要 Key${e.authEnv ? `（${e.authEnv}）` : ""}` : "无需 Key";
      L.push(`| ${e.displayName}（\`${e.modelId}\`） | ${e.category} | ${e.freeKind} | ${ctx} | ${auth} | ${(e.notes ?? "").replace(/\|/g, "\\|")} |`);
    }
    L.push("");
  }
  L.push("## 各平台免费额度速览（人工维护，以官网为准）");
  L.push("");
  L.push("| 平台 | 免费机制 | 官方入口 |");
  L.push("| --- | --- | --- |");
  const quick = loadJson(join(DATA_DIR, "curated.json"), { quickFacts: [] }).quickFacts ?? [];
  for (const f of quick) L.push(`| ${f.platform} | ${f.fact} | ${f.link ?? ""} |`);
  L.push("");
  L.push("## 如何获取密钥");
  L.push("");
  L.push("- OpenRouter：https://openrouter.ai/keys（免费模型可不带 Key 试调，建议申请）");
  L.push("- Google AI Studio：https://aistudio.google.com/apikey（Gemini 免费配额档）");
  L.push("- GitHub Models：https://github.com/settings/tokens（GitHub Models 免费额度）");
  L.push("- NVIDIA NIM：https://build.nvidia.com（免费 API Key）");
  L.push("- 智谱：https://open.bigmodel.cn/usercenter/apikeys");
  L.push("- 阿里百炼：https://bailian.console.aliyun.com/#/api-key");
  L.push("- Cloudflare：https://dash.cloudflare.com/profile/api-tokens（+ Account ID）");
  L.push("- SiliconFlow：https://cloud.siliconflow.cn/account/ak");
  L.push("- 华为 WorkSwarm：开发者招募计划免费 Token，详见官方公告");
  L.push("");
  L.push("## 命令行速查");
  L.push("");
  L.push("```sh");
  L.push("node scripts/fetch-free-apis.mjs refresh          # 立即拉取并生成报告");
  L.push("node scripts/fetch-free-apis.mjs list --free-only # 列出全部免费条目");
  L.push("node scripts/fetch-free-apis.mjs search gemini    # 搜索");
  L.push("node scripts/fetch-free-apis.mjs loop --minutes 1440  # 每 24h 自动刷新");
  L.push("```");
  L.push("");
  return L.join("\n");
}

/* ------------------------------------------------------------------ */
/* CLI                                                                 */
/* ------------------------------------------------------------------ */

function printUsage() {
  console.log(`free-api-radar —— 全平台免费可调用 API 自动拉取引擎

用法:
  node scripts/fetch-free-apis.mjs <命令> [选项]

命令:
  refresh    拉取全部启用数据源并重新生成 data/free-apis.{json,md}、state.json
  list       列出条目（--free-only 只看免费；--platform <id> 过滤平台；--json 输出 JSON）
  search <q> 在条目中搜索关键词
  status     查看最近一次运行状态与各源健康度
  loop       定时循环刷新（--minutes N，默认 1440）

选项:
  --offline            只使用 curated 种子与上次缓存，不联网
  --only <a,b>         只拉取指定数据源（id 用逗号分隔，见 data/sources.json）
  --stale-hours <N>    refresh 时，若上次成功刷新距今 < N 小时则跳过并复用旧报告
  --out <dir>          输出目录（默认 data/）
  --minutes <N>        loop 的刷新间隔（分钟）
  --help               显示本帮助`);
}

function readIndex(outDir) {
  const idx = loadJson(join(outDir, "free-apis.json"), { entries: [] });
  return idx.entries ?? [];
}

async function main(argv) {
  const [command, ...rest] = argv;
  const opt = (name) => {
    const i = rest.indexOf(name);
    return i >= 0 ? rest[i + 1] : undefined;
  };
  const has = (name) => rest.includes(name);
  const outDir = opt("--out") ? resolve(opt("--out")) : DATA_DIR;

  switch (command) {
    case "refresh": {
      const staleHours = Number(opt("--stale-hours") ?? 0);
      if (staleHours > 0 && existsSync(join(outDir, "free-apis.json"))) {
        const state = loadJson(join(outDir, "state.json"), null);
        if (state?.lastRunAt && (Date.now() - new Date(state.lastRunAt).getTime()) < staleHours * 3600e3) {
          console.log(`最近 ${staleHours} 小时内已刷新过（${state.lastRunAt}），跳过。加 --stale-hours 0 强制刷新。`);
          return;
        }
      }
      const state = await refresh({
        only: opt("--only") ?? null,
        offline: has("--offline"),
        outDir
      });
      console.log(`完成：${state.totals.free} 条免费 / ${state.totals.entries} 条记录，覆盖 ${state.totals.platforms} 个平台（${state.mode}）`);
      for (const [sid, st] of Object.entries(state.perSource)) {
        if (st.status !== "ok") console.log(`  [${sid}] ${st.status}: ${st.error ?? st.skipped ?? ""}`);
      }
      return;
    }
    case "list": {
      let items = readIndex(outDir);
      if (has("--free-only")) items = items.filter((e) => e.free);
      const platform = opt("--platform");
      if (platform) items = items.filter((e) => e.platform.toLowerCase().includes(platform.toLowerCase()) || (e.platformLabel ?? "").toLowerCase().includes(platform.toLowerCase()));
      if (has("--json")) {
        console.log(JSON.stringify(items, null, 2));
      } else {
        for (const e of items) {
          const flag = e.free ? "FREE" : "paid";
          console.log(`[${flag}] ${e.platformLabel ?? e.platform} | ${e.modelId} | ${e.category} | ${e.freeDetail ?? ""}`);
        }
        console.log(`共 ${items.length} 条`);
      }
      return;
    }
    case "search": {
      const q = rest.find((r) => !r.startsWith("--"));
      if (!q) {
        console.log("用法: node scripts/fetch-free-apis.mjs search <关键词>");
        return;
      }
      const items = readIndex(outDir).filter((e) =>
        [e.modelId, e.displayName, e.platform, e.platformLabel, e.notes, e.freeDetail].join(" ").toLowerCase().includes(q.toLowerCase())
      );
      for (const e of items) {
        const flag = e.free ? "FREE" : "paid";
        console.log(`[${flag}] ${e.platformLabel ?? e.platform} | ${e.modelId} | ${e.category} | ${e.freeDetail ?? ""}`);
      }
      console.log(`匹配 ${items.length} 条`);
      return;
    }
    case "status": {
      const state = loadJson(join(outDir, "state.json"), null);
      if (!state) {
        console.log("尚无运行记录，先执行 refresh。");
        return;
      }
      console.log(`上次运行：${state.lastRunAt}（${state.mode}）`);
      console.log(`免费 ${state.totals.free} / 总 ${state.totals.entries} / 平台 ${state.totals.platforms}`);
      for (const [sid, st] of Object.entries(state.perSource)) {
        console.log(`  [${sid}] ${st.status} ${st.count ?? 0} 条 ${st.error ?? ""} ${st.skipped ?? ""}`);
      }
      return;
    }
    case "loop": {
      const minutes = Number(opt("--minutes") ?? 1440);
      console.log(`进入循环刷新模式：每 ${minutes} 分钟一次（Ctrl+C 退出）`);
      for (;;) {
        await refresh({ offline: has("--offline"), outDir });
        await new Promise((r) => setTimeout(r, minutes * 60e3));
      }
    }
    default:
      printUsage();
  }
}

main(process.argv.slice(2)).catch((error) => {
  console.error(`失败: ${error.message ?? error}`);
  process.exitCode = 1;
});
