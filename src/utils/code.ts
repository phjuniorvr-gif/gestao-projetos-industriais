const CODE_PATTERN = /^P(\d+)$/i;

/**
 * Próximo código sequencial de projeto (P01, P02, ...). Considera o maior número já usado
 * entre os códigos existentes (não a quantidade de projetos, pois projetos podem ter sido
 * excluídos) e ignora qualquer código fora do padrão "P<número>".
 */
export function nextProjectCode(existingCodes: string[]): string {
  const numbers = existingCodes
    .map((code) => code.match(CODE_PATTERN))
    .filter((match): match is RegExpMatchArray => match !== null)
    .map((match) => Number(match[1]));
  const highest = numbers.length > 0 ? Math.max(...numbers) : 0;
  return `P${String(highest + 1).padStart(2, '0')}`;
}
