# Glonee 的数字花园

一个中文 Astro 个人博客：Material Design 3 风格的薰衣草色调、原创内联 SVG 插画、主题筛选、文章目录、响应式导航，以及真正检索构建后正文的 Pagefind 搜索。当前包含 **6 篇原创示例文章**，列表、正文和 RSS 均标明演示身份，不代表 Glonee 的真实经历或观点。

站点地址：**https://neplirio.github.io/astro-material-blog/**

## 本地运行

需要 Node.js **22.23.4 或更高**，建议使用 Node.js 24 LTS；npm 9.6.5 或更高。所有依赖和测试浏览器都安装在项目内，不需要全局安装。

```bash
npm ci
npm run dev
```

开发地址为 `http://localhost:4321/astro-material-blog/`。开发服务器不生成搜索索引；完整搜索请使用构建预览：

```bash
npm run build
npm run preview
```

打开 `http://127.0.0.1:4321/astro-material-blog/`。`build` 严格依次运行 `astro build` 和 `scripts/index-search.mjs`，索引 6 篇文章的真实 HTML 正文，输出到 `dist/pagefind/`。索引失败或文章少于 5 篇会使构建失败。可搜索正文独有词「紫藤书签」验证；结果应打开《静态博客，也值得拥有好用的全文搜索》。搜索仅请求本站静态资源，无第三方搜索服务。

`preview` 使用 Astro 7 的 `--ignore-lock` 保持前台运行，以便测试进程能可靠启动和停止服务器。

## 验证

```bash
npm run test:install
npm run verify
```

Linux 首次使用若缺系统库，可在具备系统安装权限的环境运行 `node scripts/playwright.mjs install --with-deps chromium`。浏览器二进制保存在 `.playwright/`，已被 Git 忽略。CI 使用上述带依赖的安装方式。

| 命令 | 检查范围 |
| --- | --- |
| `npm run check` | Astro 和 TypeScript 类型检查 |
| `npm run build` | 静态页面、RSS、sitemap，以及随后执行的中文 Pagefind 索引 |
| `npm test` | 构建产物的子路径、内部链接、锚点、资源、canonical、文章内容和工作流配置 |
| `npm run test:e2e` | Chromium 访问构建预览，验证真实中文全文搜索、结果跳转、快捷键与焦点、主题持久化和系统跟随、真实筛选、移动导航、320–1280px 布局与目录链接 |
| `npm run verify` | 按顺序执行以上全部检查 |

静态测试基于当前六篇演示稿建立验收基线。新增或移除文章时，更新 `tests/site.test.mjs` 和 `tests/blog.spec.ts` 中明确的数量断言；如果计划少于五篇，还应调整索引脚本的最低篇数保护。

## 写文章

Markdown 位于 `src/content/posts/`。文件名成为 URL，例如 `my-note.md` → `/astro-material-blog/posts/my-note/`。使用简短英文文件名，文件放在该目录第一层。正文的二级、三级标题自动组成目录，代码块使用 Shiki 的双主题语法高亮。

```yaml
---
title: 一篇新文章
description: 用一句话介绍文章内容。
date: 2026-10-23
topic: 开发手记
tags: [Astro, 笔记]
minutes: 5
featured: false
demo: false
---
```

`topic` 必须是「开发手记」「设计思考」「生活切片」之一；`minutes` 为正数；`demo: true` 会显示示例标记和正文提示。发布自己的文章时设为 `false`（省略时默认 false），并根据实际内容更新关于页介绍。`featured: true` 控制首页精选，多个精选取日期最新的一篇；没有精选则使用最新文章。

内容类型和校验规则位于 `src/content.config.ts`。新主题需要同步更新 schema 和首页筛选项。列表按日期倒序，RSS 与归档自动更新。日期以 UTC 格式化，不因构建机时区变化。

内部链接应带站点前缀，例如 Markdown 中写 `[归档](/astro-material-blog/archive/)`。Astro 组件和 TypeScript 使用 `src/lib/site.ts` 的 `url()`、`postUrl()`，避免写根目录绝对链接。构建后的静态测试会逐个验证内部路径与目录锚点。

## 外观与主题

`src/styles/global.css` 中的 CSS 变量定义背景、文字、容器与主色，`[data-theme=dark]` 提供深色值。组件只使用语义颜色；调整 `--primary`、`--tonal`、`--surface` 即可改变主要气质。中文无衬线正文和宋体标题使用本地打包的 Noto Sans SC / Noto Serif SC 可变字体（SIL OFL，许可证随站点发布于 `public/licenses/noto-fonts-OFL.txt`），无运行时外部字体请求；按 Unicode 范围按需加载。

主题选择「浅色模式 / 深色模式 / 跟随系统」保存在 `localStorage` 的 `glonee-theme` 键。布局 `<head>` 的内联脚本在页面绘制前应用偏好，存储不可用时回退到系统主题；系统主题变化会实时更新。所有非必要动画响应 `prefers-reduced-motion`。

- `src/components/HeroArt.astro`：原创 SVG 首页插画。
- `src/components/PostCard.astro`：主题卡片。
- `src/components/Search.astro`：原生 dialog、真实 Pagefind API、中文状态、输入防抖和过期查询保护。
- `src/layouts/Layout.astro`：导航、主题、SEO、页脚。

搜索支持 `Ctrl / ⌘ K` 和非输入状态下的 `/` 打开；Escape 关闭，关闭后焦点返回原触发器。原生 dialog 提供模态焦点边界。移动导航为展开式导航，Escape 收起并返回按钮。

## 动效

文章入口使用原生跨文档 View Transitions：卡片/精选/归档/相关文章的容器与标题共享 420ms 展开过渡，前进和返回匹配原入口。仅在截图期间给选中的两个元素命名，避免精选与普通卡片重复；不会引入 ClientRouter 或拦截链接，保留完整页面的脚本、键盘、焦点和浏览器历史行为。入口记忆与导航交接仅保存在当前标签页的 `sessionStorage`，不包含搜索词；存储不可用或浏览器不支持时直接正常跳转。不可见的返回目标也直接跳转。选择此方式是为了保留既有 MPA 生命周期，见 [Astro 官方过渡文档](https://docs.astro.build/en/guides/view-transitions/)。

搜索弹窗使用 `@starting-style` 与离散 CSS transitions 实现约 220ms 进入、140ms 退出；关闭立即还原焦点并让退出遮罩不再接收点击。筛选立即更新可见状态，卡片以 28ms 间隔短暂显现；按钮有按压和状态层反馈，导航与主题图标仅在交互时轻动。没有持续的装饰动画，也没有额外动画依赖；只有真实等待状态下的加载指示会短暂循环。

`src/components/Motion.astro` 必须保留在 `<head>` 中作为普通同步脚本，以便在 `pagereveal` 的首次绘制前设置共享元素。样式在 `src/styles/motion.css`；筛选 WAAPI 辅助函数在 `src/lib/motion.ts`。系统开启“减少动态效果”时，跨文档过渡、弹窗/遮罩及其余 CSS 动效均关闭，正在运行的筛选 WAAPI 动画也会立即取消。

`tests/motion.spec.ts` 在构建预览中断言真实 View Transition 的容器几何关键帧、标题配对、前进/返回和入口唯一性，并覆盖降级、减少动态效果、快速关闭重开及重复导航后的搜索/主题/移动导航。

### 弱网等待与恢复

`NavigationFeedback.astro` 观察浏览器的原生导航生命周期，不拦截正常导航、不预取再跳转，也不重复下载文章。实际等待超过 **180ms** 才显示 MD3 不定进度顶栏和可取消的文字提示，快速导航不闪烁；页面提交、取消后的新操作以及前进/返回会清除提示。缺少 Navigation API 时，对当前窗口的普通站内页面链接提供点击监听降级，保留修饰键、新窗口、外链、下载和当前页锚点行为。关闭 JavaScript 时使用浏览器原有的导航反馈。

等待中可用提示里的“取消”或 Escape 停止请求；**15 秒**仍未完成时通过 `window.stop()` 停止等待，并保留当前页及重试/关闭操作。已知离线状态会阻止这次站内导航，联网后可以重试；等待过程中断网也会停止请求。支持 Navigation API 的浏览器还会通过导航的 AbortSignal 识别浏览器“停止”操作。缺少该 API 时，浏览器停止操作的信号可能不可观察，15 秒上限仍会结束提示。

**原生网络错误边界：**实际 DNS/连接失败等可能直接让浏览器用自己的网络错误页替换当前文档，站内脚本不能接管该错误页。Chromium 的失败响应测试确认了这一点；此时通过浏览器返回或重新加载恢复，返回博客后不会残留加载提示。站点没有 Service Worker，也不承诺离线文章缓存。若慢请求提交了 HTTP 错误页面，则按浏览器原生导航展示该响应。

Pagefind 查询等待时先显示文字，超过 180ms 再显示小型指示器；**12 秒**后停止等待状态并提供“重试搜索”。清空输入、关闭弹窗或新查询会使旧结果失效；不能中止的模块/索引请求仍可能在后台完成，但不会覆盖当前结果。显式重试会重新加载引擎，绕过浏览器缓存的模块失败。减少动态效果时，导航和搜索均只保留静态文字，不运行加载条或旋转指示器。

样式在 `src/styles/loading.css`。`tests/loading.spec.ts` 使用构建预览的真实网络路由模拟延迟、断网、取消、超时和失败，验证单次文章请求、恢复、无 JavaScript 及搜索竞态；既有的真实容器几何过渡回归继续保留。

## 站点配置与 SEO

`astro.config.mjs` 固定配置：

```js
site: 'https://neplirio.github.io',
base: '/astro-material-blog',
trailingSlash: 'always',
```

不要把仓库路径重复放入 `site`。`BASE_URL` 经公共辅助函数应用于页面、字体/CSS/脚本资源、favicon、RSS、搜索模块与结果；canonical 和 sitemap 使用完整生产地址。若更换域名或仓库路径，同时更新配置、`public/robots.txt`、Markdown 内部绝对路径和测试中的验收地址。站点标题与简介位于 `src/lib/site.ts`。

提供 canonical、description、Open Graph、文章 JSON-LD、RSS、sitemap、SVG favicon 与 `404.html`。社交分享图为本地 SVG `public/social.svg`；部分社交平台不支持 SVG 预览，正式运营时可替换为 PNG 并修改布局中的地址。项目路径内的 `robots.txt` 可访问，但爬虫通常只读取域名根目录的 robots.txt；域名根站点的抓取策略需由其所有者配置。

## GitHub Pages

仓库为 `neplirio/astro-material-blog`，Pages 发布来源应设为 **GitHub Actions**（上游已配置）。`.github/workflows/deploy.yml` 在 `main` 推送或手动触发时：

1. checkout，配置 Node.js 24 和 Pages。
2. 明确执行 `npm ci`、类型检查和 `npm run build`（先 Astro，后 Pagefind）。
3. 运行静态测试与 Chromium 浏览器测试。
4. 上传完整 `dist/` 作为 Pages artifact，通过独立 deploy job 发布。

工作流声明 `contents: read`、`pages: write`、`id-token: write`，并使用 `pages` concurrency group 防止同时发布。只上传测试通过的构建产物。默认地址保留仓库前缀，不需要 CNAME 或手动复制搜索文件。

本次实现没有提交、推送、调用 GitHub API 或触发远程部署。工作流是否在真实仓库发布成功，需要之后由仓库工作流执行结果确认。

## 已知边界

- 搜索索引在构建时生成，修改 Markdown 后需重新构建；`astro dev` 中搜索会显示索引不可用提示。
- 搜索仅收录文章正文；首页、关于页、归档和 404 不参与搜索。
- 本地验证覆盖 Chromium，未对 Safari、Firefox 或所有屏幕阅读器进行完整审核。
- 使用客户端脚本的功能包括搜索、筛选、主题选择和移动导航展开；文章正文及桌面导航在无 JavaScript 时仍可阅读。
