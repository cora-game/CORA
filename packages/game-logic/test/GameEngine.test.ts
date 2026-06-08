import { test, expect, describe, mock, beforeEach, afterEach, setSystemTime } from 'bun:test';
import { GameEngine } from '../src/GameEngine';
import type { Question } from '@shared/question';
import { getSpecialtyMultiplier } from '@shared/characterStats';

const mockQuestions: Question[] = [
  {
    id: "q_1",
    category: "math",
    questionText: "1+1?",
    options: [{ id: "A", text: "2", score: true }, { id: "B", text: "3", score: false }, { id: "C", text: "4", score: false }, { id: "D", text: "5", score: false }],
    explanation: "yes"
  },
  {
    id: "q_2",
    category: "logical",
    questionText: "is it?",
    options: [{ id: "A", text: "no", score: false }, { id: "B", text: "yes", score: true }, { id: "C", text: "maybe", score: false }, { id: "D", text: "idk", score: false }],
    explanation: "yes"
  },
  {
    id: "q_3",
    category: "math",
    questionText: "2+2?",
    options: [{ id: "A", text: "4", score: true }, { id: "B", text: "5", score: false }, { id: "C", text: "6", score: false }, { id: "D", text: "7", score: false }],
    explanation: "yes"
  },
  {
    id: "q_4",
    category: "logical",
    questionText: "why?",
    options: [{ id: "A", text: "because", score: true }, { id: "B", text: "not", score: false }, { id: "C", text: "so", score: false }, { id: "D", text: "no", score: false }],
    explanation: "yes"
  },
  {
    id: "q_5",
    category: "sequence",
    questionText: "1,2,3...?",
    options: [{ id: "A", text: "4", score: true }, { id: "B", text: "5", score: false }, { id: "C", text: "6", score: false }, { id: "D", text: "7", score: false }],
    explanation: "yes"
  }
];

describe('GameEngine', () => {
  beforeEach(() => {
    setSystemTime(new Date(1000000000000));
  });

  afterEach(() => {
    setSystemTime();
  });

  test('initializes correctly', () => {
    const engine = new GameEngine([{ address: 'player1', characterId: 'einstein' }, { address: 'player2', characterId: 'alan_turing' }], mockQuestions);
    const healths = engine.getHealth();
    expect(healths['player1']).toBe(100);
    expect(healths['player2']).toBe(100);
    
    const state1 = engine.getStateForPlayer('player1');
    expect(state1.hand.length).toBe(5);
    expect(state1.timer.remainingMs).toBe(180_000);
  });

  test('playCard successful attack', () => {
    const engine = new GameEngine([{ address: 'player1', characterId: 'einstein' }, { address: 'player2', characterId: 'alan_turing' }], mockQuestions);
    engine.start();

    // Find an attack card in player1's hand
    const state = engine.getStateForPlayer('player1');
    const attackCard = state.hand.find(c => c.type === 'attack');
    
    if (!attackCard) return; // Might happen if randomly dealt only heals, but mock data and shuffle usually provide a mix

    // Use internal state to peek at correct option
    const internalPlayer1 = (engine as any).players.get('player1');
    const engineCard = internalPlayer1.hand.find((c: any) => c.id === attackCard.id);
    const correctOptionId = engineCard.correctOptionId;
    
    const result = engine.playCard('player1', attackCard.id, correctOptionId);
    
    const expectedDamage = GameEngine.BASE_DAMAGE * getSpecialtyMultiplier('einstein', engineCard.question.category);
    expect(result.success).toBe(true);
    expect(result.correct).toBe(true);
    expect(result.damage).toBe(expectedDamage);
    expect(engine.getHealth()['player2']).toBe(100 - expectedDamage);
    expect(engine.getScores()['player1']).toBe(expectedDamage);
    
    // Check cooldown
    const earlyResult = engine.playCard('player1', state.hand[1].id, 'A');
    expect(earlyResult.success).toBe(false);
  });

  test('playCard successful heal caps at 100', () => {
    const engine = new GameEngine([{ address: 'player1', characterId: 'einstein' }, { address: 'player2', characterId: 'alan_turing' }], mockQuestions);
    engine.start();

    const internalPlayer1 = (engine as any).players.get('player1');
    
    // Simulate taking damage first
    internalPlayer1.health = 80;

    // We force a heal card to exist for testing
    internalPlayer1.hand[0].type = 'heal';
    const healCard = internalPlayer1.hand[0];

    // fast forward time by 600ms to bypass rate limit if we already played
    setSystemTime(new Date(Date.now() + 600));
    
    const result = engine.playCard('player1', healCard.id, healCard.correctOptionId);
    
    const expectedHeal = GameEngine.BASE_HEAL * getSpecialtyMultiplier('einstein', healCard.question.category);
    expect(result.success).toBe(true);
    expect(result.correct).toBe(true);
    expect(result.heal).toBe(expectedHeal);
    expect(engine.getHealth()['player1']).toBe(80 + expectedHeal);
    expect(engine.getScores()['player1']).toBe(expectedHeal);
  });

  test('playCard wrong answer', () => {
    const engine = new GameEngine([{ address: 'player1', characterId: 'einstein' }, { address: 'player2', characterId: 'alan_turing' }], mockQuestions);
    engine.start();

    const internalPlayer1 = (engine as any).players.get('player1');
    const firstCard = internalPlayer1.hand[0];
    
    // pick a wrong answer
    const wrongOption = firstCard.question.options.find((o: any) => o.id !== firstCard.correctOptionId);

    setSystemTime(new Date(Date.now() + 600));
    const result = engine.playCard('player1', firstCard.id, wrongOption.id);

    expect(result.success).toBe(true);
    expect(result.correct).toBe(false);
    expect(result.damage).toBe(0);
    expect(result.heal).toBe(0);
    expect(engine.getHealth()['player2']).toBe(100);
    expect(engine.getHealth()['player1']).toBe(100);
  });

  test('getStateForPlayer returns live current correct streak and resets on wrong answers', () => {
    const engine = new GameEngine([{ address: 'player1', characterId: 'einstein' }, { address: 'player2', characterId: 'alan_turing' }], mockQuestions);
    engine.start();

    const internalPlayer1 = (engine as any).players.get('player1');

    const firstCard = internalPlayer1.hand[0];
    setSystemTime(new Date(Date.now() + 600));
    engine.playCard('player1', firstCard.id, firstCard.correctOptionId);
    expect(engine.getStateForPlayer('player1').player.currentCorrectStreak).toBe(1);

    const secondCard = internalPlayer1.hand[0];
    setSystemTime(new Date(Date.now() + 1200));
    engine.playCard('player1', secondCard.id, secondCard.correctOptionId);
    expect(engine.getStateForPlayer('player1').player.currentCorrectStreak).toBe(2);

    const thirdCard = internalPlayer1.hand[0];
    const wrongOption = thirdCard.question.options.find((o: any) => o.id !== thirdCard.correctOptionId);
    setSystemTime(new Date(Date.now() + 1800));
    engine.playCard('player1', thirdCard.id, wrongOption.id);

    const state = engine.getStateForPlayer('player1');
    expect(state.player.currentCorrectStreak).toBe(0);
    expect(state.player.correctAnswers).toBe(2);
  });

  test('win condition - hp zero', () => {
    const engine = new GameEngine([{ address: 'player1', characterId: 'einstein' }, { address: 'player2', characterId: 'alan_turing' }], mockQuestions);
    engine.start();

    let gameOverEventFired = false;
    engine.on('gameOver', (data) => {
      gameOverEventFired = true;
      expect(data.winnerAddress).toBe('player1');
      expect(data.reason).toBe('hp_zero');
    });

    const internalPlayer1 = (engine as any).players.get('player1');
    const internalPlayer2 = (engine as any).players.get('player2');
    internalPlayer1.roundsWon = 1; // Start with 1 round win so this round ends the game
    
    // We need 2 rounds to win, so simulate winning the first
    internalPlayer1.roundsWon = 1;
    // Bring player 2 health low enough for the next correct attack to end the match.
    internalPlayer2.health = 1;
    
    internalPlayer1.hand[0].type = 'attack';
    const attackCard = internalPlayer1.hand[0];

    setSystemTime(new Date(Date.now() + 600));
    const result = engine.playCard('player1', attackCard.id, attackCard.correctOptionId);
    
    expect(result.gameOver).toBe(true);
    expect(result.winnerAddress).toBe('player1');
    expect(gameOverEventFired).toBe(true);
    expect(engine.isFinished()).toBe(true);

    // Can't play cards after game over
    setSystemTime(new Date(Date.now() + 1200));
    const postGameResult = engine.playCard('player2', internalPlayer2.hand[0].id, internalPlayer2.hand[0].correctOptionId);
    expect(postGameResult.success).toBe(false);
  });

  test('win condition - time_up determines winner by score before health', () => {
    const engine = new GameEngine([{ address: 'player1', characterId: 'einstein' }, { address: 'player2', characterId: 'alan_turing' }], mockQuestions);
    engine.start();

    let gameOverData: any = null;
    engine.on('gameOver', (data) => {
      gameOverData = data;
    });

    // Force the final round state so determineMatchOutcome() is used directly.
    const internalPlayer1 = (engine as any).players.get('player1');
    internalPlayer1.roundsWon = 1;
    internalPlayer1.correctAnswers = 0;

    // Player1 has higher score, but lower health than player2.
    // Final winner should still be player1 because score now beats health.
    internalPlayer1.score = 120;
    internalPlayer1.health = 40;

    const internalPlayer2 = (engine as any).players.get('player2');
    internalPlayer2.roundsWon = 1;
    internalPlayer2.correctAnswers = 0;
    internalPlayer2.score = 80;
    internalPlayer2.health = 40;

    (engine as any).currentRound = 3;

    // Simulate time running out by ticking through the entire match
    const tickFn = (engine as any).tick.bind(engine);
    for (let i = 0; i < 300; i++) {
      setSystemTime(new Date(1000000000000 + (i + 1) * 1000));
      tickFn();
      if ((engine as any).finished) break;
    }

    expect(engine.isFinished()).toBe(true);
    expect(gameOverData).not.toBeNull();
    expect(gameOverData.reason).toBe('time_up');
    expect(gameOverData.winnerAddress).toBe('player1');
  });

  test('win condition - time_up tie-break by health when rounds and score are equal', () => {
    const engine = new GameEngine([{ address: 'player1', characterId: 'einstein' }, { address: 'player2', characterId: 'alan_turing' }], mockQuestions);
    engine.start();

    let gameOverData: any = null;
    engine.on('gameOver', (data) => {
      gameOverData = data;
    });

    // Give player2 one round win so the next round result ends the match
    const internalPlayer2 = (engine as any).players.get('player2');
    internalPlayer2.roundsWon = 1;

    const internalPlayer1 = (engine as any).players.get('player1');

    // Same rounds and score, so health should decide.
    internalPlayer1.score = 100;
    internalPlayer1.health = 45;
    internalPlayer2.score = 100;
    internalPlayer2.health = 70;

    // Simulate time running out
    const tickFn = (engine as any).tick.bind(engine);
    for (let i = 0; i < 300; i++) {
      setSystemTime(new Date(1000000000000 + (i + 1) * 1000));
      tickFn();
      if ((engine as any).finished) break;
    }

    expect(engine.isFinished()).toBe(true);
    expect(gameOverData.reason).toBe('time_up');
    expect(gameOverData.winnerAddress).toBe('player2');
  });

  test('extra-point phase activates at 60s remaining with x2 multiplier', () => {
    const engine = new GameEngine([{ address: 'player1', characterId: 'einstein' }, { address: 'player2', characterId: 'alan_turing' }], mockQuestions);
    engine.start();

    let phaseChangeData: any = null;
    engine.on('phaseChange', (data) => {
      phaseChangeData = data;
    });

    // Fast-forward to just before extra-point threshold (60s remaining = 240s elapsed)
    (engine as any).remainingMs = 61_000;

    // One tick brings us to 60s → triggers extra_point
    setSystemTime(new Date(1000000000000 + 240_000));
    (engine as any).tick();

    expect(phaseChangeData).not.toBeNull();
    expect(phaseChangeData.phase).toBe('extra_point');
    expect(engine.getTimerState().phase).toBe('extra_point');

    // Now play a card — should deal ×2 damage
    const internalPlayer1 = (engine as any).players.get('player1');
    internalPlayer1.roundsWon = 1; // So this attack ends the match and doesn't reset health
    internalPlayer1.hand[0].type = 'attack';
    const attackCard = internalPlayer1.hand[0];

    setSystemTime(new Date(Date.now() + 600));
    const result = engine.playCard('player1', attackCard.id, attackCard.correctOptionId);

    const expectedMult = 2 * getSpecialtyMultiplier('einstein', attackCard.question.category);
    const expectedDamage = GameEngine.BASE_DAMAGE * expectedMult;
    expect(result.success).toBe(true);
    expect(result.correct).toBe(true);
    expect(result.multiplier).toBe(expectedMult);
    expect(result.damage).toBe(expectedDamage);
    expect(engine.getHealth()['player2']).toBe(Math.max(0, 100 - expectedDamage));
  });

  test('extra-point phase x2 heal', () => {
    const engine = new GameEngine([{ address: 'player1', characterId: 'einstein' }, { address: 'player2', characterId: 'alan_turing' }], mockQuestions);
    engine.start();

    // Enter extra-point phase
    (engine as any).remainingMs = 60_000;
    (engine as any).phase = 'extra_point';

    const internalPlayer1 = (engine as any).players.get('player1');
    internalPlayer1.health = 70;
    internalPlayer1.hand[0].type = 'heal';
    const healCard = internalPlayer1.hand[0];

    setSystemTime(new Date(Date.now() + 600));
    const result = engine.playCard('player1', healCard.id, healCard.correctOptionId);

    const expectedMult = 2 * getSpecialtyMultiplier('einstein', healCard.question.category);
    const expectedHeal = GameEngine.BASE_HEAL * expectedMult;
    expect(result.success).toBe(true);
    expect(result.correct).toBe(true);
    expect(result.multiplier).toBe(expectedMult);
    expect(result.heal).toBe(expectedHeal);
    expect(engine.getHealth()['player1']).toBe(
      Math.min(GameEngine.STARTING_HEALTH, 70 + expectedHeal)
    );
  });

  test('surrender via stop() emits gameOver with surrender reason', () => {
    const engine = new GameEngine([{ address: 'player1', characterId: 'einstein' }, { address: 'player2', characterId: 'alan_turing' }], mockQuestions);
    engine.start();

    let gameOverData: any = null;
    engine.on('gameOver', (data) => {
      gameOverData = data;
    });

    engine.stop('player2');

    expect(engine.isFinished()).toBe(true);
    expect(engine.isActive()).toBe(false);
    expect(gameOverData).not.toBeNull();
    expect(gameOverData.winnerAddress).toBe('player1');
    expect(gameOverData.reason).toBe('surrender');
    expect(gameOverData.surrenderedAddress).toBe('player2');
  });

  test('stop() without surrender address just stops (no gameOver)', () => {
    const engine = new GameEngine([{ address: 'player1', characterId: 'einstein' }, { address: 'player2', characterId: 'alan_turing' }], mockQuestions);
    engine.start();

    let gameOverFired = false;
    engine.on('gameOver', () => { gameOverFired = true; });

    engine.stop(); // No surrender address

    expect(engine.isFinished()).toBe(true);
    expect(gameOverFired).toBe(false);
  });

  test('card refill from queue after playing', () => {
    // Use a larger question set to ensure the queue has cards beyond the initial hand
    const manyQuestions = Array.from({ length: 20 }, (_, i) => ({
      id: `q_refill_${i}`,
      category: 'math' as const,
      questionText: `Question ${i}?`,
      options: [
        { id: 'A', text: 'correct', score: true },
        { id: 'B', text: 'wrong1', score: false },
        { id: 'C', text: 'wrong2', score: false },
        { id: 'D', text: 'wrong3', score: false },
      ] as [any, any, any, any],
      explanation: 'test',
    }));

    const engine = new GameEngine([{ address: 'player1', characterId: 'einstein' }, { address: 'player2', characterId: 'alan_turing' }], manyQuestions);
    engine.start();

    const internalPlayer1 = (engine as any).players.get('player1');
    expect(internalPlayer1.hand.length).toBe(5);

    const firstCard = internalPlayer1.hand[0];
    const firstCardId = firstCard.id;

    setSystemTime(new Date(Date.now() + 600));
    engine.playCard('player1', firstCard.id, firstCard.correctOptionId);

    // With 20 questions, the queue has more than 5 cards, so hand stays at 5
    expect(internalPlayer1.hand.length).toBe(5);

    // The played card should no longer be in hand
    expect(internalPlayer1.hand.find((c: any) => c.id === firstCardId)).toBeUndefined();
  });

  test('hand shrinks when queue is exhausted', () => {
    // With only 5 questions, queue has exactly 5 cards. Initial hand takes all 5.
    // After playing one, no refill possible → hand = 4
    const engine = new GameEngine([{ address: 'player1', characterId: 'einstein' }, { address: 'player2', characterId: 'alan_turing' }], mockQuestions);
    engine.start();

    const internalPlayer1 = (engine as any).players.get('player1');
    expect(internalPlayer1.hand.length).toBe(5);

    const firstCard = internalPlayer1.hand[0];

    setSystemTime(new Date(Date.now() + 600));
    engine.playCard('player1', firstCard.id, firstCard.correctOptionId);

    // Queue exhausted — hand shrinks
    expect(internalPlayer1.hand.length).toBe(4);
  });

  test('resetCharacterStates sets all players to stay', () => {
    const engine = new GameEngine([{ address: 'player1', characterId: 'einstein' }, { address: 'player2', characterId: 'alan_turing' }], mockQuestions);
    engine.start();

    // Manually set some states
    const internalPlayer1 = (engine as any).players.get('player1');
    const internalPlayer2 = (engine as any).players.get('player2');
    internalPlayer1.characterState = 'action';
    internalPlayer2.characterState = 'angry';

    engine.resetCharacterStates();

    expect(internalPlayer1.characterState).toBe('stay');
    expect(internalPlayer2.characterState).toBe('stay');
  });

  test('getScores and getHealth return consistent data after plays', () => {
    const engine = new GameEngine([{ address: 'player1', characterId: 'einstein' }, { address: 'player2', characterId: 'alan_turing' }], mockQuestions);
    engine.start();

    // Initial state
    const scores0 = engine.getScores();
    const health0 = engine.getHealth();
    expect(scores0['player1']).toBe(0);
    expect(scores0['player2']).toBe(0);
    expect(health0['player1']).toBe(100);
    expect(health0['player2']).toBe(100);

    // Play a correct attack
    const internalPlayer1 = (engine as any).players.get('player1');
    internalPlayer1.hand[0].type = 'attack';
    const card = internalPlayer1.hand[0];

    setSystemTime(new Date(Date.now() + 600));
    engine.playCard('player1', card.id, card.correctOptionId);

    const expectedDamage = GameEngine.BASE_DAMAGE * getSpecialtyMultiplier('einstein', card.question.category);
    const scores1 = engine.getScores();
    const health1 = engine.getHealth();
    expect(scores1['player1']).toBe(expectedDamage);
    expect(health1['player2']).toBe(100 - expectedDamage);
    // Player 1 health unchanged
    expect(health1['player1']).toBe(100);
  });

  test('getStateForPlayer hides correct answers', () => {
    const engine = new GameEngine([{ address: 'player1', characterId: 'einstein' }, { address: 'player2', characterId: 'alan_turing' }], mockQuestions);
    const state = engine.getStateForPlayer('player1');

    // Cards should not have correctOptionId
    for (const card of state.hand) {
      expect((card as any).correctOptionId).toBeUndefined();
      // But should have question with options
      expect(card.question.options.length).toBeGreaterThan(0);
      for (const opt of card.question.options) {
        expect((opt as any).score).toBeUndefined();
      }
    }
  });

  test('getPlayerAddresses returns both addresses', () => {
    const engine = new GameEngine([{ address: 'player1', characterId: 'einstein' }, { address: 'player2', characterId: 'alan_turing' }], mockQuestions);
    const addrs = engine.getPlayerAddresses();
    expect(addrs).toEqual(['player1', 'player2']);
  });

  test('double start is no-op', () => {
    const engine = new GameEngine([{ address: 'player1', characterId: 'einstein' }, { address: 'player2', characterId: 'alan_turing' }], mockQuestions);
    engine.start();
    engine.start(); // Should not throw or reset
    expect(engine.isActive()).toBe(true);
  });

  test('double stop is safe', () => {
    const engine = new GameEngine([{ address: 'player1', characterId: 'einstein' }, { address: 'player2', characterId: 'alan_turing' }], mockQuestions);
    engine.start();
    engine.stop('player1');
    engine.stop('player1'); // Should not throw
    expect(engine.isFinished()).toBe(true);
  });

  test('damage log is capped at DAMAGE_LOG_MAX', () => {
    const engine = new GameEngine([{ address: 'player1', characterId: 'einstein' }, { address: 'player2', characterId: 'alan_turing' }], mockQuestions);
    engine.start();

    const internalPlayer1 = (engine as any).players.get('player1');

    // Play many correct attacks to fill the damage log
    for (let i = 0; i < 25; i++) {
      // Ensure we have cards and bypass cooldown
      if (internalPlayer1.hand.length === 0) break;
      internalPlayer1.hand[0].type = 'attack';
      const card = internalPlayer1.hand[0];

      setSystemTime(new Date(1000000000000 + (i + 1) * 1000));
      engine.playCard('player1', card.id, card.correctOptionId);

      if (engine.isFinished()) break;
    }

    const state = engine.getStateForPlayer('player1');
    expect(state.damageLog.length).toBeLessThanOrEqual(GameEngine.DAMAGE_LOG_MAX);
  });
});
