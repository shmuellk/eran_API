const pool = require('../configs/connection_cars');
// Regular admins may manage ordinary accounts, but cannot grant, edit or delete super administrators.
module.exports = async function accountPolicy(req, res, next) {
  if (req.auth.user.U_TYPE === 'מנהל על') return next();
  if (req.body.U_TYPE === 'מנהל על') return res.status(403).json({ message: 'Super administrator required' });
  const userName = req.body.U_USER_NAME_ORIGINAL || req.body.U_USER_NAME || req.query.userName;
  const cardCode = req.body.U_CARD_CODE || req.query.cardCode;
  if (req.path === '/creatNewUser') return next();
  if (typeof userName !== 'string' || !userName || cardCode == null) return res.status(400).json({ message: 'Account identity required' });
  try {
    const [users] = await pool.query('SELECT U_TYPE FROM BENZI_APP_USERS WHERE U_USER_NAME = ? AND U_CARD_CODE = ?', [userName, cardCode]);
    if (users.some(user => user.U_TYPE === 'מנהל על')) return res.status(403).json({ message: 'Super administrator required' });
    next();
  } catch { res.status(503).json({ message: 'Account authorization unavailable' }); }
};
