import { mdiClose, mdiDragHorizontalVariant, mdiPencil } from "@mdi/js";
import type { HassEntity } from "home-assistant-js-websocket";
import { css, html, LitElement, nothing } from "lit";
import { customElement, property } from "lit/decorators";
import { repeat } from "lit/directives/repeat";
import { computeEntityPickerDisplay } from "../../../common/entity/compute_entity_name_display";
import { fireEvent, type HASSDomEvent } from "../../../common/dom/fire_event";
import type { HaEntityPicker } from "../../../components/entity/ha-entity-picker";
import type { SecurityAlertEntityConfig } from "../../../data/frontend";
import "../../../components/entity/ha-entity-picker";
import "../../../components/entity/state-badge";
import "../../../components/ha-icon-button";
import "../../../components/ha-settings-row";
import "../../../components/ha-sortable";
import "../../../components/ha-svg-icon";
import { computeDefaultSecurityAlertVisibility } from "../strategies/security-alerts";
import { isSecurityPanelEntity } from "../strategies/security-view-strategy";
import type { HomeAssistant, ValueChangedEvent } from "../../../types";

declare global {
  interface HASSDomEvents {
    "edit-security-alert-entity": { index: number };
  }
}

@customElement("security-alerts-editor")
export class SecurityAlertsEditor extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;

  @property({ attribute: false })
  public alertEntities: SecurityAlertEntityConfig[] = [];

  protected render() {
    return html`
      <ha-sortable handle-selector=".handle" @item-moved=${this._moved}>
        <div class="alert-list">
          ${repeat(
            this.alertEntities,
            (alertEntity) => alertEntity.entity,
            (alertEntity, index) => this._renderAlertEntity(alertEntity, index)
          )}
        </div>
      </ha-sortable>
      <ha-entity-picker
        add-button
        .addButtonLabel=${this.hass.localize(
          "ui.panel.security.editor.add_alert_entity"
        )}
        .excludeEntities=${this.alertEntities.map(({ entity }) => entity)}
        .entityFilter=${this._alertEntityFilter}
        @value-changed=${this._add}
      ></ha-entity-picker>
    `;
  }

  private _renderAlertEntity(
    alertEntity: SecurityAlertEntityConfig,
    index: number
  ) {
    const stateObj = this.hass.states[alertEntity.entity];
    const { primary, secondary } = stateObj
      ? computeEntityPickerDisplay(this.hass, stateObj)
      : { primary: alertEntity.entity, secondary: undefined };

    return html`
      <div class="alert-row">
        <div class="handle">
          <ha-svg-icon .path=${mdiDragHorizontalVariant}></ha-svg-icon>
        </div>
        <ha-settings-row slim>
          <state-badge slot="prefix" .stateObj=${stateObj}></state-badge>
          <span slot="heading">${primary}</span>
          ${
            secondary
              ? html`<span slot="description">${secondary}</span>`
              : nothing
          }
          <ha-icon-button
            .path=${mdiPencil}
            .label=${this.hass.localize("ui.common.edit")}
            data-index=${index}
            @click=${this._editClicked}
          ></ha-icon-button>
          <ha-icon-button
            .path=${mdiClose}
            .label=${this.hass.localize("ui.common.delete")}
            data-index=${index}
            @click=${this._removeClicked}
          ></ha-icon-button>
        </ha-settings-row>
      </div>
    `;
  }

  private _changed(next: SecurityAlertEntityConfig[]): void {
    fireEvent(this, "value-changed", { value: next });
  }

  private _alertEntityFilter = (entity: HassEntity) =>
    isSecurityPanelEntity(this.hass, entity);

  private _getIndex(ev: Event): number | undefined {
    const index = Number((ev.currentTarget as HTMLElement).dataset.index);
    return Number.isInteger(index) ? index : undefined;
  }

  private _editClicked(ev: Event): void {
    ev.stopPropagation();
    const index = this._getIndex(ev);
    if (index !== undefined) {
      fireEvent(this, "edit-security-alert-entity", { index });
    }
  }

  private _removeClicked(ev: Event): void {
    ev.stopPropagation();
    const index = this._getIndex(ev);
    if (index !== undefined) {
      const next = [...this.alertEntities];
      next.splice(index, 1);
      this._changed(next);
    }
  }

  private _add(ev: ValueChangedEvent<string | undefined>): void {
    ev.stopPropagation();
    const entity = ev.detail.value;
    if (!entity) return;

    (ev.currentTarget as HaEntityPicker).value = "";

    if (
      this.alertEntities.some((alertEntity) => alertEntity.entity === entity)
    ) {
      return;
    }

    this._changed([
      ...this.alertEntities,
      {
        entity,
        visibility: computeDefaultSecurityAlertVisibility(entity),
      },
    ]);
  }

  private _moved(ev: HASSDomEvent<HASSDomEvents["item-moved"]>): void {
    ev.stopPropagation();
    const { oldIndex, newIndex } = ev.detail;
    const next = [...this.alertEntities];
    const [moved] = next.splice(oldIndex, 1);
    next.splice(newIndex, 0, moved);
    this._changed(next);
  }

  static styles = css`
    :host {
      display: block;
    }
    .alert-list {
      display: flex;
      flex-direction: column;
      gap: var(--ha-space-2);
    }
    .alert-row {
      display: flex;
      align-items: flex-start;
      gap: var(--ha-space-2);
    }
    .handle {
      cursor: grab;
      color: var(--secondary-text-color);
      flex-shrink: 0;
      display: flex;
      align-items: center;
      min-height: 48px;
    }
    ha-settings-row {
      flex: 1;
      min-width: 0;
      padding: 0;
      gap: var(--ha-space-3);
      min-height: 48px;
      --settings-row-prefix-display: contents;
      --settings-row-content-display: contents;
      --settings-row-body-padding-top: var(--ha-space-1);
      --settings-row-body-padding-bottom: var(--ha-space-1);
    }
    state-badge {
      flex-shrink: 0;
      width: 24px;
      height: 24px;
      --state-icon-color: var(--secondary-text-color);
    }
    [slot="heading"],
    [slot="description"] {
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    ha-entity-picker {
      display: block;
      padding-top: var(--ha-space-3);
    }
    ha-icon-button {
      --ha-icon-button-size: 40px;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "security-alerts-editor": SecurityAlertsEditor;
  }
}
