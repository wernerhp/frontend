import { createContext } from "@lit/context";
import type { SecurityAlertItem } from "../../../security/strategies/security-alerts";

export const securityAlertsContext =
  createContext<SecurityAlertItem[]>("security-alerts");
