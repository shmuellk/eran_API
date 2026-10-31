// Command-line version of POST /users/importMosofonUsers, for a JSON file exported by
// My_SQL_Server/scripts/export-mosofon-users.js. See controllers/mosofonImportController.js.
// Requires migrations/002_staff_users.sql.
//
//   node scripts/import-mosofon-users.js mosofon-users.json --created-by=<admin>
//   node scripts/import-mosofon-users.js mosofon-users.json --created-by=<admin> --apply
//
// Without --apply it only prints what would happen.
const fs = require("fs");
const pool = require("../configs/connection_cars");
const { normalizeNames, planImport, applyImport } = require("../controllers/mosofonImportController");

function parseArgs(argv) {
  const args = { file: null, apply: false };
  for (const arg of argv) {
    if (arg === "--apply") args.apply = true;
    else if (arg.startsWith("--created-by=")) args.createdBy = arg.slice(13).trim();
    else args.file = arg;
  }
  return args;
}

async function main() {
  const { file, apply, createdBy } = parseArgs(process.argv.slice(2));
  if (!file || !createdBy) {
    console.error("Usage: node scripts/import-mosofon-users.js <file.json> --created-by=<admin> [--apply]");
    process.exit(2);
  }

  const names = normalizeNames(JSON.parse(fs.readFileSync(file, "utf8")));
  const { toCreate, skipped } = await planImport(names);

  skipped.forEach((name) => console.log(`skip  ${name} (already a staff account)`));
  toCreate.forEach((name) => console.log(`${apply ? "create" : "would create"} ${name}`));
  if (!apply) {
    console.log(`\nDry run: ${toCreate.length} of ${names.length} would be created. Re-run with --apply to write.`);
    return;
  }

  await applyImport(toCreate, { createdBy });
  console.log(`\nCreated ${toCreate.length} staff accounts.`);
}

main()
  .catch((error) => {
    console.error("Import failed, nothing was written:", error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
