# codex-netcheck

[![npm version](https://img.shields.io/npm/v/codex-netcheck)](https://www.npmjs.com/package/codex-netcheck)

Diagnose why OpenAI or Codex feels slow, reconnects repeatedly, or fails behind a proxy.

`codex-netcheck` tests DNS, TCP, TLS, HTTPS, WebSocket handshakes, proxy settings, and the active route from one command. Add `--claude` to check Anthropic and Claude alongside OpenAI. It runs locally and redacts credentials from reports by default.

> macOS and Linux · Node.js 20+ · No OpenAI or Anthropic API key required

[中文文档](README.zh-CN.md)

## Quick start

```bash
npx codex-netcheck@latest
```

Check OpenAI/Codex and Claude together:

```bash
npx codex-netcheck@latest --claude
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
Network probes passed on the selected route. Codex account access and actual model requests were not tested.
```

## Codex works, but the probes fail?

Run `npx codex-netcheck@latest --version` and `npx codex-netcheck@latest --report report.json` first. Version 0.2.1 fixes probes that detected proxy settings but still connected directly. A client using an explicit proxy can work while probes on a separate direct/TUN path fail.

Check the reported connection path. macOS system HTTPS/SOCKS proxies are detected automatically; on Linux, set `HTTPS_PROXY`/`ALL_PROXY` or pass `--proxy`. For an application-specific proxy, PAC, or incorrect auto-detection, specify the actual address, for example `--proxy http://127.0.0.1:6880` (replace the port with your own). Use `--direct` only to compare the direct/TUN path; it does not change your system proxy settings.

The WebSocket probe targets OpenAI Realtime, not an actual Codex request. Failures do not by themselves establish that Codex is unusable, and passing probes do not rule out intermittent latency or account/request-specific failures. HTTP 401/403 confirms an HTTPS response, not successful authentication or inference.

If the discrepancy remains, include the version, OS, proxy software, connection mode, and a complete redacted report in the issue. Reports retain hosts, IPs, and network structure: review them for private infrastructure before sharing. Never attach passwords, tokens, or cookies. See [issue #1](https://github.com/cntopcode/codex-netcheck/issues/1).

## Why not just `ping` or `curl`?

Codex uses more than basic ICMP connectivity. A healthy ping can coexist with broken DNS, TLS interception, blocked WebSocket upgrades, or an unexpected VPN route. This tool checks each layer and turns failures into concrete remediation steps.

## Commands

```bash
# Human-readable diagnostics
npx codex-netcheck@latest

# Machine-readable output
npx codex-netcheck@latest --json

# Save a redacted Markdown report
npx codex-netcheck@latest --report report.md

# Save JSON
npx codex-netcheck@latest --report report.json

# Repeat every 30 seconds
npx codex-netcheck@latest --watch 30

# Change the timeout per check
npx codex-netcheck@latest --timeout 15

# Include Claude API and claude.ai checks
npx codex-netcheck@latest --claude
```

## Checks

| Layer | What it detects |
|---|---|
| Environment | OS, architecture, and Node.js runtime |
| Proxy | Proxy environment variables and macOS system proxy |
| DNS | IPv4 resolution for OpenAI hosts and, with `--claude`, Anthropic hosts |
| Route | Direct interface versus VPN/TUN route |
| TCP | Reachability of `api.openai.com:443` |
| TLS | Certificate validation, protocol, cipher, and handshake time |
| HTTPS | Reachability and time to response for OpenAI and ChatGPT |
| WebSocket | Whether an OpenAI WSS handshake reaches the service |

Claude mode checks `api.anthropic.com` and `claude.ai` across DNS, route, TCP, TLS, and HTTPS. It does not add a Claude WebSocket probe because Anthropic does not publish a stable client WSS endpoint for this purpose.

## Privacy and security

- No OpenAI or Anthropic API key is required or sent.
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
git clone https://github.com/cntopcode/codex-netcheck.git
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


## Proxy support (0.2.1)

The probes now use an explicit `--proxy URL`, HTTPS/ALL_PROXY environment variables, or the macOS HTTPS/SOCKS system proxy (in that order). Automatic mode honors NO_PROXY and system hostname exceptions. `--direct` checks the separate direct/TUN path without changing system settings. PAC requires an explicit proxy URL. HTTP-only HTTP_PROXY is not used for HTTPS targets.

TCP checks the proxy listener; TLS, HTTPS, and WSS establish a target connection through the selected proxy with certificate validation enabled. Proxy-side DNS avoids interpreting local Fake-IP/TUN failures as failures of a working explicit proxy. Unauthenticated probes do not validate account access or actual model requests. See the Chinese README for installation from source.
