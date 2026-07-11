# Makefile — Mandelbrot Explorer (C ↔ JS via WebAssembly)
#
# make build  - compila C pra WASM via Docker/Emscripten
# make run    - serve a página num servidor HTTP local
# make clean  - remove artefatos gerados

.PHONY: build run clean

# Compila mandelbrot.c pra WebAssembly dentro do container Docker
build:
	docker compose run --rm --build emscripten

# Inicia servidor HTTP na porta 8080 (abrir http://localhost:8080)
run:
	python -m http.server 8080

# Remove os arquivos WASM gerados
clean:
	del /Q c-wasm\main.mjs c-wasm\main.wasm 2>nul || rm -f c-wasm/main.mjs c-wasm/main.wasm
