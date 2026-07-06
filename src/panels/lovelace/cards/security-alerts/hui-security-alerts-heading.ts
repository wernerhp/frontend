import { consume, type ContextType } from "@lit/context";
import { css, html, LitElement, nothing } from "lit";
import { customElement, state } from "lit/decorators";
import { internationalizationContext } from "../../../../data/context";
import type { SecurityAlertItem } from "../../../security/strategies/security-alerts";
import { securityAlertsContext } from "./context";

@customElement("hui-security-alerts-heading")
export class HuiSecurityAlertsHeading extends LitElement {
  @state()
  @consume({ context: securityAlertsContext, subscribe: true })
  private _alerts: SecurityAlertItem[] = [];

  @state()
  @consume({ context: internationalizationContext, subscribe: true })
  private _i18n!: ContextType<typeof internationalizationContext>;

  protected render() {
    if (!this._alerts.length) {
      return nothing;
    }

    return html`<h2>
      ${this._i18n.localize("ui.card.security-alerts.title")}
    </h2>`;
  }

  static styles = css`
    :host {
      display: block;
      min-height: 24px;
      padding: 0 var(--ha-space-1);
    }
    h2 {
      color: var(--ha-heading-card-title-color, var(--primary-text-color));
      font-size: var(--ha-heading-card-title-font-size, var(--ha-font-size-l));
      font-weight: var(
        --ha-heading-card-title-font-weight,
        var(--ha-font-weight-normal)
      );
      line-height: var(
        --ha-heading-card-title-line-height,
        var(--ha-line-height-normal)
      );
      letter-spacing: 0.1px;
      margin: 0 0 var(--ha-space-2);
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "hui-security-alerts-heading": HuiSecurityAlertsHeading;
  }
}
