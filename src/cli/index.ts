#!/usr/bin/env bun
/**
 * CLI Client for Calculathor
 * Supports both daemon mode and spawn-per-client mode
 */

import { tokenize } from '../core/pure/tokenizer';
import { PrattParser } from '../core/pure/pratt-parser';
import { evaluate } from '../core/pure/evaluator';
import { RegistryService } from '../core/services/registry-service';
import {
  TransportService,
  type TransportConfig,
  type Connection,
} from '../transport/services/transport-service';
import {
  JSONRPCServer,
  JSONRPCErrorException,
  JSONRPC_ERRORS,
} from '../daemon/rpc-server';

interface CLIOptions {
  expression?: string;
  daemon?: boolean;
  noDaemon?: boolean;
  help?: boolean;
  version?: boolean;
}

function parseArgs(args: string[]): CLIOptions {
  const options: CLIOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '-h':
      case '--help':
        options.help = true;
        break;
      case '-v':
      case '--version':
        options.version = true;
        break;
      case '-d':
      case '--daemon':
        options.daemon = true;
        break;
      case '--no-daemon':
        options.noDaemon = true;
        break;
      case '-e':
      case '--eval':
        options.expression = args[++i];
        break;
      default:
        if (!arg.startsWith('-') && !options.expression) {
          options.expression = arg;
        }
    }
  }

  return options;
}

function showHelp(): void {
  console.log(`
Calculathor - A powerful yet lightweight calculator

Usage:
  calculathor [options] [expression]
  echo "expression" | calculathor

Options:
  -h, --help        Show this help message
  -v, --version     Show version
  -e, --eval        Evaluate expression
  -d, --daemon      Start daemon
  --no-daemon       Run without daemon (spawn-per-client mode)

Examples:
  calculathor "2 + 3 * 4"
  calculathor -e "sin(pi / 2)"
  echo "sqrt(16)" | calculathor
  calculathor --daemon
`);
}

function showVersion(): void {
  console.log('Calculathor v0.1.0');
}

async function evaluateLocal(expression: string): Promise<string> {
  try {
    const registry = RegistryService.createStandard();
    const parser = new PrattParser(registry);
    const tokens = tokenize(expression);
    const { ast } = parser.parse(tokens);
    const result = evaluate(ast, { registry });

    // Format result
    if (Number.isInteger(result)) {
      return result.toString();
    }
    return result.toPrecision(10).replace(/\.?0+$/, '');
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Error: ${error.message}`);
    }
    throw error;
  }
}

async function evaluateViaDaemon(expression: string): Promise<string> {
  const transport = new TransportService();
  const client = transport.createClient();

  const uid = process.getuid?.() ?? 1000;
  const socketPath = `/tmp/calculathor-${uid}.sock`;

  const config: TransportConfig = {
    type: 'unix',
    address: socketPath,
  };

  let connection: Connection;
  try {
    connection = await client.connect(config);
  } catch {
    // Daemon not running, start it
    await startDaemon();
    // Retry connection
    await new Promise((resolve) => setTimeout(resolve, 100));
    connection = await client.connect(config);
  }

  return new Promise((resolve, reject) => {
    const request = JSONRPCServer.createRequest('eval', { expr: expression }, 1);

    connection.onMessage((data) => {
      const response = JSON.parse(data);
      connection.close();

      if (response.error) {
        reject(new Error(response.error.message));
      } else {
        resolve(String(response.result));
      }
    });

    connection.onClose(() => {
      reject(new Error('Connection closed'));
    });

    connection.send(request);
  });
}

async function startDaemon(): Promise<void> {
  const proc = Bun.spawn(['bun', import.meta.dir + '/../daemon/index.ts'], {
    detached: true,
    stdio: ['ignore', 'ignore', 'ignore'],
  });

  // Wait a moment for daemon to start
  await new Promise((resolve) => setTimeout(resolve, 100));

  console.error('Daemon started');
}

async function interactiveMode(useDaemon: boolean): Promise<void> {
  console.log('Calculathor Interactive Mode');
  console.log('Type "exit" or press Ctrl+C to quit\n');

  const reader = Bun.stdin.stream().getReader();
  const decoder = new TextDecoder();

  process.stdout.write('> ');

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    const input = decoder.decode(value).trim();

    if (input === 'exit' || input === 'quit') {
      break;
    }

    if (!input) {
      process.stdout.write('> ');
      continue;
    }

    try {
      const result = useDaemon
        ? await evaluateViaDaemon(input)
        : await evaluateLocal(input);
      console.log(result);
    } catch (error) {
      if (error instanceof Error) {
        console.error(error.message);
      }
    }

    process.stdout.write('> ');
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (options.help) {
    showHelp();
    return;
  }

  if (options.version) {
    showVersion();
    return;
  }

  // Check if input is piped
  const isPiped = !Bun.stdin.isTerminal?.();

  if (options.daemon) {
    await startDaemon();
    return;
  }

  if (options.expression) {
    const useDaemon = !options.noDaemon;
    try {
      const result = useDaemon
        ? await evaluateViaDaemon(options.expression)
        : await evaluateLocal(options.expression);
      console.log(result);
    } catch (error) {
      if (error instanceof Error) {
        console.error(error.message);
        process.exit(1);
      }
    }
    return;
  }

  if (isPiped) {
    // Read from stdin
    const reader = Bun.stdin.stream().getReader();
    const decoder = new TextDecoder();
    let input = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      input += decoder.decode(value);
    }

    const expression = input.trim();
    if (expression) {
      try {
        const result = options.noDaemon
          ? await evaluateLocal(expression)
          : await evaluateViaDaemon(expression);
        console.log(result);
      } catch (error) {
        if (error instanceof Error) {
          console.error(error.message);
          process.exit(1);
        }
      }
    }
    return;
  }

  // Interactive mode
  await interactiveMode(!options.noDaemon);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
