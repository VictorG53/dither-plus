// Each algorithm receives an ImageData clone (RGBA) plus options and mutates it in place.

function toGrayscale(data) {
  const gray = new Float32Array(data.length / 4);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return gray;
}

function applyBias(buf, bias) {
  if (!bias) return;
  for (let i = 0; i < buf.length; i++) buf[i] += bias;
}

function writeGray(data, gray, palette) {
  if (palette) {
    const [lr, lg, lb] = palette.low;
    const [hr, hg, hb] = palette.high;
    for (let p = 0, i = 0; p < gray.length; p++, i += 4) {
      const v = gray[p] < 0 ? 0 : gray[p] > 255 ? 255 : gray[p];
      const t = v / 255;
      data[i] = lr + (hr - lr) * t;
      data[i + 1] = lg + (hg - lg) * t;
      data[i + 2] = lb + (hb - lb) * t;
    }
    return;
  }
  for (let p = 0, i = 0; p < gray.length; p++, i += 4) {
    const v = gray[p] < 0 ? 0 : gray[p] > 255 ? 255 : gray[p];
    data[i] = data[i + 1] = data[i + 2] = v;
  }
}

function writeColorChannel(data, channelVals, channelOffset) {
  for (let p = 0, i = channelOffset; p < channelVals.length; p++, i += 4) {
    const v = channelVals[p] < 0 ? 0 : channelVals[p] > 255 ? 255 : channelVals[p];
    data[i] = v;
  }
}

function errorDiffusion(imageData, kernel, { color = false, levels = 2, palette = null, bias = 0 } = {}) {
  const { width, height, data } = imageData;
  const steps = levels - 1;
  const quantize = (v) => Math.round((Math.round((v / 255) * steps) / steps) * 255);

  const channels = color ? [0, 1, 2] : [null];

  for (const ch of channels) {
    const buf = new Float32Array(width * height);
    if (color) {
      for (let p = 0, i = ch; p < buf.length; p++, i += 4) buf[p] = data[i];
    } else {
      const gray = toGrayscale(data);
      buf.set(gray);
    }
    applyBias(buf, bias);

    for (let y = 0; y < height; y++) {
      const serpentine = kernel.serpentine && y % 2 === 1;
      for (let xi = 0; xi < width; xi++) {
        const x = serpentine ? width - 1 - xi : xi;
        const idx = y * width + x;
        const old = buf[idx];
        const nw = quantize(old);
        buf[idx] = nw;
        const err = old - nw;
        for (const [dx, dy, w] of kernel.offsets) {
          const ddx = serpentine ? -dx : dx;
          const nx = x + ddx;
          const ny = y + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            buf[ny * width + nx] += err * w;
          }
        }
      }
    }

    if (color) {
      writeColorChannel(data, buf, ch);
    } else {
      writeGray(data, buf, palette);
    }
  }
}

const KERNELS = {
  floydSteinberg: {
    serpentine: false,
    offsets: [
      [1, 0, 7 / 16],
      [-1, 1, 3 / 16],
      [0, 1, 5 / 16],
      [1, 1, 1 / 16],
    ],
  },
  atkinson: {
    serpentine: false,
    offsets: [
      [1, 0, 1 / 8],
      [2, 0, 1 / 8],
      [-1, 1, 1 / 8],
      [0, 1, 1 / 8],
      [1, 1, 1 / 8],
      [0, 2, 1 / 8],
    ],
  },
  jarvisJudiceNinke: {
    serpentine: false,
    offsets: [
      [1, 0, 7 / 48],
      [2, 0, 5 / 48],
      [-2, 1, 3 / 48],
      [-1, 1, 5 / 48],
      [0, 1, 7 / 48],
      [1, 1, 5 / 48],
      [2, 1, 3 / 48],
      [-2, 2, 1 / 48],
      [-1, 2, 3 / 48],
      [0, 2, 5 / 48],
      [1, 2, 3 / 48],
      [2, 2, 1 / 48],
    ],
  },
  stucki: {
    serpentine: false,
    offsets: [
      [1, 0, 8 / 42],
      [2, 0, 4 / 42],
      [-2, 1, 2 / 42],
      [-1, 1, 4 / 42],
      [0, 1, 8 / 42],
      [1, 1, 4 / 42],
      [2, 1, 2 / 42],
      [-2, 2, 1 / 42],
      [-1, 2, 2 / 42],
      [0, 2, 4 / 42],
      [1, 2, 2 / 42],
      [2, 2, 1 / 42],
    ],
  },
  burkes: {
    serpentine: false,
    offsets: [
      [1, 0, 8 / 32],
      [2, 0, 4 / 32],
      [-2, 1, 2 / 32],
      [-1, 1, 4 / 32],
      [0, 1, 8 / 32],
      [1, 1, 4 / 32],
      [2, 1, 2 / 32],
    ],
  },
  sierra: {
    serpentine: false,
    offsets: [
      [1, 0, 5 / 32],
      [2, 0, 3 / 32],
      [-2, 1, 2 / 32],
      [-1, 1, 4 / 32],
      [0, 1, 5 / 32],
      [1, 1, 4 / 32],
      [2, 1, 2 / 32],
      [-1, 2, 2 / 32],
      [0, 2, 3 / 32],
      [1, 2, 2 / 32],
    ],
  },
  sierraLite: {
    serpentine: false,
    offsets: [
      [1, 0, 2 / 4],
      [-1, 1, 1 / 4],
      [0, 1, 1 / 4],
    ],
  },
};

const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

const BAYER_8X8 = (() => {
  // Recursively build 8x8 Bayer matrix from 4x4 base.
  const n = 4;
  const base = BAYER_4X4;
  const size = 8;
  const m = Array.from({ length: size }, () => new Array(size).fill(0));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const bx = x % n;
      const by = y % n;
      const quadX = Math.floor(x / n);
      const quadY = Math.floor(y / n);
      const quad = quadY * 2 + quadX;
      m[y][x] = base[by][bx] * 4 + quad;
    }
  }
  return m;
})();

function orderedDither(imageData, { matrix = BAYER_8X8, color = false, levels = 2, palette = null, bias = 0 } = {}) {
  const { width, height, data } = imageData;
  const size = matrix.length;
  const maxVal = size * size;
  const steps = levels - 1;

  const applyChannel = (buf) => {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const threshold = ((matrix[y % size][x % size] + 0.5) / maxVal - 0.5) * (255 / steps);
        const v = buf[idx] + threshold;
        const nw = Math.round((Math.round((v / 255) * steps) / steps) * 255);
        buf[idx] = nw;
      }
    }
  };

  if (color) {
    for (const ch of [0, 1, 2]) {
      const buf = new Float32Array(width * height);
      for (let p = 0, i = ch; p < buf.length; p++, i += 4) buf[p] = data[i];
      applyBias(buf, bias);
      applyChannel(buf);
      writeColorChannel(data, buf, ch);
    }
  } else {
    const buf = toGrayscale(data);
    applyBias(buf, bias);
    applyChannel(buf);
    writeGray(data, buf, palette);
  }
}

function randomDither(imageData, { color = false, levels = 2, palette = null, bias = 0 } = {}) {
  const { width, height, data } = imageData;
  const steps = levels - 1;

  const applyChannel = (buf) => {
    for (let i = 0; i < buf.length; i++) {
      const noise = (Math.random() - 0.5) * (255 / steps);
      const v = buf[i] + noise;
      buf[i] = Math.round((Math.round((v / 255) * steps) / steps) * 255);
    }
  };

  if (color) {
    for (const ch of [0, 1, 2]) {
      const buf = new Float32Array(width * height);
      for (let p = 0, i = ch; p < buf.length; p++, i += 4) buf[p] = data[i];
      applyBias(buf, bias);
      applyChannel(buf);
      writeColorChannel(data, buf, ch);
    }
  } else {
    const buf = toGrayscale(data);
    applyBias(buf, bias);
    applyChannel(buf);
    writeGray(data, buf, palette);
  }
}

function thresholdDither(imageData, { color = false, levels = 2, palette = null, bias = 0 } = {}) {
  const { data } = imageData;
  const steps = levels - 1;
  const quantize = (v) => Math.round((Math.round((v / 255) * steps) / steps) * 255);

  if (color) {
    for (let i = 0; i < data.length; i += 4) {
      data[i] = quantize(data[i] + bias);
      data[i + 1] = quantize(data[i + 1] + bias);
      data[i + 2] = quantize(data[i + 2] + bias);
    }
  } else {
    const gray = toGrayscale(data);
    applyBias(gray, bias);
    for (let p = 0; p < gray.length; p++) gray[p] = quantize(gray[p]);
    writeGray(data, gray, palette);
  }
}

export const ALGORITHMS = {
  none: { label: 'None', fn: null },
  threshold: { label: 'Simple threshold', fn: thresholdDither },
  random: { label: 'Random noise', fn: randomDither },
  bayer4: {
    label: 'Ordered (Bayer 4x4)',
    fn: (img, opts) => orderedDither(img, { ...opts, matrix: BAYER_4X4 }),
  },
  bayer8: {
    label: 'Ordered (Bayer 8x8)',
    fn: (img, opts) => orderedDither(img, { ...opts, matrix: BAYER_8X8 }),
  },
  floydSteinberg: {
    label: 'Floyd–Steinberg',
    fn: (img, opts) => errorDiffusion(img, KERNELS.floydSteinberg, opts),
  },
  atkinson: {
    label: 'Atkinson',
    fn: (img, opts) => errorDiffusion(img, KERNELS.atkinson, opts),
  },
  jarvisJudiceNinke: {
    label: 'Jarvis–Judice–Ninke',
    fn: (img, opts) => errorDiffusion(img, KERNELS.jarvisJudiceNinke, opts),
  },
  stucki: {
    label: 'Stucki',
    fn: (img, opts) => errorDiffusion(img, KERNELS.stucki, opts),
  },
  burkes: {
    label: 'Burkes',
    fn: (img, opts) => errorDiffusion(img, KERNELS.burkes, opts),
  },
  sierra: {
    label: 'Sierra',
    fn: (img, opts) => errorDiffusion(img, KERNELS.sierra, opts),
  },
  sierraLite: {
    label: 'Sierra Lite',
    fn: (img, opts) => errorDiffusion(img, KERNELS.sierraLite, opts),
  },
};

export function applyDither(imageData, algorithmKey, options) {
  const algo = ALGORITHMS[algorithmKey];
  if (!algo || !algo.fn) return imageData;
  algo.fn(imageData, options);
  return imageData;
}
