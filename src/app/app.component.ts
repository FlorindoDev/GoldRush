import { ChangeDetectionStrategy, Component } from '@angular/core';
import { HudComponent } from './hud/hud.component';

@Component({
  selector: 'app-root',
  imports: [HudComponent],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {}
