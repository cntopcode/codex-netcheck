# codex-netcheck

Diagnose why OpenAI or Codex feels slow, reconnects repeatedly, or fails behind a proxy.

`codex-netcheck` tests DNS, TCP, TLS, HTTPS, WebSocket handshakes, proxy settings, and the active route from one command. It runs locally and redacts credentials from reports by default.

> macOS and Linux · Node.js 20+ · No OpenAI API key required

[中文文档](README.zh-CN.md)

## Quick start

```bash
npx codex-netcheck
```

Example:

```text
codex-netcheck · OpenAI/Codex network diagnostics

✓ DNS api.openai.com: resolved 2 IPv4 addresses 34 ms
✓ TCP connection (api.openai.com:443): connected 76 ms
✓ TLS handshake (api.openai.com:443): TLSv1.3 114 ms
✓ OpenAI API HTTPS: HTTP 401, service reachable 225 ms
✓ OpenAI Realtime WebSocket: handshake reached service 302 ms

Conclusion
The OpenAI network path is healthy. Slow Codex responses are more likely caused by model reasoning, service load, or a long context.
```

## Why not just `ping` or `curl`?

Codex uses more than basic ICMP connectivity. A healthy ping can coexist with broken DNS, TLS interception, blocked WebSocket upgrades, or an unexpected VPN route. This tool checks each layer and turns failures into concrete remediation steps.

## Commands

```bash
# Human-readable diagnostics
npx codex-netcheck

# Machine-readable output
npx codex-netcheck --json

# Save a redacted Markdown report
npx codex-netcheck --report report.md

# Save JSON
npx codex-netcheck --report report.json

# Repeat every 30 seconds
npx codex-netcheck --watch 30

# Change the timeout per check
npx codex-netcheck --timeout 15
```

## Checks

| Layer | What it detects |
|---|---|
| Environment | OS, architecture, and Node.js runtime |
| Proxy | Proxy environment variables and macOS system proxy |
| DNS | IPv4 resolution for `api.openai.com` and `chatgpt.com` |
| Route | Direct interface versus VPN/TUN route |
| TCP | Reachability of `api.openai.com:443` |
| TLS | Certificate validation, protocol, cipher, and handshake time |
| HTTPS | Reachability and time to response for OpenAI and ChatGPT |
| WebSocket | Whether an OpenAI WSS handshake reaches the service |

## Privacy and security

- No API key is required or sent.
- Probes use unauthenticated requests only.
- API keys, bearer tokens, proxy credentials, cookies, and home-directory paths are redacted.
- Reports are created with owner-only file permissions where supported.
- The hidden `--include-sensitive` flag exists only for local debugging and should not be used for shared reports.

## Install globally

```bash
npm install --global codex-netcheck
codex-netcheck
```

## Development

```bash
git clone https://github.com/guokaitu/codex-netcheck.git
cd codex-netcheck
npm install
npm test
npm run build
npm run dev
```

## Roadmap

- OpenAI endpoint latency history and percentile summaries
- Proxy-on versus proxy-off comparison mode
- Optional traceroute/MTR integration
- Sanitized HTML report
- Windows support

## Contributing

Bug reports and reproducible network cases are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md). Please never include API keys, cookies, proxy credentials, or unredacted configuration in an issue.

## License

MIT
