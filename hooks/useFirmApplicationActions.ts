import { useState } from "react";
import { submitFirmApplicationDecision } from "@/lib/firm-applications";

interface UseFirmApplicationActionsOptions {
  pendingFirms: any[];
  onApproved: (firm: any) => void;
  onRejected: (firmId: string) => void;
  approveMessage: string;
  rejectMessage: string;
}

export function useFirmApplicationActions({
  pendingFirms,
  onApproved,
  onRejected,
  approveMessage,
  rejectMessage,
}: UseFirmApplicationActionsOptions) {
  const [isProcessingFirm, setIsProcessingFirm] = useState(false);

  const handleApproveFirm = async (firmId: string) => {
    if (!confirm("이 법인 등록 신청을 승인하시겠습니까?")) return;
    setIsProcessingFirm(true);
    try {
      await submitFirmApplicationDecision("APPROVE_FIRM", firmId);
      alert(approveMessage);
      const approved = pendingFirms.find((firm) => firm.id === firmId);
      if (approved) onApproved(approved);
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    } finally {
      setIsProcessingFirm(false);
    }
  };

  const handleRejectFirm = async (firmId: string) => {
    if (!confirm("이 법인 등록 신청을 반려하시겠습니까?")) return;
    setIsProcessingFirm(true);
    try {
      await submitFirmApplicationDecision("REJECT_FIRM", firmId);
      alert(rejectMessage);
      onRejected(firmId);
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    } finally {
      setIsProcessingFirm(false);
    }
  };

  return { isProcessingFirm, handleApproveFirm, handleRejectFirm };
}
