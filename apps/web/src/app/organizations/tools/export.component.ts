import { Component } from "@angular/core";
import { FormBuilder } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";

import { ExportFilePasswordPromptService } from "@bitwarden/angular/services/exportFilePasswordPrompt.service";
import { ModalConfig, ModalService } from "@bitwarden/angular/services/modal.service";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { CryptoService } from "@bitwarden/common/abstractions/crypto.service";
import { EventService } from "@bitwarden/common/abstractions/event.service";
import { ExportService } from "@bitwarden/common/abstractions/export.service";
import { I18nService } from "@bitwarden/common/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/abstractions/platformUtils.service";
import { PolicyService } from "@bitwarden/common/abstractions/policy.service";
import { StateService } from "@bitwarden/common/abstractions/state.service";
import { UserVerificationService } from "@bitwarden/common/abstractions/userVerification.service";

import { ExportComponent as BaseExportComponent } from "../../tools/export.component";

@Component({
  selector: "app-org-export",
  templateUrl: "../../tools/export.component.html",
})
export class ExportComponent extends BaseExportComponent {
  constructor(
    cryptoService: CryptoService,
    i18nService: I18nService,
    platformUtilsService: PlatformUtilsService,
    exportService: ExportService,
    eventService: EventService,
    private route: ActivatedRoute,
    policyService: PolicyService,
    logService: LogService,
    userVerificationService: UserVerificationService,
    formBuilder: FormBuilder,
    modalService: ModalService,
    apiService: ApiService,
    stateService: StateService,
    exportFilePasswordPromptService: ExportFilePasswordPromptService,
    modalConfig: ModalConfig
  ) {
    super(
      cryptoService,
      i18nService,
      platformUtilsService,
      exportService,
      eventService,
      policyService,
      logService,
      userVerificationService,
      formBuilder,
      modalService,
      apiService,
      stateService,
      exportFilePasswordPromptService,
      modalConfig
    );
    this.confirmDescription = modalConfig.data.confirmDescription;
    this.confirmButtonText = modalConfig.data.confirmButtonText;
    this.modalTitle = modalConfig.data.modalTitle;
  }

  async ngOnInit() {
    this.route.parent.parent.params.subscribe(async (params) => {
      this.organizationId = params.organizationId;
    });
    await super.ngOnInit();
  }

  async checkExportDisabled() {
    return;
  }

  getExportData() {
    return this.exportService.getOrganizationExport(this.organizationId, this.format);
  }

  getFileName() {
    return super.getFileName("org");
  }
}
