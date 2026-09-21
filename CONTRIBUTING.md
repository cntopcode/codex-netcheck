# Contributing

感谢你帮助改进 codex-netcheck。

## 提交问题

1. 运行 `npx codex-netcheck@latest --version` 确认版本，再用最新版重新检查。
2. 优先附上 `npx codex-netcheck@latest --report report.json` 生成的完整脱敏报告；公开前检查主机、IP 和网络结构。
3. 说明操作系统、代理软件、连接方式、输出中的“探针连接路径”，以及预期行为。
4. 不要提交 API Key、Cookie、Token、代理密码或公司内网地址。

## 本地开发

```bash
npm install
npm run check
npm test
npm run build
```

新增检查器时，请保持探测请求无认证、低频、可超时，并为报告输出补充测试。
