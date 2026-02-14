# ADR-001: Bun Runtime Selection

## Status
**Accepted**

## Date
2026-02-14

## Deciders
- System Architect
- Security Architect

## Context

Calculathor requires a TypeScript runtime that supports:
- Single binary distribution for easy deployment
- Fast startup time (<100ms target)
- Low memory footprint (<10MB core)
- Native socket APIs for daemon architecture
- Cross-platform support (Linux, macOS, Windows)

### Options Considered

| Runtime | Single Binary | Startup | Memory | Native Sockets | Notes |
|---------|---------------|---------|--------|----------------|-------|
| **Bun** | Yes (`--compile`) | ~20ms | Low | Yes (`Bun.listen`) | Fastest, modern APIs |
| Node.js | No (pkg/nexe hacks) | ~100ms | High | Yes (`net` module) | Requires bundler workarounds |
| Deno | Yes (`compile`) | ~50ms | Medium | Yes (`Deno.listen`) | Good, but smaller ecosystem |

### Key Factors

1. **Single Binary Compilation**: Bun's `bun build --compile` produces a standalone executable with embedded runtime and source maps. Node.js requires third-party tools (pkg, nexe) that are deprecated or unreliable.

2. **Performance**: Bun's JavaScriptCore engine starts significantly faster than Node's V8, critical for CLI responsiveness.

3. **Native APIs**: Bun provides first-class socket APIs (`Bun.listen`, `Bun.connect`) that are simpler and faster than Node's `net` module.

4. **TypeScript Support**: Bun has native TypeScript support without compilation step, streamlining development.

## Decision

**We will use Bun with native Bun APIs** (not Node.js compatibility mode).

### Rationale

1. **Native Bun APIs for Sockets**: Use `Bun.listen()` and `Bun.connect()` instead of Node's `net.createServer()` and `net.createConnection()`.

2. **Single Binary Distribution**: The `bun build --compile` output allows users to run `calculathor` as a single file without installing Bun or Node.js.

3. **Modern Standard Library**: Bun's built-in utilities (Bun.file, Bun.write, Bun.spawn) are faster and more ergonomic than Node equivalents.

### Code Comparison

```typescript
// Native Bun API (chosen)
const server = Bun.listen({
  unix: '/tmp/calculathor.sock',
  socket: {
    data(socket, data) {
      handleRequest(data);
    },
    open(socket) {
      console.log('Client connected');
    },
  },
});

// Node.js compatible API (rejected)
import { createServer } from 'net';
const server = createServer((socket) => {
  socket.on('data', (data) => {
    handleRequest(data);
  });
});
server.listen('/tmp/calculathor.sock');
```

## Consequences

### Positive

| Aspect | Benefit |
|--------|---------|
| **Startup Time** | ~20ms cold start vs ~100ms for Node.js |
| **Memory Usage** | Lower baseline memory footprint |
| **Binary Size** | Single ~50MB executable (includes runtime) |
| **Socket Performance** | ~0.1ms round-trip via Unix sockets |
| **Developer Experience** | Native TypeScript, no build step for dev |
| **Distribution** | Users don't need runtime installed |

### Negative

| Aspect | Impact | Mitigation |
|--------|--------|------------|
| **Ecosystem Maturity** | Bun is newer than Node.js | Stick to stable APIs, thorough testing |
| **Library Compatibility** | Some npm packages assume Node.js | Test all dependencies, prefer pure JS |
| **Documentation** | Less Stack Overflow content | Maintain internal documentation |
| **Platform-Specific Bugs** | Edge cases on Windows | CI testing across platforms |

### Neutral

- **API Differences**: Bun's API surface is intentionally different from Node.js. This is a one-time learning cost for developers familiar with Node.
- **Version Pinning**: We pin to specific Bun versions for reproducible builds.

## Security Implications

### Bun's Security Model vs Node.js

| Feature | Bun | Node.js | Notes |
|---------|-----|---------|-------|
| **Default Permissions** | All access allowed | All access allowed | Both permissive by default |
| **Permission Flags** | `--allow-*` flags planned | `--experimental-permission` | Bun's simpler model coming |
| **Sandboxing** | No built-in sandbox | No built-in sandbox | Application-level required |
| **Script Injection** | Same risk profile | Same risk profile | Input validation required |
| **Binary Compilation** | Source code embedded | Source code hidden (pkg) | Consider code obfuscation |

### Security Considerations

1. **No Runtime Permission System**: Unlike Deno, Bun does not have a built-in permission system. We must implement application-level sandboxing for:
   - Expression evaluation (isolated math context)
   - Plugin execution (VM2 or QuickJS sandbox)
   - File system access (whitelist approach)

2. **Compiled Binary Inspection**: `bun build --compile` embeds source maps. For production releases, consider:
   - Stripping source maps: `bun build --compile --minify --sourcemap=none`
   - Code obfuscation for proprietary logic

3. **Socket Security**: Unix socket permissions must be explicitly set:
   ```typescript
   // Set socket permissions to user-only (0600)
   await Bun.$`chmod 600 /tmp/calculathor.sock`;
   ```

4. **Dependency Scanning**: Bun uses npm registry. Same supply-chain risks as Node.js:
   - Use `bun audit` (when available) or `npm audit`
   - Pin dependency versions
   - Verify package integrity

### Threat Mitigations

```typescript
// Application-level sandbox for expression evaluation
function createSandboxedContext() {
  return {
    // Only expose math functions
    Math: Object.create(Math),
    // No access to process, require, Bun, etc.
  };
}

// File access whitelist
const ALLOWED_PATHS = [
  `${process.env.HOME}/.config/calculathor`,
  `${process.env.HOME}/.local/share/calculathor`,
];

function validatePath(userPath: string): string {
  const resolved = Bun.pathToFileURL(userPath).pathname;
  if (!ALLOWED_PATHS.some(p => resolved.startsWith(p))) {
    throw new SecurityError('Path traversal detected');
  }
  return resolved;
}
```

## Implementation Notes

### Build Configuration

```json
// package.json
{
  "scripts": {
    "build": "bun build --compile --minify --sourcemap=none ./src/index.ts --outfile ./dist/calculathor",
    "dev": "bun run ./src/index.ts"
  }
}
```

### Development vs Production

| Mode | Command | Notes |
|------|---------|-------|
| Development | `bun run src/index.ts` | Fast iteration, source maps |
| Testing | `bun test` | Native test runner |
| Production | `./dist/calculathor` | Single binary, optimized |

### Platform-Specific Notes

- **Linux/macOS**: Unix sockets at `$XDG_RUNTIME_DIR/calculathor.sock`
- **Windows**: TCP localhost fallback on port 7437 (AF_UNIX available on Windows 10+)
- **WSL**: Full Unix socket support, same as native Linux

## References

### Bun Documentation
- [Bun Runtime Documentation](https://bun.sh/docs)
- [Bun TCP/Unix Socket API](https://bun.sh/docs/api/tcp)
- [Bun Build --compile](https://bun.sh/docs/bundler/executables)
- [Bun File I/O](https://bun.sh/docs/api/file-io)
- [Bun.spawn API](https://bun.sh/docs/api/spawn)

### Benchmarks
- [Bun Benchmarks](https://bun.sh/docs/project/benchmarking)
- [Bun vs Node.js Performance](https://bun.sh/docs#performance)
- [JavaScriptCore vs V8](https://webkit.org/blog/7531/jsc-and-ml/)

### Alternatives
- [Deno Compile](https://docs.deno.com/runtime/reference/cli/compile/)
- [Node.js Single Executable](https://nodejs.org/api/single-executable-applications.html)
- [pkg (deprecated)](https://github.com/vercel/pkg)

### Security References
- [Bun Security Policy](https://bun.sh/docs/project/security)
- [OWASP Input Validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
- [Deno Permission Model](https://docs.deno.com/runtime/fundamentals/security/) (reference for our implementation)

## Related Decisions

- [ADR-002: Communication Transport](./ADR-002-communication-transport.md) - Unix sockets via Bun APIs
- [ADR-003: Protocol Format](./ADR-003-protocol-format.md) - JSON-RPC 2.0

---

**Document Version**: 1.0
**Last Updated**: 2026-02-14
