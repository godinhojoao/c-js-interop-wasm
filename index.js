import createModule from "./c-wasm/main.mjs";

const consoleEl = document.getElementById("console");
const input = document.getElementById("number-input");
const btn = document.getElementById("run-btn");

async function factor() {
  const n = input.value.trim();
  if (!n || Number(n) < 2) {
    consoleEl.innerHTML = `<span class="prompt">$</span> please enter an integer ≥ 2`;
    return;
  }
  let buffer = "";
  const Module = await createModule({
    print: (text) => { buffer += text + "\n"; },
    printErr: (text) => { buffer += text + "\n"; },
  });
  Module.callMain([n]);
  const out = buffer.trim();
  const [lhs, rhs] = out.split("=").map((s) => s && s.trim());
  consoleEl.innerHTML = rhs
    ? `<span class="prompt">$</span> factor ${lhs}\n  <span class="ok">${lhs}</span> = <span class="accent">${rhs}</span>`
    : `<span class="prompt">$</span> ${out}`;
}

btn.addEventListener("click", factor);
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") factor();
});
