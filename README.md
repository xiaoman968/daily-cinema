# 日常有戏 / Daily Cinema

上传生活照片，用 AI 发现日常美学，生成专属电影与分享海报。结果方案见 [DESIGN.md](DESIGN.md)。

## 本地预览

Node.js 22或更新版本：

```sh
npm run dev
```

打开 http://127.0.0.1:4173 。未配置后端也可以点击“先看一份样片”，体验报告与海报保存。正式AI分析需要以下配置。

## 账号与模型

- GitHub：https://github.com/signup ，用于仓库与Pages。
- 阿里云百炼：https://bailian.console.aliyun.com/ ，在中国内地地域开通模型服务、创建API Key并确认`qwen3-vl-plus`可调用及计费。视觉文档：https://help.aliyun.com/zh/model-studio/vision 。本项目不是用国际地域密钥调用内地接口。
- Cloudflare：https://dash.cloudflare.com/sign-up ，启用Workers。密钥通过终端交互输入，不写入前端、仓库或聊天。

## 后端部署

```sh
npm install
npx wrangler login
npx wrangler secret put DASHSCOPE_API_KEY
```

密钥输入后，将`wrangler.toml`的`ALLOWED_ORIGINS`改为实际站点来源，例如`https://YOURNAME.github.io`（不含仓库路径，不加末尾斜杠）。多个来源用逗号分隔。

```sh
npm run deploy:api
```

将部署输出的Worker HTTPS地址填入`site/config.js`的`apiBase`。不要填写任何密钥。设置百炼用量预算/提醒，按真实部署环境确认模型与Workers额度。

### 当前线上入口

GitHub Pages前端调用`https://daily-cinema-bridge-xiaoman968.pages.dev`，通过Cloudflare服务绑定转发到`daily-cinema-api`。这样当前网络无需直接访问`workers.dev`。中转不保存密钥，模型密钥仍仅在分析Worker中。

中转部署配置在`bridge/`：进入该目录运行`npx wrangler pages deploy public --project-name daily-cinema-bridge-xiaoman968 --branch main`。这是已有的Pages项目，后续部署无需再次创建项目。实际可达性仍以用户网络为准。

## GitHub Pages部署

在GitHub新建公开仓库`daily-cinema`。本项目目录作为仓库根目录，提交全部代码，主分支为`main`。仓库Settings → Pages → Build and deployment选择GitHub Actions。

```sh
git init -b main
git add .
git commit -m "Build Daily Cinema"
git remote add origin https://github.com/YOURNAME/daily-cinema.git
git push -u origin main
```

工作流自动运行测试并发布`site/`。访问`https://YOURNAME.github.io/daily-cinema/`。无需在仓库配置百炼密钥，GitHub Actions只部署静态文件。

## 验证

```sh
npm test
```

测试覆盖输入边界、来源限制、频率限制、模型请求与结果校验、失败时不泄漏上游信息。未提供真实API Key前，不声称已验证真实模型效果。上线后还需执行一次真实3图分析、海报保存和手机分享验收。

字体使用可选在线字体，加载失败自动回退到系统宋体。无需图片CDN、数据库或前端构建工具。
