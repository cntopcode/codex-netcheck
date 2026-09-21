import { describe, expect, it } from 'vitest';
import { parseSystemProxy, resolveProxyPolicy, selectRoute } from '../src/proxy.js';
import { redactValue } from '../src/redact.js';

const system = `<dictionary> {
 HTTPSEnable : 1
 HTTPSProxy : 127.0.0.1
 HTTPSPort : 6880
 SOCKSEnable : 1
 SOCKSProxy : 127.0.0.1
 SOCKSPort : 6880
 ExceptionsList : <array> {
  0 : localhost
  1 : *.local
 }
}`;

describe('代理选择与隐私', () => {
  it('识别 DigiLink 系统 HTTPS 代理并优先于 SOCKS', () => {
    expect(parseSystemProxy(system)).toEqual({ url: 'http://127.0.0.1:6880', bypass: ['localhost', '*.local'], pac: false });
    expect(resolveProxyPolicy({}, {}, system).route.source).toBe('macOS 系统代理');
  });
  it('显式指定 > 环境变量 > 系统代理', () => {
    const env = { HTTPS_PROXY: 'http://env:8080', ALL_PROXY: 'socks5h://fallback:1080' };
    expect(resolveProxyPolicy({ proxy: 'http://explicit:8888' }, env, system).route.url).toBe('http://explicit:8888/');
    expect(resolveProxyPolicy({}, env, system).route.url).toBe('http://env:8080/');
    expect(resolveProxyPolicy({}, { ALL_PROXY: env.ALL_PROXY }, system).route.url).toBe(env.ALL_PROXY);
  });
  it('直连显式覆盖环境及系统代理，冲突选项报错', () => {
    expect(resolveProxyPolicy({ direct: true }, { HTTPS_PROXY: 'http://env:80' }, system).route.url).toBeUndefined();
    expect(() => resolveProxyPolicy({ direct: true, proxy: 'http://env:80' }, {})).toThrow('不能同时');
  });
  it('NO_PROXY 支持域名边界、端口和全匹配', () => {
    const policy = resolveProxyPolicy({}, { HTTPS_PROXY: 'http://env:8080', NO_PROXY: '.openai.com,chatgpt.com:443' });
    expect(selectRoute(policy, 'https://api.openai.com').url).toBeUndefined();
    expect(selectRoute(policy, 'https://evilopenai.com').url).toBeDefined();
    expect(selectRoute(policy, 'https://chatgpt.com').url).toBeUndefined();
    expect(selectRoute(policy, 'https://chatgpt.com:444').url).toBeDefined();
    expect(selectRoute({ ...policy, bypass: ['*'] }, 'https://api.openai.com').url).toBeUndefined();
  });
  it('系统代理例外生效，显式 --proxy 不被例外覆盖', () => {
    expect(selectRoute(resolveProxyPolicy({}, {}, system), 'https://test.local').url).toBeUndefined();
    expect(selectRoute(resolveProxyPolicy({ proxy: 'http://proxy:8080' }, { NO_PROXY: '*' }, system), 'https://test.local').url).toBeDefined();
  });
  it('拒绝错误代理地址且不泄露凭据', () => {
    expect(() => resolveProxyPolicy({ proxy: 'ftp://alice:password@proxy' }, {})).toThrow('不支持');
    expect(() => resolveProxyPolicy({ proxy: 'http://proxy/path' }, {})).toThrow('只能包含');
    expect(redactValue({ proxy: 'socks5h://alice:password@proxy:1080' })).toEqual({ proxy: 'socks5h://***:***@proxy:1080' });
    expect(redactValue('http://alice@proxy:8080')).toBe('http://***:***@proxy:8080');
  });
  it('PAC 不被静默当作已使用的代理', () => {
    expect(resolveProxyPolicy({}, {}, 'ProxyAutoConfigEnable : 1').warning).toContain('PAC');
  });
});
