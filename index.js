import createModule from "./c-wasm/main.mjs";

const consoleEl = document.getElementById("console");
const input = document.getElementById("number-input");
const btn = document.getElementById("run-btn");

const U64_MAX = 18446744073709551615n;

async function factor() {
  const n = input.value.trim();
  let big;
  try { big = BigInt(n); } catch { big = null; }
  if (big === null || big < 2n) {
    consoleEl.innerHTML = `<span class="prompt">$</span> please enter an integer ≥ 2`;
    return;
  }
  if (big > U64_MAX) {
    consoleEl.innerHTML = `<span class="prompt">$</span> max supported is 2^64-1 (${U64_MAX})`;
    return;
  }
  consoleEl.innerHTML = `<span class="prompt">$</span> factoring…`;
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
