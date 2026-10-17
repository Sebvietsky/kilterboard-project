// « 1 climb », « 3 climbs ». Le pluriel irrégulier se passe en troisième
// argument : plural(2, 'try', 'tries').
export function plural(
  count: number,
  singular: string,
  pluralForm = `${singular}s`,
): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}
