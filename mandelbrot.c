/*
 * mandelbrot.c — Cálculo do fractal de Mandelbrot (compilado para WebAssembly)
 *
 * Papel: computação numérica (C)
 * Interop: funções exportadas via EMSCRIPTEN_KEEPALIVE, memória compartilhada com JS
 *
 * O conjunto de Mandelbrot é o conjunto dos números complexos c para os quais
 * z_{n+1} = z_n² + c não diverge quando z_0 = 0.
 *
 * Referências:
 *   - https://en.wikipedia.org/wiki/Mandelbrot_set
 *   - https://iquilezles.org/articles/palettes/ (paleta cosseno)
 */

#include <emscripten.h>
#include <stdlib.h>
#include <math.h>
#include <stdint.h>

/* Bailout alto (256 em vez de 4) para suavizar a coloração nas bordas */
#define BAILOUT_RADIUS_SQ 256.0
#define TWO_PI 6.28318530717958647692

static double clamp01(double x) {
    if (x < 0.0) return 0.0;
    if (x > 1.0) return 1.0;
    return x;
}

/*
 * Converte contagem de iterações em cor RGB usando paleta cosseno (técnica do Inigo Quilez).
 * Fórmula: cor(t) = a + b * cos(2π * (c*t + d))
 * As fases diferentes por canal (dr, dg, db) geram a variação cromática.
 * Pontos dentro do conjunto ficam pretos.
 */
static void iter_to_color(double iter, int maxIter,
                          uint8_t *r, uint8_t *g, uint8_t *b) {
    if (iter >= (double)maxIter) {
        *r = *g = *b = 0;
        return;
    }

    /* Divisor controla frequência de repetição das cores */
    double t = iter / 64.0;

    /* Parâmetros da paleta: offsets, amplitudes, frequências e fases */
    const double ar = 0.5, ag = 0.5, ab = 0.5;
    const double br = 0.5, bg = 0.5, bb = 0.5;
    const double cr = 1.0, cg = 1.0, cb = 1.0;
    const double dr = 0.00, dg = 0.10, db = 0.20;

    *r = (uint8_t)(255.0 * clamp01(ar + br * cos(TWO_PI * (cr * t + dr))));
    *g = (uint8_t)(255.0 * clamp01(ag + bg * cos(TWO_PI * (cg * t + dg))));
    *b = (uint8_t)(255.0 * clamp01(ab + bb * cos(TWO_PI * (cb * t + db))));
}

/*
 * Renderiza o Mandelbrot num buffer RGBA.
 *
 * O JS chama essa função via cwrap(), recebe o ponteiro de volta,
 * e lê os pixels via Module.HEAPU8. Depois chama mandelbrot_free().
 *
 * O viewport é definido por centro (centerX, centerY) e zoom.
 * Com zoom=1, a altura visível no plano complexo é 4.0 unidades.
 *
 * Usa smooth coloring pra evitar bandas:
 *   smooth_n = n + 1 - log2(log2(|z|))
 */
EMSCRIPTEN_KEEPALIVE
uint8_t *mandelbrot_render(int width, int height,
                           double centerX, double centerY,
                           double zoom, int maxIter) {
    size_t bufSize = (size_t)width * (size_t)height * 4;
    uint8_t *buf = (uint8_t *)malloc(bufSize);
    if (!buf) return NULL;

    /* Tamanho de cada pixel no plano complexo */
    double pixelSize = 4.0 / (zoom * (double)height);

    for (int py = 0; py < height; py++) {
        for (int px = 0; px < width; px++) {
            /* Pixel -> coordenada no plano complexo */
            double cr = centerX + ((double)px - (double)width  / 2.0) * pixelSize;
            double ci = centerY + ((double)py - (double)height / 2.0) * pixelSize;

            /*
             * Iteração z = z² + c:
             *   z = (a + bi) -> z² = (a²-b²) + (2ab)i
             *   z² + c = (a²-b² + cr) + (2ab + ci)i
             * Loop até |z|² > bailout ou esgotar iterações.
             */
            double zr = 0.0, zi = 0.0;
            int iter = 0;

            while (zr * zr + zi * zi <= BAILOUT_RADIUS_SQ && iter < maxIter) {
                double tmp = zr * zr - zi * zi + cr;
                zi = 2.0 * zr * zi + ci;
                zr = tmp;
                iter++;
            }

            /* Smooth coloring: interpola entre faixas de iteração */
            double smoothIter = (double)iter;
            if (iter < maxIter) {
                double logZn = log(zr * zr + zi * zi) / 2.0;
                smoothIter = (double)iter + 1.0 - log(logZn) / log(2.0);
            }

            uint8_t r, g, b;
            iter_to_color(smoothIter, maxIter, &r, &g, &b);

            /* RGBA no buffer: [R,G,B,A, R,G,B,A, ...] */
            int idx = (py * width + px) * 4;
            buf[idx]     = r;
            buf[idx + 1] = g;
            buf[idx + 2] = b;
            buf[idx + 3] = 255;
        }
    }

    return buf;
}

/* Libera buffer alocado por mandelbrot_render(). Chamado pelo JS após copiar os pixels. */
EMSCRIPTEN_KEEPALIVE
void mandelbrot_free(uint8_t *ptr) {
    free(ptr);
}
