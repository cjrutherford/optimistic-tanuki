import { Component, OnInit, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  CardComponent,
  ButtonComponent,
  BadgeComponent,
} from '@optimistic-tanuki/common-ui';
import {
  EstimateCalculation,
  EstimateParameters,
  PropertyOrVehicleSize,
  ServicePackage,
  ServicePackageTier,
  SurfaceCondition,
} from '../../models/field-flow.models';
import { FieldFlowApiService } from '../../services/field-flow-api.service';
import { BrandConfigService } from '@optimistic-tanuki/whitebox-brand-config';

@Component({
  selector: 'flow-estimate',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardComponent,
    ButtonComponent,
    BadgeComponent,
  ],
  templateUrl: './estimate.component.html',
  styleUrl: './estimate.component.scss',
})
export class EstimateComponent implements OnInit {
  private readonly router = inject(Router);
  readonly apiService = inject(FieldFlowApiService);
  readonly brandConfig = inject(BrandConfigService);

  get availableServices(): ServicePackage[] {
    return this.apiService.getTenantServices();
  }

  // Selected parameters
  selectedPackage: ServicePackageTier = '';
  selectedSize: PropertyOrVehicleSize = 'midsize';
  selectedCondition: SurfaceCondition = 'moderate';
  squareFootage = 800;

  calculation!: EstimateCalculation;
  formError = '';

  constructor() {
    effect(() => {
      if (this.brandConfig.resolutionState() === 'resolved') {
        this.recalculate();
      }
    });
  }

  ngOnInit(): void {
    const services = this.availableServices;
    if (services.length > 0) {
      this.selectedPackage = services[1]?.id || services[0]?.id;
    }
    this.recalculate();
  }

  get tenantResolutionState() {
    return this.apiService.tenantResolutionState();
  }

  get tenantResolutionError(): string | null {
    return this.apiService.tenantResolutionError();
  }

  get isBrandResolved(): boolean {
    return this.brandConfig.getResolvedBrand() !== null;
  }

  onPackageSelect(tier: ServicePackageTier): void {
    this.selectedPackage = tier;
    this.recalculate();
  }

  onSizeSelect(size: PropertyOrVehicleSize): void {
    this.selectedSize = size;
    this.recalculate();
  }

  onConditionSelect(condition: SurfaceCondition): void {
    this.selectedCondition = condition;
    this.recalculate();
  }

  onSqftChange(): void {
    this.recalculate();
  }

  recalculate(): void {
    this.formError = '';
    const services = this.availableServices;
    if (!this.selectedPackage && services.length > 0) {
      this.selectedPackage = services[0].id;
    }

    const params: EstimateParameters = {
      servicePackage: this.selectedPackage,
      size: this.selectedSize,
      condition: this.selectedCondition,
      squareFootage: this.squareFootage,
      tradeType: this.brandConfig.getResolvedBrand()?.tradeCategory ?? '',
    };
    this.calculation = this.apiService.calculateEstimate(params);
  }

  proceedToBooking(): void {
    this.formError = '';
    if (!this.isBrandResolved) {
      this.formError = 'Loading service profile. Please try again shortly.';
      return;
    }
    const params: EstimateParameters = {
      servicePackage: this.selectedPackage,
      size: this.selectedSize,
      condition: this.selectedCondition,
      squareFootage: this.squareFootage,
      tradeType: this.brandConfig.getResolvedBrand()?.tradeCategory ?? '',
    };

    this.apiService.dispatchEstimate(params, this.calculation).subscribe({
      next: () => {
        this.calculation = this.apiService.calculateEstimate(params);
        void this.router.navigate(['/book']);
      },
      error: (error: unknown) => {
        this.formError =
          error instanceof Error && error.message
            ? `Unable to load estimate: ${error.message}`
            : 'Unable to load estimate. Please try again.';
      },
    });
  }
}
