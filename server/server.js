import 'dotenv/config';
import { connectDatabase } from './config/db.js';
import app from './app.js';

const port = process.env.PORT || 5000;

connectDatabase()
  .then(() => app.listen(port, () => console.log(`StudyBot API listening on http://localhost:${port}`)))
  .catch((error) => {
    console.error('Could not start StudyBot API:', error.message);
    process.exit(1);
  });
