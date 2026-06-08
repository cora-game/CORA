# ML Data Collection for Anti-Cheat

## Overview
Currently, the CORA Anti-Cheat System uses a **rule-based statistical analysis engine** (`AntiCheatAnalyzer.ts`) to flag suspicious or cheating behavior. While these initial thresholds (e.g., < 1.5s average answer time, > 90% accuracy) provide a strong baseline, sophisticated bots or external-tool users may eventually adapt.

Our long-term strategy is to train a **Machine Learning classifier** (e.g., Random Forest or a neural network) on real-world match data to detect subtle patterns in player behavior.

This document outlines the data collection strategy required to build that dataset.

## Data Schema
At the end of every match, the `GameEngine` generates an `AntiCheatVerdict` for each player, containing raw `PlayerMatchStats`.

To train an ML model, we need to collect these raw stats along with metadata. The target schema for the collected data is:

```json
{
  "matchId": "string",            // Unique match identifier
  "timestamp": "iso8601",         // When the match ended
  "playerAddress": "string",      // Player wallet address
  
  // Input Features (X)
  "stats": {
    "totalPlays": "integer",             // Total number of answers submitted
    "correctPlays": "integer",           // Number of correct answers
    "accuracyRate": "float",             // correctPlays / totalPlays
    "avgAnswerTimeMs": "float",          // Average time taken to answer a question
    "answerTimeStdDev": "float",         // Standard deviation of answer times
    "longestCorrectStreak": "integer",   // Maximum consecutive correct answers
    "cooldownHits": "integer",           // Number of times player hit the 500ms rate limit
    "cadenceCoeffOfVariation": "float"   // Regularity of inputs (StdDev / Mean)
  },
  
  // Labels (y)
  "ruleBasedVerdict": "string",   // 'trusted', 'suspicious', or 'rejected'
  "manualLabel": "string"         // Nullable. Populated later by human review ('clean', 'bot', 'external_tool')
}
```

## Collection Mechanism

1. **Current Implementation (Logging)**
   Currently, the `RoomManager` logs these stats to `stdout` upon match completion:
   ```typescript
   console.log(`[Anti-Cheat] Stats for ${address}:`, JSON.stringify(verdict.stats));
   ```
   *We will capture these server logs via our infrastructure (e.g., Datadog, AWS CloudWatch, or PM2 logs) for initial analysis.*

2. **Future Implementation (Database)**
   In a future update, these payloads should be persisted directly to a database (e.g., PostgreSQL or MongoDB) for easier querying.
   *Proposed Table*: `MatchAnalytics`
   *Columns*: `id`, `match_id`, `player_address`, `stats_json`, `created_at`, `manual_label`.

## The ML Pipeline Strategy

1. **Phase 1: Data Gathering (Current)**
   - Run the game in production with the rule-based thresholds.
   - Collect at least 10,000 match records.
   - Export the logged JSON payloads to a `.csv` or `.parquet` file.

2. **Phase 2: Data Labeling**
   - The `ruleBasedVerdict` provides a weak label.
   - We must manually review a sample of matches (e.g., looking at "suspicious" matches or reported players) to assign a definitive `manualLabel` (1 = cheat, 0 = clean).

3. **Phase 3: Model Training**
   - We will use Python (Scikit-Learn or XGBoost) in a Jupyter notebook (`notebooks/anti-cheat-training.ipynb`).
   - Train a supervised classifier on the features (`accuracyRate`, `avgAnswerTimeMs`, `answerTimeStdDev`, etc.).
   - Evaluate model precision and recall. (We want high precision to avoid false positives).

4. **Phase 4: Integration**
   - Once the model outperforms the rule-based system, export it (e.g., as ONNX).
   - Integrate an ONNX runtime into the backend `RoomManager`, or replace the `AntiCheatAnalyzer.ts` logic with a call to a dedicated ML microservice.
