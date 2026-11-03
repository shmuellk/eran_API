// "שנת ייצור" (noam.manufacture_years) is derived from "משנה" (from_year) and "עד שנה"
// (until_year): every year in the range, comma-separated, e.g. 2018..2020 -> "2018,2019,2020".
// "ואילך" in until_year means "up to the current year".
//
// Returns null when the range cannot be read (missing/invalid from_year, empty or invalid
// until_year, or until before from) - callers then leave manufacture_years as it is.

const MIN_YEAR = 1900;
const MAX_YEAR = 2100;

const parseYear = (value) => {
  const text = String(value ?? "").trim();
  if (!/^\d{4}$/.test(text)) return null;
  const year = parseInt(text, 10);
  return year >= MIN_YEAR && year <= MAX_YEAR ? year : null;
};

const manufactureYearsFor = (fromYear, untilYear, now = new Date()) => {
  const from = parseYear(fromYear);
  if (from === null) return null;

  const untilText = String(untilYear ?? "").trim();
  const until = untilText.includes("ואילך") ? now.getFullYear() : parseYear(untilText);
  if (until === null || until < from) return null;

  const years = [];
  for (let y = from; y <= until; y++) years.push(y);
  return years.join(",");
};

module.exports = { manufactureYearsFor };
