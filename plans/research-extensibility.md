# Calculathor Scripting & Extensibility Research

> **Research Domain**: Section 2.4 Scripting/Extensibility
> **Author**: Research Agent
> **Date**: 2026-02-14
> **Status**: Complete

---

## Executive Summary

This document evaluates five approaches for adding scripting and extensibility to Calculathor:
1. Embedded QuickJS (JavaScript)
2. WASM-based plugins
3. Lua via wasmoon
4. Custom DSL (Domain-Specific Language)
5. TypeScript plugin system (dynamic import)

**Recommendation**: Implement a **two-tier approach**:
- **Phase 1 (MVP)**: Simple expression-based custom functions using the expression engine
- **Phase 2 (Post-MVP)**: QuickJS for user scripting with strict sandboxing

---

## 1. Option Comparison Matrix

| Criteria | QuickJS | WASM Plugins | Lua/wasmoon | Custom DSL | TS Dynamic Import |
|----------|---------|--------------|-------------|------------|-------------------|
| **Security** | High | Very High | Medium | Very High | Low |
| **Performance** | Good | Excellent | Good | Excellent | Excellent |
| **Bundle Size** | ~500KB | Variable | ~1MB | Minimal | 0 |
| **Developer Experience** | Excellent | Good | Good | Poor | Excellent |
| **Debugging** | Good | Poor | Poor | None | Excellent |
| **Learning Curve** | Low | High | Medium | High | Low |
| **Math Libraries** | Rich | Varies | Moderate | Build from scratch | Rich |
| **Sandboxing** | Built-in | Native | Limited | Complete | Requires VM |

---

## 2. Detailed Analysis

### 2.1 Embedded QuickJS (JavaScript)

**Overview**: QuickJS is a small, embeddable JavaScript engine by Fabrice Bellard. The `quickjs-emscripten` package provides TypeScript bindings.

**Security/Sandboxing**:
- Complete control over global object
- No access to `require()`, `fs`, or Node.js APIs by default
- Memory limits can be enforced
- CPU time limits via interrupt handlers
- Can disable dangerous operations (eval, Function constructor)

```typescript
// Example sandbox configuration
import { getQuickJS } from 'quickjs-emscripten';

const QuickJS = await getQuickJS();
const vm = QuickJS.newContext();

// Remove dangerous globals
vm.unwrapResult(vm.evalCode('delete this.eval')).dispose();
vm.unwrapResult(vm.evalCode('delete this.Function')).dispose();

// Inject safe math API
const math = vm.newObject();
vm.setProp(math, 'sin', vm.newFunction('sin', (x) => {
  return { value: Math.sin(vm.getNumber(x)) };
}));
vm.setProp(vm.global, 'Math', math);
```

**Performance Overhead**:
- Startup: ~10-50ms for simple scripts
- Execution: Near-native for math operations (JIT not available but interpreter is fast)
- Memory: ~5-10MB per VM instance
- Can reuse VMs with context reset for better performance

**Bundle Size Impact**:
- `quickjs-emscripten`: ~500KB minified
- Additional ~100KB for TypeScript wrappers

**Developer Experience**:
- JavaScript is familiar to most users
- Rich ecosystem of math libraries (mathjs, decimal.js concepts)
- Can support async/await patterns
- Error messages are reasonable

**Debugging Capabilities**:
- Stack traces available
- Can add source maps
- Can implement breakpoint-like functionality via interrupt handlers
- Limited compared to Node.js debugging

**Pros**:
- Mature, actively maintained
- Excellent sandboxing
- Familiar syntax for users
- Good performance for calculator use cases

**Cons**:
- WASM compilation overhead on first run
- Cannot easily share state between VM instances
- Limited debugging compared to full Node.js

---

### 2.2 WASM-Based Plugins

**Overview**: Users write plugins in any WASM-compilable language (Rust, C++, Go, AssemblyScript) and load them as `.wasm` files.

**Security/Sandboxing**:
- WASM provides memory sandboxing by design
- No filesystem/network access without explicit host imports
- Capability-based security model
- Can enforce execution time limits
- Linear memory isolation

```typescript
// Example WASM plugin loader
import { readFile } from 'fs/promises';

interface CalculatorHost {
  log: (msg: string) => void;
  getConstant: (name: string) => number;
}

async function loadPlugin(path: string, host: CalculatorHost) {
  const wasmBuffer = await readFile(path);
  const module = await WebAssembly.compile(wasmBuffer);

  const imports = {
    calculathor: {
      log: (ptr: number, len: number) => { /* ... */ },
      getConstant: (ptr: number, len: number) => { /* ... */ },
    }
  };

  const instance = await WebAssembly.instantiate(module, imports);
  return instance.exports;
}
```

**Performance Overhead**:
- Near-native performance
- Minimal overhead for host calls
- Instantiation cost: ~1-5ms per module

**Bundle Size Impact**:
- No runtime dependency (WASM is native to Node.js)
- Plugin sizes vary: 10KB-500KB depending on language and optimization

**Developer Experience**:
- Requires knowledge of WASM-compilable languages
- Steep learning curve for casual users
- Excellent for power users and library authors
- Requires separate build toolchain

**Debugging Capabilities**:
- Limited in Node.js
- Language-specific debugging during development
- Chrome DevTools can debug WASM but complex setup

**Pros**:
- Maximum performance
- Language agnostic (Rust, C++, Go, etc.)
- Strong security model
- Future-proof

**Cons**:
- High barrier to entry
- Complex build process for plugin authors
- Debugging is difficult
- Overkill for simple custom functions

---

### 2.3 Lua via wasmoon

**Overview**: Lua is a lightweight scripting language designed for embedding. `wasmoon` is a Lua implementation compiled to WASM for Node.js.

**Security/Sandboxing**:
- Lua has good sandboxing capabilities
- Can remove dangerous standard library functions
- Memory limits via WASM
- But: Lua's sandboxing requires careful configuration

```typescript
// Example wasmoon usage
import { LuaFactory } from 'wasmoon';

const factory = new LuaFactory();
const lua = await factory.createEngine();

// Remove dangerous functions
await lua.doString(`
  os = nil
  io = nil
  load = nil
  loadfile = nil
  dofile = nil
  package = nil
`);

// Inject safe math API
lua.global.set('calculathor', {
  sin: Math.sin,
  cos: Math.cos,
  // ...
});
```

**Performance Overhead**:
- Good performance for scripting
- Faster than QuickJS for simple operations
- Slower than native WASM

**Bundle Size Impact**:
- `wasmoon`: ~1MB
- Larger than QuickJS

**Developer Experience**:
- Lua is simple but less known than JavaScript
- Good for configuration-style scripting
- 1-based indexing can confuse users
- Smaller ecosystem than JavaScript

**Debugging Capabilities**:
- Basic error messages
- Can use Lua debug library (if enabled)
- Limited compared to modern JS tooling

**Pros**:
- Designed for embedding
- Good performance
- Simple syntax for math

**Cons**:
- Smaller ecosystem
- Less familiar to most users
- Larger bundle size than QuickJS
- Sandbox requires careful configuration

---

### 2.4 Custom DSL (Domain-Specific Language)

**Overview**: Create a purpose-built language specifically for Calculathor calculations.

**Security/Sandboxing**:
- Complete control over language semantics
- Only allow safe operations by design
- No need for sandboxing - the language IS the sandbox

```typescript
// Example custom DSL syntax
/*
def fib(n) {
  if (n <= 1) return n
  return fib(n - 1) + fib(n - 2)
}

const phi = (1 + sqrt(5)) / 2

// User-defined units
unit furlong = 201.168 meters
*/
```

**Performance Overhead**:
- Can be excellent if using Pratt parser + direct execution
- No interpreter overhead if compiling to simple bytecode

**Bundle Size Impact**:
- Minimal - just the parser and evaluator
- ~50-100KB for a complete implementation

**Developer Experience**:
- Must learn new syntax
- Can be optimized for calculator use cases
- No external documentation or examples

**Debugging Capabilities**:
- Can design good error messages
- No existing tooling (debugger, IDE support)

**Pros**:
- Perfect fit for domain
- Minimal dependencies
- Maximum control

**Cons**:
- High implementation cost
- Users must learn new language
- No existing tooling or libraries
- Maintenance burden

---

### 2.5 TypeScript Plugin System (Dynamic Import)

**Overview**: Allow users to write TypeScript/JavaScript plugins that are dynamically imported.

**Security/Sandboxing**:
- **CRITICAL**: No sandboxing by default
- `vm` module provides some isolation but can be escaped
- `vm2` has security vulnerabilities (deprecated)
- `isolated-vm` provides real isolation but complex

```typescript
// DANGEROUS - No sandbox
const plugin = await import('./user-plugin.js');

// Safer with isolated-vm (but complex)
import ivm from 'isolated-vm';

const isolate = new ivm.Isolate({ memoryLimit: 128 });
const context = await isolate.createContext();
// ... complex setup ...
```

**Performance Overhead**:
- Native Node.js performance
- No interpreter overhead

**Bundle Size Impact**:
- None (native Node.js)

**Developer Experience**:
- Full TypeScript/JavaScript support
- Excellent debugging via Node.js
- Rich ecosystem access

**Debugging Capabilities**:
- Full Node.js debugging
- Source maps work
- IDE support

**Pros**:
- Best developer experience
- Full language features
- No bundle size impact

**Cons**:
- **Security nightmare without proper sandboxing**
- `isolated-vm` adds complexity and native dependencies
- Users can access filesystem, network, etc.
- Not suitable for untrusted code

---

## 3. Security Considerations

### Threat Model

| Threat | Risk | Mitigation |
|--------|------|------------|
| File system access | High | Sandboxed VMs only |
| Network access | High | No host imports for network |
| Infinite loops | Medium | Execution time limits |
| Memory exhaustion | Medium | Memory limits |
| Prototype pollution | Medium | Freeze prototypes, use VMs |
| Data exfiltration | High | No unsandboxed code execution |

### Security Recommendations

1. **Never use raw `eval()` or `new Function()` with user input**
2. **Never use `vm` module for untrusted code** (escapable)
3. **Prefer QuickJS or WASM** for user scripts
4. **Implement resource limits**:
   - Max execution time (e.g., 5 seconds)
   - Max memory (e.g., 128MB)
   - Max call stack depth
   - Max loop iterations

5. **Audit all host functions** exposed to scripts
6. **Consider using Worker threads** with message passing for additional isolation

---

## 4. Plugin API Design Sketch

### 4.1 QuickJS-Based API (Recommended)

```typescript
// calculathor.d.ts - Type definitions for plugin authors
declare global {
  // Math utilities
  function sin(x: number): number;
  function cos(x: number): number;
  function tan(x: number): number;
  function sqrt(x: number): number;
  function log(x: number, base?: number): number;
  function ln(x: number): number;
  function exp(x: number): number;
  function pow(base: number, exp: number): number;
  function abs(x: number): number;
  function floor(x: number): number;
  function ceil(x: number): number;
  function round(x: number, decimals?: number): number;
  function min(...values: number[]): number;
  function max(...values: number[]): number;
  function sum(...values: number[]): number;
  function avg(...values: number[]): number;
  function factorial(n: number): number;
  function gcd(a: number, b: number): number;
  function lcm(a: number, b: number): number;

  // Constants
  const PI: number;
  const E: number;
  const PHI: number;
  const SQRT2: number;
  const LN2: number;
  const LN10: number;

  // Conversion utilities
  function toRadians(degrees: number): number;
  function toDegrees(radians: number): number;

  // Persistence
  function setVar(name: string, value: number | string | boolean): void;
  function getVar(name: string): number | string | boolean | undefined;
  function deleteVar(name: string): void;
  function listVars(): string[];

  // Function registration
  function registerFunction(
    name: string,
    fn: (...args: number[]) => number,
    options?: {
      description?: string;
      args?: string[];
    }
  ): void;

  // Unit definitions (future)
  function defineUnit(name: string, baseValue: number, baseUnit?: string): void;
  function convert(value: number, from: string, to: string): number;

  // Output
  function print(...values: any[]): void;
  function format(value: number, decimals?: number): string;
}

export {};
```

### 4.2 Plugin Manifest

```typescript
// plugin-manifest.d.ts
interface CalculathorPlugin {
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;

  // Plugin entry point
  main: string; // Path to main script file

  // Optional metadata
  keywords?: string[];
  homepage?: string;
  repository?: string;

  // API version compatibility
  apiVersion: '1.0';

  // Dependencies on other plugins
  dependencies?: string[];

  // Optional configuration schema
  config?: {
    [key: string]: {
      type: 'string' | 'number' | 'boolean';
      default?: any;
      description: string;
    };
  };
}
```

### 4.3 Example Plugin

```javascript
// example-plugin.js
// A Calculathor plugin for statistical functions

const { registerFunction, setVar } = calculathor;

// Register statistical functions
registerFunction('std', function(...values) {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}, {
  description: 'Calculate standard deviation',
  args: ['...values']
});

registerFunction('median', function(...values) {
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}, {
  description: 'Calculate median',
  args: ['...values']
});

// Set plugin constants
setVar('statsVersion', '1.0.0');
```

### 4.4 Host Implementation Sketch

```typescript
// plugin-host.ts - Internal implementation
import { getQuickJS, QuickJSContext } from 'quickjs-emscripten';
import { readFile } from 'fs/promises';
import { resolve } from 'path';

interface PluginHost {
  loadPlugin(path: string): Promise<void>;
  unloadPlugin(name: string): void;
  listPlugins(): string[];
  execute(script: string): Promise<unknown>;
}

class QuickJSPluginHost implements PluginHost {
  private vm: QuickJSContext;
  private plugins = new Map<string, PluginMetadata>();

  constructor() {
    this.vm = this.createSandboxedVM();
  }

  private createSandboxedVM(): QuickJSContext {
    const vm = QuickJS.newContext();

    // Remove dangerous globals
    this.removeDangerousGlobals(vm);

    // Inject safe API
    this.injectMathAPI(vm);
    this.injectPersistenceAPI(vm);
    this.injectPluginAPI(vm);

    return vm;
  }

  private injectMathAPI(vm: QuickJSContext): void {
    const math = vm.newObject();

    // Inject math functions
    const injectFn = (name: string, fn: Function) => {
      vm.setProp(math, name, vm.newFunction(name, (...args) => ({
        value: fn(...args.map(a => vm.dump(a)))
      })));
    };

    injectFn('sin', Math.sin);
    injectFn('cos', Math.cos);
    // ... etc

    vm.setProp(vm.global, 'Math', math);
  }

  async execute(script: string, timeoutMs = 5000): Promise<unknown> {
    // Set up timeout
    const timeoutHandle = setTimeout(() => {
      this.vm.runtime.executePendingJobs(0);
    }, timeoutMs);

    try {
      const result = this.vm.unwrapResult(this.vm.evalCode(script));
      const value = this.vm.dump(result);
      result.dispose();
      return value;
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  async loadPlugin(path: string): Promise<void> {
    const content = await readFile(resolve(path), 'utf-8');
    await this.execute(content);
  }

  // ... other methods
}
```

---

## 5. Implementation Roadmap

### Phase 0: MVP (Immediate)
- **No scripting** - Focus on expression engine
- Support basic function definitions in expression syntax:
  ```
  f(x) = x^2 + 2*x + 1
  g(x, y) = sqrt(x^2 + y^2)
  ```
- Persist user-defined functions in session state

### Phase 1: Core Scripting (Post-MVP)
- Integrate QuickJS
- Implement sandboxed API
- Support `.calc.js` plugin files
- Add `loadPlugin()` and `unloadPlugin()` commands

### Phase 2: Enhanced Scripting
- Plugin registry/discovery
- Async script support
- Unit definition API
- Plugin configuration system

### Phase 3: Advanced Extensions
- WASM plugin support for performance-critical extensions
- Plugin marketplace/repository
- Hot reload during development

---

## 6. Recommendation

**Primary Recommendation: QuickJS**

Rationale:
1. **Security**: Built-in sandboxing without native dependencies
2. **Familiarity**: JavaScript is the most widely known language
3. **Performance**: Adequate for calculator use cases
4. **Ecosystem**: Rich math library concepts can be adapted
5. **Bundle Size**: ~500KB is acceptable for the functionality

**Alternative for Power Users: WASM**
- Offer WASM plugin support as an advanced feature
- Higher barrier to entry but maximum performance
- Good for computational heavy extensions (matrix math, numerical methods)

**What to Avoid**:
- Custom DSL (implementation cost too high)
- Raw dynamic imports (security risk)
- Lua (smaller ecosystem than JS)

---

## 7. References

- [QuickJS Documentation](https://bellard.org/quickjs/)
- [quickjs-emscripten](https://github.com/justjake/quickjs-emscripten)
- [wasmoon](https://github.com/ceifa/wasmoon)
- [WebAssembly Security Model](https://webassembly.org/docs/security/)
- [isolated-vm](https://github.com/laverdet/isolated-vm)
- [kalker](https://github.com/PaddiM8/kalker) - Similar calculator with function support
- [qalculate](https://qalculate.github.io/) - Reference for math functionality

---

**Next Steps**:
1. Review this research with the architecture team
2. Prototype QuickJS integration
3. Design the expression engine to support Phase 0 function definitions
4. Create security guidelines for plugin API surface
