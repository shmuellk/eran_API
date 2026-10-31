// User types (BENZI_APP_USERS.U_TYPE) that get admin treatment everywhere.
// "מנהל על" is an admin in every way; the only extra it gets is the noam / cars
// tables in MANAG, which is decided in the MANAG frontend.
const ADMIN_TYPES = ["מנהל", "מנהל על"];

// Company staff using the mosofon app (messengers / warehouse). Stored in their own
// table (BENZI_STAFF_USERS), not in BENZI_APP_USERS; this U_TYPE is attached when such an
// account is loaded. Staff reach only the mosofon routes on My_SQL_Server, no customer data.
const STAFF_TYPE = "עובד";

const isAdminType = (type) => ADMIN_TYPES.includes(type);

// For SQL: `U_TYPE NOT IN (${ADMIN_TYPES_SQL})`
const ADMIN_TYPES_SQL = ADMIN_TYPES.map((t) => `'${t}'`).join(", ");

module.exports = { ADMIN_TYPES, STAFF_TYPE, isAdminType, ADMIN_TYPES_SQL };
