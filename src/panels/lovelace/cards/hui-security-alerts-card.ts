import { consume, type ContextType } from "@lit/context";
import type { HassEntity } from "home-assistant-js-websocket";
import type { PropertyValues } from "lit";
import { css, html, LitElement, nothing } from "lit";
import { customElement, state } from "lit/decorators";
import { classMap } from "lit/directives/class-map";
import { consumeEntityStates } from "../../../common/decorators/consume-context-entry";
import { computeStateName } from "../../../common/entity/compute_state_name";
import { fireEvent } from "../../../common/dom/fire_event";
import "../../../components/ha-card";
import "../../../components/ha-relative-time";
import "../../../components/ha-state-icon";
import "../../../components/tile/ha-tile-container";
import "../../../components/tile/ha-tile-icon";
import "../../../components/tile/ha-tile-info";
import { formattersContext } from "../../../data/context";
import type { ActionHandlerEvent } from "../../../data/lovelace/action_handler";
import { pulseOpacityAnimation } from "../../../resources/animations";
import {
  computeSecurityAlertItems,
  type SecurityAlertItem,
} from "../../security/strategies/security-alerts";
import type { LovelaceCard, LovelaceGridOptions } from "../types";
import { tileCardStyle } from "./tile/tile-card-style";
import type { SecurityAlertsCardConfig } from "./types";

const DEFAULT_ALERT_LIMIT = 3;

@customElement("hui-security-alerts-card")
export class HuiSecurityAlertsCard extends LitElement implements LovelaceCard {
  public connectedWhileHidden = true;

  @state() private _config?: SecurityAlertsCardConfig;

  @state()
  @consumeEntityStates({ entityIdPath: ["_config", "entities"] })
  private _states?: Record<string, HassEntity>;

  @state()
  @consume({ context: formattersContext, subscribe: true })
  private _formatters!: ContextType<typeof formattersContext>;

  public setConfig(config: SecurityAlertsCardConfig): void {
    if (!config.entities) {
      throw new Error("Specify entities");
    }
    this._config = config;
  }

  public connectedCallback(): void {
    super.connectedCallback();
    this.updateComplete.then(() => this._updateHeadingVisibility());
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
    if (!this._config || !this._states) {
      return [];
    }
    return computeSecurityAlertItems(this._states, this._config.entities).slice(
      0,
      this._config.limit ?? DEFAULT_ALERT_LIMIT
    );
  }

  private _handleAction(ev: ActionHandlerEvent): void {
    const entityId = (ev.currentTarget as HTMLElement).dataset.entityId;
    if (ev.detail.action === "tap" && entityId) {
      fireEvent(this, "hass-more-info", { entityId });
    }
  }

  protected willUpdate(changedProps: PropertyValues<this>): void {
    super.willUpdate(changedProps);

    if (!this._config) {
      return;
    }

    const shouldBeHidden = this._visibleAlerts.length === 0;

    if (shouldBeHidden !== this.hidden) {
      this.style.display = shouldBeHidden ? "none" : "";
      this.toggleAttribute("hidden", shouldBeHidden);
      this._updateHeadingVisibility();
      fireEvent(this, "card-visibility-changed", { value: !shouldBeHidden });
    }
  }

  private _updateHeadingVisibility(): void {
    if (!this._config?.heading_card_id || !this.parentElement) {
      return;
    }

    const heading = this.parentElement.querySelector(
      `#${CSS.escape(this._config.heading_card_id)}`
    ) as HTMLElement | null;
    heading?.toggleAttribute("hidden", this.hasAttribute("hidden"));
  }

  protected render() {
    if (!this._config || this.hidden) {
      return nothing;
    }

    const alerts = this._visibleAlerts;
    if (!alerts.length) {
      return nothing;
    }

    return html`
      <div class="alerts">
        ${alerts.map((alert) => this._renderAlert(alert))}
      </div>
    `;
  }

  private _renderAlert(alert: SecurityAlertItem) {
    const stateDisplay = this._formatters.formatEntityState(alert.stateObj);
    return html`
      <ha-card class=${classMap({ [alert.severity]: true })}>
        <ha-tile-container
          .interactive=${true}
          .actionHandlerOptions=${{ hasHold: false, hasDoubleClick: false }}
          data-entity-id=${alert.entityId}
          @action=${this._handleAction}
        >
          <ha-tile-icon
            slot="icon"
            .icon=${alert.icon}
            .iconPath=${alert.iconPath}
          >
            ${
              !alert.icon && !alert.iconPath
                ? html`<ha-state-icon
                    slot="icon"
                    .stateObj=${alert.stateObj}
                  ></ha-state-icon>`
                : nothing
            }
          </ha-tile-icon>
          <ha-tile-info slot="info">
            <span slot="primary">${computeStateName(alert.stateObj)}</span>
            <span slot="secondary">
              ${stateDisplay} ·
              <ha-relative-time
                .datetime=${alert.stateObj.last_changed}
              ></ha-relative-time>
            </span>
          </ha-tile-info>
        </ha-tile-container>
      </ha-card>
    `;
  }

  static styles = [
    tileCardStyle,
    pulseOpacityAnimation,
    css`
      :host {
        display: block;
        --ha-security-alert-negative-color: var(--error-color);
        --ha-security-alert-warning-color: var(--warning-color);
        --ha-security-alert-info-color: var(--info-color);
        --ha-security-alert-pulse-duration: 1s;
        --ha-security-alert-pulse-opacity: 0.3;
      }
      .alerts {
        display: flex;
        flex-direction: column;
        gap: var(--ha-space-2);
      }
      ha-card {
        position: relative;
        overflow: hidden;
        height: 100%;
        --tile-color: var(--primary-color);
      }
      ha-card::before {
        position: absolute;
        inset: 0;
        border-radius: var(--ha-card-border-radius, var(--ha-border-radius-lg));
        content: "";
        opacity: 0;
        pointer-events: none;
        --ha-pulse-opacity: var(--ha-security-alert-pulse-opacity);
        animation: pulse-opacity var(--ha-security-alert-pulse-duration)
          ease-in-out infinite alternate;
      }
      ha-card.negative {
        --tile-color: var(--ha-security-alert-negative-color);
      }
      ha-card.negative::before {
        background-color: var(--ha-security-alert-negative-color);
      }
      ha-card.warning {
        --tile-color: var(--ha-security-alert-warning-color);
      }
      ha-card.warning::before {
        background-color: var(--ha-security-alert-warning-color);
      }
      ha-card.info {
        --tile-color: var(--ha-security-alert-info-color);
      }
      ha-card.info::before {
        background-color: var(--ha-security-alert-info-color);
      }
      ha-tile-container {
        position: relative;
      }
      @media (prefers-reduced-motion: reduce) {
        ha-card::before {
          animation: none;
          opacity: var(--ha-security-alert-pulse-opacity);
        }
      }
    `,
  ];
}

declare global {
  interface HTMLElementTagNameMap {
    "hui-security-alerts-card": HuiSecurityAlertsCard;
  }
}
