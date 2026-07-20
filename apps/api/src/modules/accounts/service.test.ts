import { describe, expect, it } from "vitest";
import type { AccountRow, AccountsRepository } from "./repository";
import { createAccountsService } from "./service";

/**
 * A fake AccountsRepository implementing the port directly, in memory — no
 * real db. The repository's own persistence/concurrency guarantees are
 * covered by repository.test.ts against a real db; this file only tests
 * the service's orchestration logic (try create, fall back to a re-read on
 * conflict, throw on the "should never happen" gap).
 */
function fakeRepository(seed: Record<string, AccountRow> = {}): AccountsRepository {
  const state = new Map<string, AccountRow>(Object.entries(seed));
  let nextId = 0;

  return {
    async findByClerkUserId(clerkUserId) {
      return state.get(clerkUserId);
    },
    async createWithDefaultProject(clerkUserId) {
      if (state.has(clerkUserId)) {
        return undefined;
      }
      const row: AccountRow = { id: `account_${(nextId += 1)}` };
      state.set(clerkUserId, row);
      return row;
    },
  };
}

describe("ensureAccount", () => {
  it("creates a new account and reports created: true", async () => {
    const service = createAccountsService(fakeRepository());

    const result = await service.ensureAccount("user_123");

    expect(result.created).toBe(true);
    expect(result.accountId).toBeTruthy();
  });

  it("returns the existing account and reports created: false on a second call", async () => {
    const service = createAccountsService(fakeRepository());

    const first = await service.ensureAccount("user_123");
    const second = await service.ensureAccount("user_123");

    expect(second.created).toBe(false);
    expect(second.accountId).toBe(first.accountId);
  });

  it("throws if the repository reports a conflict but the re-read finds nothing", async () => {
    const repository: AccountsRepository = {
      async findByClerkUserId() {
        return undefined;
      },
      async createWithDefaultProject() {
        return undefined;
      },
    };
    const service = createAccountsService(repository);

    await expect(service.ensureAccount("user_123")).rejects.toThrow(
      /row not found after conflict/,
    );
  });
});
