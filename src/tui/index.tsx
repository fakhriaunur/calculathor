#!/usr/bin/env bun
import React, { useState, useCallback } from 'react';
import type { JSX } from 'react';
import { render, Box, Text, useApp, useStdout } from 'ink';
import { InputPanel, ResultsPanel, HistorySidebar } from './components';
import { tokenize, parse, ParseError } from '../parser';
import { evaluate, createDefaultContext } from '../evaluator';

interface HistoryItem {
  expression: string;
  result: number | string;
}

interface TUIState {
  input: string;
  history: HistoryItem[];
  error: string | null;
}

function App(): JSX.Element {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [state, setState] = useState<TUIState>({
    input: '',
    history: [],
    error: null,
  });

  const handleInputChange = useCallback((value: string) => {
    setState(prev => ({
      ...prev,
      input: value,
      error: null,
    }));
  }, []);

  const handleSubmit = useCallback(() => {
    const expression = state.input.trim();
    if (!expression) return;

    try {
      const tokens = tokenize(expression);
      const ast = parse(tokens);
      const context = createDefaultContext();
      const result = evaluate(ast, context);

      setState(prev => ({
        input: '',
        history: [{ expression, result }, ...prev.history].slice(0, 100),
        error: null,
      }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setState(prev => ({
        ...prev,
        error: errorMessage,
      }));
    }
  }, [state.input]);

  const handleHistorySelect = useCallback((item: HistoryItem) => {
    setState(prev => ({
      ...prev,
      input: item.expression,
    }));
  }, []);

  const handleExit = useCallback(() => {
    exit();
  }, [exit]);

  return (
    <Box flexDirection="column" height={stdout.rows}>
      {/* Header */}
      <Box marginBottom={1} paddingX={1}>
        <Text bold color="cyan">
          {' '}
          {' '}
          {' '}
          {' '}
        </Text>
        <Text bold underline>
          Calculathor
        </Text>
        <Text dimColor color="gray">
          {' '}
          - Press Ctrl+C to exit
        </Text>
      </Box>

      {/* Main content area */}
      <Box flexGrow={1}>
        {/* History sidebar */}
        <HistorySidebar
          items={state.history}
          onSelect={handleHistorySelect}
        />

        {/* Main panel */}
        <Box flexDirection="column" flexGrow={1} marginLeft={1}>
          {/* Results */}
          <Box flexGrow={1} borderStyle="single" borderColor="gray" flexDirection="column">
            <Box marginBottom={1} paddingX={1}>
              <Text bold underline>
                Results
              </Text>
            </Box>
            <ResultsPanel results={state.history} />
          </Box>

          {/* Input */}
          <Box marginTop={1}>
            <InputPanel
              value={state.input}
              onChange={handleInputChange}
              onSubmit={handleSubmit}
              error={state.error}
            />
          </Box>
        </Box>
      </Box>

      {/* Footer with help */}
      <Box marginTop={1} paddingX={1}>
        <Text dimColor color="gray">
          Enter: Evaluate | Ctrl+C: Exit | ↑/↓ in sidebar: Navigate history
        </Text>
      </Box>
    </Box>
  );
}

// Render the app
render(<App />);
