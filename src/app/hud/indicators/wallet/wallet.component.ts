import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { GAME_BALANCE } from '../../../config/game-balance';
import { satoshisToEuros } from '../../../game/electricity';
import { GameService } from '../../../game/game.service';
import { BitcoinModelComponent } from '../bitcoin-model/bitcoin-model.component';

const euros = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });

@Component({
  selector: 'app-wallet',
  imports: [BitcoinModelComponent],
  templateUrl: './wallet.component.html',
  styleUrl: './wallet.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WalletComponent {
  readonly game = inject(GameService);
  readonly displayedSatoshis = signal(0);
  readonly stage = signal<'idle' | 'reward' | 'bill' | 'net'>('idle');
  readonly receiptVisible = signal(false);
  readonly settlement = computed(() => this.game.world().lastSettlement);
  readonly formatEuros = (amount: number) => euros.format(amount);
  readonly bitcoin = computed(() =>
    (this.displayedSatoshis() / GAME_BALANCE.world.satoshisPerBitcoin).toFixed(8),
  );
  readonly euroBalance = computed(() =>
    this.formatEuros(satoshisToEuros(this.displayedSatoshis())),
  );
  readonly price = this.formatEuros(GAME_BALANCE.economy.bitcoinPriceEur);
  readonly toEuros = satoshisToEuros;

  constructor() {
    effect((onCleanup) => {
      const settlement = this.settlement();
      this.receiptVisible.set(Boolean(settlement));
      if (!settlement) {
        this.displayedSatoshis.set(this.game.world().satoshis);
        this.stage.set('idle');
        return;
      }
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      let frame = 0;
      const start = performance.now();
      const gross = settlement.balanceBeforeSatoshis + settlement.rewardSatoshis;
      const animate = (now: number) => {
        const elapsed = now - start;
        if (reducedMotion || elapsed >= 2300) {
          this.displayedSatoshis.set(settlement.balanceAfterSatoshis);
          this.stage.set('net');
          return;
        }
        const billing = elapsed >= 1100;
        this.stage.set(billing ? 'bill' : 'reward');
        const progress = Math.min(1, (elapsed - (billing ? 1100 : 0)) / (billing ? 1000 : 700));
        const eased = 1 - (1 - progress) ** 3;
        const from = billing ? gross : settlement.balanceBeforeSatoshis;
        const to = billing ? settlement.balanceAfterSatoshis : gross;
        this.displayedSatoshis.set(Math.round(from + (to - from) * eased));
        frame = requestAnimationFrame(animate);
      };
      animate(start);
      const dismiss = setTimeout(() => this.receiptVisible.set(false), 7000);
      onCleanup(() => {
        cancelAnimationFrame(frame);
        clearTimeout(dismiss);
      });
    });
  }
}
