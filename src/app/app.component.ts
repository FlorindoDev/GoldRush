import { ChangeDetectionStrategy, Component } from '@angular/core';
import { HudComponent } from './hud/hud.component';
import { ModelLibraryComponent } from './model-library/model-library.component';

@Component({
  selector: 'app-root',
  imports: [HudComponent, ModelLibraryComponent],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  readonly showModels = new URLSearchParams(window.location.search).has('models');
}
