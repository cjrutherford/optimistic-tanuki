export type CampaignLifecycleStatus =
  | 'draft'
  | 'active'
  | 'paused'
  | 'archived';

export type CampaignTargetType = 'channel' | 'community';

export type CampaignPlacementType =
  | 'pre-roll'
  | 'mid-roll'
  | 'post-roll'
  | 'on-page';

export interface CampaignTargetPlacementInput {
  targetType: CampaignTargetType;
  placementType: CampaignPlacementType;
}

export const isValidCampaignTargetPlacement = ({
  targetType,
  placementType,
}: CampaignTargetPlacementInput): boolean =>
  targetType === 'channel' || placementType === 'on-page';

export interface CampaignCreativeDto {
  placementType: CampaignPlacementType;
  headline?: string | null;
  body?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  imageUrl?: string | null;
}

export interface CampaignTargetPlacementDto
  extends CampaignTargetPlacementInput {
  targetId: string;
}

export interface AdvertisingCampaignDto {
  id: string;
  businessPageId: string;
  name: string;
  status: CampaignLifecycleStatus;
  budget?: number | null;
  startsAt: string;
  endsAt: string;
  creatives: CampaignCreativeDto[];
  targetPlacements: CampaignTargetPlacementDto[];
}
