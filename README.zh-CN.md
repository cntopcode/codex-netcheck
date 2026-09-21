# codex-netcheck

一条命令诊断 OpenAI/Codex 响应慢、反复重连、代理下无法访问等网络问题。

`codex-netcheck` 会检查 DNS、TCP、TLS、HTTPS、WebSocket 握手、系统代理和实际路由，并给出可执行的排查建议。增加 `--claude` 参数后，可以在检查 OpenAI 的同时检查 Anthropic 与 Claude。所有检查都在本机运行，报告默认自动脱敏。

> 支持 macOS 和 Linux · 需要 Node.js 20+ · 不需要 OpenAI 或 Anthropic API Key

## 快速开始

```bash
npx codex-netcheck@latest
```

同时检查 OpenAI/Codex 和 Claude：

```bash
npx codex-netcheck@latest --claude
```

典型输出：

```text
codex-netcheck · OpenAI/Codex 网络诊断

✓ DNS api.openai.com: 解析成功 34 ms
✓ TCP 连接 (api.openai.com:443): 连接成功 76 ms
✓ TLS 握手 (api.openai.com:443): TLSv1.3 114 ms
✓ OpenAI API HTTPS: HTTP 401，服务可达 225 ms
✓ OpenAI Realtime WebSocket: 握手到达服务端 302 ms

综合结论
所选路径上的 OpenAI 网络探针通过；未验证 Codex 账号权限或实际模型请求。
```

## Codex 能用，但探针报失败？

先确认运行的是最新版本，避免 npx 使用已有的旧版本：

```bash
npx codex-netcheck@latest --version
npx codex-netcheck@latest --report report.json
```

0.2.1 修复了旧版只识别代理配置、却没有让网络探针使用该代理的问题。如果客户端走显式代理，而探针经过另一条直连/TUN 路径，就可能出现客户端可用、探针的 TCP/TLS/HTTPS/WebSocket 同时报错的情况。

检查输出中的“探针连接路径”，确认它与客户端一致。macOS 会自动读取系统 HTTPS/SOCKS 代理；Linux 请使用 `HTTPS_PROXY`、`ALL_PROXY` 或 `--proxy`。若客户端使用自带代理、PAC 或自动识别不正确，可显式指定实际代理地址（端口应以你的代理软件设置为准）：

```bash
npx codex-netcheck@latest --proxy http://127.0.0.1:6880 --report proxy-report.json
# 仅用于对比直连/TUN，不会切换或关闭你的系统代理
npx codex-netcheck@latest --direct --report direct-report.json
```

当前 WebSocket 探针使用 OpenAI Realtime 端点，并不等同于一次真实 Codex 请求。单次探针失败不能直接断言 Codex 不可用；全部通过也不能排除间歇性慢、账号权限或实际请求路径的问题。`401/403` 只说明收到了 HTTPS 响应，不代表登录或模型调用成功。

若最新版仍有差异，请在 issue 中补充版本、操作系统、代理软件、实际连接方式及完整脱敏报告。报告会保留主机、IP 和网络结构，公开前仍需检查并删除公司内网信息；不要附带密码、Token 或 Cookie。相关讨论：[issue #1](https://github.com/cntopcode/codex-netcheck/issues/1)。

## 为什么不只是运行 `ping` 或 `curl`？

Codex 的连接不仅依赖 ICMP 或普通网页。即使 ping 正常，也可能存在 DNS 污染、TLS 中间人、WebSocket Upgrade 被代理阻断，或 VPN 分流走错节点等问题。本工具逐层检测并给出针对性建议。

## 使用方法

```bash
# 人类可读输出
npx codex-netcheck@latest

# JSON 输出
npx codex-netcheck@latest --json

# 保存脱敏 Markdown 报告
npx codex-netcheck@latest --report report.md

# 保存 JSON 报告
npx codex-netcheck@latest --report report.json

# 每 30 秒重复检查
npx codex-netcheck@latest --watch 30

# 单项检查超时 15 秒
npx codex-netcheck@latest --timeout 15

# 追加 Claude API 和 claude.ai 检查
npx codex-netcheck@latest --claude
```

## 检查内容

| 检查层 | 能发现的问题 |
|---|---|
| 运行环境 | 操作系统、架构和 Node.js 版本 |
| 代理 | 代理环境变量和 macOS 系统代理 |
| DNS | OpenAI 域名，以及启用 `--claude` 后的 Anthropic 域名是否正常解析 |
| 路由 | 流量直连还是经过 VPN/TUN 接口 |
| TCP | `api.openai.com:443` 是否可建立连接 |
| TLS | 证书校验、协议、密码套件和握手延迟 |
| HTTPS | OpenAI、ChatGPT 服务是否可达及响应时间 |
| WebSocket | OpenAI WSS 握手是否能到达服务端 |

Claude 模式会对 `api.anthropic.com` 和 `claude.ai` 执行 DNS、路由、TCP、TLS 与 HTTPS 检查。由于 Anthropic 没有为此场景公开稳定的客户端 WSS 端点，因此不会添加虚假的 Claude WebSocket 探测。

## 隐私与安全

- 不需要也不会读取 OpenAI 或 Anthropic API Key。
- 只发送无认证探测请求。
- 自动隐藏 API Key、Bearer Token、代理凭据、Cookie 和用户目录。
- 报告文件在系统支持时采用仅当前用户可读写的权限。
- 隐藏参数 `--include-sensitive` 仅用于本机调试，不应生成对外分享的报告。

## 全局安装

```bash
npm install --global codex-netcheck
codex-netcheck
```

## 本地开发

```bash
git clone https://github.com/cntopcode/codex-netcheck.git
cd codex-netcheck
npm install
npm test
npm run build
npm run dev
```

## 路线图

- 延迟历史与 P50/P95 汇总
- 开关代理前后的自动对比
- 可选 traceroute/MTR 检查
- 脱敏 HTML 报告
- Windows 支持

## 参与贡献

欢迎提交可复现的网络问题。请查看 [CONTRIBUTING.md](CONTRIBUTING.md)，并且不要在 Issue 中提交 API Key、Cookie、代理密码或未脱敏配置。

## 许可证

MIT


## 代理支持（0.2.1）

默认探针按以下顺序选择 HTTPS/WSS 代理：`--proxy` → `https_proxy`/`HTTPS_PROXY` → `all_proxy`/`ALL_PROXY` → macOS 系统 HTTPS/SOCKS 代理 → 直连。仅 HTTP 的 `HTTP_PROXY` 不用于 HTTPS 目标。自动模式遵循 `NO_PROXY` 和系统域名例外；显式 `--proxy` 强制使用所选代理。支持 HTTP CONNECT、HTTPS 代理及 SOCKS，PAC 需用 `--proxy` 指定实际地址。

```bash
# 自动跟随 DigiLink 等软件设置的系统代理
npx codex-netcheck@latest
# 显式使用 HTTP 或 SOCKS 代理
npx codex-netcheck@latest --proxy http://127.0.0.1:6880
npx codex-netcheck@latest --proxy socks5h://127.0.0.1:6880
# 单独检查直连/TUN 路径，不修改系统设置
npx codex-netcheck@latest --direct
```

TCP 项检查代理入口；TLS、HTTPS 和 WSS 项通过同一代理建立目标连接，并保留 TLS 证书校验。HTTP CONNECT / SOCKS5h 模式由代理解析目标域名，因此本地 DNS/Fake-IP 结果只供参考，不代表代理上游出口。`--direct` 仍可能经过系统 TUN。未认证探针只检查网络可达性，不验证 Codex 账号权限、实际推理请求或完整服务可用性。代理自身返回的 403/407 不会被当作目标服务可达。

从源码构建安装：

```bash
npm ci
npm run build
npm pack
npm install -g ./codex-netcheck-0.2.1.tgz
```
