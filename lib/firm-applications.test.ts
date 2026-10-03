import { afterEach, describe, expect, it, vi } from "vitest";
import { submitFirmApplicationDecision } from "./firm-applications";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("submitFirmApplicationDecision", () => {
  it("sends the firm decision through the shared API contract", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await submitFirmApplicationDecision("APPROVE_FIRM", "firm-123");

    expect(fetchMock).toHaveBeenCalledWith("/api/firms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "APPROVE_FIRM", firmId: "firm-123" }),
    });
  });

  it("surfaces server errors for the screen to display", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "승인 실패" }),
      }),
    );

    await expect(
      submitFirmApplicationDecision("REJECT_FIRM", "firm-123"),
    ).rejects.toThrow("승인 실패");
  });
});
