import { test, expect, describe, setSystemTime, beforeEach, afterEach } from 'bun:test';
import { AntiCheatAnalyzer } from '../src/AntiCheatAnalyzer';

describe('AntiCheatAnalyzer', () => {
  let analyzer: AntiCheatAnalyzer;

  beforeEach(() => {
    setSystemTime(new Date(1000000000000));
    analyzer = new AntiCheatAnalyzer();
  });

  afterEach(() => {
    setSystemTime();
  });

  test('human-like play is trusted', () => {
    // 10 human-like plays (avg > 2s, varying, mixed accuracy)
    const answerTimes = [2500, 3100, 4000, 2200, 5000, 1800, 3500, 2900, 4200, 2600];
    const correctAnswers = [true, false, true, true, false, true, true, false, true, true];
    
    let currentTime = 1000000000000;

    for (let i = 0; i < 10; i++) {
      currentTime += answerTimes[i];
      setSystemTime(new Date(currentTime));
      analyzer.recordPlay('player_human', correctAnswers[i]);
    }

    const verdicts = analyzer.getVerdicts();
    const verdict = verdicts['player_human'];

    expect(verdict.verdict).toBe('trusted');
    expect(verdict.flags.length).toBe(0);
    expect(verdict.stats.accuracyRate).toBe(0.7);
    expect(verdict.stats.avgAnswerTimeMs).toBeGreaterThan(2000);
  });

  test('bot-like play is rejected (fast and consistent)', () => {
    // 10 bot-like plays (avg 500ms, very consistent std dev, 100% accuracy)
    const answerTimes = [500, 520, 490, 510, 505, 495, 515, 485, 525, 490];
    
    let currentTime = 1000000000000;

    for (let i = 0; i < 10; i++) {
      currentTime += answerTimes[i];
      setSystemTime(new Date(currentTime));
      analyzer.recordPlay('player_bot', true);
    }

    const verdicts = analyzer.getVerdicts();
    const verdict = verdicts['player_bot'];

    expect(verdict.verdict).toBe('rejected');
    expect(verdict.flags.length).toBeGreaterThan(0);
    expect(verdict.flags.some(f => f.signal === 'answer_speed')).toBe(true);
    expect(verdict.flags.some(f => f.signal === 'speed_variance')).toBe(true);
    expect(verdict.flags.some(f => f.signal === 'perfect_streak')).toBe(true);
  });

  test('high accuracy over many plays is penalized', () => {
    // 16 plays, all correct, normal human timing
    let currentTime = 1000000000000;

    for (let i = 0; i < 16; i++) {
      currentTime += 3000 + (Math.random() * 1000); // 3s-4s
      setSystemTime(new Date(currentTime));
      analyzer.recordPlay('player_smart', true);
    }

    const verdicts = analyzer.getVerdicts();
    const verdict = verdicts['player_smart'];

    // Depending on threshold, this should be at least suspicious or rejected due to perfect streak + accuracy
    expect(['suspicious', 'rejected']).toContain(verdict.verdict);
    expect(verdict.flags.some(f => f.signal === 'accuracy_rate')).toBe(true);
    expect(verdict.flags.some(f => f.signal === 'perfect_streak')).toBe(true);
  });

  test('not enough data defaults to trusted', () => {
    // 3 plays, all perfect and fast
    let currentTime = 1000000000000;

    for (let i = 0; i < 3; i++) {
      currentTime += 500;
      setSystemTime(new Date(currentTime));
      analyzer.recordPlay('player_new', true);
    }

    const verdicts = analyzer.getVerdicts();
    const verdict = verdicts['player_new'];

    expect(verdict.verdict).toBe('trusted');
    expect(verdict.stats.totalPlays).toBe(3);
  });

  test('frequent rate limits triggers penalty', () => {
    // 10 plays, normal time, but lots of cooldown hits
    let currentTime = 1000000000000;

    for (let i = 0; i < 10; i++) {
      currentTime += 3000;
      setSystemTime(new Date(currentTime));
      
      // Simulate spamming the button 4 times before it works
      analyzer.recordPlay('player_spammer', false, true);
      analyzer.recordPlay('player_spammer', false, true);
      analyzer.recordPlay('player_spammer', false, true);
      analyzer.recordPlay('player_spammer', false, true);
      
      // The actual play
      analyzer.recordPlay('player_spammer', true, false);
    }

    const verdicts = analyzer.getVerdicts();
    const verdict = verdicts['player_spammer'];

    // 40 cooldown hits is massive penalty -> rejected
    expect(verdict.verdict).toBe('rejected');
    expect(verdict.flags.some(f => f.signal === 'cooldown_hits')).toBe(true);
  });
});
