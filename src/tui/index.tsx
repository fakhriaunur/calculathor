#!/usr/bin/env bun
/**
 * TUI Client for Calculathor
 * Interactive terminal UI using Ink
 */

import React, { useState, useCallback, useEffect } from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';

interface Result {
  id: number;
  input: string;
  result: string;
  error?: string;
  timestamp: Date;
}

function App() {
  const { exit } = useApp();
  const [input, setInput] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [nextId, setNextId] = useState(1);

  // Evaluate expression locally (Tracer 2 - direct integration)
  const evaluate = useCallback(async (expr: string): Promise<string> => {
    try {
      // Dynamic import to avoid issues
      const { tokenize } = await import('../core/pure/tokenizer');
      const { PrattParser } = await import('../core/pure/pratt-parser');
      const { evaluate: evalAST } = await import('../core/pure/evaluator');
      const { RegistryService } = await import('../core/services/registry-service');

      const registry = RegistryService.createStandard();
      const parser = new PrattParser(registry);
      const tokens = tokenize(expr);
      const { ast } = parser.parse(tokens);
      const result = evalAST(ast, { registry });

      // Format result
      if (Number.isInteger(result)) {
        return result.toString();
      }
      return result.toPrecision(10).replace(/\.?0+$/, '');
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(error.message);
      }
      throw new Error('Unknown error');
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!input.trim()) return;

    const expr = input.trim();
    setHistory((prev) => [...prev, expr]);
    setHistoryIndex(-1);

    try {
      const result = await evaluate(expr);
      setResults((prev) => [
        ...prev,
        {
          id: nextId,
          input: expr,
          result,
          timestamp: new Date(),
        },
      ]);
    } catch (error) {
      setResults((prev) => [
        ...prev,
        {
          id: nextId,
          input: expr,
          result: '',
          error: error instanceof Error ? error.message : 'Error',
          timestamp: new Date(),
        },
      ]);
    }

    setNextId((id) => id + 1);
    setInput('');
  }, [input, nextId, evaluate]);

  // Handle keyboard input
  useInput((inputChar, key) => {
    if (key.upArrow) {
      if (history.length > 0) {
        const newIndex =
          historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setInput(history[newIndex]);
      }
      return;
    }

    if (key.downArrow) {
      if (historyIndex !== -1) {
        const newIndex = historyIndex + 1;
        if (newIndex >= history.length) {
          setHistoryIndex(-1);
          setInput('');
        } else {
          setHistoryIndex(newIndex);
          setInput(history[newIndex]);
        }
      }
      return;
    }

    if (key.escape || (key.ctrl && inputChar === 'c')) {
      exit();
    }
  });

  return (
    <Box flexDirection="column" height="100%">
      {/* Header */}
      <Box borderStyle="single" paddingX={1}>
        <Text bold color="cyan">
          Calculathor
        </Text>
        <Text> - Interactive Calculator</Text>
      </Box>

      {/* Results Area */}
      <Box flexDirection="column" flexGrow={1} overflow="hidden" paddingX={1}>
        {results.length === 0 ? (
          <Text dimColor>
            Enter an expression to calculate. Press Ctrl+C to exit.
          </Text>
        ) : (
          results.map((r) => (
            <Box key={r.id} flexDirection="column" marginY={1}>
              <Box>
                <Text color="blue">› </Text>
                <Text>{r.input}</Text>
              </Box>
              {r.error ? (
                <Box marginLeft={2}>
                  <Text color="red">{r.error}</Text>
                </Box>
              ) : (
                <Box marginLeft={2}>
                  <Text color="green" bold>
                    = {r.result}
                  </Text>
                </Box>
              )}
            </Box>
          ))
        )}
      </Box>

      {/* Input Area */}
      <Box borderStyle="single" borderTop borderColor="cyan" paddingX={1}>
        <Text color="blue">› </Text>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          placeholder="Enter expression..."
        />
      </Box>

      {/* Help */}
      <Box paddingX={1}>
        <Text dimColor>
          ↑↓ History • Enter Calculate • Ctrl+C Exit
        </Text>
      </Box>
    </Box>
  );
}

render(<App />);
