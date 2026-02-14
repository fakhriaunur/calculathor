import { describe, it, expect, beforeEach } from 'bun:test';
import {
  JSONRPCServer,
  JSONRPCErrorException,
  JSONRPC_ERRORS,
} from '../../../src/daemon/rpc-server';

describe('JSONRPCServer', () => {
  let server: JSONRPCServer;

  beforeEach(() => {
    server = new JSONRPCServer();
  });

  describe('method registration', () => {
    it('registers a method', async () => {
      server.registerMethod('test', () => 'result');
      const request = JSON.stringify({
        jsonrpc: '2.0',
        method: 'test',
        id: 1,
      });

      const response = await server.handleMessage(request);
      const parsed = JSON.parse(response!);
      expect(parsed.result).toBe('result');
    });

    it('unregisters a method', () => {
      server.registerMethod('test', () => 'result');
      expect(server.unregisterMethod('test')).toBe(true);
      expect(server.unregisterMethod('test')).toBe(false);
    });
  });

  describe('request handling', () => {
    beforeEach(() => {
      server.registerMethod('add', (params: any) => params.a + params.b);
      server.registerMethod('error', () => {
        throw new Error('Test error');
      });
    });

    it('handles valid request', async () => {
      const request = JSON.stringify({
        jsonrpc: '2.0',
        method: 'add',
        params: { a: 2, b: 3 },
        id: 1,
      });

      const response = await server.handleMessage(request);
      const parsed = JSON.parse(response!);
      expect(parsed.jsonrpc).toBe('2.0');
      expect(parsed.result).toBe(5);
      expect(parsed.id).toBe(1);
    });

    it('returns method not found error', async () => {
      const request = JSON.stringify({
        jsonrpc: '2.0',
        method: 'unknown',
        id: 1,
      });

      const response = await server.handleMessage(request);
      const parsed = JSON.parse(response!);
      expect(parsed.error.code).toBe(JSONRPC_ERRORS.METHOD_NOT_FOUND);
    });

    it('returns internal error on exception', async () => {
      const request = JSON.stringify({
        jsonrpc: '2.0',
        method: 'error',
        id: 1,
      });

      const response = await server.handleMessage(request);
      const parsed = JSON.parse(response!);
      expect(parsed.error.code).toBe(JSONRPC_ERRORS.INTERNAL_ERROR);
    });
  });

  describe('notification handling', () => {
    it('handles notification (no id)', async () => {
      let called = false;
      server.registerMethod('notify', () => {
        called = true;
        return null;
      });

      const request = JSON.stringify({
        jsonrpc: '2.0',
        method: 'notify',
      });

      const response = await server.handleMessage(request);
      expect(response).toBeNull();
      expect(called).toBe(true);
    });
  });

  describe('error handling', () => {
    it('handles parse error', async () => {
      const response = await server.handleMessage('invalid json');
      const parsed = JSON.parse(response!);
      expect(parsed.error.code).toBe(JSONRPC_ERRORS.PARSE_ERROR);
    });

    it('handles invalid request', async () => {
      const response = await server.handleMessage('{}');
      const parsed = JSON.parse(response!);
      expect(parsed.error.code).toBe(JSONRPC_ERRORS.INVALID_REQUEST);
    });

    it('handles custom JSONRPCError', async () => {
      server.registerMethod('custom', () => {
        throw new JSONRPCErrorException(-32000, 'Custom error', { detail: 'test' });
      });

      const request = JSON.stringify({
        jsonrpc: '2.0',
        method: 'custom',
        id: 1,
      });

      const response = await server.handleMessage(request);
      const parsed = JSON.parse(response!);
      expect(parsed.error.code).toBe(-32000);
      expect(parsed.error.message).toBe('Custom error');
      expect(parsed.error.data).toEqual({ detail: 'test' });
    });
  });

  describe('message creation', () => {
    it('creates request', () => {
      const request = JSONRPCServer.createRequest('test', { a: 1 }, 1);
      const parsed = JSON.parse(request);
      expect(parsed.jsonrpc).toBe('2.0');
      expect(parsed.method).toBe('test');
      expect(parsed.params).toEqual({ a: 1 });
      expect(parsed.id).toBe(1);
    });

    it('creates notification', () => {
      const request = JSONRPCServer.createNotification('test', { a: 1 });
      const parsed = JSON.parse(request);
      expect(parsed.jsonrpc).toBe('2.0');
      expect(parsed.method).toBe('test');
      expect(parsed.id).toBeUndefined();
    });
  });
});
