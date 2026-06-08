import { GameEngine } from '../src/GameEngine';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Load actual questions to validate the real data
const questionsDir = join(import.meta.dir, '..', '..', '..', 'data', 'questions');
const questionsData = JSON.parse(readFileSync(join(questionsDir, 'questions.json'), 'utf-8'));

console.log(`\n======================================`);
console.log(`🚀 CORA Game Engine - Mock Match 🚀`);
console.log(`======================================\n`);

const players: [string, string] = ['Alice', 'Bob'];
const engine = new GameEngine(players, questionsData);

// State tracking for the simulation
let matchOver = false;

// Event listeners
engine.on('timerSync', (data) => {
  if (data.remainingMs % 10000 === 0 && data.remainingMs > 0) {
    console.log(`⏱️  Timer: ${data.remainingMs / 1000}s remaining (${data.phase})`);
  }
});

engine.on('phaseChange', (data) => {
  console.log(`\n🔥 PHASE CHANGE: ${data.phase.toUpperCase()} (x2 Points/Damage) 🔥\n`);
});

engine.on('gameOver', (data) => {
  console.log(`\n======================================`);
  console.log(`🏁 GAME OVER 🏁`);
  console.log(`Winner: ${data.winnerAddress} (Reason: ${data.reason})`);
  console.log(`Final Scores:`, engine.getScores());
  console.log(`Final Health:`, engine.getHealth());
  
  if (data.antiCheatVerdicts) {
    console.log(`\n🛡️ ANTI-CHEAT VERDICTS 🛡️`);
    for (const [address, verdict] of Object.entries(data.antiCheatVerdicts)) {
      console.log(`Player: ${address} | Verdict: ${verdict.verdict.toUpperCase()} | Score: ${verdict.trustScore.toFixed(2)}`);
      if (verdict.flags.length > 0) {
        console.log(`  Flags:`);
        verdict.flags.forEach(f => console.log(`   - [${f.signal}] ${f.description}`));
      }
      console.log(`  Stats: Plays=${verdict.stats.totalPlays}, Acc=${Math.round(verdict.stats.accuracyRate*100)}%, AvgTime=${Math.round(verdict.stats.avgAnswerTimeMs)}ms, Cooldowns=${verdict.stats.cooldownHits}`);
    }
  }

  console.log(`======================================\n`);
  matchOver = true;
  process.exit(0);
});

engine.on('stateUpdate', () => {
  // console.log(`State updated.`);
});

// Start the match
engine.start();
console.log(`Match started! Health: Alice 100 | Bob 100\n`);

// Helper to format health bars
function drawHP(hp: number) {
  const bars = Math.ceil(hp / 10);
  return `[${'█'.repeat(bars)}${'-'.repeat(10 - bars)}] ${hp} HP`;
}

// Simulation Loop
const playInterval = setInterval(() => {
  if (matchOver) {
    clearInterval(playInterval);
    return;
  }

  // Randomly select a player to make a move
  const attacker = Math.random() > 0.5 ? 'Alice' : 'Bob';
  const state = engine.getStateForPlayer(attacker);
  const internalPlayer = (engine as any).players.get(attacker);

  // Pick a random card from hand
  const cardIndex = Math.floor(Math.random() * state.hand.length);
  const clientCard = state.hand[cardIndex];
  const engineCard = internalPlayer.hand[cardIndex];

  // 75% chance to answer correctly
  const isCorrect = Math.random() < 0.75;
  let selectedOptionId;
  
  if (isCorrect) {
    selectedOptionId = engineCard.correctOptionId;
  } else {
    const wrongOptions = clientCard.question.options.filter(o => o.id !== engineCard.correctOptionId);
    selectedOptionId = wrongOptions[Math.floor(Math.random() * wrongOptions.length)].id;
  }

  console.log(`➡️  ${attacker} plays ${clientCard.type.toUpperCase()} card (Answers ${isCorrect ? 'Correctly✅' : 'Wrongly❌'})`);

  const result = engine.playCard(attacker, clientCard.id, selectedOptionId);

  if (result.success && result.correct) {
    const target = result.targetAddress;
    const amount = result.cardType === 'attack' ? result.damage : result.heal;
    console.log(`   💥 ${attacker} ${result.cardType === 'attack' ? 'deals' : 'heals'} ${amount} ${result.cardType === 'attack' ? 'damage to' : 'HP to'} ${target}!`);
    
    // Print health status
    const healths = engine.getHealth();
    console.log(`   Alice: ${drawHP(healths['Alice'])} | Bob: ${drawHP(healths['Bob'])}\n`);
  } else if (!result.success) {
    console.log(`   ⚠️  Play failed (cooldown?)\n`);
  } else {
    console.log(`   💨 Attack missed!\n`);
  }

}, 1500); // Play a card every 1.5 seconds

// Accelerate the timer by ticking more frequently for the simulation
const realTick = (engine as any).tick;
(engine as any).tick = function() {
  // Tick 10 seconds at a time instead of 1 second
  this.remainingMs -= 9000;
  realTick.call(this);
};
