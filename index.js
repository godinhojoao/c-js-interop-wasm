/*
 * index.js — Interface do visualizador de Mandelbrot
 *
 * Papel: interface com o usuário (JavaScript)
 * Interop: chama funções C via cwrap(), lê pixels da memória WASM via HEAPU8
 *
 * Fluxo: JS chama C -> C preenche buffer RGBA no WASM -> JS lê e pinta no canvas
 */

import createModule from "./c-wasm/main.mjs";

/* Elementos do DOM */
const canvas = document.getElementById("fractal-canvas");
const ctx = canvas.getContext("2d");
const iterSlider = document.getElementById("iter-slider");
const iterValue = document.getElementById("iter-value");
const resetBtn = document.getElementById("reset-btn");
const coordsEl = document.getElementById("coords");
const zoomEl = document.getElementById("zoom-level");
const statusEl = document.getElementById("status");

/* Viewport padrão: centro em (-0.5, 0) mostra a visão clássica do Mandelbrot */
const DEFAULT_CENTER_X = -0.5;
const DEFAULT_CENTER_Y = 0.0;
const DEFAULT_ZOOM = 1.0;
const DEFAULT_MAX_ITER = 200;

/* Estado do viewport (atualizado pelas interações do usuário) */
let centerX = DEFAULT_CENTER_X;
let centerY = DEFAULT_CENTER_Y;
let zoom = DEFAULT_ZOOM;
let maxIter = DEFAULT_MAX_ITER;

/* Estado do drag/pan */
let isDragging = false;
let dragStartX = 0, dragStartY = 0;
let dragCenterX = 0, dragCenterY = 0;

/* Módulo WASM e wrappers das funções C */
let Module = null;
let wasmRender = null;
let wasmFree = null;
let isRendering = false;

/*
 * Carrega o módulo WASM e cria wrappers JS para as funções C.
 * cwrap(nome, tipoRetorno, [tiposArgs]) converte tipos automaticamente.
 */
async function initWasm() {
  Module = await createModule();

  /* uint8_t* mandelbrot_render(int, int, double, double, double, int) */
  wasmRender = Module.cwrap("mandelbrot_render", "number", [
    "number", "number", "number", "number", "number", "number",
  ]);

  /* void mandelbrot_free(uint8_t*) */
  wasmFree = Module.cwrap("mandelbrot_free", null, ["number"]);
}

/* Ajusta resolução do canvas pro tamanho do container (3:2) */
function setupCanvas() {
  const container = document.getElementById("canvas-card");
  const maxWidth = Math.min(container.clientWidth - 40, 1200);
  const width = Math.max(400, maxWidth);
  const height = Math.floor(width * 0.667);
  canvas.width = width;
  canvas.height = height;
}

/*
 * Renderiza o fractal:
 * 1. Chama mandelbrot_render() no C via WASM (retorna ponteiro pro buffer)
 * 2. Lê os pixels da memória WASM via Module.HEAPU8
 * 3. Copia pro canvas via putImageData()
 * 4. Libera o buffer chamando mandelbrot_free()
 */
function render() {
  if (!wasmRender || isRendering) return;
  isRendering = true;

  const width = canvas.width;
  const height = canvas.height;

  statusEl.textContent = "computing…";
  statusEl.classList.add("computing");

  /* setTimeout pra dar tempo do browser pintar o status antes do WASM bloquear */
  setTimeout(() => {
    const ptr = wasmRender(width, height, centerX, centerY, zoom, maxIter);

    if (!ptr) {
      statusEl.textContent = "erro: alocação falhou";
      statusEl.classList.remove("computing");
      isRendering = false;
      return;
    }

    /* Lê o buffer RGBA direto da memória linear do WASM */
    const size = width * height * 4;
    const wasmPixels = new Uint8Array(Module.HEAPU8.buffer, ptr, size);

    const imageData = ctx.createImageData(width, height);
    imageData.data.set(wasmPixels);
    ctx.putImageData(imageData, 0, 0);

    wasmFree(ptr);

    coordsEl.textContent = `Center: (${centerX.toFixed(8)}, ${centerY.toFixed(8)})`;
    zoomEl.textContent = `Zoom: ${zoom.toFixed(1)}x`;
    statusEl.textContent = "ready";
    statusEl.classList.remove("computing");
    isRendering = false;
  }, 10);
}

/*
 * Zoom com scroll: o ponto sob o cursor fica fixo.
 * Calcula o ponto complexo sob o mouse, aplica o zoom,
 * e reposiciona o centro pra manter o mesmo ponto no mesmo pixel.
 */
canvas.addEventListener("wheel", (e) => {
  e.preventDefault();

  const rect = canvas.getBoundingClientRect();
  const mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
  const mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);

  const pixelSize = 4.0 / (zoom * canvas.height);

  /* Ponto complexo sob o cursor */
  const mx = centerX + (mouseX - canvas.width / 2) * pixelSize;
  const my = centerY + (mouseY - canvas.height / 2) * pixelSize;

  /* Scroll up = zoom in, scroll down = zoom out */
  const factor = e.deltaY < 0 ? 1.5 : 1.0 / 1.5;
  zoom *= factor;

  /* Reposiciona centro pra manter o ponto fixo */
  const newPixelSize = 4.0 / (zoom * canvas.height);
  centerX = mx - (mouseX - canvas.width / 2) * newPixelSize;
  centerY = my - (mouseY - canvas.height / 2) * newPixelSize;

  render();
}, { passive: false });

/* Pan: clica e arrasta pra mover pelo fractal */
canvas.addEventListener("mousedown", (e) => {
  if (e.button !== 0) return;
  isDragging = true;
  canvas.style.cursor = "grabbing";

  const rect = canvas.getBoundingClientRect();
  dragStartX = (e.clientX - rect.left) * (canvas.width / rect.width);
  dragStartY = (e.clientY - rect.top) * (canvas.height / rect.height);
  dragCenterX = centerX;
  dragCenterY = centerY;
});

canvas.addEventListener("mousemove", (e) => {
  if (!isDragging) return;

  const rect = canvas.getBoundingClientRect();
  const currentX = (e.clientX - rect.left) * (canvas.width / rect.width);
  const currentY = (e.clientY - rect.top) * (canvas.height / rect.height);

  /* Converte delta de pixels pra unidades do plano complexo */
  const pixelSize = 4.0 / (zoom * canvas.height);
  centerX = dragCenterX - (currentX - dragStartX) * pixelSize;
  centerY = dragCenterY - (currentY - dragStartY) * pixelSize;

  render();
});

canvas.addEventListener("mouseup", () => {
  isDragging = false;
  canvas.style.cursor = "crosshair";
});

canvas.addEventListener("mouseleave", () => {
  if (isDragging) {
    isDragging = false;
    canvas.style.cursor = "crosshair";
  }
});

/* Slider de iterações: mais iterações = mais detalhe nas bordas, mais lento */
iterSlider.addEventListener("input", () => {
  maxIter = parseInt(iterSlider.value, 10);
  iterValue.textContent = maxIter;
  render();
});

/* Reset: volta tudo pro estado inicial */
resetBtn.addEventListener("click", () => {
  centerX = DEFAULT_CENTER_X;
  centerY = DEFAULT_CENTER_Y;
  zoom = DEFAULT_ZOOM;
  maxIter = DEFAULT_MAX_ITER;
  iterSlider.value = DEFAULT_MAX_ITER;
  iterValue.textContent = DEFAULT_MAX_ITER;
  render();
});

/* Inicializa: configura canvas, carrega WASM, renderiza */
async function init() {
  setupCanvas();
  await initWasm();
  render();
}

init();
