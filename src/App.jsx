import { useCallback, useEffect, useRef, useState } from 'react';
import { ALGORITHMS, applyDither } from './dither';

const LEVEL_PRESETS = [2, 3, 4, 8, 16];

const COLOR_MODES = [
  { key: 'grayscale', label: 'Grayscale' },
  { key: 'rgb', label: 'RGB' },
  { key: 'custom', label: 'Custom' },
];

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function Panel({ title, children, className = '' }) {
  return (
    <div className={`flex h-full min-h-0 flex-col ${className}`}>
      {title && (
        <div className="shrink-0 border-b border-black bg-black px-4 py-2">
          <span className="text-[11px] font-medium uppercase tracking-[0.15em] text-white">
            {title}
          </span>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto p-4 [scrollbar-gutter:stable]">{children}</div>
    </div>
  );
}

function ColorSwatch({ label, value, onChange }) {
  return (
    <label className="flex flex-1 cursor-pointer items-center gap-3 border border-black bg-[#f3f2ec] px-2.5 py-2 transition-colors hover:border-[#ff5a1f]">
      <span
        className="relative h-7 w-7 shrink-0 border border-black"
        style={{ backgroundColor: value }}
      >
        <input
          type="color"
          value={value}
          onChange={onChange}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-[10px] uppercase tracking-[0.1em] text-black/50">{label}</span>
        <span className="text-[11px] uppercase tabular-nums">{value}</span>
      </span>
    </label>
  );
}

function Field({ label, value, children, hint }) {
  return (
    <div className="border-t border-black/15 py-4 first:border-t-0 first:pt-0">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[11px] uppercase tracking-[0.15em] text-black/70">{label}</span>
        {value !== undefined && (
          <span className="text-[11px] tabular-nums text-black/50">{value}</span>
        )}
      </div>
      {children}
      {hint && <p className="mt-2 text-[11px] leading-snug text-black/40">{hint}</p>}
    </div>
  );
}

export default function App() {
  const [imageEl, setImageEl] = useState(null);
  const [fileName, setFileName] = useState('');
  const [algorithm, setAlgorithm] = useState('floydSteinberg');
  const [colorMode, setColorMode] = useState('grayscale');
  const color = colorMode === 'rgb';
  const twoTone = colorMode === 'custom';
  const [colorLow, setColorLow] = useState('#000000');
  const [colorHigh, setColorHigh] = useState('#ffffff');
  const [levels, setLevels] = useState(2);
  const [bias, setBias] = useState(0);
  const [scale, setScale] = useState(1);
  const [dragActive, setDragActive] = useState(false);

  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  const loadFile = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImageEl(img);
      setFileName(file.name);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, []);

  const handleFileInput = (e) => {
    loadFile(e.target.files?.[0]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    loadFile(e.dataTransfer.files?.[0]);
  };

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageEl) return;

    const w = Math.max(1, Math.round(imageEl.naturalWidth * scale));
    const h = Math.max(1, Math.round(imageEl.naturalHeight * scale));
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(imageEl, 0, 0, w, h);

    const imageData = ctx.getImageData(0, 0, w, h);
    const palette =
      !color && twoTone ? { low: hexToRgb(colorLow), high: hexToRgb(colorHigh) } : null;
    applyDither(imageData, algorithm, { color, levels, palette, bias });
    ctx.putImageData(imageData, 0, 0);
  }, [imageEl, algorithm, color, levels, scale, twoTone, colorLow, colorHigh, bias]);

  useEffect(() => {
    render();
  }, [render]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const base = fileName.replace(/\.[^.]+$/, '') || 'image';
    const downloadName = `${base}-dither.png`;

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], downloadName, { type: 'image/png' });

      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file] });
          return;
        } catch {
          // user cancelled or share failed, fall back to direct download
        }
      }

      const link = document.createElement('a');
      link.download = downloadName;
      link.href = URL.createObjectURL(blob);
      link.click();
      URL.revokeObjectURL(link.href);
    }, 'image/png');
  };

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[#f3f2ec] text-black">
      <header className="shrink-0 border-b border-black px-4 py-4 sm:px-6 sm:py-5">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-base font-semibold uppercase tracking-[0.1em] sm:text-lg">
            Dither
            <sup className="ml-0.5 text-[#ff5a1f]">+</sup>
          </h1>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl min-h-0 flex-1 flex-col border-black lg:border-x lg:flex-row">
        <section className="flex w-full min-h-0 flex-col border-black max-lg:h-[40%] max-lg:border-b lg:flex-1 lg:overflow-y-auto lg:border-r lg:[scrollbar-gutter:stable]">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative flex min-h-0 flex-1 cursor-pointer items-center justify-center border-b border-black p-3 transition-colors sm:p-4 lg:min-h-[420px] ${
              dragActive ? 'bg-[#ff5a1f]/10' : ''
            }`}
          >
            {imageEl ? (
              <canvas
                ref={canvasRef}
                className="max-h-full max-w-full object-contain"
                style={{
                  aspectRatio: `${imageEl.naturalWidth} / ${imageEl.naturalHeight}`,
                  imageRendering: 'pixelated',
                }}
              />
            ) : (
              <div className="flex items-center gap-2 text-center sm:block">
                <svg
                  className="h-5 w-5 shrink-0 text-black/40 sm:mx-auto sm:mb-2 sm:h-6 sm:w-6"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 16V4m0 0-4 4m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
                  />
                </svg>
                <p className="text-left text-sm font-medium uppercase tracking-[0.1em] sm:mb-1 sm:text-center">
                  Drop an image here
                  <span className="block text-[11px] font-normal normal-case tracking-normal text-black/40 sm:hidden">
                    or tap to choose one
                  </span>
                </p>
                <p className="hidden text-[12px] text-black/40 sm:block">or click to choose one</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileInput}
              className="hidden"
            />
          </div>

          <div className="flex items-stretch justify-between">
            <span className="min-w-0 truncate self-center px-3 py-3 text-[11px] text-black/50 sm:px-4 sm:text-[12px]">
              {fileName || 'No file loaded'}
            </span>
            {imageEl && (
              <button
                onClick={handleDownload}
                className="shrink-0 cursor-pointer border-l border-black bg-black px-3 text-[10px] font-medium uppercase tracking-[0.1em] text-white transition-colors hover:border-[#ff5a1f] hover:bg-[#ff5a1f] sm:px-4 sm:text-[11px] sm:tracking-[0.15em]"
              >
                Download PNG
              </button>
            )}
          </div>
        </section>

        <aside className="w-full min-h-0 max-lg:h-[60%] lg:h-full lg:w-96 lg:shrink-0">
          <Panel title="Settings">
            <Field label="Algorithm">
              <select
                value={algorithm}
                onChange={(e) => setAlgorithm(e.target.value)}
                className="w-full cursor-pointer appearance-none border border-black bg-[#f3f2ec] px-3 py-2 text-[13px] focus:border-[#ff5a1f] focus:outline-none"
              >
                {Object.entries(ALGORITHMS).map(([key, { label }]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Levels per channel" value={levels}>
              <div className="grid grid-cols-5 gap-px bg-black">
                {LEVEL_PRESETS.map((n) => (
                  <button
                    key={n}
                    onClick={() => setLevels(n)}
                    className={`cursor-pointer border border-black py-1.5 text-[12px] font-medium transition-colors ${
                      levels === n
                        ? 'bg-black text-white'
                        : 'bg-[#f3f2ec] text-black/70 hover:bg-black hover:text-white'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </Field>

            <Field
              label="Black / white balance"
              value={bias > 0 ? `+${bias}` : bias}
              hint="Shifts the result toward black or white before dithering."
            >
              <input
                type="range"
                min="-255"
                max="255"
                step="1"
                value={bias}
                onChange={(e) => setBias(Number(e.target.value))}
                className="w-full accent-[#ff5a1f]"
              />
            </Field>

            <Field
              label="Effect resolution"
              value={`${Math.round(scale * 100)}%`}
              hint="Reduces the dithering computation resolution, without changing the image size."
            >
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.05"
                value={scale}
                onChange={(e) => setScale(Number(e.target.value))}
                className="w-full accent-[#ff5a1f]"
              />
            </Field>

            <Field label="Color mode">
              <div className="grid grid-cols-3 gap-px bg-black">
                {COLOR_MODES.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setColorMode(key)}
                    className={`cursor-pointer border border-black py-1.5 text-[11px] font-medium uppercase tracking-[0.05em] transition-colors ${
                      colorMode === key
                        ? 'bg-black text-white'
                        : 'bg-[#f3f2ec] text-black/70 hover:bg-black hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {twoTone && (
                <div className="mt-3 flex items-center gap-2">
                  <ColorSwatch
                    label="Shadows"
                    value={colorLow}
                    onChange={(e) => setColorLow(e.target.value)}
                  />
                  <ColorSwatch
                    label="Highlights"
                    value={colorHigh}
                    onChange={(e) => setColorHigh(e.target.value)}
                  />
                </div>
              )}
            </Field>

            {!imageEl && (
              <p className="border-t border-black/15 pt-4 text-[12px] leading-snug text-black/40">
                Load an image to enable the settings and see the live result.
              </p>
            )}
          </Panel>
        </aside>
      </main>

      <footer className="shrink-0 border-t border-black px-4 py-3 sm:px-6">
        <p className="mx-auto max-w-6xl text-[10px] uppercase tracking-[0.1em] text-black/40 sm:text-[11px] sm:tracking-[0.15em]">
          by{' '}
          <a
            href="https://fwszs.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#ff5a1f] hover:text-black"
          >
            fwszs
          </a>
        </p>
      </footer>
    </div>
  );
}
