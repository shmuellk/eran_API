// User types (BENZI_APP_USERS.U_TYPE) that get admin treatment everywhere.
// "מנהל על" is an admin in every way; the only extra it gets is the noam / cars
// tables in MANAG, which is decided in the MANAG frontend.
const ADMIN_TYPES = ["מנהל", "מנהל על"];

// Company staff using the mosofon app (messengers / warehouse). Not an admin:
// My_SQL_Server only lets this type reach the delivery-scan and warehouse routes.
const STAFF_TYPE = "עובד";

const isAdminType = (type) => ADMIN_TYPES.includes(type);

// Admins and staff log in from changing addresses (staff work on cellular data),
// so the customer login IP restriction does not apply to them.
const isIpExemptType = (type) => isAdminType(type) || type === STAFF_TYPE;

// For SQL: `U_TYPE NOT IN (${ADMIN_TYPES_SQL})`
const ADMIN_TYPES_SQL = ADMIN_TYPES.map((t) => `'${t}'`).join(", ");

module.exports = { ADMIN_TYPES, STAFF_TYPE, isAdminType, isIpExemptType, ADMIN_TYPES_SQL };
