const generateReference = (prefix = 'TXN') => {
  const random = Math.floor(Math.random() * 1e6)
    .toString()
    .padStart(6, '0');
  return `${prefix}${Date.now()}${random}`;
};

module.exports = {
  generateReference,
};
