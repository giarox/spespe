const MONTHS: Record<string, number> = {
  gennaio: 0,
  febbraio: 1,
  marzo: 2,
  aprile: 3,
  maggio: 4,
  giugno: 5,
  luglio: 6,
  agosto: 7,
  settembre: 8,
  ottobre: 9,
  novembre: 10,
  dicembre: 11,
};

function buildDate(day: number, monthName: string, baseYear?: number) {
  const month = MONTHS[monthName.toLowerCase()];
  if (month === undefined) return undefined;
  const today = new Date();
  let year = baseYear ?? today.getFullYear();
  return new Date(Date.UTC(year, month, day));
}

export function parseItalianRange(text: string) {
  const rangeRegex = /dal\s+(\d{1,2})\s+([a-zà]+)\s+al\s+(\d{1,2})\s+([a-zà]+)/i;
  const match = text.match(rangeRegex);
  if (!match) return { start: undefined, end: undefined };
  const [, startDayStr, startMonth, endDayStr, endMonth] = match;
  const startDay = parseInt(startDayStr, 10);
  const endDay = parseInt(endDayStr, 10);
  const tentativeYear = new Date().getFullYear();
  let startDate = buildDate(startDay, startMonth, tentativeYear);
  let endDate = buildDate(endDay, endMonth, tentativeYear);
  if (startDate && endDate && endDate < startDate) {
    // Flyer crosses year boundary.
    endDate = buildDate(endDay, endMonth, tentativeYear + 1);
  }
  return {
    start: startDate?.toISOString().slice(0, 10),
    end: endDate?.toISOString().slice(0, 10),
  };
}
