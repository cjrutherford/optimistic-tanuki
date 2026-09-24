import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  EstimateCalculation,
  EstimateParameters,
  PropertyOrVehicleSize,
  ServicePackageTier,
  SurfaceCondition,
} from '../../models/field-flow.models';
import {
  FieldFlowApiService,
  SERVICE_PACKAGES,
} from '../../services/field-flow-api.service';
import { BrandConfigService } from '../../services/brand-config.service';

@Component({
  selector: 'flow-estimate',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './estimate.component.html',
  styleUrl: './estimate.component.scss',
})
export class EstimateComponent implements OnInit {
  private readonly router = inject(Router);
  readonly apiService = inject(FieldFlowApiService);
  readonly brandConfig = inject(BrandConfigService);

  readonly packageTiers: ServicePackageTier[] = [
    'standard',
    'premium',
    'restoration',
  ];
  readonly packages = SERVICE_PACKAGES;

  // Selected parameters
  selectedPackage: ServicePackageTier = 'premium';
  selectedSize: PropertyOrVehicleSize = 'midsize';
  selectedCondition: SurfaceCondition = 'moderate';
  squareFootage = 800;

  calculation!: EstimateCalculation;

  ngOnInit(): void {
    this.recalculate();
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
    const params: EstimateParameters = {
      servicePackage: this.selectedPackage,
      size: this.selectedSize,
      condition: this.selectedCondition,
      squareFootage: this.squareFootage,
      tradeType: this.brandConfig.currentBrand().tradeCategory,
    };
    this.calculation = this.apiService.calculateEstimate(params);
  }

  proceedToBooking(): void {
    const params: EstimateParameters = {
      servicePackage: this.selectedPackage,
      size: this.selectedSize,
      condition: this.selectedCondition,
      squareFootage: this.squareFootage,
      tradeType: this.brandConfig.currentBrand().tradeCategory,
    };

    this.apiService.dispatchEstimate(params, this.calculation).subscribe({
      next: () => {
        void this.router.navigate(['/book']);
      },
      error: () => {
        void this.router.navigate(['/book']);
      },
    });
  }
}
