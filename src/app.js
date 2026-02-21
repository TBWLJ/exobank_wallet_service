const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');

const walletRoutes = require('./routes/walletRoutes');
const transferRoutes = require('./routes/transferRoutes');
const errorMiddleware = require('./middlewares/errorMiddleware');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('combined'));

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/wallets', walletRoutes);
app.use('/transfers', transferRoutes);

app.use(errorMiddleware);

module.exports = app;
