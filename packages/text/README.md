# @eli-golin/utcp-text

> Maintained fork of the UTCP TypeScript libraries, with fixes not yet released upstream. See [typescript-utcp](https://github.com/Eli-Golin/typescript-utcp).

Text Content Communication Protocol plugin for the Universal Tool Calling Protocol (UTCP).

## Overview

This plugin provides support for loading UTCP manuals and tool definitions from direct text/string content. Unlike `@eli-golin/utcp-file` which reads from files, this plugin is **browser-compatible** and works in any JavaScript environment.

## Installation

```bash
npm install @eli-golin/utcp-text
```

## Usage

The plugin automatically registers itself when imported:

```typescript
import '@eli-golin/utcp-text';
import { UtcpClient } from '@eli-golin/utcp-sdk';

const utcpManualContent = JSON.stringify({
  tools: [
    {
      name: 'my_tool',
      description: 'A sample tool',
      inputs: { type: 'object', properties: {} },
      outputs: { type: 'object', properties: {} }
    }
  ]
});

const client = await UtcpClient.create();
await client.registerCallTemplate({
  call_template_type: 'text',
  name: 'my-manual',
  content: utcpManualContent
});
```

## Features

- **Browser-Compatible**: No file system dependencies
- **Multiple Formats**: Supports both JSON and YAML content
- **OpenAPI Conversion**: Automatically converts OpenAPI specs to UTCP manuals
- **Type-Safe**: Full TypeScript support with Zod validation

## Text Call Template

The text call template accepts the following configuration:

- `call_template_type`: Must be set to `'text'`
- `name`: Unique identifier for this manual
- `content`: String content containing the UTCP manual or OpenAPI spec (required)
- `auth_tools`: Optional authentication to apply to tools from OpenAPI specs

## Example: OpenAPI Spec

```typescript
import '@eli-golin/utcp-text';
import { UtcpClient } from '@eli-golin/utcp-sdk';

const openApiSpec = `
openapi: 3.0.0
info:
  title: My API
  version: 1.0.0
paths:
  /users:
    get:
      summary: Get users
      responses:
        '200':
          description: Success
`;

const client = await UtcpClient.create();
await client.registerCallTemplate({
  call_template_type: 'text',
  name: 'my-api',
  content: openApiSpec
});
```

## Browser Usage

Perfect for web applications:

```typescript
import '@eli-golin/utcp-text';
import { UtcpClient } from '@eli-golin/utcp-sdk';

// Load from API or inline
const response = await fetch('/api/utcp-manual');
const manualContent = await response.text();

const client = await UtcpClient.create();
await client.registerCallTemplate({
  call_template_type: 'text',
  name: 'remote-manual',
  content: manualContent
});
```

## Comparison with @eli-golin/utcp-file

| Feature | @eli-golin/utcp-text | @eli-golin/utcp-file |
|---------|-------------|-----------|
| Browser compatible | ✅ Yes | ❌ No |
| Node.js compatible | ✅ Yes | ✅ Yes |
| File system access | ❌ No | ✅ Yes |
| Direct content | ✅ Yes | ❌ No |
| Use case | Web apps, inline content | Server-side file reading |

## License

MPL-2.0
