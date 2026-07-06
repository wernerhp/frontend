import type { HassEntity } from "home-assistant-js-websocket";
import { describe, expect, it } from "vitest";
import { computeSecurityAlertItems } from "../../../../src/panels/security/strategies/security-alerts";

const state = (
  entityId: string,
  value: string,
  deviceClass: string | undefined,
  lastChanged: string
): HassEntity => ({
  entity_id: entityId,
  state: value,
  attributes: {
    ...(deviceClass ? { device_class: deviceClass } : {}),
    friendly_name: entityId,
  },
  last_changed: lastChanged,
  last_updated: lastChanged,
  context: { id: "", parent_id: null, user_id: null },
});

describe("computeSecurityAlertItems", () => {
  it("classifies safety sensors as negative alerts", () => {
    const states = {
      "binary_sensor.dishwasher_leak": state(
        "binary_sensor.dishwasher_leak",
        "on",
        "moisture",
        "2026-01-01T00:00:00Z"
      ),
    };

    expect(
      computeSecurityAlertItems(states, Object.keys(states))[0]?.severity
    ).toBe("negative");
  });

  it("classifies open security entities as warning alerts", () => {
    const states = {
      "lock.front_door": state(
        "lock.front_door",
        "unlocked",
        undefined,
        "2026-01-01T00:00:00Z"
      ),
      "binary_sensor.window": state(
        "binary_sensor.window",
        "on",
        "window",
        "2026-01-01T00:01:00Z"
      ),
    };

    expect(
      computeSecurityAlertItems(states, Object.keys(states)).map(
        (item) => item.severity
      )
    ).toEqual(["warning", "warning"]);
  });

  it("classifies unavailable entities as info alerts", () => {
    const states = {
      "camera.patio": state(
        "camera.patio",
        "unavailable",
        undefined,
        "2026-01-01T00:00:00Z"
      ),
    };

    expect(
      computeSecurityAlertItems(states, Object.keys(states))[0]?.severity
    ).toBe("info");
  });

  it("sorts by severity before recency", () => {
    const states = {
      "camera.patio": state(
        "camera.patio",
        "unavailable",
        undefined,
        "2026-01-01T00:03:00Z"
      ),
      "binary_sensor.window": state(
        "binary_sensor.window",
        "on",
        "window",
        "2026-01-01T00:02:00Z"
      ),
      "binary_sensor.leak": state(
        "binary_sensor.leak",
        "on",
        "moisture",
        "2026-01-01T00:01:00Z"
      ),
    };

    expect(
      computeSecurityAlertItems(states, Object.keys(states)).map(
        (item) => item.entityId
      )
    ).toEqual(["binary_sensor.leak", "binary_sensor.window", "camera.patio"]);
  });

  it("ignores inactive security entities", () => {
    const states = {
      "lock.front_door": state(
        "lock.front_door",
        "locked",
        undefined,
        "2026-01-01T00:00:00Z"
      ),
      "binary_sensor.leak": state(
        "binary_sensor.leak",
        "off",
        "moisture",
        "2026-01-01T00:00:00Z"
      ),
    };

    expect(computeSecurityAlertItems(states, Object.keys(states))).toEqual([]);
  });
});
