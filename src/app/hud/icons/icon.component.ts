import { ChangeDetectionStrategy, Component, input } from '@angular/core';

const PATHS: Record<string, string | readonly string[]> = {
  cube: 'm12 3 9 5v8l-9 5-9-5V8l9-5Zm0 0v9m9-4-9 4-9-4m9 4v9',
  code: 'm8 7-5 5 5 5m8-10 5 5-5 5M14 4l-4 16',
  terminal: 'm4 6 6 6-6 6m9 0h7',
  play: 'm8 4 12 8-12 8V4Z',
  start: 'M7 4.5a1 1 0 0 1 1.5-.86l11 6.36a2.3 2.3 0 0 1 0 4l-11 6.36a1 1 0 0 1-1.5-.86v-15Z',
  step: ['M5 5l10 7-10 7V5Z', 'M19 5v14'],
  resize: 'M7 20 20 7M13 20l7-7M19 20l1-1',
  resizeY: 'M6 10h12M6 14h12M12 6V3m0 0-3 3m3-3 3 3m-3 12v3m0 0-3-3m3 3 3-3',
  indent: 'M4 6h16M10 10h10M10 14h10M10 18h10M4 9l3 3-3 3',
  stop: 'M6 6h12v12H6V6Z',
  arrow: 'M4 12h16m-6-6 6 6-6 6',
  book: 'M12 5v16m0-16C8 2 4 3 2 4v15c4-2 7-1 10 2 3-3 6-4 10-2V4c-2-1-6-2-10 1Z',
  gpu: 'M4 6h16v12H4V6ZM1 9h3m-3 6h3m16-6h3m-3 6h3M8 10h3v4H8v-4Zm7 0h2v4h-2v-4ZM7 3v3m5-3v3m5-3v3M7 18v3m5-3v3m5-3v3',
  rack: 'M4 3h16v7H4V3Zm0 11h16v7H4v-7ZM7 6h.01M7 17h.01M11 6h6M11 17h6',
  camcorder: 'M3 7h11v10H3V7Zm11 3 7-4v12l-7-4',
  video:
    'M3 10h12v10H3V10Zm12 3 6-3v10l-6-3M8 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM15 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  tool: 'M14.7 6.3a5 5 0 0 0-6.4 6.4L3 18a2.1 2.1 0 0 0 3 3l5.3-5.3a5 5 0 0 0 6.4-6.4l-3 3-3-3 3-3Z',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  focus: 'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M8 8h8v8H8V8Z',
  rotate: 'M3 10a9 9 0 1 1 1 7M3 3v7h7',
  chevron: 'm8 5 7 7-7 7',
  down: 'm6 9 6 6 6-6',
  close: 'M5 5l14 14M19 5 5 19',
  check: 'm5 12 4 4L19 6',
  lock: 'M6 10h12v11H6V10Zm2 0V6a4 4 0 0 1 8 0v4m-4 5v2',
  bolt: 'm13 2-9 12h7l-1 8 10-13h-7l1-7Z',
  info: 'M12 11v6m0-10v.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',
  mouse: 'M12 2a7 7 0 0 0-7 7v6a7 7 0 0 0 14 0V9a7 7 0 0 0-7-7Zm0 0v7',
  wallet: 'M20 8H5a3 3 0 0 1 0-6h13v6M2 5v14a3 3 0 0 0 3 3h15V8m-4 5h6v5h-6v-5Z',
  layers: 'm12 3 10 5-10 5L2 8l10-5ZM2 12l10 5 10-5M2 16l10 5 10-5',
  flag: 'M5 21V3m0 1c6-4 8 4 14 0v10c-6 4-8-4-14 0',
  external: 'M14 3h7v7m0-7L10 14m0-11H3v18h18v-7',
  settings: [
    'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
    'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.67 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1.08 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 20.33 9c.2.63.8 1.04 1.46 1H22a2 2 0 1 1 0 4h-.09c-.66 0-1.26.41-1.51 1Z',
  ],
  dock: 'M4 4h16v16H4zM4 14h16',
  undock: 'M4 4h16v16H4zM4 9h16',
};

@Component({
  selector: 'app-icon',
  templateUrl: './icon.component.html',
  styleUrl: './icon.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IconComponent {
  readonly name = input('cube');

  paths(): readonly string[] {
    const path = PATHS[this.name()] ?? PATHS['cube'];
    return typeof path === 'string' ? [path] : path;
  }
}
