# Compila mandelbrot.c pra WebAssembly usando o SDK do Emscripten.
# Gera c-wasm/main.mjs (wrapper JS) e c-wasm/main.wasm (bytecode).

FROM emscripten/emsdk:6.0.2

WORKDIR /app

CMD emcc mandelbrot.c -O3 \
  -sMODULARIZE \
  -sEXPORT_ES6 \
  -sALLOW_MEMORY_GROWTH \
  "-sEXPORTED_FUNCTIONS=['_mandelbrot_render','_mandelbrot_free','_malloc','_free']" \
  "-sEXPORTED_RUNTIME_METHODS=['ccall','cwrap','HEAPU8']" \
  -o ./c-wasm/main.mjs
