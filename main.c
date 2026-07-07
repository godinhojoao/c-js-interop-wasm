#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>

// Simplified GNFS-style factorization.
// Real GNFS targets very large composites; for small inputs (e.g. 14)
// trial division + Pollard's rho covers the same job practically.

static uint64_t gcd(uint64_t a, uint64_t b) {
  while (b) { uint64_t t = a % b; a = b; b = t; }
  return a;
}

static uint64_t pollard_rho(uint64_t n) {
  if (n % 2 == 0) return 2;
  uint64_t x = 2, y = 2, c = 1, d = 1;
  while (d == 1) {
    x = (x * x + c) % n;
    y = (y * y + c) % n; y = (y * y + c) % n;
    d = gcd(x > y ? x - y : y - x, n);
  }
  return d == n ? 0 : d;
}

static void gnfs_factor(uint64_t n) {
  printf("%llu = ", (unsigned long long)n);
  int first = 1;
  for (uint64_t p = 2; p * p <= n && p < 100000; ++p) {
    while (n % p == 0) {
      printf("%s%llu", first ? "" : " * ", (unsigned long long)p);
      first = 0;
      n /= p;
    }
  }
  while (n > 1) {
    if (n < 2) break;
    uint64_t f = (n > 3) ? pollard_rho(n) : n;
    if (!f) f = n;
    printf("%s%llu", first ? "" : " * ", (unsigned long long)f);
    first = 0;
    n /= f;
  }
  printf("\n");
}

int main(int argc, char **argv) {
  if (argc < 2) {
    printf("usage: pass a number to factor (e.g. 14)\n");
    return 1;
  }
  uint64_t n = strtoull(argv[1], NULL, 10);
  if (n < 2) {
    printf("%llu has no prime factorization\n", (unsigned long long)n);
    return 0;
  }
  gnfs_factor(n);
  return 0;
}
