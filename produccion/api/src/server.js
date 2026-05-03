import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from './services/config.js';
import { healthRouter } from './routes/health.js';
import { appApiRouter } from './routes/appApi.js';
import { cobrosRouter } from './routes/cobros.js';
import { legacyRouter } from './routes/legacy.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const iconDir = path.resolve(__dirname, '../../icon');
const legacyAssetsDir = path.resolve(__dirname, '../../Frontend_gas/assets');

const app = express();
app.use(cors({ origin: env.CORS_ORIGIN || true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use('/icon', express.static(iconDir));
app.use('/legacy-assets', express.static(legacyAssetsDir));

app.use('/health', healthRouter);
app.use('/api', appApiRouter);
app.use('/cobros', cobrosRouter);
app.use('/', legacyRouter);

const port = env.PORT || 3001;
app.listen(port, () => {
  console.log(`API listening on :${port}`);
});
