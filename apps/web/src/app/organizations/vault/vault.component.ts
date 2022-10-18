import {
  ChangeDetectorRef,
  Component,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
  ViewContainerRef,
} from "@angular/core";
import { ActivatedRoute, Params, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";
import { first } from "rxjs/operators";

import { ModalService } from "@bitwarden/angular/services/modal.service";
import { BroadcasterService } from "@bitwarden/common/abstractions/broadcaster.service";
import { CipherService } from "@bitwarden/common/abstractions/cipher.service";
import { I18nService } from "@bitwarden/common/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/abstractions/messaging.service";
import { OrganizationService } from "@bitwarden/common/abstractions/organization/organization.service.abstraction";
import { PasswordRepromptService } from "@bitwarden/common/abstractions/passwordReprompt.service";
import { PlatformUtilsService } from "@bitwarden/common/abstractions/platformUtils.service";
import { SyncService } from "@bitwarden/common/abstractions/sync/sync.service.abstraction";
import { Organization } from "@bitwarden/common/models/domain/organization";
import { TreeNode } from "@bitwarden/common/models/domain/treeNode";
import { CipherView } from "@bitwarden/common/models/view/cipherView";

import { VaultFilterService } from "../../vault/vault-filter/services/abstractions/vault-filter.service";
import { VaultFilter } from "../../vault/vault-filter/shared/models/vault-filter.model";
import { CollectionFilter } from "../../vault/vault-filter/shared/models/vault-filter.type";
import { EntityEventsComponent } from "../manage/entity-events.component";

import { AddEditComponent } from "./add-edit.component";
import { AttachmentsComponent } from "./attachments.component";
import { CiphersComponent } from "./ciphers.component";
import { CollectionsComponent } from "./collections.component";
import { VaultFilterComponent } from "./vault-filter/vault-filter.component";

const BroadcasterSubscriptionId = "OrgVaultComponent";

@Component({
  selector: "app-org-vault",
  templateUrl: "vault.component.html",
})
export class VaultComponent implements OnInit, OnDestroy {
  @ViewChild("vaultFilter", { static: true })
  vaultFilterComponent: VaultFilterComponent;
  @ViewChild(CiphersComponent, { static: true }) ciphersComponent: CiphersComponent;
  @ViewChild("attachments", { read: ViewContainerRef, static: true })
  attachmentsModalRef: ViewContainerRef;
  @ViewChild("cipherAddEdit", { read: ViewContainerRef, static: true })
  cipherAddEditModalRef: ViewContainerRef;
  @ViewChild("collections", { read: ViewContainerRef, static: true })
  collectionsModalRef: ViewContainerRef;
  @ViewChild("eventsTemplate", { read: ViewContainerRef, static: true })
  eventsModalRef: ViewContainerRef;

  organization: Organization;
  trashCleanupWarning: string = null;
  activeFilter: VaultFilter = new VaultFilter();

  constructor(
    private route: ActivatedRoute,
    private organizationService: OrganizationService,
    private vaultFilterService: VaultFilterService,
    private router: Router,
    private changeDetectorRef: ChangeDetectorRef,
    private syncService: SyncService,
    private i18nService: I18nService,
    private modalService: ModalService,
    private messagingService: MessagingService,
    private broadcasterService: BroadcasterService,
    private ngZone: NgZone,
    private platformUtilsService: PlatformUtilsService,
    private cipherService: CipherService,
    private passwordRepromptService: PasswordRepromptService
  ) {}

  ngOnInit() {
    this.trashCleanupWarning = this.i18nService.t(
      this.platformUtilsService.isSelfHost()
        ? "trashCleanupWarningSelfHosted"
        : "trashCleanupWarning"
    );
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    this.route.parent.params.subscribe(async (params: any) => {
      this.organization = this.organizationService.get(params.organizationId);
      this.ciphersComponent.organization = this.organization;

      /* eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe, rxjs/no-nested-subscribe */
      this.route.queryParams.pipe(first()).subscribe(async (qParams) => {
        this.ciphersComponent.searchText = this.vaultFilterComponent.searchText = qParams.search;
        if (!this.organization.canViewAllCollections) {
          await this.syncService.fullSync(false);
          this.broadcasterService.subscribe(BroadcasterSubscriptionId, (message: any) => {
            this.ngZone.run(async () => {
              switch (message.command) {
                case "syncCompleted":
                  if (message.successfully) {
                    await Promise.all([
                      this.vaultFilterService.reloadCollections(),
                      this.ciphersComponent.refresh(),
                    ]);
                    this.changeDetectorRef.detectChanges();
                  }
                  break;
              }
            });
          });
        }

        await this.ciphersComponent.reload(
          this.activeFilter.buildFilter(),
          this.activeFilter.isDeleted
        );

        if (qParams.viewEvents != null) {
          const cipher = this.ciphersComponent.ciphers.filter((c) => c.id === qParams.viewEvents);
          if (cipher.length > 0) {
            this.viewEvents(cipher[0]);
          }
        }

        /* eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe, rxjs/no-nested-subscribe */
        this.route.queryParams.subscribe(async (params) => {
          const cipherId = getCipherIdFromParams(params);
          if (cipherId) {
            if (
              // Handle users with implicit collection access since they use the admin endpoint
              this.organization.canUseAdminCollections ||
              (await this.cipherService.get(cipherId)) != null
            ) {
              this.editCipherId(cipherId);
            } else {
              this.platformUtilsService.showToast(
                "error",
                this.i18nService.t("errorOccurred"),
                this.i18nService.t("unknownCipher")
              );
              this.router.navigate([], {
                queryParams: { cipherId: null, itemId: null },
                queryParamsHandling: "merge",
              });
            }
          }
        });
      });
    });
  }

  ngOnDestroy() {
    this.broadcasterService.unsubscribe(BroadcasterSubscriptionId);
  }

  async applyVaultFilter(filter: VaultFilter) {
    this.activeFilter = filter;
    this.ciphersComponent.showAddNew = !this.activeFilter.isDeleted;
    await this.ciphersComponent.reload(
      this.activeFilter.buildFilter(),
      this.activeFilter.isDeleted
    );
    this.go();
  }

  filterSearchText(searchText: string) {
    this.ciphersComponent.searchText = searchText;
    this.ciphersComponent.search(200);
  }

  async editCipherAttachments(cipher: CipherView) {
    if (this.organization.maxStorageGb == null || this.organization.maxStorageGb === 0) {
      this.messagingService.send("upgradeOrganization", { organizationId: cipher.organizationId });
      return;
    }

    let madeAttachmentChanges = false;

    const [modal] = await this.modalService.openViewRef(
      AttachmentsComponent,
      this.attachmentsModalRef,
      (comp) => {
        comp.organization = this.organization;
        comp.cipherId = cipher.id;
        // eslint-disable-next-line rxjs-angular/prefer-takeuntil
        comp.onUploadedAttachment.subscribe(() => (madeAttachmentChanges = true));
        // eslint-disable-next-line rxjs-angular/prefer-takeuntil
        comp.onDeletedAttachment.subscribe(() => (madeAttachmentChanges = true));
      }
    );

    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    modal.onClosed.subscribe(async () => {
      if (madeAttachmentChanges) {
        await this.ciphersComponent.refresh();
      }
      madeAttachmentChanges = false;
    });
  }

  async editCipherCollections(cipher: CipherView) {
    const currCollections = await firstValueFrom(this.vaultFilterService.filteredCollections$);
    const [modal] = await this.modalService.openViewRef(
      CollectionsComponent,
      this.collectionsModalRef,
      (comp) => {
        comp.collectionIds = cipher.collectionIds;
        comp.collections = currCollections.filter((c) => !c.readOnly && c.id != null);
        comp.organization = this.organization;
        comp.cipherId = cipher.id;
        // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
        comp.onSavedCollections.subscribe(async () => {
          modal.close();
          await this.ciphersComponent.refresh();
        });
      }
    );
  }

  async addCipher() {
    const component = await this.editCipher(null);
    component.organizationId = this.organization.id;
    component.type = this.activeFilter.cipherType;
    component.collections = (
      await firstValueFrom(this.vaultFilterService.filteredCollections$)
    ).filter((c) => !c.readOnly && c.id != null);
    if (this.activeFilter.collectionId) {
      component.collectionIds = [this.activeFilter.collectionId];
    }
  }

  async editCipher(cipher: CipherView) {
    return this.editCipherId(cipher?.id);
  }

  async editCipherId(cipherId: string) {
    const cipher = await this.cipherService.get(cipherId);
    if (cipher != null && cipher.reprompt != 0) {
      if (!(await this.passwordRepromptService.showPasswordPrompt())) {
        this.go({ cipherId: null, itemId: null });
        return;
      }
    }

    const [modal, childComponent] = await this.modalService.openViewRef(
      AddEditComponent,
      this.cipherAddEditModalRef,
      (comp) => {
        comp.organization = this.organization;
        comp.cipherId = cipherId;
        // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
        comp.onSavedCipher.subscribe(async () => {
          modal.close();
          await this.ciphersComponent.refresh();
        });
        // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
        comp.onDeletedCipher.subscribe(async () => {
          modal.close();
          await this.ciphersComponent.refresh();
        });
        // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
        comp.onRestoredCipher.subscribe(async () => {
          modal.close();
          await this.ciphersComponent.refresh();
        });
      }
    );

    modal.onClosedPromise().then(() => {
      this.go({ cipherId: null, itemId: null });
    });

    return childComponent;
  }

  async cloneCipher(cipher: CipherView) {
    const component = await this.editCipher(cipher);
    component.cloneMode = true;
    component.organizationId = this.organization.id;
    component.collections = (
      await firstValueFrom(this.vaultFilterService.filteredCollections$)
    ).filter((c) => !c.readOnly && c.id != null);
    component.collectionIds = cipher.collectionIds;
  }

  async viewEvents(cipher: CipherView) {
    await this.modalService.openViewRef(EntityEventsComponent, this.eventsModalRef, (comp) => {
      comp.name = cipher.name;
      comp.organizationId = this.organization.id;
      comp.entityId = cipher.id;
      comp.showUser = true;
      comp.entity = "cipher";
    });
  }

  get breadcrumbs(): TreeNode<CollectionFilter>[] {
    if (!this.activeFilter.selectedCollectionNode) {
      return [];
    }

    const collections = [this.activeFilter.selectedCollectionNode];
    while (collections[collections.length - 1].parent != undefined) {
      collections.push(collections[collections.length - 1].parent);
    }

    return collections
      .map((c) => c)
      .slice(1, -1) // 1 for self, -1 for "top collections node"
      .reverse();
  }

  protected applyCollectionFilter(collection: TreeNode<CollectionFilter>) {
    const filter = this.activeFilter;
    filter.resetFilter();
    filter.selectedCollectionNode = collection;
    this.applyVaultFilter(filter);
  }

  private go(queryParams: any = null) {
    if (queryParams == null) {
      queryParams = {
        type: this.activeFilter.cipherType,
        collectionId: this.activeFilter.collectionId,
        deleted: this.activeFilter.isDeleted || null,
      };
    }

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: queryParams,
      queryParamsHandling: "merge",
      replaceUrl: true,
    });
  }
}

/**
 * Allows backwards compatibility with
 * old links that used the original `cipherId` param
 */
const getCipherIdFromParams = (params: Params): string => {
  return params["itemId"] || params["cipherId"];
};
