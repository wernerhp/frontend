import { ContextProvider } from "@lit/context";
import type { HassEntity } from "home-assistant-js-websocket";
import { css, html, LitElement, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators";
import { classMap } from "lit/directives/class-map";
import memoizeOne from "memoize-one";
import { fireEvent, type HASSDomEvent } from "../../../common/dom/fire_event";
import "../../../components/ha-button";
import "../../../components/ha-dialog";
import "../../../components/ha-dialog-footer";
import "../../../components/ha-expansion-panel";
import "../../../components/ha-form/ha-form";
import type { HaFormSchema } from "../../../components/ha-form/types";
import "../../../components/ha-icon";
import "../../../components/ha-icon-button";
import "../../../components/ha-icon-button-prev";
import type {
  SecurityAlertEntityConfig,
  SecurityFrontendSystemData,
} from "../../../data/frontend";
import type { HassDialog } from "../../../dialogs/make-dialog-manager";
import { DirtyStateProviderMixin } from "../../../mixins/dirty-state-provider-mixin";
import { haStyleDialog } from "../../../resources/styles";
import type { HomeAssistant, ValueChangedEvent } from "../../../types";
import "../../lovelace/cards/hui-card";
import type { SecurityAlertsCardConfig } from "../../lovelace/cards/types";
import "../../lovelace/editor/conditions/ha-card-conditions-editor";
import "../../lovelace/editor/conditions/ha-visibility-status";
import type { Condition } from "../../lovelace/common/validate-condition";
import { conditionsEntityContext } from "../../lovelace/editor/conditions/context";
import "../components/security-alerts-editor";
import {
  computeSecurityAlertEntityDefaultColor,
  computeDefaultSecurityAlertVisibility,
} from "../strategies/security-alerts";
import { isSecurityPanelEntity } from "../strategies/security-view-strategy";
import type { EditSecurityDialogParams } from "./show-dialog-edit-security";
import { withViewTransition } from "../../../common/util/view-transition";

interface AlertEntityEditorData {
  entity: string;
  color: string;
  pulse: boolean;
}

@customElement("dialog-edit-security")
export class DialogEditSecurity
  extends DirtyStateProviderMixin<SecurityFrontendSystemData>()(LitElement)
  implements HassDialog<EditSecurityDialogParams>
{
  @property({ attribute: false }) public hass!: HomeAssistant;

  @state() private _params?: EditSecurityDialogParams;

  @state() private _state?: SecurityFrontendSystemData;

  @state() private _open = false;

  @state() private _submitting = false;

  @state() private _editingAlertEntityIndex?: number;

  private _conditionContextProvider = new ContextProvider(this, {
    context: conditionsEntityContext,
    initialValue: undefined,
  });

  protected willUpdate(changedProperties: PropertyValues): void {
    super.willUpdate(changedProperties);
    if (
      changedProperties.has("_editingAlertEntityIndex") ||
      changedProperties.has("_state")
    ) {
      const alertEntity = this._editingAlertEntity;
      this._conditionContextProvider.setValue(
        alertEntity
          ? { mode: "current", entityId: alertEntity.entity }
          : undefined
      );
    }
  }

  private get _editingAlertEntity(): SecurityAlertEntityConfig | undefined {
    return this._editingAlertEntityIndex === undefined
      ? undefined
      : this._state?.alert_entities?.[this._editingAlertEntityIndex];
  }

  public showDialog(params: EditSecurityDialogParams): void {
    this._params = params;
    this._state = {
      ...params.config,
      alert_entities: params.config.alert_entities
        ? [...params.config.alert_entities]
        : [],
    };
    this._initDirtyTracking({ type: "shallow" }, this._state);
    this._open = true;
  }

  public closeDialog(): boolean {
    this._open = false;
    return true;
  }

  private _dialogClosed(): void {
    this._params = undefined;
    this._state = undefined;
    this._submitting = false;
    this._editingAlertEntityIndex = undefined;
    fireEvent(this, "dialog-closed", { dialog: this.localName });
  }

  protected render() {
    if (!this._params || !this._state) {
      return nothing;
    }

    return html`
      <ha-dialog
        class=${classMap({ subview: Boolean(this._editingAlertEntity) })}
        .open=${this._open}
        .width=${this._editingAlertEntity ? "large" : "medium"}
        .headerTitle=${this.hass.localize("ui.panel.security.editor.title")}
        .headerSubtitle=${
          this._editingAlertEntity
            ? undefined
            : this.hass.localize("ui.panel.security.editor.description")
        }
        .preventScrimClose=${this.isDirtyState}
        @closed=${this._dialogClosed}
      >
        ${
          this._editingAlertEntity
            ? html` ${this._renderAlertEntityEditor(this._editingAlertEntity)} `
            : this._renderMainEditor()
        }

        <ha-dialog-footer slot="footer">
          <ha-button
            appearance="plain"
            slot="secondaryAction"
            @click=${this.closeDialog}
            .disabled=${this._submitting}
          >
            ${this.hass.localize("ui.common.cancel")}
          </ha-button>
          <ha-button
            slot="primaryAction"
            @click=${this._save}
            .disabled=${this._submitting || !this.isDirtyState}
          >
            ${this.hass.localize("ui.common.save")}
          </ha-button>
        </ha-dialog-footer>
      </ha-dialog>
    `;
  }

  private _renderMainEditor() {
    return html`
      <ha-expansion-panel
        outlined
        expanded
        no-collapse
        .header=${this.hass.localize(
          "ui.panel.security.editor.active_alert_entities"
        )}
        .secondary=${this.hass.localize(
          "ui.panel.security.editor.active_alert_entities_description"
        )}
      >
        <ha-icon slot="leading-icon" icon="mdi:shield-alert"></ha-icon>
        <div class="expansion-content">
          <security-alerts-editor
            .hass=${this.hass}
            .alertEntities=${this._state?.alert_entities ?? []}
            @value-changed=${this._alertEntitiesChanged}
            @edit-security-alert-entity=${this._editAlertEntity}
          ></security-alerts-editor>
        </div>
      </ha-expansion-panel>
    `;
  }

  private _renderAlertEntityEditor(alertEntity: SecurityAlertEntityConfig) {
    return html`
      <div class="entity-editor">
        <div class="subpage-header">
          <ha-icon-button-prev
            .label=${this.hass.localize("ui.common.back")}
            @click=${this._closeAlertEntityEditor}
          ></ha-icon-button-prev>
          <span class="subpage-title">
            ${this.hass.localize("ui.panel.security.editor.edit_alert_entity")}
          </span>
        </div>
        <div class="entity-editor-content">
          <div class="element-editor">
            <p class="entity-editor-description">
              ${this.hass.localize(
                "ui.panel.security.editor.alert_entity_description"
              )}
            </p>
            <ha-form
              .hass=${this.hass}
              .data=${{
                entity: alertEntity.entity,
                color: alertEntity.color,
                pulse: alertEntity.pulse ?? true,
              }}
              .schema=${this._alertEntityFormSchema()}
              .context=${{ entityFilter: this._alertEntityFilter }}
              .computeLabel=${this._computeAlertEntityEditorLabel}
              @value-changed=${this._alertEntityFormChanged}
            ></ha-form>
            <div class="conditions">
              <p class="field-label">
                ${this.hass.localize(
                  "ui.panel.security.editor.visibility_conditions"
                )}
              </p>
              <ha-visibility-status
                .hass=${this.hass}
                .conditions=${
                  alertEntity.visibility ??
                  computeDefaultSecurityAlertVisibility(alertEntity.entity)
                }
              ></ha-visibility-status>
              <ha-card-conditions-editor
                .hass=${this.hass}
                .conditions=${
                  alertEntity.visibility ??
                  computeDefaultSecurityAlertVisibility(alertEntity.entity)
                }
                @value-changed=${this._alertEntityConditionsChanged}
              ></ha-card-conditions-editor>
            </div>
          </div>
          <div class="element-preview">
            <div class="preview-heading">
              ${this.hass.localize("ui.panel.security.editor.preview")}
            </div>
            <hui-card
              .hass=${this.hass}
              .config=${this._previewCardConfig(alertEntity)}
              preview
            ></hui-card>
          </div>
        </div>
      </div>
    `;
  }

  private _previewCardConfig = memoizeOne(
    (alertEntity: SecurityAlertEntityConfig): SecurityAlertsCardConfig => ({
      type: "security-alerts",
      alert_entities: [alertEntity],
    })
  );

  private _alertEntitiesChanged(
    ev: ValueChangedEvent<SecurityFrontendSystemData["alert_entities"]>
  ): void {
    this._state = {
      ...this._state,
      alert_entities: ev.detail.value,
    };
    this._updateDirtyState(this._state);
  }

  private _editAlertEntity(
    ev: HASSDomEvent<HASSDomEvents["edit-security-alert-entity"]>
  ): void {
    ev.stopPropagation();
    withViewTransition(() => {
      this._editingAlertEntityIndex = ev.detail.index;
    });
  }

  private _closeAlertEntityEditor(): void {
    this._editingAlertEntityIndex = undefined;
  }

  private _alertEntityFilter = (entity: HassEntity) =>
    isSecurityPanelEntity(this.hass, entity);

  private _alertEntityFormSchema(): HaFormSchema[] {
    return [
      {
        name: "entity",
        required: true,
        selector: {
          entity: {
            exclude_entities: (this._state?.alert_entities ?? [])
              .filter((_, index) => index !== this._editingAlertEntityIndex)
              .map(({ entity }) => entity),
          },
        },
      },
      {
        type: "grid",
        name: "highlight",
        flatten: true,
        column_min_width: "0",
        schema: [
          {
            name: "color",
            selector: {
              ui_color: {
                include_none: true,
                default_color: computeSecurityAlertEntityDefaultColor(
                  this.hass.states[this._editingAlertEntity?.entity ?? ""]
                ),
              },
            },
          },
          {
            name: "pulse",
            selector: { boolean: {} },
          },
        ],
      },
    ];
  }

  private _computeAlertEntityEditorLabel = (schema: HaFormSchema): string => {
    switch (schema.name) {
      case "entity":
        return this.hass.localize("ui.panel.security.editor.entity");
      case "color":
        return this.hass.localize("ui.panel.security.editor.alert_color.label");
      case "pulse":
        return this.hass.localize("ui.panel.security.editor.pulse");
      default:
        return schema.name;
    }
  };

  private _updateEditingAlertEntity(
    updates: Partial<SecurityAlertEntityConfig>
  ): void {
    if (this._editingAlertEntityIndex === undefined || !this._state) {
      return;
    }
    const alertEntities = [...(this._state.alert_entities ?? [])];
    const alertEntity = alertEntities[this._editingAlertEntityIndex];
    if (!alertEntity) {
      return;
    }
    alertEntities[this._editingAlertEntityIndex] = {
      ...alertEntity,
      ...updates,
    };
    this._state = {
      ...this._state,
      alert_entities: alertEntities,
    };
    this._updateDirtyState(this._state);
  }

  private _alertEntityFormChanged(
    ev: ValueChangedEvent<AlertEntityEditorData>
  ): void {
    const previousEntity = this._editingAlertEntity?.entity;
    const updates: Partial<SecurityAlertEntityConfig> = {
      entity: ev.detail.value.entity,
      color: ev.detail.value.color,
      pulse: ev.detail.value.pulse,
    };
    if (previousEntity !== ev.detail.value.entity) {
      updates.visibility = computeDefaultSecurityAlertVisibility(
        ev.detail.value.entity
      );
    }
    this._updateEditingAlertEntity(updates);
  }

  private _alertEntityConditionsChanged(
    ev: ValueChangedEvent<Condition[]>
  ): void {
    this._updateEditingAlertEntity({ visibility: ev.detail.value });
  }

  private async _save(): Promise<void> {
    if (!this._params || !this._state) return;

    this._submitting = true;
    const config: SecurityFrontendSystemData = {
      ...this._params.config,
      alert_entities: this._state.alert_entities?.length
        ? this._state.alert_entities
        : undefined,
    };

    try {
      await this._params.saveConfig(config);
      this._markDirtyStateClean();
      this.closeDialog();
    } finally {
      this._submitting = false;
    }
  }

  static styles = [
    haStyleDialog,
    css`
      ha-dialog {
        --dialog-content-padding: var(--ha-space-6);
      }

      ha-dialog.subview {
        --dialog-content-padding: var(--ha-space-2);
      }

      ha-expansion-panel {
        display: block;
        --expansion-panel-content-padding: 0;
        border-radius: var(--ha-border-radius-md);
        --ha-card-border-radius: var(--ha-border-radius-md);
      }

      .expansion-content {
        padding: var(--ha-space-3);
      }

      .entity-editor {
        display: flex;
        flex-direction: column;
      }

      .subpage-header {
        display: flex;
        align-items: center;
        gap: var(--ha-space-2);
        padding: 0 var(--ha-space-1);
      }

      .subpage-title {
        color: var(--primary-text-color);
        font-size: var(--ha-font-size-l);
        font-weight: var(--ha-font-weight-medium);
      }

      .entity-editor-content {
        display: flex;
        flex-direction: column;
        gap: var(--ha-space-4);
        padding: var(--ha-space-4) 0;
      }

      .element-editor {
        display: flex;
        flex-direction: column;
        gap: var(--ha-space-4);
        padding: var(--ha-space-4);
      }

      .element-preview {
        position: relative;
        background: var(--primary-background-color);
        padding: var(--ha-space-4);
        border-radius: var(--ha-border-radius-sm);
      }

      .preview-heading {
        color: var(--secondary-text-color);
        font-size: var(--ha-font-size-s);
        font-weight: var(--ha-font-weight-medium);
        margin: 0 0 var(--ha-space-2);
      }

      .element-preview hui-card {
        display: block;
        width: 100%;
        box-sizing: border-box;
      }

      @media (min-width: 1000px) {
        .entity-editor-content {
          flex-direction: row;
          max-height: calc(100vh - 209px);
        }

        .entity-editor-content > .element-editor,
        .entity-editor-content > .element-preview {
          flex-basis: 0;
          flex-grow: 1;
          flex-shrink: 1;
          min-width: 0;
        }

        .entity-editor-content > .element-preview {
          overflow-y: auto;
        }

        .entity-editor-content > .element-editor {
          padding-inline-end: var(--ha-space-4);
        }
      }

      .entity-editor-description {
        margin: 0;
        font-size: var(--ha-font-size-m);
        line-height: var(--ha-line-height-normal);
      }

      ha-form-grid {
        direction: ltr;
        --form-grid-column-count: 2;
      }

      .field-label {
        margin: 0 0 var(--ha-space-2) 0;
        font-size: 14px;
        color: var(--primary-text-color);
      }

      ha-visibility-status {
        display: block;
        margin-bottom: var(--ha-space-3);
      }
    `,
  ];
}

declare global {
  interface HTMLElementTagNameMap {
    "dialog-edit-security": DialogEditSecurity;
  }
}
