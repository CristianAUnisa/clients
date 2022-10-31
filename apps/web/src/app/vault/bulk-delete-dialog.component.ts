import { DialogRef, DIALOG_DATA } from "@angular/cdk/dialog";
import { Component, Inject } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { CipherService } from "@bitwarden/common/abstractions/cipher.service";
import { I18nService } from "@bitwarden/common/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/abstractions/platformUtils.service";
import { Organization } from "@bitwarden/common/models/domain/organization";
import { CipherBulkDeleteRequest } from "@bitwarden/common/models/request/cipher-bulk-delete.request";
import { CollectionBulkDeleteRequest } from "@bitwarden/common/models/request/collection-bulk-delete.request";

export interface BulkDeleteDialogParams {
  cipherIds?: string[];
  collectionIds?: string[];
  permanent?: boolean;
  organization?: Organization;
}

export enum BulkDeleteDialogResult {
  Deleted = "deleted",
  Canceled = "canceled",
}
@Component({
  selector: "app-vault-bulk-delete",
  templateUrl: "bulk-delete-dialog.component.html",
})
export class BulkDeleteDialogComponent {
  cipherIds: string[];
  collectionIds: string[];
  permanent = false;
  organization: Organization;

  formPromise: Promise<any>;

  constructor(
    @Inject(DIALOG_DATA) params: BulkDeleteDialogParams,
    private dialogRef: DialogRef<BulkDeleteDialogResult>,
    private cipherService: CipherService,
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService,
    private apiService: ApiService
  ) {
    this.cipherIds = params.cipherIds ?? [];
    this.collectionIds = params.collectionIds ?? [];
    this.permanent = params.permanent;
    this.organization = params.organization;
  }

  protected async cancel() {
    this.close(BulkDeleteDialogResult.Canceled);
  }

  protected submit = async () => {
    const deletePromises: Promise<void>[] = [];
    if (this.cipherIds.length) {
      if (!this.organization || !this.organization.canEditAnyCollection) {
        deletePromises.push(this.deleteCiphers());
      } else {
        deletePromises.push(this.deleteCiphersAdmin());
      }
    }

    if (this.collectionIds.length && this.organization) {
      deletePromises.push(this.deleteCollections());
    }

    this.formPromise = Promise.all(deletePromises);
    await this.formPromise;

    if (this.cipherIds.length) {
      this.platformUtilsService.showToast(
        "success",
        null,
        this.i18nService.t(this.permanent ? "permanentlyDeletedItems" : "deletedItems")
      );
    }
    if (this.collectionIds.length) {
      this.platformUtilsService.showToast(
        "success",
        null,
        this.i18nService.t("deletedCollections")
      );
    }
    this.close(BulkDeleteDialogResult.Deleted);
  };

  private async deleteCiphers(): Promise<any> {
    if (this.permanent) {
      await this.cipherService.deleteManyWithServer(this.cipherIds);
    } else {
      await this.cipherService.softDeleteManyWithServer(this.cipherIds);
    }
  }

  private async deleteCiphersAdmin(): Promise<any> {
    const deleteRequest = new CipherBulkDeleteRequest(this.cipherIds, this.organization.id);
    if (this.permanent) {
      return await this.apiService.deleteManyCiphersAdmin(deleteRequest);
    } else {
      return await this.apiService.putDeleteManyCiphersAdmin(deleteRequest);
    }
  }

  private async deleteCollections(): Promise<any> {
    if (!this.organization.canDeleteAssignedCollections) {
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccurred"),
        this.i18nService.t("missingPermissions")
      );
      return;
    }
    const deleteRequest = new CollectionBulkDeleteRequest(this.collectionIds, this.organization.id);
    return await this.apiService.deleteManyCollections(deleteRequest);
  }

  private close(result: BulkDeleteDialogResult) {
    this.dialogRef.close(result);
  }
}