import type { AntiCheatVerdict, AntiCheatFlag, PlayerMatchStats } from './types';

interface PlayRecord {
  timestamp: number;
  correct: boolean;
  timeSinceLastPlay: number;
  wasCooldownHit: boolean;
}

export class AntiCheatAnalyzer {
  private playerRecords: Map<string, PlayRecord[]> = new Map();
  private matchStartTime: number;

  constructor() {
    this.matchStartTime = Date.now();
  }

  /**
   * Records a play event for a player.
   */
  public recordPlay(
    playerAddress: string,
    correct: boolean,
    wasCooldownHit: boolean = false
  ): void {
    if (!this.playerRecords.has(playerAddress)) {
      this.playerRecords.set(playerAddress, []);
    }

    const records = this.playerRecords.get(playerAddress)!;
    const now = Date.now();
    const lastTimestamp = records.length > 0 ? records[records.length - 1].timestamp : this.matchStartTime;
    const timeSinceLastPlay = now - lastTimestamp;

    records.push({
      timestamp: now,
      correct,
      timeSinceLastPlay,
      wasCooldownHit,
    });
  }

  /**
   * Generates final anti-cheat verdicts for all players.
   */
  public getVerdicts(): Record<string, AntiCheatVerdict> {
    const verdicts: Record<string, AntiCheatVerdict> = {};

    for (const [address, records] of this.playerRecords.entries()) {
      verdicts[address] = this.analyzePlayer(address, records);
    }

    return verdicts;
  }

  /**
   * Generate an individual player verdict based on their records.
   */
  private analyzePlayer(playerAddress: string, records: PlayRecord[]): AntiCheatVerdict {
    const stats = this.calculateStats(records);
    const flags: AntiCheatFlag[] = [];
    
    // Default to trusted if not enough data
    if (records.length < 5) {
      return {
        playerAddress,
        trustScore: 1.0,
        verdict: 'trusted',
        flags,
        stats
      };
    }

    let totalPenalty = 0;

    // Signal 1: Answer Speed (too fast)
    // Assuming human average is > 2000ms. If average is < 1500ms, it's very suspicious.
    if (stats.avgAnswerTimeMs < 1500) {
      const penalty = Math.min(1.0, (1500 - stats.avgAnswerTimeMs) / 1000);
      flags.push({
        signal: 'answer_speed',
        value: stats.avgAnswerTimeMs,
        threshold: 1500,
        penalty,
        description: `Average answer time is suspiciously fast (${Math.round(stats.avgAnswerTimeMs)}ms).`
      });
      totalPenalty += penalty;
    }

    // Signal 2: Speed Variance (too consistent)
    // Bots have low variance. If std dev is < 300ms, it's suspicious.
    if (stats.answerTimeStdDev < 300 && records.length >= 10) {
      const penalty = 0.5; // Fixed penalty for unnatural consistency
      flags.push({
        signal: 'speed_variance',
        value: stats.answerTimeStdDev,
        threshold: 300,
        penalty,
        description: `Answer timing is unnaturally consistent (std dev ${Math.round(stats.answerTimeStdDev)}ms).`
      });
      totalPenalty += penalty;
    }

    // Signal 3: Accuracy Rate (too high)
    // Trivia games have ~60-70% accuracy. >90% over 15+ plays is suspicious.
    if (stats.accuracyRate > 0.9 && records.length >= 15) {
      const penalty = (stats.accuracyRate - 0.9) * 5; // e.g., 0.95 -> 0.25 penalty
      flags.push({
        signal: 'accuracy_rate',
        value: stats.accuracyRate,
        threshold: 0.9,
        penalty,
        description: `Accuracy rate is suspiciously high (${Math.round(stats.accuracyRate * 100)}%).`
      });
      totalPenalty += penalty;
    }

    // Signal 4: Perfect Streaks
    // Streak of 10+ is very rare.
    if (stats.longestCorrectStreak >= 10) {
      const penalty = Math.min(1.0, (stats.longestCorrectStreak - 9) * 0.2); // 10 = 0.2, 14 = 1.0
      flags.push({
        signal: 'perfect_streak',
        value: stats.longestCorrectStreak,
        threshold: 10,
        penalty,
        description: `Suspiciously long streak of correct answers (${stats.longestCorrectStreak} in a row).`
      });
      totalPenalty += penalty;
    }

    // Signal 5: Cadence Regularity (macros)
    // Low CV means regular intervals. CV < 0.1 is highly suspicious of a macro.
    if (stats.cadenceCoeffOfVariation < 0.1 && records.length >= 10) {
      const penalty = 0.8;
      flags.push({
        signal: 'cadence_regularity',
        value: stats.cadenceCoeffOfVariation,
        threshold: 0.1,
        penalty,
        description: `Input timing suggests a macro or script (CV ${stats.cadenceCoeffOfVariation.toFixed(2)}).`
      });
      totalPenalty += penalty;
    }

    // Signal 6: Rapid-fire (hitting cooldown limits frequently)
    if (stats.cooldownHits > 3) {
      const penalty = Math.min(1.0, stats.cooldownHits * 0.2);
      flags.push({
        signal: 'cooldown_hits',
        value: stats.cooldownHits,
        threshold: 3,
        penalty,
        description: `Triggered the play rate-limit multiple times (${stats.cooldownHits} times).`
      });
      totalPenalty += penalty;
    }

    // Calculate final score
    const trustScore = Math.max(0, 1.0 - totalPenalty);
    
    let verdict: 'trusted' | 'suspicious' | 'rejected' = 'trusted';
    if (trustScore < 0.4) {
      verdict = 'rejected';
    } else if (trustScore < 0.7) {
      verdict = 'suspicious';
    }

    return {
      playerAddress,
      trustScore,
      verdict,
      flags,
      stats
    };
  }

  private calculateStats(records: PlayRecord[]): PlayerMatchStats {
    const totalPlays = records.length;
    let correctPlays = 0;
    let longestCorrectStreak = 0;
    let currentStreak = 0;
    let cooldownHits = 0;
    
    let totalAnswerTime = 0;
    const answerTimes: number[] = [];

    for (const record of records) {
      if (record.correct) {
        correctPlays++;
        currentStreak++;
        if (currentStreak > longestCorrectStreak) {
          longestCorrectStreak = currentStreak;
        }
      } else {
        currentStreak = 0;
      }

      if (record.wasCooldownHit) {
        cooldownHits++;
      }

      totalAnswerTime += record.timeSinceLastPlay;
      answerTimes.push(record.timeSinceLastPlay);
    }

    const accuracyRate = totalPlays > 0 ? correctPlays / totalPlays : 0;
    const avgAnswerTimeMs = totalPlays > 0 ? totalAnswerTime / totalPlays : 0;

    // Calculate standard deviation of answer times
    let varianceSum = 0;
    for (const time of answerTimes) {
      varianceSum += Math.pow(time - avgAnswerTimeMs, 2);
    }
    const variance = totalPlays > 1 ? varianceSum / (totalPlays - 1) : 0;
    const answerTimeStdDev = Math.sqrt(variance);

    // Coefficient of Variation (StdDev / Mean) -> measures relative dispersion
    const cadenceCoeffOfVariation = avgAnswerTimeMs > 0 ? answerTimeStdDev / avgAnswerTimeMs : 0;

    return {
      totalPlays,
      correctPlays,
      accuracyRate,
      avgAnswerTimeMs,
      answerTimeStdDev,
      longestCorrectStreak,
      cooldownHits,
      cadenceCoeffOfVariation
    };
  }
}
