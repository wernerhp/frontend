import type { HassEntity } from "home-assistant-js-websocket";
import { mdiCctvOff, mdiLockOpen, mdiShieldAlert, mdiWater } from "@mdi/js";
import { compareDesc, parseISO } from "date-fns";
import { computeDomain } from "../../../common/entity/compute_domain";
import { UNAVAILABLE } from "../../../data/entity/entity";

export type SecurityAlertSeverity = "negative" | "warning" | "info";

export interface SecurityAlertItem {
  entityId: string;
  stateObj: HassEntity;
  severity: SecurityAlertSeverity;
  icon?: string;
  iconPath?: string;
}

type SecurityAlertIcon = Pick<SecurityAlertItem, "icon" | "iconPath">;

const SEVERITY_ORDER: Record<SecurityAlertSeverity, number> = {
  negative: 0,
  warning: 1,
  info: 2,
};

const NEGATIVE_BINARY_SENSOR_DEVICE_CLASSES = new Set([
  "carbon_monoxide",
  "gas",
  "moisture",
  "safety",
  "smoke",
]);

const WARNING_BINARY_SENSOR_DEVICE_CLASSES = new Set([
  "door",
  "garage_door",
  "lock",
  "opening",
  "tamper",
  "window",
]);

const WARNING_COVER_DEVICE_CLASSES = new Set([
  "door",
  "garage",
  "gate",
  "window",
]);

const computeSecurityAlertSeverity = (
  stateObj: HassEntity
): SecurityAlertSeverity | undefined => {
  if (stateObj.state === UNAVAILABLE) {
    return "info";
  }

  const domain = computeDomain(stateObj.entity_id);

  switch (domain) {
    case "alarm_control_panel":
      return stateObj.state === "triggered" ? "negative" : undefined;
    case "binary_sensor": {
      if (stateObj.state !== "on") {
        return undefined;
      }

      const deviceClass = stateObj.attributes.device_class;
      if (typeof deviceClass !== "string") {
        return undefined;
      }

      if (NEGATIVE_BINARY_SENSOR_DEVICE_CLASSES.has(deviceClass)) {
        return "negative";
      }
      if (WARNING_BINARY_SENSOR_DEVICE_CLASSES.has(deviceClass)) {
        return "warning";
      }
      return undefined;
    }
    case "cover": {
      const deviceClass = stateObj.attributes.device_class;
      return typeof deviceClass === "string" &&
        WARNING_COVER_DEVICE_CLASSES.has(deviceClass) &&
        stateObj.state !== "closed"
        ? "warning"
        : undefined;
    }
    case "lock":
      return ["jammed", "open", "unlocked"].includes(stateObj.state)
        ? "warning"
        : undefined;
    default:
      return undefined;
  }
};

const computeSecurityAlertIcon = (stateObj: HassEntity): SecurityAlertIcon => {
  const domain = computeDomain(stateObj.entity_id);
  if (stateObj.state === UNAVAILABLE && domain === "camera") {
    return { iconPath: mdiCctvOff };
  }
  if (
    domain === "binary_sensor" &&
    stateObj.attributes.device_class === "moisture"
  ) {
    return { iconPath: mdiWater };
  }
  if (domain === "lock") {
    return { iconPath: mdiLockOpen };
  }
  if (domain === "alarm_control_panel") {
    return { iconPath: mdiShieldAlert };
  }
  return typeof stateObj.attributes.icon === "string"
    ? { icon: stateObj.attributes.icon }
    : {};
};

export const computeSecurityAlertItems = (
  states: Record<string, HassEntity>,
  entityIds: string[]
): SecurityAlertItem[] =>
  entityIds
    .map((entityId) => states[entityId])
    .filter((stateObj): stateObj is HassEntity => Boolean(stateObj))
    .map((stateObj): SecurityAlertItem | undefined => {
      const severity = computeSecurityAlertSeverity(stateObj);
      if (!severity) {
        return undefined;
      }
      return {
        entityId: stateObj.entity_id,
        stateObj,
        severity,
        ...computeSecurityAlertIcon(stateObj),
      };
    })
    .filter((item): item is SecurityAlertItem => Boolean(item))
    .sort((a, b) => {
      const severityDiff =
        SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
      if (severityDiff) {
        return severityDiff;
      }
      return compareDesc(
        parseISO(a.stateObj.last_changed),
        parseISO(b.stateObj.last_changed)
      );
    });
