import { ContextProvider, consume, type ContextType } from "@lit/context";
import type { HassEntity } from "home-assistant-js-websocket";
import type { PropertyValues } from "lit";
import { css, html, LitElement, nothing } from "lit";
import { customElement, state } from "lit/decorators";
import { consumeEntityStates } from "../../../../common/decorators/consume-context-entry";
import { fireEvent } from "../../../../common/dom/fire_event";
import {
  configContext,
  internationalizationContext,
} from "../../../../data/context";
import {
  computeSecurityAlertItems,
  extractSecurityAlertEntityIds,
  type SecurityAlertItem,
} from "../../../security/strategies/security-alerts";
import type { LovelaceCard, LovelaceGridOptions } from "../../types";
import type { SecurityAlertsCardConfig } from "../types";
import { securityAlertsContext } from "./context";
import "./hui-security-alerts-heading";
import "./hui-security-alerts-list";

@customElement("hui-security-alerts-card")
export class HuiSecurityAlertsCard extends LitElement implements LovelaceCard {
  public connectedWhileHidden = true;

  private _alertsProvider = new ContextProvider<{
    __context__: SecurityAlertItem[];
  }>(this, {
    context: securityAlertsContext,
    initialValue: [],
  });

  @state() private _config?: SecurityAlertsCardConfig;

  @state() private _alertEntityIds?: string[];

  @state()
  @consumeEntityStates({ entityIdPath: ["_alertEntityIds"] })
  private _states?: Record<string, HassEntity>;

  @state()
  @consume({ context: configContext, subscribe: true })
  private _hassConfig!: ContextType<typeof configContext>;

  @state()
  @consume({ context: internationalizationContext, subscribe: true })
  private _i18n!: ContextType<typeof internationalizationContext>;

  public setConfig(config: SecurityAlertsCardConfig): void {
    if (!config.alert_entities) {
      throw new Error("Specify alert entities");
    }
    this._config = config;
    this._alertEntityIds = extractSecurityAlertEntityIds(config.alert_entities);
  }

  public getCardSize(): number {
    return this._visibleAlerts.length + 1;
  }

  public getGridOptions(): LovelaceGridOptions {
    return {
      columns: 12,
      rows: "auto",
      min_columns: 6,
      min_rows: 1,
    };
  }

  private get _visibleAlerts(): SecurityAlertItem[] {
    if (!this._config || !this._alertEntityIds?.length || !this._states) {
      return [];
    }
    return computeSecurityAlertItems(
      { ...this._hassConfig, ...this._i18n, states: this._states },
      this._config.alert_entities
    );
  }

  protected willUpdate(changedProps: PropertyValues<this>): void {
    super.willUpdate(changedProps);

    if (!this._config) {
      return;
    }

    const alerts = this._visibleAlerts;
    this._alertsProvider.setValue(alerts);
    const shouldBeHidden = alerts.length === 0;

    if (shouldBeHidden !== this.hidden) {
      this.style.display = shouldBeHidden ? "none" : "";
      this.toggleAttribute("hidden", shouldBeHidden);
      fireEvent(this, "card-visibility-changed", { value: !shouldBeHidden });
    }
  }

  protected render() {
    if (!this._config || this.hidden) {
      return nothing;
    }

    return html`
      <hui-security-alerts-heading></hui-security-alerts-heading>
      <hui-security-alerts-list></hui-security-alerts-list>
    `;
  }

  static styles = css`
    :host {
      display: block;
      --ha-security-alert-danger-color: var(--error-color);
      --ha-security-alert-warning-color: var(--warning-color);
      --ha-security-alert-info-color: var(--info-color);
      --ha-security-alert-pulse-duration: 1s;
      --ha-security-alert-pulse-opacity: 0.3;
      --ha-security-alert-static-opacity: 0;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "hui-security-alerts-card": HuiSecurityAlertsCard;
  }
}
