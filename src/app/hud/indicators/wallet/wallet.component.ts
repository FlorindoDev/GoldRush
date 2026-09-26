import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  OnDestroy,
  signal,
} from '@angular/core';
import { GAME_BALANCE } from '../../../config/game-balance';
import { CRYPTO_CONFIG } from '../../../config/crypto-config';
import { satoshisToEuros, type MiningSettlement } from '../../../game/electricity';
import { GameService } from '../../../game/game.service';
import { IconComponent } from '../../icons/icon.component';
import { BitcoinModelComponent } from '../bitcoin-model/bitcoin-model.component';

const euros = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });
const quantities = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 8 });
const CLOCK_REFRESH_MS = 200;

@Component({
  selector: 'app-wallet',
  imports: [BitcoinModelComponent, IconComponent],
  templateUrl: './wallet.component.html',
  styleUrl: './wallet.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WalletComponent implements OnDestroy {
  readonly game = inject(GameService);
  readonly expanded = signal(false);
  readonly assets = computed(() =>
    CRYPTO_CONFIG.map((crypto) => ({
      ...crypto,
      quantity: this.game.world().holdings[crypto.id] ?? 0,
      valueEur: (this.game.world().holdings[crypto.id] ?? 0) * crypto.priceEur,
    })).filter((crypto) => crypto.quantity > 0),
  );
  readonly formatQuantity = (amount: number) => quantities.format(amount);
  private clockUpdatedAt = performance.now();
  private readonly clockTimer = setInterval(() => {
    const now = performance.now();
    this.game.advanceGameTime(now - this.clockUpdatedAt);
    this.clockUpdatedAt = now;
  }, CLOCK_REFRESH_MS);
  private readonly animatedBalance = signal<{ amountEur: number; targetEur: number } | null>(null);
  readonly displayedEuros = computed(() => {
    const balance = this.game.balanceEur();
    const animation = this.animatedBalance();
    return animation && Math.abs(balance - animation.targetEur) <= 0.000001
      ? animation.amountEur
      : balance;
  });
  readonly stage = signal<'idle' | 'reward' | 'bill' | 'net'>('idle');
  readonly receiptVisible = signal(false);
  readonly billVisible = signal(false);
  readonly settlement = computed(() => this.game.world().lastSettlement);
  readonly dailyBill = computed(() => this.game.world().lastElectricityBill);
  readonly gameDay = computed(
    () => Math.floor(this.game.gameElapsedMinutes() / GAME_BALANCE.clock.minutesPerDay) + 1,
  );
  readonly gameDayLabel = computed(() => String(this.gameDay()).padStart(2, '0'));
  readonly gameTime = computed(() => {
    const totalMinutes = Math.floor(this.game.gameElapsedMinutes());
    const minutesToday = totalMinutes % GAME_BALANCE.clock.minutesPerDay;
    const hours = Math.floor(minutesToday / 60);
    const minutes = minutesToday % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  });
  readonly formatEuros = (amount: number) => euros.format(amount);
  readonly euroBalance = computed(() => this.formatEuros(this.displayedEuros()));
  readonly toEuros = satoshisToEuros;
  private lastAnimatedSettlement: MiningSettlement | null = null;

  constructor() {
    effect((onCleanup) => {
      const settlement = this.settlement();
      this.dailyBill();
      if (settlement === this.lastAnimatedSettlement) {
        this.animatedBalance.set(null);
        return;
      }
      this.lastAnimatedSettlement = settlement;
      this.receiptVisible.set(Boolean(settlement));
      if (!settlement) {
        this.animatedBalance.set(null);
        this.stage.set('idle');
        return;
      }
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      let frame = 0;
      const start = performance.now();
      const animate = (now: number) => {
        const elapsed = now - start;
        if (reducedMotion || elapsed >= 1000) {
          this.animatedBalance.set(null);
          this.stage.set(this.billVisible() ? 'bill' : 'net');
          return;
        }
        this.stage.set('reward');
        const progress = Math.min(1, elapsed / 1000);
        const eased = 1 - (1 - progress) ** 3;
        this.animatedBalance.set({
          amountEur:
            settlement.balanceBeforeEur +
            (settlement.balanceAfterEur - settlement.balanceBeforeEur) * eased,
          targetEur: settlement.balanceAfterEur,
        });
        frame = requestAnimationFrame(animate);
      };
      this.animatedBalance.set({
        amountEur: settlement.balanceBeforeEur,
        targetEur: settlement.balanceAfterEur,
      });
      animate(start);
      const dismiss = setTimeout(() => this.receiptVisible.set(false), 7000);
      onCleanup(() => {
        cancelAnimationFrame(frame);
        clearTimeout(dismiss);
      });
    });

    effect((onCleanup) => {
      const bill = this.dailyBill();
      if (!bill) {
        this.billVisible.set(false);
        if (this.stage() === 'bill') {
          this.stage.set('idle');
        }
        return;
      }

      this.animatedBalance.set(null);
      this.stage.set('bill');
      this.receiptVisible.set(false);
      this.billVisible.set(true);
      const dismiss = setTimeout(() => {
        this.billVisible.set(false);
        this.stage.set('idle');
      }, 7000);
      onCleanup(() => clearTimeout(dismiss));
    });
  }

  ngOnDestroy(): void {
    clearInterval(this.clockTimer);
  }
}
