import express from 'express';
import cors from 'cors';
import { env } from './services/config.js';
import { healthRouter } from './routes/health.js';
import { cobrosRouter } from './routes/cobros.js';

const app = express();
app.use(cors({ origin: env.CORS_ORIGIN || true, credentials: true }));
app.use(express.json({ limit: '10mb' }));

app.get('/', (req, res) => {
  res.json({ ok: true, name: 'cobro-transporte-api' });
});

app.use('/health', healthRouter);
app.use('/cobros', cobrosRouter);

const port = env.PORT || 3001;
app.listen(port, () => {
  console.log(`API listening on :${port}`);
});
