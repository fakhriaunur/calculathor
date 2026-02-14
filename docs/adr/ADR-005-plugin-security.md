# ADR-005: Plugin Security Model

## Status
**Accepted**

**Proposed**

## Context

Calculathor requires an extensibility mechanism to allow users to define custom functions and, in the future, execute arbitrary scripts for advanced calculations. This capability introduces significant security risks that must be addressed through a comprehensive security model.

The system must support:

1. **Expression-based custom functions** (Phase 1): User-defined functions using expression syntax like `f(x) = x^2 + 2*x + 1`
2. **QuickJS scripting** (Phase 2): Full JavaScript execution via embedded QuickJS engine for complex calculations
3. **Plugin ecosystem** (Future): Third-party plugins via `.calc.js` files

Without proper security controls, malicious or buggy user code could:
- Execute arbitrary system commands
- Access the filesystem or network
- Exfiltrate sensitive data
- Cause denial of service through infinite loops or resource exhaustion
- Escape the sandbox to access host Node.js environment

## Decision

We will implement a **two-tier security model** with defense-in-depth principles:

### Tier 1: Expression Engine (Phase 1)

For simple custom functions defined via expression syntax, security is enforced through the parser and evaluator design:

- **Language restriction**: Only mathematical expressions, no statements or control flow
- **Whitelist approach**: Only explicitly allowed functions and operators are permitted
- **No I/O primitives**: Expressions cannot perform any input/output operations
- **Immutable context**: Variables are bound at evaluation time, preventing side effects

```typescript
// Allowed: Pure mathematical expressions
f(x) = sqrt(x^2 + 1)
g(a, b) = sin(a) * cos(b) + log(a + b)

// Blocked: Any I/O or system access
f(x) = fs.readFileSync('/etc/passwd')  // No file system access
f(x) = fetch('https://evil.com')       // No network access
```

### Tier 2: QuickJS Sandboxing (Phase 2)

For full scripting capabilities, we will use QuickJS with strict sandboxing:

**1. VM Isolation**

```typescript
import { getQuickJS } from 'quickjs-emscripten';

const QuickJS = await getQuickJS();
const vm = QuickJS.newContext();

// Complete isolation from host - no Node.js APIs available
```

**2. Dangerous API Removal**

```typescript
// Remove dangerous globals before any user code execution
vm.unwrapResult(vm.evalCode('delete this.eval')).dispose();
vm.unwrapResult(vm.evalCode('delete this.Function')).dispose();
vm.unwrapResult(vm.evalCode('delete this.constructor')).dispose();
vm.unwrapResult(vm.evalCode('delete this.Proxy')).dispose();

// Remove any other dynamic code execution paths
```

**3. Controlled API Surface**

Only explicitly injected functions are available to scripts:

```typescript
interface SandboxAPI {
  // Math functions only - no host access
  sin(x: number): number;
  cos(x: number): number;
  // ... other math functions

  // Variable persistence (isolated to VM)
  setVar(name: string, value: number): void;
  getVar(name: string): number | undefined;

  // Plugin registration
  registerFunction(name: string, fn: Function, meta: object): void;
}
```

**4. Prototype Pollution Prevention**

```typescript
// Freeze all prototypes to prevent pollution
vm.unwrapResult(vm.evalCode(`
  Object.freeze(Object.prototype);
  Object.freeze(Array.prototype);
  Object.freeze(Number.prototype);
  Object.freeze(String.prototype);
  Object.freeze(Boolean.prototype);
  Object.freeze(Function.prototype);
`)).dispose();

// Use Object.create(null) for internal objects
const safeObj = vm.unwrapResult(vm.evalCode('Object.create(null)')).dispose();
```

### Resource Limits

All script execution will enforce strict resource constraints:

| Resource | Limit | Enforcement |
|----------|-------|-------------|
| **Execution Time** | 5 seconds default, configurable | Interrupt handler in QuickJS runtime |
| **Memory** | 128MB default, configurable | QuickJS memory limits + host monitoring |
| **Call Stack** | 1000 frames | QuickJS internal limits |
| **Loop Iterations** | 1,000,000 per execution | Custom bytecode injection or VM-level tracking |
| **Output Size** | 1MB maximum | Truncate or reject oversized outputs |

```typescript
class ResourceLimiter {
  private startTime: number;
  private maxExecutionMs: number;
  private loopCounter: number;
  private maxLoopIterations: number;

  constructor(options: ResourceLimitOptions) {
    this.maxExecutionMs = options.maxExecutionMs ?? 5000;
    this.maxLoopIterations = options.maxLoopIterations ?? 1_000_000;
    this.startTime = Date.now();
    this.loopCounter = 0;
  }

  checkExecutionTime(): void {
    if (Date.now() - this.startTime > this.maxExecutionMs) {
      throw new ResourceExhaustedError(
        `Execution timeout: exceeded ${this.maxExecutionMs}ms`
      );
    }
  }

  checkLoopIteration(): void {
    this.loopCounter++;
    if (this.loopCounter > this.maxLoopIterations) {
      throw new ResourceExhaustedError(
        `Loop iteration limit exceeded: ${this.maxLoopIterations}`
      );
    }
  }
}

// QuickJS interrupt handler
vm.runtime.setInterruptHandler(() => {
  limiter.checkExecutionTime();
  return false; // Continue execution
});
```

### Threat Model

| Threat | Severity | Likelihood | Mitigation |
|--------|----------|------------|------------|
| **Code Injection** | Critical | Medium | No `eval()` or `new Function()`; whitelist-only APIs; QuickJS isolation |
| **Infinite Loops** | High | High | Execution time limits; interrupt handlers; loop iteration caps |
| **Resource Exhaustion** | High | Medium | Memory limits; output size limits; CPU quotas |
| **Sandbox Escape** | Critical | Low | Remove dangerous globals; no host imports; prototype freezing |
| **Prototype Pollution** | Medium | Medium | Freeze all prototypes; use Object.create(null) |
| **File System Access** | Critical | Low | No fs module exposure; path sanitization at host boundary |
| **Network Access** | Critical | Low | No network APIs in sandbox; code cannot make HTTP requests |
| **Data Exfiltration** | High | Low | Sandboxed execution; no external communication channels |
| **ReDoS (Regex DoS)** | Medium | Low | Limit regex complexity; timeout regex operations |

### Input Validation

All user inputs entering the script environment must be validated:

```typescript
import { z } from 'zod';

const ScriptInputSchema = z.object({
  script: z.string().max(50000, 'Script exceeds maximum length'),
  timeoutMs: z.number().int().min(100).max(30000).default(5000),
  memoryMb: z.number().int().min(16).max(512).default(128),
});

const FunctionDefinitionSchema = z.object({
  name: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'Invalid function name'),
  args: z.array(z.string()).max(10, 'Too many parameters'),
  body: z.string().max(10000),
});
```

### Audit Logging

Security-relevant events will be logged for monitoring:

```typescript
interface SecurityAuditEvent {
  timestamp: Date;
  event: 'SCRIPT_EXECUTION' | 'PLUGIN_LOAD' | 'RESOURCE_LIMIT_HIT' | 'SANDBOX_VIOLATION';
  source: string; // Plugin name or 'anonymous'
  details: Record<string, unknown>;
  executionTimeMs?: number;
  memoryUsedMb?: number;
}
```

## Consequences

### Positive

- **Defense in depth**: Multiple security layers protect against various attack vectors
- **Minimal attack surface**: Only explicitly allowed operations are possible
- **Resource protection**: System remains stable even under malicious script attacks
- **Auditability**: All script execution is logged for security review
- **Extensibility**: Users can still create powerful custom functions within constraints

### Negative

- **Performance overhead**: QuickJS interpretation is slower than native execution
- **Memory overhead**: Each VM instance requires ~5-10MB
- **Complexity**: Security model adds implementation complexity
- **Debugging limitations**: Sandboxed environment limits debugging capabilities
- **API limitations**: Users cannot access full Node.js ecosystem from scripts

## Implementation Guidelines

### For Plugin Host Implementers

1. **Never trust user code**: Assume all scripts are potentially malicious
2. **Validate at boundaries**: Check all inputs before passing to VM
3. **Use immutable patterns**: Prevent mutation of host objects
4. **Log extensively**: Record all security-relevant events
5. **Fail securely**: On any error, terminate VM and clean up resources

### For Plugin Authors

1. **Pure functions preferred**: Avoid side effects for predictable behavior
2. **Handle resource limits gracefully**: Scripts may be terminated mid-execution
3. **Document dependencies**: Declare required API features in plugin manifest
4. **Test in sandbox**: Verify plugins work within resource constraints

## Alternatives Considered

### 1. Node.js `vm` Module

**Rejected**: The `vm` module is escapable and not suitable for untrusted code. Multiple CVEs exist for vm-based sandbox escapes.

### 2. `isolated-vm` Package

**Considered**: Provides real V8 isolates with strong sandboxing.

**Rejected**: Requires native compilation, adds deployment complexity, and is overkill for calculator use cases.

### 3. WASM-Based Plugins Only

**Considered**: Maximum security through WASM memory isolation.

**Rejected**: Too high barrier to entry for casual users; complex build toolchain required.

### 4. Custom DSL

**Considered**: Purpose-built language with security by design.

**Rejected**: High implementation cost; users must learn new syntax; no tooling support.

## Related ADRs

- [ADR-002: Expression Engine Architecture](./ADR-002-expression-engine.md) - Tier 1 implementation
- [ADR-003: State Management](./ADR-003-state-management.md) - Variable persistence security
- [ADR-004: Plugin Architecture](./ADR-004-plugin-architecture.md) - Plugin system design

## References

- [QuickJS Security Model](https://bellard.org/quickjs/security.html)
- [WebAssembly Security](https://webassembly.org/docs/security/)
- [CWE-94: Code Injection](https://cwe.mitre.org/data/definitions/94.html)
- [OWASP Prototype Pollution](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/11-Client-side_Testing/10-Testing_for_Prototype_Pollution)
- [CWE-400: Uncontrolled Resource Consumption](https://cwe.mitre.org/data/definitions/400.html)

## Tags

adr,security,sandbox,quickjs,plugins,threat-model

---

*Last Updated: 2026-02-14*
*Author: V3 Security Architect*
*Status: Proposed*
