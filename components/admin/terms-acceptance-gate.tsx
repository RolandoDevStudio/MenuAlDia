"use client";

import { useState, type ReactNode } from "react";
import { CURRENT_TERMS_VERSION } from "@/lib/constants/legal";
import { TermsAcceptanceModal } from "@/components/admin/terms-acceptance-modal";

type Props = {
  restaurantId: string;
  termsVersionAccepted: string | null | undefined;
  children: ReactNode;
};

export function TermsAcceptanceGate({
  restaurantId,
  termsVersionAccepted,
  children,
}: Props) {
  const [acceptedVersion, setAcceptedVersion] = useState(
    termsVersionAccepted ?? null,
  );

  const needsAcceptance = acceptedVersion !== CURRENT_TERMS_VERSION;

  return (
    <>
      {children}
      <TermsAcceptanceModal
        restaurantId={restaurantId}
        open={needsAcceptance}
        onAccepted={() => setAcceptedVersion(CURRENT_TERMS_VERSION)}
      />
    </>
  );
}
