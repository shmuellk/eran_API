// User types (BENZI_APP_USERS.U_TYPE) that get admin treatment everywhere.
// "מנהל על" is an admin in every way; the only extra it gets is the noam / cars
// tables in MANAG, which is decided in the MANAG frontend.
const ADMIN_TYPES = ["מנהל", "מנהל על"];

const isAdminType = (type) => ADMIN_TYPES.includes(type);

// For SQL: `U_TYPE NOT IN (${ADMIN_TYPES_SQL})`
const ADMIN_TYPES_SQL = ADMIN_TYPES.map((t) => `'${t}'`).join(", ");

module.exports = { ADMIN_TYPES, isAdminType, ADMIN_TYPES_SQL };
