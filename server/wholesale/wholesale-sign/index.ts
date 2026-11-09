import { signHandler } from './handler.mjs';

Deno.serve(signHandler((name: string) => Deno.env.get(name)));
