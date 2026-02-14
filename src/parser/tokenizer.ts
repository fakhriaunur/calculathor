/**
 * Tokenizer for Calculathor expression parser
 * Converts raw expression strings into an array of tokens.
 */

export type TokenType =
  | 'NUMBER'
  | 'IDENTIFIER'
  | 'OPERATOR'
  | 'LPAREN'
  | 'RPAREN'
  | 'COMMA'
  | 'EOF';

export interface Token {
  type: TokenType;
  value: string;
  position: number;
  line: number;
  column: number;
}

export class Tokenizer {
  private input: string;
  private position = 0;
  private line = 1;
  private column = 1;

  constructor(input: string) {
    this.input = input;
  }

  tokenize(): Token[] {
    const tokens: Token[] = [];

    while (!this.isAtEnd()) {
      this.skipWhitespace();
      if (this.isAtEnd()) break;

      const token = this.nextToken();
      if (token) tokens.push(token);
    }

    tokens.push(this.createToken('EOF', '', this.position));
    return tokens;
  }

  private nextToken(): Token | null {
    const start = this.position;
    const char = this.peek();
    const startColumn = this.column;

    if (this.isDigit(char) || (char === '.' && this.isDigit(this.peekNext()))) {
      return this.readNumber();
    }

    if (this.isAlpha(char) || char === '_') {
      return this.readIdentifier();
    }

    const twoChar = char + this.peekNext();
    if (['==', '!=', '<=', '>='].includes(twoChar)) {
      this.advance();
      this.advance();
      return this.createToken('OPERATOR', twoChar, start, startColumn);
    }

    switch (char) {
      case '+':
      case '-':
      case '*':
      case '/':
      case '^':
      case '%':
      case '<':
      case '>':
        this.advance();
        return this.createToken('OPERATOR', char, start, startColumn);
      case '(':
        this.advance();
        return this.createToken('LPAREN', char, start, startColumn);
      case ')':
        this.advance();
        return this.createToken('RPAREN', char, start, startColumn);
      case ',':
        this.advance();
        return this.createToken('COMMA', char, start, startColumn);
      default:
        throw this.error(`Unexpected character: '${char}'`, startColumn);
    }
  }

  private readNumber(): Token {
    const start = this.position;
    const startColumn = this.column;
    let value = '';

    if (this.peek() === '.') {
      value += '0.';
      this.advance();
      while (this.isDigit(this.peek())) {
        value += this.advance();
      }
    } else {
      while (this.isDigit(this.peek())) {
        value += this.advance();
      }

      if (this.peek() === '.') {
        value += this.advance();
        while (this.isDigit(this.peek())) {
          value += this.advance();
        }
        if (value.endsWith('.')) {
          value = value.slice(0, -1);
        }
      }
    }

    if (this.peek() === 'e' || this.peek() === 'E') {
      const ePos = this.position;
      const eColumn = this.column;
      let expPart = this.advance();

      if (this.peek() === '+' || this.peek() === '-') {
        expPart += this.advance();
      }

      if (!this.isDigit(this.peek())) {
        this.position = ePos;
        this.column = eColumn;
      } else {
        while (this.isDigit(this.peek())) {
          expPart += this.advance();
        }
        value += expPart;
      }
    }

    return this.createToken('NUMBER', value, start, startColumn);
  }

  private readIdentifier(): Token {
    const start = this.position;
    const startColumn = this.column;
    let value = '';

    while (this.isAlphaNumeric(this.peek()) || this.peek() === '_') {
      value += this.advance();
    }

    return this.createToken('IDENTIFIER', value, start, startColumn);
  }

  private skipWhitespace(): void {
    while (this.peek() === ' ' || this.peek() === '\t' ||
           this.peek() === '\n' || this.peek() === '\r') {
      if (this.peek() === '\n') {
        this.line++;
        this.column = 0;
      }
      this.advance();
    }
  }

  private peek(): string {
    if (this.isAtEnd()) return '\0';
    return this.input[this.position];
  }

  private peekNext(): string {
    if (this.position + 1 >= this.input.length) return '\0';
    return this.input[this.position + 1];
  }

  private advance(): string {
    if (this.isAtEnd()) return '\0';
    this.column++;
    return this.input[this.position++];
  }

  private isAtEnd(): boolean {
    return this.position >= this.input.length;
  }

  private isDigit(char: string): boolean {
    return char >= '0' && char <= '9';
  }

  private isAlpha(char: string): boolean {
    return (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z');
  }

  private isAlphaNumeric(char: string): boolean {
    return this.isAlpha(char) || this.isDigit(char);
  }

  private createToken(
    type: TokenType,
    value: string,
    position: number,
    column?: number
  ): Token {
    return {
      type,
      value,
      position,
      line: this.line,
      column: column ?? this.column - value.length
    };
  }

  private error(message: string, errorColumn?: number): SyntaxError {
    const col = errorColumn ?? this.column;
    return new SyntaxError(
      `${message} at line ${this.line}, column ${col}`
    );
  }
}

export function tokenize(input: string): Token[] {
  return new Tokenizer(input).tokenize();
}
