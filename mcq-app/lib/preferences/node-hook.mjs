const appRoot = new URL("../../", import.meta.url);

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const target = new URL(`${specifier.slice(2)}.ts`, appRoot);
    return nextResolve(target.href, context);
  }
  if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    !specifier.endsWith(".ts") &&
    !specifier.endsWith(".tsx") &&
    !specifier.endsWith(".js") &&
    !specifier.endsWith(".mjs") &&
    !specifier.endsWith(".css") &&
    !specifier.endsWith(".json")
  ) {
    return nextResolve(`${specifier}.ts`, context);
  }
  return nextResolve(specifier, context);
}
