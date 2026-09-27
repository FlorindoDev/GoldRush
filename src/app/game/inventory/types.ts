import type { CryptoId } from '../../config/crypto-config';
import type { ShopProduct } from '../../config/shop-config';
import type { RigSetup } from '../../config/rig-config';
import type { GpuOperatingState } from '../gpu-operation';

export interface StockRigGpu {
  readonly state: GpuOperatingState;
  readonly cryptoId: CryptoId;
}

export interface StockRig {
  readonly setup: RigSetup;
  /** Indice nell'array = posizione dello slot nel RIG. */
  readonly gpus: readonly (StockRigGpu | null)[];
  readonly isNew?: boolean;
}

export interface StockItem {
  readonly id: number;
  readonly productId: string;
  readonly gpu?: GpuOperatingState;
  readonly rig?: StockRig;
}

export interface Inventory {
  readonly items: readonly StockItem[];
  readonly nextId: number;
}

export interface CartLine {
  readonly productId: string;
  readonly quantity: number;
}

export interface InventoryEntry {
  readonly key: string;
  readonly product: ShopProduct;
  readonly quantity: number;
  readonly condition: 'new' | 'used' | 'broken';
  readonly location: string;
  readonly stockId?: number;
  readonly gpuId?: number;
  readonly rigId?: number;
  readonly gpu?: GpuOperatingState;
  readonly rig?: StockRig;
}

export interface InventoryGroup {
  readonly key: string;
  readonly product: ShopProduct;
  readonly condition: InventoryEntry['condition'];
  readonly entries: readonly InventoryEntry[];
  readonly quantity: number;
}
