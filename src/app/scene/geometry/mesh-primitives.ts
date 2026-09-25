import * as THREE from 'three';
const CANVAS_TEXTURE_SCALE = 2;
export const GAME_FONT_FAMILY = '"JetBrains Mono", Consolas, monospace';
const LABEL_FONT = `700 52px ${GAME_FONT_FAMILY}`;

export function createCanvasTexture(
  width: number,
  height: number,
  draw: (context: CanvasRenderingContext2D) => void,
  fontToLoad?: string,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width * CANVAS_TEXTURE_SCALE;
  canvas.height = height * CANVAS_TEXTURE_SCALE;
  const context = canvas.getContext('2d')!;
  context.scale(CANVAS_TEXTURE_SCALE, CANVAS_TEXTURE_SCALE);
  draw(context);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  if (fontToLoad) {
    void document.fonts
      .load(fontToLoad)
      .then(() => {
        draw(context);
        texture.needsUpdate = true;
      })
      .catch(() => {
        // Keep the initial drawing when font loading fails.
      });
  }
  return texture;
}

export function createLabelTexture(text: string, color = '#b8f575'): THREE.CanvasTexture {
  return createCanvasTexture(
    512,
    128,
    (context) => {
      context.fillStyle = '#202c25';
      context.fillRect(0, 0, 512, 128);
      context.fillStyle = color;
      context.font = LABEL_FONT;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(text, 256, 66);
    },
    LABEL_FONT,
  );
}
