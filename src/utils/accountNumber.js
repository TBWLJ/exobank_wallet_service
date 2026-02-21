const generateAccountNumberCandidate = () => {
  const suffix = Math.floor(Math.random() * 10000000)
    .toString()
    .padStart(7, '0');
  return `300${suffix}`;
};

module.exports = {
  generateAccountNumberCandidate,
};
