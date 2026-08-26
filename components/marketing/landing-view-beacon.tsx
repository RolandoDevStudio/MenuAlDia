"use client";

import { useEffect } from "react";
import { trackLandingView } from "@/lib/landing-events";

export function LandingViewBeacon() {
  useEffect(() => {
    trackLandingView();
  }, []);
  return null;
}
