# Architecture Review: Calculathor Multi-Client Architecture

> **Reviewer**: Code Review Agent
> **Date**: 2026-02-14
> **Document Reviewed**: `/plans/research-architecture.md`
> **Status**: APPROVED with Minor Revisions

---

## 1. Executive Summary

The proposed architecture for Calculathor is well-reasoned and appropriately scoped for the project goals. The hybrid daemon model with JSON-RPC 2.0 over Unix sockets is a solid foundation that balances performance, simplicity, and future extensibility.

**Overall Assessment**: The architecture aligns well with the "Functional Core, Imperative Shell" philosophy and supports the TUI-first MVP while maintaining flexibility for future client types.

---

## 2. Strengths

### 2.1 Communication Transport Decision

**Unix Domain Sockets with TCP Fallback**

The dual-transport approach is pragmatic:
- Unix sockets offer superior performance (~0.1ms round-trip) for Unix-like systems
- TCP fallback (port 7437) ensures cross-platform compatibility
- Stdio mode for CLI one-off calculations provides appropriate simplicity

**Alignment with project goals**: Supports the single-binary distribution model via Bun while maintaining multi-client capability.

### 2.2 Protocol Choice: JSON-RPC 2.0

**Excellent decision for this use case**:
- Human-readable protocol aids debugging (can use `nc`, `telnet`)
- No code generation required (unlike gRPC)
- Batching support for efficient multi-expression evaluation
- Established error handling semantics
- Universal language support for future client implementations

### 2.3 State Management Design

**Stateful sessions with per-client isolation** is appropriate for a calculator engine:
- Natural fit for variable persistence across expressions
- Session timeout (30 minutes) prevents resource leaks
- SQLite persistence for history and functions aligns with research.md decisions
- Copy-on-write for shared state modifications is performant

### 2.4 Hybrid Process Model

The hybrid approach (daemon for TUI/GUI, spawn-per-client for CLI) demonstrates understanding of use case differences:
- Daemon mode provides shared state and fast response for interactive clients
- Spawn-per-client for simple CLI calculations avoids daemon overhead
- Auto-start on first connection simplifies client implementation

### 2.5 Functional Core, Imperative Shell Alignment

The architecture correctly separates concerns:

| Layer | Responsibility | Purity |
|-------|---------------|--------|
| Parser/Evaluator | Expression → Result | Pure |
| Registry | Function lookup | Pure |
| Session Manager | State isolation | Side effects contained |
| Transport | Socket/stdio I/O | Side effects at boundary |
| Store | Persistence | Side effects at boundary |

---

## 3. Areas of Concern

### 3.1 Bun Runtime Implications

**Issue**: The architecture document references Node.js (`createServer`, `net` module) but the project uses **Bun** runtime.

**Considerations**:
- Bun's `Bun.listen()` and `Bun.connect()` APIs differ from Node.js `net` module
- Bun's single-binary compilation (`bun build --compile`) affects daemon lifecycle:
  - Compiled binaries have different process management characteristics
  - Socket file cleanup on crash may need SIGTERM handlers
- Bun's faster startup (~20ms vs ~100ms Node.js) changes the spawn-per-client calculus

**Recommendation**: Update implementation examples to use Bun-native APIs where beneficial, while maintaining Node.js compatibility where possible.

### 3.2 Single-Binary Distribution Feasibility

**Potential Issue**: Daemon mode with auto-start complicates single-binary distribution.

**Questions to resolve during implementation**:
1. How does a compiled binary spawn itself as a daemon? (argv[0] detection)
2. Will the socket activation pattern work with compiled binaries?
3. Can we embed the daemon logic in the same binary as the CLI/TUI clients?

**Suggested approach**:
```typescript
// Single binary detects mode by argv[0] or flags
if (process.argv.includes('--daemon')) {
  startDaemon();
} else if (process.argv.includes('--stdio')) {
  startStdioMode();
} else {
  // Client mode - auto-start daemon if needed
  connectOrStartDaemon();
}
```

### 3.3 Session Variable Persistence vs MVP Scope

**Conflict identified**: The architecture specifies session variable persistence, but `research.md` states "NO variables in MVP".

**Resolution needed**: Clarify if the MVP excludes:
- (a) Variables entirely, OR
- (b) Just persistent variables across restarts

The architecture assumes (b), which is reasonable, but should be explicitly documented.

### 3.4 Security Considerations

**Gap**: The threat model is appropriate but lacks detail on:

1. **Expression Sandbox**: The document mentions "VM2 or similar" but Bun has different VM capabilities than Node.js
   - Bun does not support `vm` module the same way as Node.js
   - Alternative: Use Web Workers or QuickJS for sandboxing

2. **Socket Permissions**: Unix socket at `/tmp/calculathor.sock` with mode 0600 is good, but:
   - `$XDG_RUNTIME_DIR` is preferred over `/tmp` (systemd standard)
   - Should document why 0600 vs 0660 (user-only vs group-accessible)

3. **TCP Security**: Binding to 127.0.0.1 is correct, but consider:
   - Adding authentication token for TCP mode
   - Documenting that TCP is less secure than Unix sockets

### 3.5 Transport Layer Swappability

**Concern**: The architecture shows stdio, Unix socket, and TCP as parallel options, but the implementation detail suggests they may not be fully swappable without client changes.

**Current design**:
```
TUI -> Unix Socket
CLI -> Stdio (or Unix Socket for complex ops)
GUI -> Unix Socket
Web -> TCP
```

**Recommendation**: Abstract transport behind a common interface so clients can use any transport:

```typescript
interface Transport {
  connect(): Promise<void>;
  send(request: JSONRPCRequest): Promise<JSONRPCResponse>;
  close(): Promise<void>;
}

class UnixSocketTransport implements Transport { }
class TcpTransport implements Transport { }
class StdioTransport implements Transport { }
```

---

## 4. Recommendations

### 4.1 Minor Documentation Updates

1. **Update code examples** to reference Bun APIs where appropriate
2. **Clarify MVP scope** regarding variables (see 3.3)
3. **Expand security section** with Bun-specific sandboxing approach
4. **Document single-binary strategy** for daemon auto-start

### 4.2 Implementation Priorities

| Priority | Item | Rationale |
|----------|------|-----------|
| High | Bun-native socket APIs | Performance and binary size |
| High | Transport abstraction layer | True swappability |
| Medium | Expression sandbox research | Bun compatibility |
| Medium | Daemon lifecycle in compiled binary | Distribution requirement |
| Low | Authentication for TCP | Security enhancement |

### 4.3 ADR Amendments

Consider adding these ADRs:
- **ADR-005**: Bun Runtime Selection (why Bun over Node.js)
- **ADR-006**: Single Binary Distribution Strategy
- **ADR-007**: Expression Sandboxing Approach

---

## 5. Blockers for Implementation

**No critical blockers identified.**

The following items should be resolved but do not block beginning implementation:

| Item | Impact | Mitigation |
|------|--------|------------|
| Bun socket API differences | Low | Use Node.js `net` compatibility or Bun-native APIs |
| Variable persistence scope | Low | Assume session-only for MVP, persist post-MVP |
| Expression sandbox | Medium | Use Web Workers as interim solution |
| Single-binary daemon spawn | Medium | Document approach in implementation |

---

## 6. Approval Status

### APPROVED with Minor Revisions

The architecture is sound and ready for implementation. The identified concerns are documentation clarifications and implementation details, not fundamental flaws.

### Required Before Implementation Begins

None - implementation can proceed with the understanding that:
1. Bun runtime specifics will be worked out during implementation
2. Variable persistence scope will be clarified with project lead
3. Security sandbox approach will be validated with a proof-of-concept

### Suggested Implementation Order

Following the tracer bullet approach from `research.md`:

1. **Tracer 1**: CLI-only with stdio (validates parser/evaluator)
2. **Tracer 2**: Add Unix socket daemon + TUI (validates architecture)
3. **Tracer 3**: Add persistence layer (validates state management)
4. **Tracer 4**: Add user functions (validates extensibility)

---

## 7. Metrics Validation

| Target | Architecture Support | Confidence |
|--------|---------------------|------------|
| <100ms startup | Bun + daemon model supports this | High |
| <10MB memory | Single daemon vs multiple processes | High |
| <1ms expression eval | JSON-RPC overhead minimal | Medium |
| <5ms connection | Unix socket performance | High |

---

## 8. Conclusion

The Calculathor architecture is well-designed and appropriately scoped. The hybrid daemon model, JSON-RPC 2.0 protocol, and stateful session management form a solid foundation. The main action items are Bun-specific implementation details rather than architectural changes.

**Next Steps**:
1. Proceed with implementation following tracer bullet approach
2. Create proof-of-concept for Bun socket communication
3. Validate single-binary daemon spawn mechanism
4. Document final decisions in additional ADRs

---

**Review Completed**: 2026-02-14
**Reviewer**: Architecture Review Agent
**Document Version**: 1.0
