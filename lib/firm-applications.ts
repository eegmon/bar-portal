export type FirmApplicationDecision = "APPROVE_FIRM" | "REJECT_FIRM";

export async function submitFirmApplicationDecision(
  action: FirmApplicationDecision,
  firmId: string,
): Promise<void> {
  const response = await fetch("/api/firms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, firmId }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error);
}
