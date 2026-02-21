const jwt = require('jsonwebtoken');
const env = require('../config/env');

const verifyAccessToken = (token) => jwt.verify(token, env.jwtAccessSecret);

module.exports = {
  verifyAccessToken,
};
