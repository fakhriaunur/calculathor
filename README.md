# Calculathor

A powerful yet lightweight calculator with expression parser, built with Domain-Driven Design principles.

## Features

- **Mathematical Expressions**: Full support for arithmetic, trigonometry, logarithms, and more
- **Operator Precedence**: Proper handling of precedence with Pratt Parser (Top-Down Operator Precedence)
- **Variables**: Define and use variables in calculations
- **Functions**: Extensive built-in function library (sin, cos, log, sqrt, etc.)
- **Constants**: Built-in constants (pi, e, phi, tau)
- **CLI Mode**: Quick calculations from command line
- **TUI Mode**: Interactive terminal UI with history
- **Daemon Mode**: Persistent sessions with variable storage
- **JSON-RPC API**: Programmatic access via Unix sockets or TCP
- **Self-Learning Hooks**: Adaptive behavior with pattern recognition and caching

## Installation

```bash
# Clone the repository
git clone <repo-url>
cd calculathor

# Install dependencies
bun install

# Build binary
bun run build
```

## Usage

### CLI Mode

```bash
# Direct calculation
bun run cli "2 + 3 * 4"
# Output: 14

# Using pipe
echo "sin(pi / 2)" | bun run cli
# Output: 1

# Interactive mode
bun run cli
```

### TUI Mode

```bash
# Launch interactive TUI
bun run tui
```

### Daemon Mode

```bash
# Start daemon
bun run daemon

# Or let CLI auto-start daemon
bun run cli "2 + 2"
```

## Examples

```bash
# Basic arithmetic
calculathor "2 + 3 * 4"           # 14
calculathor "(2 + 3) * 4"         # 20
calculathor "2 ^ 3 ^ 2"           # 512 (right-associative)

# Trigonometry
calculathor "sin(pi / 2)"         # 1
calculathor "cos(0)"              # 1
calculathor "sqrt(16)"            # 4

# Variables (in TUI or daemon mode)
> x = 5
> y = 10
> x * y
50

# Functions
calculathor "max(1, 5, 3)"        # 5
calculathor "abs(-10)"            # 10
calculathor "log(1000)"           # 3
```

## Architecture

The project follows Domain-Driven Design with clear bounded contexts:

```
/src
├── core/           # Core Domain - Expression Evaluation
│   ├── pure/       # Pure functions (tokenizer, parser, evaluator)
│   ├── services/   # Domain services (registry)
│   └── domain/     # Domain models
├── transport/      # Transport Context - IPC
├── persistence/    # Persistence Context - Session Management
├── tui/            # TUI Client (Ink)
├── cli/            # CLI Client
├── daemon/         # Daemon Process
└── hooks/          # Self-Learning Hooks System
```

### Key Components

- **Tokenizer**: Lexical analysis, converts input to tokens
- **Pratt Parser**: Top-down operator precedence parsing
- **Evaluator**: Evaluates AST to produce results
- **Registry**: Manages operators, functions, and constants
- **Transport**: Unix sockets, TCP, and stdio communication
- **Session Manager**: Session lifecycle and variable storage
- **Hooks System**: Self-learning with pattern recognition

## Testing

```bash
# Run all tests
bun test

# Run specific test suites
bun run test:core        # Core domain tests
bun run test:persistence # Persistence tests

# With coverage
bun run test:coverage
```

## Development

```bash
# Run in watch mode
bun run dev:daemon
bun run dev:tui

# Type check
bun run lint

# Format code
bun run format
```

## JSON-RPC API

The daemon exposes a JSON-RPC 2.0 API:

```typescript
// Evaluate expression
{ method: 'eval', params: { expr: '2 + 2' }, id: 1 }

// Get/set variables
{ method: 'get_var', params: { sessionId, name: 'x' }, id: 2 }
{ method: 'set_var', params: { sessionId, name: 'x', value: 10 }, id: 3 }

// Get history
{ method: 'get_history', params: { sessionId }, id: 4 }

// Ping
{ method: 'ping', id: 5 }
```

## License

MIT
