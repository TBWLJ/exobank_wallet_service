const axios = require('axios');
const env = require('../config/env');

const notifyExternalTransfer = async (payload) => {
  if (!env.nibssSimulatorUrl) {
    return { simulated: false };
  }

  const response = await axios.post(`${env.nibssSimulatorUrl}/transfers`, payload, {
    timeout: 5000,
    headers: env.nibssApiKey
      ? {
          'x-api-key': env.nibssApiKey,
        }
      : {},
  });

  return response.data;
};

module.exports = {
  notifyExternalTransfer,
};
