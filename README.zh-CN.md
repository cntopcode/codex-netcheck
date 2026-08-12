# codex-netcheck

一条命令诊断 OpenAI/Codex 响应慢、反复重连、代理下无法访问等网络问题。

`codex-netcheck` 会检查 DNS、TCP、TLS、HTTPS、WebSocket 握手、系统代理和实际路由，并给出可执行的排查建议。所有检查都在本机运行，报告默认自动脱敏。

> 支持 macOS 和 Linux · 需要 Node.js 20+ · 不需要 OpenAI API Key

## 快速开始

```bash
npx codex-netcheck
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
OpenAI 基础网络链路正常。若 Codex 仍响应慢，更可能与模型推理、服务端负载或长上下文有关。
```

## 为什么不只是运行 `ping` 或 `curl`？

Codex 的连接不仅依赖 ICMP 或普通网页。即使 ping 正常，也可能存在 DNS 污染、TLS 中间人、WebSocket Upgrade 被代理阻断，或 VPN 分流走错节点等问题。本工具逐层检测并给出针对性建议。

## 使用方法

```bash
# 人类可读输出
npx codex-netcheck

# JSON 输出
npx codex-netcheck --json

# 保存脱敏 Markdown 报告
npx codex-netcheck --report report.md

# 保存 JSON 报告
npx codex-netcheck --report report.json

# 每 30 秒重复检查
npx codex-netcheck --watch 30

# 单项检查超时 15 秒
npx codex-netcheck --timeout 15
```

## 检查内容

| 检查层 | 能发现的问题 |
|---|---|
| 运行环境 | 操作系统、架构和 Node.js 版本 |
| 代理 | 代理环境变量和 macOS 系统代理 |
| DNS | `api.openai.com`、`chatgpt.com` 是否正常解析 |
| 路由 | 流量直连还是经过 VPN/TUN 接口 |
| TCP | `api.openai.com:443` 是否可建立连接 |
| TLS | 证书校验、协议、密码套件和握手延迟 |
| HTTPS | OpenAI、ChatGPT 服务是否可达及响应时间 |
| WebSocket | OpenAI WSS 握手是否能到达服务端 |

## 隐私与安全

- 不需要也不会读取 OpenAI API Key。
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
