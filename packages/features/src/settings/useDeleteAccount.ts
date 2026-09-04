import React from "react";
import type { SendtallyApi } from "@sendtally/api-client";
import { deleteConfirmationMatches } from "./transforms";
import type { DeleteAccountStatus } from "./types";

export type DeleteAccountFeature = {
  status: DeleteAccountStatus;
  error: string | null;
  confirmation: string;
  setConfirmation: (value: string) => void;
  canConfirm: boolean;
  open: () => void;
  cancel: () => void;
  confirm: () => void;
};

export function useDeleteAccount(api: SendtallyApi, onDeleted: () => void): DeleteAccountFeature {
  const [status, setStatus] = React.useState<DeleteAccountStatus>("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [confirmation, setConfirmation] = React.useState("");

  const open = React.useCallback(() => {
    setStatus("confirming");
    setError(null);
    setConfirmation("");
  }, []);

  const cancel = React.useCallback(() => {
    setStatus("idle");
    setError(null);
    setConfirmation("");
  }, []);

  const confirm = React.useCallback(() => {
    if (!deleteConfirmationMatches(confirmation)) return;
    setStatus("deleting");
    setError(null);
    api
      .deleteAccount()
      .then(() => {
        setStatus("deleted");
        onDeleted();
      })
      .catch((err: unknown) => {
        setStatus("confirming");
        setError(err instanceof Error ? err.message : "Something went wrong.");
      });
  }, [api, confirmation, onDeleted]);

  return {
    status,
    error,
    confirmation,
    setConfirmation,
    canConfirm: deleteConfirmationMatches(confirmation),
    open,
    cancel,
    confirm,
  };
}
