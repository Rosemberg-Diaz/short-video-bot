export function randomItem<T>(items: readonly T[]): T {
  if (items.length === 0) {
    throw new Error("No se puede seleccionar un elemento de una lista vacía.");
  }

  return items[Math.floor(Math.random() * items.length)]!;
}

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex]!, result[index]!];
  }
  return result;
}
