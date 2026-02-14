# ADR-003: Hybrid Daemon Architecture

## Status
**Accepted**

**Accepted**

## Context

Calculathor requires a multi-client architecture to support various client types:
- **TUI Client**: Long-running, interactive terminal interface
- **CLI Client**: Short-lived, one-off calculations
- **Future GUI Client**: Desktop application (Electron/Tauri)
- **Future Web Client**: Browser-based interface

The architecture must balance:
- Low latency for interactive use
- Low resource usage for simple CLI operations
- State persistence for variables and history
- Cross-platform compatibility (Linux, macOS, Windows, WSL)

## Decision

We will implement a **hybrid daemon architecture** with the following characteristics:

### 1. Hybrid Process Model

| Client Type | Mode | Rationale |
|-------------|------|-----------|
| TUI | Daemon | Long-running, needs state persistence |
| GUI | Daemon | Long-running, shares state with TUI |
| CLI | Spawn-per-client (with daemon fallback) | Fast one-off calculations |
| Web | Daemon | Long-running connections |

### 2. Transport Layer

**Primary**: Unix Domain Sockets
- Path: `/tmp/calculathor-$UID/socket` (Linux), `~/Library/Caches/calculathor/socket` (macOS)
- Lowest latency (~0.1ms round-trip)
- File-based discovery and permission control

**Fallback**: TCP Sockets
- Host: `127.0.0.1`, Port: `7437` ("CALC" on phone keypad)
- Universal cross-platform support
- Network-transparent for future remote engines

**CLI Mode**: Stdio Pipes
- Spawn engine process with `--stdio` flag
- Line-delimited JSON communication
- No daemon management overhead for simple operations

### 3. Protocol: JSON-RPC 2.0

Line-delimited JSON over the transport layer:

```typescript
// Request
{"jsonrpc": "2.0", "method": "eval", "params": {"expr": "2 + 2"}, "id": 1}

// Response
{"jsonrpc": "2.0", "result": 4, "id": 1}

// Error
{"jsonrpc": "2.0", "error": {"code": -32000, "message": "Division by zero"}, "id": 1}
```

Key methods:
- `eval`: Evaluate expression
- `eval_batch`: Evaluate multiple expressions
- `get_var`/`set_var`: Variable management
- `get_vars`/`clear_vars`: Session variable operations
- `get_history`: Retrieve calculation history
- `define_func`/`get_funcs`: User-defined functions
- `ping`: Health check

### 4. Stateful Sessions with Isolation

Each client connection receives an isolated session:

```
┌─────────────────────────────────────────────┐
│              Engine Process                  │
│  ┌───────────────────────────────────────┐  │
│  │         Session Manager                │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐  │  │
│  │  │Session A│ │Session B│ │Session C│  │  │
│  │  │- vars   │ │- vars   │ │- vars   │  │  │
│  │  │- funcs  │ │- funcs  │ │- funcs  │  │  │
│  │  │- history│ │- history│ │- history│  │  │
│  │  └─────────┘ └─────────┘ └─────────┘  │  │
│  └───────────────────────────────────────┘  │
│  ┌───────────────────────────────────────┐  │
│  │       Shared State (Global)            │  │
│  │  - Built-in functions                  │  │
│  │  - Constants (pi, e)                   │  │
│  │  - Unit definitions                    │  │
│  │  - Plugin registry                     │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

Session lifecycle:
1. **Connected**: Client establishes transport connection
2. **Active**: Session created, commands processed
3. **Suspended**: Timeout after 30 minutes idle
4. **Terminated**: Cleanup on disconnect or max suspend time

### 5. Single Binary Distribution

The entire application compiles to a single binary using `bun build --compile`:

```typescript
// Daemon auto-spawn mechanism
async function ensureDaemonRunning(): Promise<void> {
  const socketPath = getSocketPath();

  // Check if daemon is already running
  if (await isDaemonRunning(socketPath)) {
    return;
  }

  // Remove stale socket if exists
  if (await Bun.file(socketPath).exists()) {
    await Bun.file(socketPath).delete();
  }

  // Spawn daemon using process.execPath
  // Works for both bun runtime and compiled binary
  const proc = Bun.spawn([process.execPath, '--daemon'], {
    detached: true,
    stdio: ['ignore', 'ignore', 'ignore'],
  });

  // Wait for socket to be created
  await waitForSocket(socketPath, 5000);
}
```

Socket discovery priority:
1. `CALCULATHOR_SOCKET` environment variable
2. XDG runtime directory: `$XDG_RUNTIME_DIR/calculathor/socket`
3. Platform defaults:
   - macOS: `~/Library/Caches/calculathor/socket`
   - Linux: `/tmp/calculathor-$UID/socket`
   - Windows: `\.\pipe\calculathor-$USERNAME`

## Consequences

### Positive

- **Low latency**: Unix sockets provide ~0.1ms round-trip for interactive use
- **Resource efficiency**: Single daemon serves multiple clients (~10-20MB vs per-client processes)
- **State persistence**: Variables and history maintained across commands
- **Flexibility**: Hybrid model optimizes for both interactive and one-off usage
- **Simple deployment**: Single binary with auto-spawn daemon
- **Human-readable protocol**: Easy debugging with standard tools

### Negative

- **Complexity**: Daemon lifecycle management, socket cleanup, crash recovery
- **Platform differences**: Unix sockets not native on older Windows
- **Shared fate**: Daemon crash affects all connected clients
- **Memory growth**: Session state accumulates until timeout/cleanup

### Mitigations

- Implement graceful error recovery with auto-restart
- Provide `--no-daemon` flag for isolated CLI usage
- Add health checks and watchdog monitoring
- Session timeout with auto-cleanup (30 minutes idle)
- Optional session persistence to SQLite for recovery

## Implementation Notes

### Error Codes

| Code | Meaning | Usage |
|------|---------|-------|
| `-32700` | Parse error | Invalid JSON |
| `-32600` | Invalid request | Malformed JSON-RPC |
| `-32601` | Method not found | Unknown method |
| `-32602` | Invalid params | Wrong parameters |
| `-32603` | Internal error | Engine crash |
| `-32000` | Calculation error | Math errors (div/0, etc.) |
| `-32001` | Undefined variable | Variable not found |
| `-32002` | Invalid expression | Parse error in expression |

### Performance Targets

| Metric | Target |
|--------|--------|
| Connection establishment | <10ms |
| Simple expression eval | <1ms |
| Complex expression eval | <10ms |
| Session creation | <5ms |
| Memory per session | <100KB |
| Daemon startup | <100ms |

## References

- [JSON-RPC 2.0 Specification](https://www.jsonrpc.org/specification)
- [Bun TCP Sockets](https://bun.sh/docs/api/tcp)
- [Bun Build --compile](https://bun.sh/docs/bundler/executables)
- [XDG Base Directory Specification](https://specifications.freedesktop.org/basedir-spec/basedir-spec-latest.html)

## Related ADRs

- ADR-001: Daemon vs Spawn-Per-Client (detailed comparison)
- ADR-002: Communication Transport (transport analysis)
- ADR-004: State Management Model (session architecture)

---

**Date**: 2026-02-14
**Deciders**: System Architect
