# How to Import UTCP Packages

## ✅ Fixed Export Configuration

Your packages now use the **standard library pattern** - all exports go through the main entry point.

## Correct Import Usage

### ✅ Import from Main Entry Point

```typescript
// ✅ CORRECT - Import from package root
import { UtcpClient, ToolDefinition, CallTemplate } from '@eli-golin/utcp-sdk';
import { McpCommunicationProtocol } from '@eli-golin/utcp-mcp';
import { TextCallTemplate } from '@eli-golin/utcp-text';
import { HttpCommunicationProtocol } from '@eli-golin/utcp-http';
import { CliCallTemplate } from '@eli-golin/utcp-cli';
```

### ❌ Don't Import from Subpaths

```typescript
// ❌ WRONG - Don't import from dist or subpaths
import { ToolDefinition } from '@eli-golin/utcp-sdk';
import { ToolDefinition } from '@eli-golin/utcp-sdk/data';
```

## Why This Is Better

### 1. **Standard Library Pattern**
This is how all major libraries work:
- `import { z } from 'zod'` (not `'zod/types'`)
- `import { format } from 'date-fns'` (not `'date-fns/format'`)
- `import React from 'react'` (not `'react/components'`)

### 2. **Simpler API**
Users only need to remember one import path per package.

### 3. **Better Tree-Shaking**
Modern bundlers can tree-shake unused exports from the main entry point automatically.

### 4. **Prevents Breaking Changes**
Internal file structure can change without breaking user code.

## Package Exports Summary

### @eli-golin/utcp-sdk (Core Package)
```typescript
import {
  // Client
  UtcpClient,
  UtcpClientConfig,
  
  // Data Models
  Auth,
  CallTemplate,
  Tool,
  ToolDefinition,
  UtcpManual,
  RegisterManualResult,
  
  // Interfaces
  CommunicationProtocol,
  ConcurrentToolRepository,
  Serializer,
  ToolSearchStrategy,
  VariableSubstitutor,
  
  // Implementations
  InMemConcurrentToolRepository,
  TagSearchStrategy,
  
  // Plugins
  PluginLoader
} from '@eli-golin/utcp-sdk';
```

### @eli-golin/utcp-mcp
```typescript
import {
  McpCommunicationProtocol,
  McpCallTemplate
} from '@eli-golin/utcp-mcp';
```

### @eli-golin/utcp-text
```typescript
import {
  TextCommunicationProtocol,
  TextCallTemplate,
  TextCallTemplateSerializer
} from '@eli-golin/utcp-text';
```

### @eli-golin/utcp-http
```typescript
import {
  HttpCommunicationProtocol,
  HttpCallTemplate,
  OpenApiConverter,
  SseCommunicationProtocol,
  SseCallTemplate,
  StreamableHttpCommunicationProtocol,
  StreamableHttpCallTemplate
} from '@eli-golin/utcp-http';
```

### @eli-golin/utcp-cli
```typescript
import {
  CliCommunicationProtocol,
  CliCallTemplate
} from '@eli-golin/utcp-cli';
```

## TypeScript IntelliSense

Your IDE will show all available exports when you start typing:

```typescript
import { /* Ctrl+Space to see all exports */ } from '@eli-golin/utcp-sdk';
```

## Configuration Changes Made

### Before (Problematic)
```json
{
  "exports": {
    ".": {
      "import": "./dist/index.js"
    },
    "./*": {
      "import": "./dist/*.js"  // ❌ This caused @eli-golin/utcp-sdk/dist/ imports
    }
  }
}
```

### After (Fixed)
```json
{
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  }
}
```

## Re-Publishing

After these changes, you should publish new patch versions:

```bash
# Update version in each package.json (1.0.1 -> 1.0.2)
bun run rebuild
bun run publish:all
```

## Migration Guide for Existing Users

If users were importing from subpaths, they need to update:

```typescript
// Before
import { ToolDefinition } from '@eli-golin/utcp-sdk';

// After
import { ToolDefinition } from '@eli-golin/utcp-sdk';
```

This is a one-line change and follows standard npm package conventions.
