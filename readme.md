# Mandelbrot Explorer — C ↔ JavaScript via WebAssembly

Visualizador interativo do fractal de Mandelbrot, utilizando **C** para o cálculo computacional e **JavaScript** para a interface gráfica, com interoperabilidade via **WebAssembly (Emscripten)**.

## Arquivos do Repositório

| Arquivo | Descrição |
|---------|-----------|
| `mandelbrot.c` | Código-fonte em C: cálculo das iterações do Mandelbrot e mapeamento de cores. Compilado para WebAssembly. |
| `index.html` | Interface web: estrutura HTML com canvas, controles (slider, botão reset) e estilização CSS. |
| `index.js` | Lógica da interface em JavaScript: carrega o módulo WASM, gerencia interações (zoom, pan) e renderiza pixels no canvas. |
| `Dockerfile` | Configuração Docker para compilação do C usando o SDK do Emscripten. |
| `docker-compose.yml` | Orquestração Docker Compose para simplificar o processo de build. |
| `Makefile` | Automação de build (`make build`) e execução (`make run`). |
| `package.json` | Metadados do projeto Node.js (configuração de módulo ES6). |
| `c-wasm/main.mjs` | *Gerado automaticamente* — wrapper JavaScript do módulo WebAssembly. |
| `c-wasm/main.wasm` | *Gerado automaticamente* — bytecode WebAssembly compilado do C. |
| `documentacao.md` | Documentação detalhada da implementação (conteúdo para o PDF). |

## Pré-requisitos

- **Docker** e **Docker Compose** — para compilação do código C para WebAssembly
  - [Instalação Docker](https://docs.docker.com/get-docker/)
- **Python 3** — para o servidor HTTP local (alternativa: qualquer servidor HTTP estático)
- **Navegador moderno** — Chrome, Firefox, Edge ou Safari (com suporte a WebAssembly)

## Como Compilar

```bash
make build
```

Isso executa `docker compose run --rm --build emscripten`, que:
1. Baixa a imagem do Emscripten SDK (na primeira vez)
2. Compila `mandelbrot.c` para WebAssembly usando `emcc`
3. Gera `c-wasm/main.mjs` (wrapper JS) e `c-wasm/main.wasm` (bytecode WASM)

## Como Executar

```bash
make run
```

Isso inicia um servidor HTTP local na porta 8080. Abra no navegador:

```
http://localhost:8080
```

> **Nota:** É necessário um servidor HTTP porque módulos ES6 e WebAssembly não funcionam via `file://` (restrição CORS do navegador).

### Alternativas ao servidor Python

```bash
# Se python3 não funcionar, tente:
python3 -m http.server 8080

# Ou com npx (requer Node.js):
npx serve . -p 8080
```

## Caso de Estudo

Após abrir `http://localhost:8080`:

1. **Visão inicial**: o fractal de Mandelbrot é renderizado automaticamente
2. **Zoom**: use o scroll do mouse para ampliar/reduzir (centrado no cursor)
3. **Navegação**: clique e arraste para mover pelo fractal
4. **Detalhe**: ajuste o slider "Iterações" para mais/menos detalhes nas bordas
5. **Reset**: clique no botão "Reset" para voltar à visão inicial

### Regiões interessantes para explorar

- **Vale do Seahorse**: zoom na região (-0.75, 0.1) — espirais complexas
- **Antena principal**: zoom na região (-1.25, 0.0) — padrões auto-similares
- **Mini-Mandelbrot**: zoom na região (-1.77, 0.0) — cópia do conjunto inteiro em miniatura

## Linguagens e Interoperabilidade

| Linguagem | Papel | Método de Interop |
|-----------|-------|-------------------|
| **C** | Computação do fractal (iterações z=z²+c, coloração) | Compilado para WASM via Emscripten, funções exportadas com `EMSCRIPTEN_KEEPALIVE` |
| **JavaScript** | Interface gráfica (canvas, mouse, controles) | Chama funções C via `Module.cwrap()`, lê pixels da memória WASM via `Module.HEAPU8` |

## Limpeza

```bash
make clean
```

Remove os arquivos gerados (`c-wasm/main.mjs` e `c-wasm/main.wasm`).
