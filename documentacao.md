# Documentação da Implementação — Mandelbrot Explorer

## 1. Aplicação Escolhida

### 1.1 O Conjunto de Mandelbrot

O conjunto de Mandelbrot é um dos fractais mais conhecidos da matemática. É definido como o conjunto dos números complexos **c** para os quais a sequência iterativa:

```
z₀ = 0
z_{n+1} = z_n² + c
```

**não diverge** (i.e., |z_n| permanece limitado para todo n).

Pontos **dentro** do conjunto são tipicamente coloridos em preto. Pontos **fora** do conjunto são coloridos de acordo com a velocidade com que a sequência diverge (número de iterações até |z| > 2), criando os padrões fractais coloridos característicos.

### 1.2 Justificativa da Escolha

O fractal de Mandelbrot é ideal para este trabalho porque:

- **Computação intensiva**: cada pixel requer centenas de iterações de aritmética complexa, justificando o uso de C/WebAssembly para performance.
- **Resultado visual**: a saída é uma imagem 2D colorida, atendendo ao requisito de "aplicação gráfica".
- **Interatividade**: zoom e navegação permitem explorar infinitamente o fractal, demonstrando chamadas repetidas entre as linguagens.

---

## 2. Divisão de Responsabilidades por Linguagem

### 2.1 C — Cálculo Computacional (`mandelbrot.c`)

A linguagem C é responsável por toda a computação matemática:

- **Iteração z = z² + c**: para cada pixel da imagem, mapeia coordenadas de tela para o plano complexo e executa o loop de iteração.
- **Coloração contínua (smooth coloring)**: em vez de usar a contagem inteira de iterações (que produziria bandas de cor), calcula um valor fracionário usando: `smooth_n = n + 1 - log₂(log₂(|z|))`.
- **Mapeamento de cores**: usa a técnica de paleta cosseno de Inigo Quilez: `cor(t) = a + b · cos(2π · (c·t + d))`, que produz gradientes suaves e visualmente agradáveis.
- **Gerenciamento de memória**: aloca e libera o buffer RGBA de pixels.

O C foi escolhido para esta parte porque:
- Executa com performance próxima ao nativo quando compilado para WebAssembly
- Controle direto sobre memória (malloc/free) permite transferência eficiente de dados para o JavaScript
- Aritmética de ponto flutuante (double) é fundamental para a precisão do fractal em altos níveis de zoom

### 2.2 JavaScript — Interface com o Usuário (`index.js`, `index.html`)

JavaScript é responsável por toda a interação e apresentação:

- **Carregamento do WebAssembly**: inicializa o módulo WASM e cria wrappers para as funções C.
- **Renderização no canvas**: lê o buffer de pixels da memória WASM e pinta no canvas HTML5.
- **Interação do usuário**: zoom com scroll do mouse, pan com drag, slider de iterações, botão reset.
- **Gerenciamento do viewport**: controla coordenadas centrais, nível de zoom e parâmetros de renderização.

JavaScript foi escolhido porque:
- É a linguagem nativa da web, com acesso direto ao DOM e Canvas API
- Gerencia eventos de mouse/teclado nativamente
- O Emscripten gera módulos ES6, integrando naturalmente com JavaScript moderno

---

## 3. Método de Interoperabilidade: WebAssembly via Emscripten

### 3.1 Visão Geral

A interoperabilidade entre C e JavaScript é realizada através do **WebAssembly (WASM)**, usando o **Emscripten** como compilador. O Emscripten compila código C para bytecode WebAssembly, que pode ser executado diretamente no navegador com performance próxima ao nativo.

### 3.2 Fluxo de Dados

```
┌──────────────────────────────────────────────────────────────────┐
│                         NAVEGADOR                                │
│                                                                  │
│  ┌─────────────────────────────┐    ┌─────────────────────────┐  │
│  │       JavaScript            │    │         C (WASM)        │  │
│  │                             │    │                         │  │
│  │  1. Usuário interage        │    │                         │  │
│  │     (zoom, pan, slider)     │    │                         │  │
│  │                             │    │                         │  │
│  │  2. Chama wasmRender()  ────┼───►│  3. mandelbrot_render() │  │
│  │     via cwrap()             │    │     - calcula iterações │  │
│  │                             │    │     - mapeia cores      │  │
│  │                             │    │     - preenche buffer   │  │
│  │                             │◄───┼──── retorna ponteiro    │  │
│  │                             │    │                         │  │
│  │  4. Lê buffer via HEAPU8   │    │                         │  │
│  │  5. Pinta no <canvas>      │    │                         │  │
│  │  6. Chama wasmFree() ──────┼───►│  7. Libera buffer       │  │
│  │                             │    │                         │  │
│  └─────────────────────────────┘    └─────────────────────────┘  │
│           │                                     │                │
│           ▼                                     ▼                │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │              Memória Linear do WebAssembly                │    │
│  │                                                          │    │
│  │  [R,G,B,A, R,G,B,A, R,G,B,A, ...]  ← buffer de pixels  │    │
│  │   ↑                                                      │    │
│  │   ponteiro retornado por mandelbrot_render()              │    │
│  │   acessível pelo JS via Module.HEAPU8[ptr..ptr+size]     │    │
│  └──────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

### 3.3 Mecanismos de Interoperabilidade Utilizados

#### 3.3.1 EMSCRIPTEN_KEEPALIVE

No código C, as funções que devem ser acessíveis pelo JavaScript são marcadas com `EMSCRIPTEN_KEEPALIVE`. Sem essa anotação, o compilador pode remover funções "não utilizadas" durante a otimização (dead code elimination).

```c
EMSCRIPTEN_KEEPALIVE
uint8_t *mandelbrot_render(int width, int height,
                           double centerX, double centerY,
                           double zoom, int maxIter) { ... }
```

#### 3.3.2 Module.cwrap()

O Emscripten fornece a função `cwrap()` para criar wrappers JavaScript que chamam funções C com conversão automática de tipos. Isso permite chamar funções C como se fossem funções JavaScript normais:

```javascript
// Cria wrapper: (number, number, number, number, number, number) → number
const wasmRender = Module.cwrap("mandelbrot_render", "number", [
  "number", "number", "number", "number", "number", "number"
]);

// Chama a função C como se fosse JavaScript
const ptr = wasmRender(800, 600, -0.5, 0.0, 1.0, 200);
```

O tipo `"number"` mapeia automaticamente para `int`, `float` ou `double` em C, dependendo da declaração da função.

#### 3.3.3 Memória Linear Compartilhada (HEAPU8)

O WebAssembly usa um modelo de memória linear: um array contíguo de bytes acessível tanto pelo C (como ponteiros) quanto pelo JavaScript (como `ArrayBuffer`). O Emscripten expõe esta memória como `Module.HEAPU8` (Uint8Array).

Quando o C aloca memória com `malloc()` e retorna um ponteiro, o JavaScript pode ler os bytes correspondentes:

```javascript
// ptr = endereço na memória WASM retornado pelo C
// size = número de bytes a ler
const pixels = new Uint8Array(Module.HEAPU8.buffer, ptr, size);
```

Este é o mecanismo principal de transferência de dados: o C escreve pixels na memória WASM, e o JavaScript lê diretamente da mesma memória, sem cópias intermediárias entre runtimes.

#### 3.3.4 Compilação com Emscripten (emcc)

O Emscripten compila C para WebAssembly usando o comando `emcc`. As flags utilizadas são:

| Flag | Propósito |
|------|-----------|
| `-O3` | Otimização máxima (fundamental para performance do fractal) |
| `-sMODULARIZE` | Gera uma factory function (permite múltiplas instâncias) |
| `-sEXPORT_ES6` | Gera módulo ES6 (import/export) |
| `-sALLOW_MEMORY_GROWTH` | Permite que malloc expanda a memória WASM |
| `-sEXPORTED_FUNCTIONS` | Lista de funções C acessíveis pelo JavaScript |
| `-sEXPORTED_RUNTIME_METHODS` | Métodos do runtime Emscripten (cwrap, HEAPU8) |

### 3.4 Containerização com Docker

O ambiente de compilação Emscripten é provido via Docker, usando a imagem oficial `emscripten/emsdk`. Isso garante reprodutibilidade: qualquer pessoa com Docker pode compilar o projeto sem instalar o Emscripten localmente.

```yaml
# docker-compose.yml
services:
  emscripten:
    build: .
    volumes:
      - .:/app   # monta o diretório do projeto dentro do container
```

---

## 4. Conclusão

Este projeto demonstra a interoperabilidade entre C e JavaScript através do WebAssembly, onde cada linguagem atua em seu ponto forte: C para computação numérica intensiva e JavaScript para interface web interativa. O Emscripten serve como ponte entre os dois mundos, fornecendo mecanismos (cwrap, memória compartilhada) que permitem comunicação eficiente e tipada entre as linguagens.
