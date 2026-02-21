const prisma = require('../config/prisma');

const createAuditLog = (data, tx = prisma) => tx.auditLog.create({ data });

module.exports = {
  createAuditLog,
};
