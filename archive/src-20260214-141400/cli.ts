#!/usr/bin/env bun
/**
 * Calculathor CLI - Entry point for the calculator
 *
 * Usage:
 *   bun run cli "2 + 3"          # Expression from args
 *   echo "2 + 3" | bun run cli   # Expression from stdin
 *   bun run cli                  # Interactive mode
 */

import { tokenize } from './parser/tokenizer';
import { parse } from './parser/pratt';
import { evaluate, createDefaultContext } from './evaluator';

const VERSION = '0.1.0';

function printUsage(): void {
  console.log('Calculathor - A mathematical expression evaluator');
  console.log('');
  console.log('Usage:');
  console.log('  bun run cli [expression]     Evaluate expression');
  console.log('  echo "expr" | bun run cli    Read from stdin');
  console.log('  bun run cli                  Interactive mode');
  console.log('');
  console.log('Options:');
  console.log('  -h, --help    Show this help');
  console.log('  -v, --version Show version');
}

function calculate(expression: string): number {
  const tokens = tokenize(expression);
  const ast = parse(tokens);
  const context = createDefaultContext();
  return evaluate(ast, context);
}

function handleError(error: unknown): void {
  if (error instanceof Error) {
    console.error(`Error: ${error.message}`);
  } else {
    console.error('Error: An unknown error occurred');
  }
}

async function readStdin(): Promise<string> {
  const chunks: string[] = [];
  for await (const chunk of Bun.stdin.stream()) {
    chunks.push(new TextDecoder().decode(chunk));
  }
  return chunks.join('').trim();
}

function runInteractive(): void {
  console.log('Calculathor v' + VERSION);
  console.log('Type an expression or "quit" to exit\n');

  while (true) {
    const input = prompt('> ');

    if (input === null || input.toLowerCase() === 'quit' || input.toLowerCase() === 'exit') {
      break;
    }

    const trimmed = input.trim();
    if (!trimmed) continue;

    try {
      const result = calculate(trimmed);
      console.log(result);
    } catch (error) {
      handleError(error);
    }
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Handle flags
  if (args.includes('-h') || args.includes('--help')) {
    printUsage();
    process.exit(0);
  }

  if (args.includes('-v') || args.includes('--version')) {
    console.log(VERSION);
    process.exit(0);
  }

  // Expression from command line args
  if (args.length > 0) {
    const expression = args.join(' ');
    try {
      const result = calculate(expression);
      console.log(result);
      process.exit(0);
    } catch (error) {
      handleError(error);
      process.exit(1);
    }
  }

  // Check if stdin has data (piped input)
  const isStdinPiped = !process.stdin.isTTY;

  if (isStdinPiped) {
    try {
      const expression = await readStdin();
      if (!expression) {
        console.error('Error: No input provided');
        process.exit(1);
      }
      const result = calculate(expression);
      console.log(result);
      process.exit(0);
    } catch (error) {
      handleError(error);
      process.exit(1);
    }
  }

  // Interactive mode
  runInteractive();
  process.exit(0);
}

main().catch((error) => {
  handleError(error);
  process.exit(1);
});
