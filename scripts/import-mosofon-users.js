// Command-line version of POST /users/importMosofonUsers, for a JSON file exported by
// My_SQL_Server/scripts/export-mosofon-users.js. See controllers/mosofonImportController.js.
//
//   node scripts/import-mosofon-users.js mosofon-users.json --card-code=<code> --created-by=<admin>
//   node scripts/import-mosofon-users.js mosofon-users.json --card-code=<code> --created-by=<admin> --apply
//
// Without --apply it only prints what would happen.
const fs = require("fs");
const pool = require("../configs/connection_cars");
const { normalizeNames, planImport, applyImport } = require("../controllers/mosofonImportController");

function parseArgs(argv) {
  const args = { file: null, apply: false };
  for (const arg of argv) {
    if (arg === "--apply") args.apply = true;
    else if (arg.startsWith("--card-code=")) args.cardCode = arg.slice(12).trim();
    else if (arg.startsWith("--created-by=")) args.createdBy = arg.slice(13).trim();
    else args.file = arg;
  }
  return args;
}

async function main() {
  const { file, apply, cardCode, createdBy } = parseArgs(process.argv.slice(2));
  if (!file || !cardCode || !createdBy) {
    console.error("Usage: node scripts/import-mosofon-users.js <file.json> --card-code=<code> --created-by=<admin> [--apply]");
    process.exit(2);
  }

  const names = normalizeNames(JSON.parse(fs.readFileSync(file, "utf8")));
  const { toCreate, skipped } = await planImport(names);

  for (const { name, migratedAs } of skipped) {
    console.log(migratedAs === name ? `skip  ${name} (already a staff account)` : `skip  ${name} (already migrated as ${migratedAs})`);
  }
  for (const { name, original } of toCreate) {
    const renamed = name !== original ? `   <-- RENAMED from ${original} (name taken)` : "";
    console.log(`${apply ? "create" : "would create"} ${name}${renamed}`);
  }
  const renamedCount = toCreate.filter((user) => user.name !== user.original).length;
  if (renamedCount) console.log(`\n${renamedCount} users get a new name; tell them to log in with it.`);
  if (!apply) {
    console.log(`\nDry run: ${toCreate.length} of ${names.length} would be created. Re-run with --apply to write.`);
    return;
  }

  await applyImport(toCreate, { cardCode, createdBy });
  console.log(`\nCreated ${toCreate.length} staff accounts.`);
}

main()
  .catch((error) => {
    console.error("Import failed, nothing was written:", error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
