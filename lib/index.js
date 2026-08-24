/**
 * free-api-radar —— dsh bundle 工具插件（可选安装方式）
 * =================================================================
 * 把免费 API 雷达引擎封装成一个模型可调用的工具 `free_api_radar`。
 * 安装（二选一，推荐零安装的技能方式见 .dsh/skills/free-api-radar）：
 *   dsh plugin --profile <name> add .
 * 然后重启 profile 的 Host。
 *
 * 导出格式遵循 dsh 工具包的 Service Definition 模式：
 *   export { name, inject, Config, apply }
 * 执行逻辑放在引擎脚本 scripts/fetch-free-apis.mjs 里，本插件只做
 * 参数校验、调用引擎、读回结果并渲染给模型。
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import z from "@deepseek-ai/schemastery";
import { defineTool } from "@deepseek-ai/dsh-tools";

const PLUGIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(PLUGIN_ROOT, "scripts", "fetch-free-apis.mjs");

const name = "free-api-radar";
const inject = ["tools"];

const Config = z.object({
  script: z.string().default("./scripts/fetch-free-apis.mjs"),
  maxOutputChars: z.number().default(6000)
});

function readJsonOrNull(rel) {
  const path = join(PLUGIN_ROOT, rel);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function runEngine(args, maxOutputChars) {
  const result = spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: PLUGIN_ROOT,
    encoding: "utf8",
    timeout: 120000
  });
  if (result.error) throw new Error(`无法运行引擎: ${result.error.message}`);
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  return output.length > maxOutputChars ? `${output.slice(0, maxOutputChars)}\n…（输出已截断）` : output;
}

function summarize() {
  const index = readJsonOrNull("data/free-apis.json");
  const state = readJsonOrNull("data/state.json");
  const entries = index?.entries ?? [];
  const free = entries.filter((e) => e.free);
  const lines = [];
  if (state) lines.push(`最近刷新：${state.lastRunAt}（${state.mode}）`);
  lines.push(`共 ${entries.length} 条模型记录，其中免费可调用 ${free.length} 条。`);
  const byPlatform = new Map();
  for (const e of free) byPlatform.set(e.platformLabel ?? e.platform, (byPlatform.get(e.platformLabel ?? e.platform) ?? 0) + 1);
  lines.push("免费条目按平台：" + [...byPlatform.entries()].map(([p, n]) => `${p}(${n})`).join("、"));
  if (state) {
    const unhealthy = Object.entries(state.perSource).filter(([, s]) => s.status !== "ok");
    if (unhealthy.length) lines.push(`数据源状态：${unhealthy.map(([id, s]) => `${id}=${s.status}`).join("、")}（见 state.json 详情）`);
  }
  lines.push("完整报告：data/free-apis.md；机器索引：data/free-apis.json。");
  return lines.join("\n");
}

function apply(ctx, config) {
  const maxOutputChars = config.maxOutputChars ?? 6000;
  ctx.tools.register(defineTool({
    name: "free_api_radar",
    description:
      "全平台免费可调用 API / 免费大模型 API 雷达。可触发刷新（从 OpenRouter、Gemini、GitHub Models、SiliconFlow、智谱、百炼、Cloudflare 及社区清单在线拉取并更新 data/free-apis.json/md），或直接查询已生成的索引。免费额度随时变动，回答时须以各平台官网为准。",
    parameters: {
      action: {
        type: "string",
        required: true,
        enum: ["refresh", "list", "search", "status"],
        description: "refresh=在线拉取并更新报告；list=列出条目；search=搜索关键词；status=查看数据源健康度"
      },
      query: { type: "string", description: "search 时的关键词" },
      platform: { type: "string", description: "list 时按平台过滤（如 openrouter / gemini / workswarm）" },
      offline: { type: "boolean", description: "refresh 时仅用 curated 种子与缓存，不联网" },
      staleHours: { type: "number", description: "refresh 时距上次成功刷新小于该小时数则跳过（默认 24）" }
    },
    output: {
      schema: { type: "string" },
      render: (_args, value) => [{ type: "text", text: value }]
    },
    presentCall: (args) => ({
      card: "generic",
      title: `free_api_radar: ${args.action}`,
      kind: "other",
      rawInput: args.action
    }),
    async execute(args) {
      const { action } = args;
      if (action === "refresh") {
        const cli = ["refresh"];
        if (args.offline) cli.push("--offline");
        const stale = Number(args.staleHours ?? 24);
        if (stale > 0) cli.push("--stale-hours", String(stale));
        const output = runEngine(cli, maxOutputChars);
        return `${output}\n\n${summarize()}`;
      }
      if (action === "status") {
        const state = readJsonOrNull("data/state.json");
        if (!state) return "尚无运行记录，先执行 action=refresh。";
        const lines = [`上次运行：${state.lastRunAt}（${state.mode}）`, `免费 ${state.totals.free} / 总 ${state.totals.entries} / 平台 ${state.totals.platforms}`];
        for (const [sid, st] of Object.entries(state.perSource)) {
          lines.push(`  [${sid}] ${st.status} ${st.count ?? 0} 条 ${st.error ?? st.skipped ?? ""}`);
        }
        return lines.join("\n");
      }
      if (action === "list" || action === "search") {
        const index = readJsonOrNull("data/free-apis.json");
        if (!index) return "还没有索引数据，先执行 action=refresh。";
        let items = index.entries ?? [];
        if (action === "search" && args.query) {
          const q = String(args.query).toLowerCase();
          items = items.filter((e) =>
            [e.modelId, e.displayName, e.platform, e.platformLabel, e.notes, e.freeDetail].join(" ").toLowerCase().includes(q)
          );
        }
        if (args.platform) {
          const p = String(args.platform).toLowerCase();
          items = items.filter((e) => e.platform.toLowerCase().includes(p) || (e.platformLabel ?? "").toLowerCase().includes(p));
        }
        const freeOnly = args.freeOnly !== false && action === "list" ? true : false;
        const shown = freeOnly ? items.filter((e) => e.free) : items;
        const lines = shown.slice(0, 120).map((e) =>
          `[${e.free ? "FREE" : "paid"}] ${e.platformLabel ?? e.platform} | ${e.modelId} | ${e.category} | ${e.freeDetail ?? ""}`
        );
        if (shown.length > 120) lines.push(`…（共 ${shown.length} 条，仅显示前 120 条）`);
        lines.push(`共 ${shown.length} 条（全部 ${items.length} 条）`);
        return lines.join("\n");
      }
      return `未知 action: ${action}`;
    }
  }));
}

export { Config, apply, inject, name };
