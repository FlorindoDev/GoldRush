export interface PlacementItem {
  readonly stockId: number;
  readonly kind: 'rig' | 'gpu';
}

export const PLACEMENT_MIME = 'application/x-goldrush-placement';
export const PLACED_MIME = 'application/x-goldrush-placed';
