FROM emscripten/emsdk:6.0.2

WORKDIR /app

CMD ["emcc", "main.c", "-O3", \
  "-sMODULARIZE", \
  "-sEXPORT_ES6", \
  "-sINVOKE_RUN=0", \
  "-sEXPORTED_RUNTIME_METHODS=callMain,ccall,cwrap", \
  "-o", "./c-wasm/main.mjs"]
