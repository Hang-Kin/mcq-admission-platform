import { register } from "node:module";

await register("./node-hook.mjs", import.meta.url);
