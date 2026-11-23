// packages/http/tests/insecure_http_opt_in.test.ts
//
// Pin the per-call-template `allow_insecure_http` opt-in: plain HTTP to a
// non-loopback host is refused unless the operator's call template says
// otherwise, the opt-in never follows a redirect off its origin, and a
// manual fetched over the network cannot grant it to itself.

import { test, expect, describe } from 'bun:test';
import '@eli-golin/utcp-http';
import { IUtcpClient } from '@eli-golin/utcp-sdk';
import { isSecureUrl, ensureSecureUrl, safeRequestWithRedirects } from '../src/_security';
import { HttpCommunicationProtocol } from '../src/http_communication_protocol';
import { HttpCallTemplate, HttpCallTemplateSchema, HttpCallTemplateSerializer } from '../src/http_call_template';
import { SseCallTemplateSchema } from '../src/sse_call_template';
import { StreamableHttpCallTemplateSchema } from '../src/streamable_http_call_template';
import { OpenApiConverter } from '../src/openapi_converter';

const mockClient = {} as IUtcpClient;

type Reply = { status: number; headers?: Record<string, any>; data?: any };

/** An axios stand-in that records each request and answers from `route`. */
function fakeAxios(route: (url: string) => Reply) {
  const seen: string[] = [];
  return {
    seen,
    request: async (cfg: any) => {
      seen.push(cfg.url);
      const r = route(cfg.url);
      return { status: r.status, headers: { 'content-type': 'application/json', ...(r.headers || {}) }, data: r.data };
    },
  };
}

function protocolWith(axiosLike: any): HttpCommunicationProtocol {
  const protocol = new HttpCommunicationProtocol();
  (protocol as any)._axiosInstance = axiosLike;
  return protocol;
}

describe('isSecureUrl / ensureSecureUrl with allowInsecureHttp', () => {
  test('plain HTTP to a LAN host is refused by default and allowed with the opt-in', () => {
    expect(isSecureUrl('http://192.168.14.245:32520/api/search')).toBe(false);
    expect(isSecureUrl('http://192.168.14.245:32520/api/search', true)).toBe(true);
  });

  test('the opt-in does not widen anything but http://', () => {
    expect(isSecureUrl('ftp://192.168.1.5/x', true)).toBe(false);
    expect(isSecureUrl('file:///etc/passwd', true)).toBe(false);
    expect(isSecureUrl('not a url', true)).toBe(false);
    expect(isSecureUrl('https://example.com/', false)).toBe(true);
  });

  test('the rejection names the opt-in', () => {
    expect(() => ensureSecureUrl('http://10.0.0.5/', 'tool invocation')).toThrow(/allow_insecure_http/);
    expect(() => ensureSecureUrl('http://10.0.0.5/', 'tool invocation', true)).not.toThrow();
  });
});

describe('call template schemas keep the flag', () => {
  test('http round-trips allow_insecure_http and leaves it unset by default', () => {
    const base = { call_template_type: 'http', url: 'http://10.0.0.5/x', http_method: 'GET' };
    expect(HttpCallTemplateSchema.parse(base).allow_insecure_http).toBeUndefined();
    const parsed = HttpCallTemplateSchema.parse({ ...base, allow_insecure_http: true });
    expect(parsed.allow_insecure_http).toBe(true);
    expect(new HttpCallTemplateSerializer().toDict(parsed).allow_insecure_http).toBe(true);
  });

  test('sse and streamable_http accept the flag', () => {
    expect(SseCallTemplateSchema.parse({ call_template_type: 'sse', url: 'http://10.0.0.5/s', allow_insecure_http: true }).allow_insecure_http).toBe(true);
    expect(StreamableHttpCallTemplateSchema.parse({ call_template_type: 'streamable_http', url: 'http://10.0.0.5/s', allow_insecure_http: true }).allow_insecure_http).toBe(true);
  });
});

describe('HttpCommunicationProtocol.callTool', () => {
  const template: HttpCallTemplate = {
    name: 'grafana_dev',
    call_template_type: 'http',
    http_method: 'GET',
    url: 'http://192.168.14.245:32520/api/search',
    content_type: 'application/json',
  };

  test('refuses plain HTTP to a LAN host without the opt-in, before any request', async () => {
    const ax = fakeAxios(() => ({ status: 200, data: [] }));
    await expect(protocolWith(ax).callTool(mockClient, 'g.search', {}, template)).rejects.toThrow(/Security error/);
    expect(ax.seen).toEqual([]);
  });

  test('sends the request when the call template opts in', async () => {
    const ax = fakeAxios(() => ({ status: 200, data: [{ uid: 'abc' }] }));
    const result = await protocolWith(ax).callTool(mockClient, 'g.search', {}, { ...template, allow_insecure_http: true });
    expect(result).toEqual([{ uid: 'abc' }]);
    expect(ax.seen).toEqual(['http://192.168.14.245:32520/api/search']);
  });
});

describe('safeRequestWithRedirects with allowInsecureHttp', () => {
  test('follows a plain-HTTP redirect that stays on the same origin', async () => {
    const ax = fakeAxios((url) =>
      url.endsWith('/a') ? { status: 302, headers: { location: '/b' } } : { status: 200, data: { ok: true } },
    );
    const res = await safeRequestWithRedirects(ax as any, { url: 'http://10.0.0.5/a', method: 'GET' }, 'tool invocation', 5, [], true);
    expect(res.data).toEqual({ ok: true });
    expect(ax.seen).toEqual(['http://10.0.0.5/a', 'http://10.0.0.5/b']);
  });

  test('refuses a plain-HTTP redirect to another host', async () => {
    const ax = fakeAxios(() => ({ status: 302, headers: { location: 'http://10.0.0.6/steal' } }));
    await expect(
      safeRequestWithRedirects(ax as any, { url: 'http://10.0.0.5/a', method: 'GET' }, 'tool invocation', 5, [], true),
    ).rejects.toThrow(/redirect target/);
    expect(ax.seen).toEqual(['http://10.0.0.5/a']);
  });
});

describe('remote manuals cannot grant themselves the opt-in', () => {
  const remoteManual = {
    utcp_version: '1.0.1',
    manual_version: '1.0.0',
    tools: [{
      name: 'internal',
      description: 'aims at a plain-HTTP internal host',
      inputs: { type: 'object', properties: {} },
      outputs: { type: 'object', properties: {} },
      tool_call_template: {
        name: 'remote', call_template_type: 'http', http_method: 'GET',
        url: 'http://10.0.0.7/admin', allow_insecure_http: true,
      },
    }],
  };
  const discovery: HttpCallTemplate = {
    name: 'remote', call_template_type: 'http', http_method: 'GET',
    url: 'https://manuals.example.com/utcp', content_type: 'application/json',
  };

  test('a manual over HTTPS that sets allow_insecure_http is refused', async () => {
    const ax = fakeAxios(() => ({ status: 200, data: remoteManual }));
    const result = await protocolWith(ax).registerManual(mockClient, discovery);
    expect(result.success).toBe(false);
    expect(result.errors.join(' ')).toMatch(/allow_insecure_http/);
  });

  test('the same manual is accepted when the discovering call template opts in', async () => {
    const ax = fakeAxios(() => ({ status: 200, data: remoteManual }));
    const result = await protocolWith(ax).registerManual(mockClient, { ...discovery, allow_insecure_http: true });
    expect(result.success).toBe(true);
    expect(result.manual.tools[0].tool_call_template).toMatchObject({ allow_insecure_http: true });
  });
});

describe('OpenApiConverter', () => {
  const spec = {
    openapi: '3.0.0',
    info: { title: 'grafana', version: '1' },
    servers: [{ url: 'http://192.168.14.245:32520/api' }],
    paths: { '/search': { get: { operationId: 'search', responses: { '200': { description: 'ok' } } } } },
  };

  test('copies the opt-in onto generated tools only when asked', () => {
    const plain = new OpenApiConverter(spec).convert();
    expect((plain.tools[0].tool_call_template as any).allow_insecure_http).toBeUndefined();
    const optedIn = new OpenApiConverter(spec, { allowInsecureHttp: true }).convert();
    expect((optedIn.tools[0].tool_call_template as any).allow_insecure_http).toBe(true);
  });
});
