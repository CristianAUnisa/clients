import { APP_INITIALIZER, NgModule } from "@angular/core";
import { ToastrModule } from "ngx-toastr";

import {
  JslibServicesModule,
  SECURE_STORAGE,
  STATE_FACTORY,
  STATE_SERVICE_USE_CACHE,
  LOCALES_DIRECTORY,
  SYSTEM_LANGUAGE,
} from "@bitwarden/angular/services/jslib-services.module";
import { ModalService as ModalServiceAbstraction , ModalConfig as ModalConfigAbstraction , ModalConfig } from "@bitwarden/angular/services/modal.service";
import { ApiService as ApiServiceAbstraction } from "@bitwarden/common/abstractions/api.service";
import { CipherService as CipherServiceAbstraction } from "@bitwarden/common/abstractions/cipher.service";
import { CollectionService as CollectionServiceAbstraction } from "@bitwarden/common/abstractions/collection.service";
import { CryptoService as CryptoServiceAbstraction } from "@bitwarden/common/abstractions/crypto.service";
import { CryptoFunctionService as CryptoFunctionServiceAbstraction } from "@bitwarden/common/abstractions/cryptoFunction.service";
import { ExportService as ExportServiceAbstraction } from "@bitwarden/common/abstractions/export.service";
import { ExportFilePasswordPromptService as ExportFilePasswordPromptServiceAbstraction } from "@bitwarden/common/abstractions/exportFilePasswordPrompt.service";
import { FilePasswordPromptService as FilePasswordPromptServiceAbstraction } from "@bitwarden/common/abstractions/filePasswordPrompt.service";
import { FolderService as FolderServiceAbstraction } from "@bitwarden/common/abstractions/folder.service";
import { I18nService as I18nServiceAbstraction } from "@bitwarden/common/abstractions/i18n.service";
import { ImportService as ImportServiceAbstraction } from "@bitwarden/common/abstractions/import.service";
import { LogService } from "@bitwarden/common/abstractions/log.service";
import { MessagingService as MessagingServiceAbstraction } from "@bitwarden/common/abstractions/messaging.service";
import { PasswordRepromptService as PasswordRepromptServiceAbstraction } from "@bitwarden/common/abstractions/passwordReprompt.service";
import { PlatformUtilsService as PlatformUtilsServiceAbstraction } from "@bitwarden/common/abstractions/platformUtils.service";
import { StateService as BaseStateServiceAbstraction } from "@bitwarden/common/abstractions/state.service";
import { StateMigrationService as StateMigrationServiceAbstraction } from "@bitwarden/common/abstractions/stateMigration.service";
import { StorageService as StorageServiceAbstraction } from "@bitwarden/common/abstractions/storage.service";
import { StateFactory } from "@bitwarden/common/factories/stateFactory";
import { ExportService } from "@bitwarden/common/services/export.service";
import { ImportService } from "@bitwarden/common/services/import.service";

import { StateService as StateServiceAbstraction } from "../../abstractions/state.service";
import { Account } from "../../models/account";
import { GlobalState } from "../../models/globalState";
import { BroadcasterMessagingService } from "../../services/broadcasterMessaging.service";
import { ExportFilePasswordPromptService } from "../../services/exportFilePasswordPrompt.service";
import { FilePasswordPromptService } from "../../services/filePasswordPrompt.service";
import { HtmlStorageService } from "../../services/htmlStorage.service";
import { I18nService } from "../../services/i18n.service";
import { MemoryStorageService } from "../../services/memoryStorage.service";
import { PasswordRepromptService } from "../../services/passwordReprompt.service";
import { StateService } from "../../services/state.service";
import { StateMigrationService } from "../../services/stateMigration.service";
import { WebPlatformUtilsService } from "../../services/webPlatformUtils.service";
import { HomeGuard } from "../guards/home.guard";
import { PermissionsGuard as OrgPermissionsGuard } from "../organizations/guards/permissions.guard";
import { NavigationPermissionsService as OrgPermissionsService } from "../organizations/services/navigation-permissions.service";

import { EventService } from "./event.service";
import { InitService } from "./init.service";
import { ModalService } from "./modal.service";
import { PolicyListService } from "./policy-list.service";
import { RouterService } from "./router.service";

@NgModule({
  imports: [ToastrModule, JslibServicesModule],
  declarations: [],
  providers: [
    OrgPermissionsService,
    OrgPermissionsGuard,
    InitService,
    RouterService,
    EventService,
    PolicyListService,
    {
      provide: APP_INITIALIZER,
      useFactory: (initService: InitService) => initService.init(),
      deps: [InitService],
      multi: true,
    },
    {
      provide: STATE_FACTORY,
      useValue: new StateFactory(GlobalState, Account),
    },
    {
      provide: STATE_SERVICE_USE_CACHE,
      useValue: false,
    },
    {
      provide: I18nServiceAbstraction,
      useClass: I18nService,
      deps: [SYSTEM_LANGUAGE, LOCALES_DIRECTORY],
    },
    { provide: StorageServiceAbstraction, useClass: HtmlStorageService },
    {
      provide: SECURE_STORAGE,
      // TODO: platformUtilsService.isDev has a helper for this, but using that service here results in a circular dependency.
      // We have a tech debt item in the backlog to break up platformUtilsService, but in the meantime simply checking the environement here is less cumbersome.
      useClass: process.env.NODE_ENV === "development" ? HtmlStorageService : MemoryStorageService,
    },
    {
      provide: PlatformUtilsServiceAbstraction,
      useClass: WebPlatformUtilsService,
    },
    { provide: MessagingServiceAbstraction, useClass: BroadcasterMessagingService },
    { provide: ModalServiceAbstraction, useClass: ModalService },
    { provide: ModalConfigAbstraction, useClass: ModalConfig },
    {
      provide: ImportServiceAbstraction,
      useClass: ImportService,
      deps: [
        CipherServiceAbstraction,
        FolderServiceAbstraction,
        ApiServiceAbstraction,
        I18nServiceAbstraction,
        CollectionServiceAbstraction,
        PlatformUtilsServiceAbstraction,
        CryptoServiceAbstraction,
      ],
    },
    {
      provide: ExportServiceAbstraction,
      useClass: ExportService,
      deps: [
        FolderServiceAbstraction,
        CipherServiceAbstraction,
        ApiServiceAbstraction,
        CryptoServiceAbstraction,
        CryptoFunctionServiceAbstraction,
      ],
    },
    {
      provide: StateMigrationServiceAbstraction,
      useClass: StateMigrationService,
      deps: [StorageServiceAbstraction, SECURE_STORAGE, STATE_FACTORY],
    },
    {
      provide: StateServiceAbstraction,
      useClass: StateService,
      deps: [
        StorageServiceAbstraction,
        SECURE_STORAGE,
        LogService,
        StateMigrationServiceAbstraction,
        STATE_FACTORY,
        STATE_SERVICE_USE_CACHE,
      ],
    },
    {
      provide: BaseStateServiceAbstraction,
      useExisting: StateServiceAbstraction,
    },
    {
      provide: PasswordRepromptServiceAbstraction,
      useClass: PasswordRepromptService,
    },
    {
      provide: FilePasswordPromptServiceAbstraction,
      useClass: FilePasswordPromptService,
    },
    {
      provide: ExportFilePasswordPromptServiceAbstraction,
      useClass: ExportFilePasswordPromptService,
    },
    HomeGuard,
  ],
})
export class ServicesModule {}
