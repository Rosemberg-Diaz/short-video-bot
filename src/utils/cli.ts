export function getStringArgument(name: string): string | undefined {
  const prefix = `--${name}=`;
  const argument = process.argv.slice(2).find((value) => value.startsWith(prefix));
  return argument?.slice(prefix.length).trim() || undefined;
}

export function getPositiveIntegerArgument(
  name: string,
  defaultValue: number,
): number {
  const rawValue = getStringArgument(name);
  if (!rawValue) return defaultValue;

  const value = Number(rawValue);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`--${name} debe ser un número entero positivo.`);
  }

  return value;
}
