/**
 * Minimal ambient typings for the handful of Node APIs used by build-time
 * scripts and vite.config.ts.
 *
 * Why not @types/node? The initiative's dependency policy pins dev deps to
 * vite / typescript / vitest / fontsource only (tech-design "Tech Stack &
 * Dependencies"). The scripts use a tiny surface, declared here instead.
 */

declare module "node:url" {
  export function fileURLToPath(url: URL | string): string;
}

declare module "node:fs" {
  export function writeFileSync(path: string, data: string): void;
  export function readFileSync(path: string, encoding: "utf8"): string;
  export function mkdirSync(path: string, opts?: { recursive?: boolean }): void;
}

declare module "node:path" {
  export function dirname(p: string): string;
  export function resolve(...parts: string[]): string;
  export function join(...parts: string[]): string;
}

declare var process: {
  argv: string[];
  exitCode?: number;
  env: Record<string, string | undefined>;
  cwd(): string;
};
