/**
 * Tests for the Persistence Layer
 * Following TDD London School (mock-first) approach
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import {
  PersistenceService,
  createPersistenceService,
  initPersistenceService,
} from "../src/persistence";

describe("PersistenceService", () => {
  let persistence: PersistenceService;

  beforeEach(async () => {
    // Use in-memory database for tests
    persistence = await initPersistenceService();
  });

  afterEach(() => {
    persistence.close();
  });

  describe("Database Connection", () => {
    it("should connect to database successfully", async () => {
      const health = await persistence.healthCheck();
      expect(health.ok).toBe(true);
    });

    it("should apply migrations on init", async () => {
      // If we got here without error, migrations ran
      const health = await persistence.healthCheck();
      expect(health.ok).toBe(true);
    });
  });

  describe("History Repository", () => {
    it("should add a history entry", async () => {
      await persistence.history.add({
        expression: "2 + 2",
        result: 4,
        error: null,
      });

      const recent = await persistence.history.getRecent(1);
      expect(recent).toHaveLength(1);
      expect(recent[0].expression).toBe("2 + 2");
      expect(recent[0].result).toBe(4);
      expect(recent[0].error).toBeNull();
    });

    it("should store timestamp automatically", async () => {
      const before = Date.now();
      await persistence.history.add({
        expression: "test",
        result: 42,
        error: null,
      });
      const after = Date.now();

      const recent = await persistence.history.getRecent(1);
      expect(recent[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(recent[0].timestamp).toBeLessThanOrEqual(after);
    });

    it("should get recent entries ordered by timestamp", async () => {
      await persistence.history.add({
        expression: "first",
        result: 1,
        error: null,
        timestamp: 1000,
      });
      await persistence.history.add({
        expression: "second",
        result: 2,
        error: null,
        timestamp: 2000,
      });
      await persistence.history.add({
        expression: "third",
        result: 3,
        error: null,
        timestamp: 3000,
      });

      const recent = await persistence.history.getRecent(2);
      expect(recent).toHaveLength(2);
      expect(recent[0].expression).toBe("third");
      expect(recent[1].expression).toBe("second");
    });

    it("should search entries by expression", async () => {
      await persistence.history.add({ expression: "add(2, 3)", result: 5, error: null });
      await persistence.history.add({ expression: "multiply(4, 5)", result: 20, error: null });
      await persistence.history.add({ expression: "add(10, 20)", result: 30, error: null });

      const results = await persistence.history.search("add");
      expect(results).toHaveLength(2);
      expect(results[0].expression).toContain("add");
      expect(results[1].expression).toContain("add");
    });

    it("should handle errors in history entries", async () => {
      await persistence.history.add({
        expression: "1 / 0",
        result: null,
        error: "Division by zero",
      });

      const recent = await persistence.history.getRecent(1);
      expect(recent[0].result).toBeNull();
      expect(recent[0].error).toBe("Division by zero");
    });

    it("should delete a history entry", async () => {
      await persistence.history.add({ expression: "delete me", result: 1, error: null });
      const entries = await persistence.history.getRecent(1);

      await persistence.history.delete(entries[0].id);

      const afterDelete = await persistence.history.getRecent(1);
      expect(afterDelete).toHaveLength(0);
    });

    it("should clear all history entries", async () => {
      await persistence.history.add({ expression: "a", result: 1, error: null });
      await persistence.history.add({ expression: "b", result: 2, error: null });

      await persistence.history.clear();

      const recent = await persistence.history.getRecent(10);
      expect(recent).toHaveLength(0);
    });
  });

  describe("Function Repository", () => {
    it("should save a user function", async () => {
      await persistence.functions.save({
        name: "square",
        params: ["x"],
        body: "x * x",
      });

      const func = await persistence.functions.findByName("square");
      expect(func).not.toBeNull();
      expect(func?.name).toBe("square");
      expect(func?.params).toEqual(["x"]);
      expect(func?.body).toBe("x * x");
    });

    it("should return null for non-existent function", async () => {
      const func = await persistence.functions.findByName("does-not-exist");
      expect(func).toBeNull();
    });

    it("should update existing function", async () => {
      await persistence.functions.save({
        name: "double",
        params: ["x"],
        body: "x * 2",
      });

      await persistence.functions.save({
        name: "double",
        params: ["n"],
        body: "n + n",
      });

      const func = await persistence.functions.findByName("double");
      expect(func?.params).toEqual(["n"]);
      expect(func?.body).toBe("n + n");
    });

    it("should get all functions", async () => {
      await persistence.functions.save({ name: "f1", params: [], body: "1" });
      await persistence.functions.save({ name: "f2", params: [], body: "2" });
      await persistence.functions.save({ name: "f3", params: [], body: "3" });

      const all = await persistence.functions.getAll();
      expect(all).toHaveLength(3);
      expect(all.map((f) => f.name).sort()).toEqual(["f1", "f2", "f3"]);
    });

    it("should delete a function", async () => {
      await persistence.functions.save({ name: "to-delete", params: [], body: "1" });

      await persistence.functions.delete("to-delete");

      const func = await persistence.functions.findByName("to-delete");
      expect(func).toBeNull();
    });

    it("should handle multiple parameters", async () => {
      await persistence.functions.save({
        name: "add",
        params: ["a", "b", "c"],
        body: "a + b + c",
      });

      const func = await persistence.functions.findByName("add");
      expect(func?.params).toEqual(["a", "b", "c"]);
    });
  });

  describe("Settings Repository", () => {
    it("should set and get a setting", async () => {
      await persistence.settings.set("precision", "10");

      const value = await persistence.settings.get("precision");
      expect(value).toBe("10");
    });

    it("should return null for non-existent setting", async () => {
      const value = await persistence.settings.get("non-existent");
      expect(value).toBeNull();
    });

    it("should update existing setting", async () => {
      await persistence.settings.set("theme", "dark");
      await persistence.settings.set("theme", "light");

      const value = await persistence.settings.get("theme");
      expect(value).toBe("light");
    });

    it("should delete a setting", async () => {
      await persistence.settings.set("temp", "value");
      await persistence.settings.delete("temp");

      const value = await persistence.settings.get("temp");
      expect(value).toBeNull();
    });

    it("should get all settings", async () => {
      await persistence.settings.set("key1", "value1");
      await persistence.settings.set("key2", "value2");

      const all = await persistence.settings.getAll();
      expect(all).toEqual({
        key1: "value1",
        key2: "value2",
      });
    });
  });

  describe("Factory Functions", () => {
    it("createPersistenceService should create with in-memory db", () => {
      const service = createPersistenceService();
      expect(service).toBeDefined();
      service.close();
    });

    it("createPersistenceService should use provided path", async () => {
      const tempPath = "/tmp/test-calculathor-" + Date.now() + ".db";
      const service = createPersistenceService(tempPath);
      await service.migrate();

      await service.settings.set("test", "value");
      const value = await service.settings.get("test");
      expect(value).toBe("value");

      service.close();

      // Clean up
      await Bun.file(tempPath).delete().catch(() => {});
    });
  });
});
