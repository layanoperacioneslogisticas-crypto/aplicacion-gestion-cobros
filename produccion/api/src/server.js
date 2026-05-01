import express from 'express';
import cors from 'cors';
import { env } from './services/config.js';
import { healthRouter } from './routes/health.js';
import { appApiRouter } from './routes/appApi.js';
import { cobrosRouter } from './routes/cobros.js';
import { legacyRouter } from './routes/legacy.js';

const app = express();
app.use(cors({ origin: env.CORS_ORIGIN || true, credentials: true }));
app.use(express.json({ limit: '10mb' }));

app.use('/health', healthRouter);
app.use('/api', appApiRouter);
app.use('/cobros', cobrosRouter);
app.use('/', legacyRouter);

const port = env.PORT || 3001;
app.listen(port, () => {
  console.log(`API listening on :${port}`);
});
