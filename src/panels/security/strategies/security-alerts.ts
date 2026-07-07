import type { HassEntity } from "home-assistant-js-websocket";
import { mdiCctvOff, mdiLockOpen, mdiShieldAlert, mdiWater } from "@mdi/js";
import { computeDomain } from "../../../common/entity/compute_domain";
import { UNAVAILABLE } from "../../../data/entity/entity";
import type { SecurityAlertEntityConfig } from "../../../data/frontend";
import type { HomeAssistant } from "../../../types";
import type { Condition } from "../../lovelace/common/validate-condition";
import {
  checkConditionsMet,
  extractConditionEntityIds,
} from "../../lovelace/common/validate-condition";

export type SecurityAlertSeverity = "danger" | "warning" | "info";

export interface SecurityAlertItem {
  entityId: string;
  stateObj: HassEntity;
  severity: SecurityAlertSeverity;
  color?: string;
  pulse: boolean;
  icon?: string;
  iconPath?: string;
}

type SecurityAlertIcon = Pick<SecurityAlertItem, "icon" | "iconPath">;

export type SecurityAlertHass = Pick<
  HomeAssistant,
  "config" | "locale" | "states" | "user"
>;

const DANGER_BINARY_SENSOR_DEVICE_CLASSES = [
  "carbon_monoxide",
  "gas",
  "moisture",
  "safety",
  "smoke",
] as const;

const WARNING_BINARY_SENSOR_DEVICE_CLASSES = [
  "door",
  "garage_door",
  "lock",
  "opening",
  "tamper",
  "window",
] as const;

const WARNING_COVER_DEVICE_CLASSES = [
  "door",
  "garage",
  "gate",
  "window",
] as const;

type DangerBinarySensorDeviceClass =
  (typeof DANGER_BINARY_SENSOR_DEVICE_CLASSES)[number];
type WarningBinarySensorDeviceClass =
  (typeof WARNING_BINARY_SENSOR_DEVICE_CLASSES)[number];
type WarningCoverDeviceClass = (typeof WARNING_COVER_DEVICE_CLASSES)[number];

const DANGER_BINARY_SENSOR_DEVICE_CLASS_SET =
  new Set<DangerBinarySensorDeviceClass>(DANGER_BINARY_SENSOR_DEVICE_CLASSES);
const WARNING_BINARY_SENSOR_DEVICE_CLASS_SET =
  new Set<WarningBinarySensorDeviceClass>(WARNING_BINARY_SENSOR_DEVICE_CLASSES);
const WARNING_COVER_DEVICE_CLASS_SET = new Set<WarningCoverDeviceClass>(
  WARNING_COVER_DEVICE_CLASSES
);

const isDangerBinarySensorDeviceClass = (
  deviceClass: string
): deviceClass is DangerBinarySensorDeviceClass =>
  DANGER_BINARY_SENSOR_DEVICE_CLASS_SET.has(
    deviceClass as DangerBinarySensorDeviceClass
  );

const isWarningBinarySensorDeviceClass = (
  deviceClass: string
): deviceClass is WarningBinarySensorDeviceClass =>
  WARNING_BINARY_SENSOR_DEVICE_CLASS_SET.has(
    deviceClass as WarningBinarySensorDeviceClass
  );

const isWarningCoverDeviceClass = (
  deviceClass: string
): deviceClass is WarningCoverDeviceClass =>
  WARNING_COVER_DEVICE_CLASS_SET.has(deviceClass as WarningCoverDeviceClass);

export const isSecurityAlertEntity = (stateObj: HassEntity): boolean => {
  const domain = computeDomain(stateObj.entity_id);

  switch (domain) {
    case "alarm_control_panel":
    case "camera":
    case "lock":
      return true;
    case "binary_sensor": {
      const deviceClass = stateObj.attributes.device_class;
      return (
        typeof deviceClass === "string" &&
        (isDangerBinarySensorDeviceClass(deviceClass) ||
          isWarningBinarySensorDeviceClass(deviceClass))
      );
    }
    case "cover": {
      const deviceClass = stateObj.attributes.device_class;
      return (
        typeof deviceClass === "string" &&
        isWarningCoverDeviceClass(deviceClass)
      );
    }
    default:
      return false;
  }
};

const computeSecurityAlertSeverity = (
  stateObj: HassEntity
): SecurityAlertSeverity | undefined => {
  if (stateObj.state === UNAVAILABLE) {
    return "info";
  }

  const domain = computeDomain(stateObj.entity_id);

  switch (domain) {
    case "alarm_control_panel":
      return stateObj.state === "triggered" ? "danger" : undefined;
    case "binary_sensor": {
      if (stateObj.state !== "on") {
        return undefined;
      }

      const deviceClass = stateObj.attributes.device_class;
      if (typeof deviceClass !== "string") {
        return undefined;
      }

      if (isDangerBinarySensorDeviceClass(deviceClass)) {
        return "danger";
      }
      if (isWarningBinarySensorDeviceClass(deviceClass)) {
        return "warning";
      }
      return undefined;
    }
    case "cover": {
      const deviceClass = stateObj.attributes.device_class;
      return typeof deviceClass === "string" &&
        isWarningCoverDeviceClass(deviceClass) &&
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

export const computeDefaultSecurityAlertColor = (
  stateObj?: HassEntity
): string => {
  if (!stateObj) {
    return "red";
  }
  switch (computeSecurityAlertSeverity(stateObj)) {
    case "warning":
      return "amber";
    case "info":
      return "blue";
    default:
      return "red";
  }
};

export const computeSecurityAlertEntityDefaultColor = (
  stateObj?: HassEntity
): string => {
  if (!stateObj) {
    return "red";
  }

  const domain = computeDomain(stateObj.entity_id);
  if (domain === "camera") {
    return "blue";
  }
  if (domain === "binary_sensor") {
    const deviceClass = stateObj.attributes.device_class;
    return typeof deviceClass === "string" &&
      isWarningBinarySensorDeviceClass(deviceClass)
      ? "amber"
      : "red";
  }
  if (domain === "cover" || domain === "lock") {
    return "amber";
  }
  return "red";
};

export const computeDefaultSecurityAlertVisibility = (
  entityId: string
): Condition[] => [
  {
    condition: "state",
    entity: entityId,
    state:
      computeDomain(entityId) === "alarm_control_panel" ? "triggered" : "on",
  },
];

export const extractSecurityAlertEntityIds = (
  alertEntities: SecurityAlertEntityConfig[]
): string[] => [
  ...new Set(
    alertEntities.flatMap((alertEntity) => [
      alertEntity.entity,
      ...extractConditionEntityIds(
        alertEntity.visibility ??
          computeDefaultSecurityAlertVisibility(alertEntity.entity)
      ),
    ])
  ),
];

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

export const computeSecurityAlertItem = (
  stateObj: HassEntity,
  alertEntity: SecurityAlertEntityConfig
): SecurityAlertItem => ({
  entityId: stateObj.entity_id,
  stateObj,
  severity: computeSecurityAlertSeverity(stateObj) ?? "danger",
  color: alertEntity.color ?? computeSecurityAlertEntityDefaultColor(stateObj),
  pulse: alertEntity.pulse === undefined || alertEntity.pulse === true,
  ...computeSecurityAlertIcon(stateObj),
});

export const computeSecurityAlertItems = (
  hass: SecurityAlertHass,
  alertEntities: SecurityAlertEntityConfig[]
): SecurityAlertItem[] =>
  alertEntities
    .map((alertEntity): SecurityAlertItem | undefined => {
      const stateObj = hass.states[alertEntity.entity];
      if (!stateObj) {
        return undefined;
      }

      const visibility =
        alertEntity.visibility ??
        computeDefaultSecurityAlertVisibility(alertEntity.entity);

      if (
        !checkConditionsMet(visibility, hass as HomeAssistant, {
          entity_id: alertEntity.entity,
        })
      ) {
        return undefined;
      }

      return computeSecurityAlertItem(stateObj, alertEntity);
    })
    .filter((item): item is SecurityAlertItem => Boolean(item));
