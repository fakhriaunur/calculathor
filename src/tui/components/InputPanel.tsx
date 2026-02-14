import React, { useState } from 'react';
import type { JSX } from 'react';
import { Box, Text, useInput } from 'ink';
import { tokenize, TokenType } from '../../parser';

interface InputPanelProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  error: string | null;
}

const TOKEN_COLORS: Record<TokenType, string> = {
  NUMBER: 'yellow',
  IDENTIFIER: 'cyan',
  OPERATOR: 'magenta',
  LPAREN: 'gray',
  RPAREN: 'gray',
  COMMA: 'gray',
  EOF: 'gray',
};

export function InputPanel({ value, onChange, onSubmit, error }: InputPanelProps): JSX.Element {
  const [cursorPosition, setCursorPosition] = useState(0);

  useInput((input, key) => {
    if (key.return) {
      onSubmit();
      setCursorPosition(0);
    } else if (key.backspace || key.delete) {
      if (cursorPosition > 0) {
        const newValue = value.slice(0, cursorPosition - 1) + value.slice(cursorPosition);
        onChange(newValue);
        setCursorPosition(Math.max(0, cursorPosition - 1));
      }
    } else if (key.leftArrow) {
      setCursorPosition(Math.max(0, cursorPosition - 1));
    } else if (key.rightArrow) {
      setCursorPosition(Math.min(value.length, cursorPosition + 1));
    } else if (input && !key.ctrl && !key.meta) {
      const newValue = value.slice(0, cursorPosition) + input + value.slice(cursorPosition);
      onChange(newValue);
      setCursorPosition(cursorPosition + input.length);
    }
  });

  const tokens = value ? tokenize(value) : [];

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={error ? 'red' : 'blue'} paddingX={1}>
      <Box>
        <Text bold color="green">
          {'>'}{' '}
        </Text>
        {value ? (
          <Text>
            {tokens
              .filter(t => t.type !== 'EOF')
              .map((token, i) => (
                <Text key={i} color={TOKEN_COLORS[token.type]}>
                  {token.value}
                </Text>
              ))}
          </Text>
        ) : (
          <Text color="gray" dimColor>_</Text>
        )}
      </Box>
      {error && (
        <Box marginTop={1}>
          <Text color="red">{error}</Text>
        </Box>
      )}
    </Box>
  );
}
