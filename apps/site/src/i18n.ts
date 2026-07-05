export type SiteLocale = "zh-CN" | "en-US";

export const defaultSiteLocale: SiteLocale = "zh-CN";
export const siteLocaleStorageKey = "edgeever.site.locale";
export const siteLocaleDataAttribute = "data-edgeever-site-locale";

export const getSiteLocale = (pathname: string): SiteLocale => (pathname === "/en" || pathname.startsWith("/en/") ? "en-US" : "zh-CN");

export const getLocalizedPath = (locale: SiteLocale, path: string) => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (locale === "zh-CN") {
    return normalizedPath === "/en" ? "/" : normalizedPath.replace(/^\/en(?=\/|$)/, "") || "/";
  }

  if (normalizedPath === "/") {
    return "/en/";
  }

  return normalizedPath.startsWith("/en/") ? normalizedPath : `/en${normalizedPath}`;
};

export const siteCopy = {
  "zh-CN": {
    layout: {
      defaultDescription:
        "EdgeEver 是一个开源、自托管、Cloudflare-native 的现代笔记工作区。保留经典印象笔记的三栏体验，支持富文本、无限嵌套，原生支持 MCP 对 AI Agent 极度友好，个人托管接近零成本。",
      defaultTitle: "EdgeEver - 基于 Cloudflare 全家桶自托管的免费开源『印象笔记』",
      imageAlt: "EdgeEver 笔记应用截图",
      ogLocale: "zh_CN",
    },
    nav: {
      homeAria: "EdgeEver 首页",
      features: "功能特性",
      deploy: "安装部署",
      blog: "博客",
      contact: "联系我们",
      demo: "在线演示",
      language: "语言",
      languageMenu: "切换语言",
    },
    hero: {
      slogan: "基于 Cloudflare 全家桶自托管的免费开源『印象笔记』",
      demo: "在线演示",
      agentInstall: "通过AI Agent安装",
      imageAlt: "EdgeEver product preview",
    },
    features: {
      heading: "重新定义个人笔记体验",
      items: [
        {
          title: "海量存储，个人自托管永久免费。",
          summary: "依托 Cloudflare D1 与 R2 的免费额度，为个人笔记提供几乎无限的存储体验。",
          points: [
            "免费额度对个人笔记足够宽裕：短笔记可达 15 万条，200KB 图片约可存放 5 万张。",
            "图片上传前在浏览器本地压缩，常见截图和照片通常减少 50%-90% 体积。",
            "数据和资源分别落在 D1 与 R2，部署后由你自己的 Cloudflare 账号承载。",
          ],
        },
        {
          title: "AI Agent 原生连接",
          summary: "内置 REST API、OpenAPI schema 与 Remote MCP endpoint，让 AI 助手安全地读取、创建和整理笔记。",
          points: [
            "在应用内生成 MCP Token，就能把 EdgeEver 接入 Codex、Claude Code、Antigravity 等工具。",
            "适合做灵感归纳、自动打标签、知识图谱整理和跨笔记检索。",
            "API 与 Agent 能力围绕你的私有实例工作，不依赖封闭笔记平台。",
          ],
        },
        {
          title: "经典三栏，熟悉但更轻快",
          summary: "保留印象笔记式的笔记本树、笔记列表和主编辑区，减少迁移后的学习成本。",
          points: [
            "支持无限级嵌套笔记本，适合长期沉淀的大型知识库。",
            "笔记本可以拖拽排序和调整层级，笔记支持多选移动与多选合并。",
            "基于 TipTap 的富文本编辑器支持查看笔记历史版本，兼顾流畅写作与内容回溯。",
          ],
        },
        {
          title: "数据开放，迁移和导出不被绑架",
          summary: "笔记内容以结构化 JSON、Markdown 与纯文本多形态保存，便于编辑器、API、搜索和 Agent 分别使用。",
          points: [
            "内容存放在基于标准 SQLite 的 Cloudflare D1 中，可通过 API、MCP 或 CLI 按需读取。",
            "支持印象笔记数据导入能力，降低从旧笔记库迁移过来的成本。",
            "Markdown 面向导入导出和 Agent 使用，降低未来再次迁移的成本。",
          ],
        },
        {
          title: "多端随手记录，同步几乎无感",
          summary: "电脑、手机、平板都能直接打开使用，记录和同步尽量贴近本地应用的顺滑体验。",
          points: [
            "支持 PC 与移动端网页访问，也可以安装成 PWA，随手打开就能记。",
            "已有笔记支持离线编辑草稿和本地同步队列，弱网时也能先写后同步。",
            "单用户登录、PBKDF2-SHA256 密码 hash 与独立 API Token，安全能力放在顺手体验背后。",
          ],
        },
      ],
    },
  },
  "en-US": {
    layout: {
      defaultDescription:
        "EdgeEver is an open-source, self-hosted, Cloudflare-native notes workspace with a classic three-pane workflow, rich text, nested notebooks, REST API, OpenAPI schema, and Remote MCP endpoint.",
      defaultTitle: "EdgeEver - A self-hosted, Cloudflare-native Evernote alternative",
      imageAlt: "EdgeEver notes app screenshot",
      ogLocale: "en_US",
    },
    nav: {
      homeAria: "EdgeEver home",
      features: "Features",
      deploy: "Deploy",
      blog: "Blog",
      contact: "Contact",
      demo: "Demo",
      language: "Language",
      languageMenu: "Change language",
    },
    hero: {
      slogan: "A free, open-source Evernote alternative self-hosted on Cloudflare.",
      demo: "Live demo",
      agentInstall: "Install with AI Agent",
      imageAlt: "EdgeEver product preview",
    },
    features: {
      heading: "A personal notes workspace rebuilt for self-hosting",
      items: [
        {
          title: "Generous storage, nearly free forever.",
          summary: "Cloudflare D1 and R2 free quotas are roomy enough for a personal notes archive.",
          points: [
            "The free tier can cover roughly 100k short notes and about 50k 200KB images.",
            "Images are compressed locally before upload, often reducing screenshots and photos by 50%-90%.",
            "Your data and resources live in your own Cloudflare account after deployment.",
          ],
        },
        {
          title: "AI Agent native",
          summary: "Built-in REST API, OpenAPI schema, and Remote MCP endpoint let AI assistants read, create, and organize notes safely.",
          points: [
            "Generate an MCP token in the app to connect EdgeEver with Codex, Claude Code, Antigravity, and similar tools.",
            "Useful for idea summaries, automatic tagging, knowledge graph cleanup, and cross-note retrieval.",
            "Agent workflows operate on your private instance instead of a closed notes platform.",
          ],
        },
        {
          title: "Classic three-pane workflow",
          summary: "Notebook tree, note list, and editor stay familiar for Evernote-style migrations.",
          points: [
            "Unlimited nested notebooks support long-lived personal knowledge bases.",
            "Drag notebooks to reorder or change hierarchy, and move or merge notes in batches.",
            "A TipTap-based rich text editor includes note version history for reviewing earlier content.",
          ],
        },
        {
          title: "Open data, easier migration",
          summary: "Notes are stored as structured JSON, Markdown, and plain text for editors, APIs, search, and agents.",
          points: [
            "Content lives in Cloudflare D1, based on standard SQLite, and can be read via API, MCP, or CLI.",
            "Evernote import support lowers the cost of moving from an existing notes library.",
            "Markdown keeps import, export, and agent workflows portable.",
          ],
        },
        {
          title: "Works across desktop and mobile",
          summary: "Use EdgeEver from desktop, phone, or tablet with a PWA-friendly experience.",
          points: [
            "Open it in the browser or install it as a PWA for quick capture.",
            "Existing notes support offline drafts and a local sync queue for weak network conditions.",
            "Single-user login, PBKDF2-SHA256 password hashing, and API tokens stay behind a simple UI.",
          ],
        },
      ],
    },
  },
} as const;
