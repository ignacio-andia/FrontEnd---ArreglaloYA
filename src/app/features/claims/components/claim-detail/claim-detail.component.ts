import { DatePipe } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { ImageGalleryComponent } from '../../../../shared/components/image-gallery/image-gallery.component';
import { ImageLoader } from '../../../../shared/components/private-image/private-image.component';
import { DISPLAY_TIMEZONE } from '../../../../shared/utils/display-timezone';
import { CLAIM_STATUS_LABELS, Claim } from '../../models/claim.model';
import { ClaimsApiService } from '../../services/claims-api.service';

/**
 * Reclamo completo: estado, fechas, descripción, fotografías y, si está resuelto, la decisión y
 * su justificación. Solo para el cliente que lo presentó y el administrador.
 */
@Component({
  selector: 'app-claim-detail',
  imports: [DatePipe, ImageGalleryComponent],
  templateUrl: './claim-detail.component.html',
  styleUrl: './claim-detail.component.scss',
})
export class ClaimDetailComponent {
  private readonly claimsApi = inject(ClaimsApiService);

  readonly claim = input.required<Claim>();

  protected readonly labels = CLAIM_STATUS_LABELS;
  protected readonly timezone = DISPLAY_TIMEZONE;
  private readonly claimId = computed(() => this.claim().id);
  protected readonly loader = computed((): ImageLoader => {
    const claimId = this.claimId();
    return (imageId, variant) => this.claimsApi.getImage(claimId, imageId, variant);
  });
}
