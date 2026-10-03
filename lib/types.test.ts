import { describe, expect, it } from "vitest";
import {
  canManageAssembly,
  canManageDiscipline,
  canManageExam,
  canManageSettings,
  canManageUsers,
  hasAdminPanelAccess,
} from "./types";

describe("management permissions", () => {
  it("denies management access to inactive accounts", () => {
    const user = {
      id: "user-1",
      loginId: "user-1",
      name: "Test User",
      role: "ADMIN" as const,
      status: "SUSPENDED" as const,
      isTrainee: 0,
      positions: ["PRESIDENT", "SECRETARY_GENERAL"],
    };

    expect(hasAdminPanelAccess(user)).toBe(false);
    expect(canManageSettings(user)).toBe(false);
    expect(canManageUsers(user)).toBe(false);
    expect(canManageAssembly(user)).toBe(false);
    expect(canManageExam(user)).toBe(false);
    expect(canManageDiscipline(user)).toBe(false);
  });
});
