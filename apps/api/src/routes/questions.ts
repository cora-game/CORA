import { Hono } from 'hono';
import { fetchMatchQuestions } from '../questions';

export function createQuestionsRouter() {
  const router = new Hono();

  router.get('/questions', async (c) => {
    try {
      // Rely on our single source of truth in questions.ts.
      const masterDeck = await fetchMatchQuestions();
      return c.json({ questions: masterDeck });
    } catch (error) {
      console.error('Failed to load questions via API:', error);
      return c.json({ error: 'Failed to load questions' }, 500);
    }
  });

  return router;
}
