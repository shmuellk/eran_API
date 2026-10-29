// Bind customer identifiers to the authenticated account, including nested orders.
// Document identifiers also need ownership checks in their database queries.
function customerScope(req, res, next) {
  const user = req.auth.user;
  if (['מנהל', 'מנהל על'].includes(user.U_TYPE)) return next();
  const cards = new Set(['cardcode', 'u_card_code']);
  const names = new Set(['username', 'u_user_name']);
  function bind(value, depth = 0) {
    if (!value || typeof value !== 'object' || depth > 20) return;
    for (const key of Object.keys(value)) {
      const normalized = key.toLowerCase();
      if (cards.has(normalized)) value[key] = String(user.U_CARD_CODE);
      else if (names.has(normalized)) value[key] = user.U_USER_NAME;
      else bind(value[key], depth + 1);
    }
  }
  if (!user.U_CARD_CODE || !user.U_USER_NAME) return res.status(403).json({ message: 'Account identity incomplete' });
  Object.assign(req.query, { CARDCODE: String(user.U_CARD_CODE), cardCode: String(user.U_CARD_CODE), U_CARD_CODE: String(user.U_CARD_CODE), userName: user.U_USER_NAME, U_USER_NAME: user.U_USER_NAME });
  bind(req.query);
  bind(req.body);
  next();
}
module.exports = customerScope;
