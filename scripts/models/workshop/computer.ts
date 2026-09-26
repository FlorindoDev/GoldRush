import * as THREE from 'three';
import { createBox, createCanvasTexture, createRod } from './mesh-primitives';

/** Original low-poly workstation. Reference silhouettes documented in computer-design.md. */
export function createComputer(): THREE.Group {
  const root = new THREE.Group();
  const colors = {
    frame: 0x26332c,
    top: 0x69715b,
    shell: 0xc4c3ab,
    dark: 0x252c29,
    keys: 0xdddaca,
    green: 0xb8f575,
  };
  const box = (
    name: string,
    size: [number, number, number],
    color: number,
    position: [number, number, number],
  ) => {
    const mesh = createBox(size, color, position);
    mesh.name = name;
    root.add(mesh);
    return mesh;
  };
  box('desk-top', [4.6, 0.16, 2.7], colors.top, [0, 1.75, 0]);
  box('desk-front-edge', [4.6, 0.08, 0.08], colors.shell, [0, 1.76, 1.35]);
  for (const x of [-2, 2])
    for (const z of [-1.05, 1.05]) {
      box('desk-leg', [0.13, 2.08, 0.13], colors.frame, [x, 0.63, z]);
      box('desk-foot', [0.28, 0.06, 0.3], colors.dark, [x, -0.38, z]);
    }
  box('desk-brace', [4.1, 0.12, 0.12], colors.frame, [0, 0.15, -1.05]);
  box('tower', [0.78, 1.28, 1.35], colors.shell, [1.45, 2.47, -0.3]);
  box('tower-front', [0.65, 1.13, 0.035], colors.dark, [1.45, 2.47, 0.394]);
  box('drive-bay', [0.51, 0.12, 0.05], colors.shell, [1.45, 2.87, 0.42]);
  box('drive-slot', [0.37, 0.015, 0.015], colors.dark, [1.42, 2.88, 0.45]);
  for (let index = 0; index < 8; index++)
    box('tower-vent', [0.44, 0.022, 0.025], 0x687568, [1.45, 2.15 + index * 0.05, 0.425]);
  box('power-button', [0.065, 0.065, 0.04], colors.green, [1.65, 2.72, 0.43]);
  for (const x of [1.25, 1.38])
    box('usb-port', [0.075, 0.032, 0.035], colors.shell, [x, 2.68, 0.43]);
  box('monitor-foot', [0.92, 0.07, 0.6], colors.dark, [-0.52, 1.875, -0.42]);
  box('monitor-stand', [0.18, 0.38, 0.17], colors.dark, [-0.52, 2.08, -0.6]);
  box('monitor-case', [2.05, 1.33, 0.25], colors.shell, [-0.52, 2.79, -0.64]);
  box('screen-bezel', [1.9, 1.14, 0.035], colors.dark, [-0.52, 2.83, -0.498]);
  const screenTexture = createCanvasTexture(640, 360, (ctx) => {
    ctx.fillStyle = '#141a15';
    ctx.fillRect(0, 0, 640, 360);
    ctx.fillStyle = '#263022';
    ctx.fillRect(0, 0, 640, 42);
    ctx.fillStyle = '#b8f575';
    ctx.font = '600 18px Segoe UI, sans-serif';
    ctx.fillText('LAB / PC', 22, 28);
    ctx.fillStyle = '#f1f0e8';
    ctx.font = '600 26px Segoe UI, sans-serif';
    ctx.fillText('Laboratorio', 36, 106);
    for (let index = 0; index < 2; index++) {
      const x = 36 + index * 294;
      ctx.fillStyle = '#252e23';
      ctx.fillRect(x, 138, 266, 145);
      ctx.strokeStyle = '#637452';
      ctx.strokeRect(x, 138, 266, 145);
      ctx.strokeStyle = '#b8f575';
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 20, 159, 36, 27);
      if (index === 0) {
        ctx.beginPath();
        ctx.moveTo(x + 14, 152);
        ctx.lineTo(x + 20, 159);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(x + 38, 159);
        ctx.lineTo(x + 38, 186);
        ctx.stroke();
      }
      ctx.fillStyle = '#f1f0e8';
      ctx.font = '600 21px Segoe UI, sans-serif';
      ctx.fillText(index === 0 ? 'Shop' : 'Magazzino', x + 20, 227);
      ctx.fillStyle = '#a5ad9e';
      ctx.font = '14px Segoe UI, sans-serif';
      ctx.fillText(index === 0 ? 'Hardware e ricambi' : 'Stock e componenti', x + 20, 255);
    }
    ctx.fillStyle = '#a5ad9e';
    ctx.font = '12px Segoe UI, sans-serif';
    ctx.fillText('BLOCKCRAFT', 36, 331);
  });
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(1.78, 1.001),
    new THREE.MeshBasicMaterial({ map: screenTexture }),
  );
  screen.position.set(-0.52, 2.84, -0.477);
  screen.name = 'computer-screen';
  root.add(screen);
  box('monitor-led', [0.035, 0.016, 0.02], colors.green, [0.3, 2.22, -0.503]);
  box('keyboard', [1.82, 0.075, 0.62], colors.shell, [-0.52, 1.87, 0.65]);
  for (let row = 0; row < 4; row++)
    for (let column = 0; column < 13; column++) {
      box('key', [0.102, 0.022, 0.082], column === 12 ? colors.top : colors.keys, [
        -1.28 + column * 0.125,
        1.921,
        0.43 + row * 0.115,
      ]);
    }
  box('spacebar', [0.73, 0.022, 0.075], colors.keys, [-0.52, 1.921, 0.9]);
  box('mouse-mat', [0.57, 0.015, 0.67], colors.dark, [0.74, 1.843, 0.7]);
  const mouse = new THREE.Mesh(
    new THREE.CylinderGeometry(0.115, 0.14, 0.12, 8),
    new THREE.MeshStandardMaterial({ color: colors.shell, flatShading: true, roughness: 0.9 }),
  );
  mouse.scale.z = 1.5;
  mouse.position.set(0.74, 1.91, 0.65);
  mouse.name = 'mouse';
  root.add(mouse);
  root.add(createRod([0.74, 1.86, 0.47], [0.86, 1.86, 0.04], 0.012, colors.dark));
  root.add(createRod([-0.52, 1.86, 0.33], [-0.52, 1.86, -0.32], 0.016, colors.dark));
  return root;
}
