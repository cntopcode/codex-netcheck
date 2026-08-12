# Contributing

感谢你帮助改进 codex-netcheck。

## 提交问题

1. 使用最新版重新运行。
2. 优先附上 `codex-netcheck --report report.md` 生成的脱敏报告。
3. 说明操作系统、是否使用代理/VPN，以及预期行为。
4. 不要提交 API Key、Cookie、Token、代理密码或公司内网地址。

## 本地开发

```bash
npm install
npm run check
npm test
npm run build
```

新增检查器时，请保持探测请求无认证、低频、可超时，并为报告输出补充测试。
