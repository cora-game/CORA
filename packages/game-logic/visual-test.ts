import { GameEngine } from './src/GameEngine';
import fs from 'fs';
import path from 'path';

// Read the real questions
const questionsPath = path.resolve(__dirname, '../../data/questions/questions.json');
const questionsData = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));

// Initialize engine with real questions
const engine = new GameEngine(['player1', 'player2'], questionsData);

console.log('--- INITIAL DEAL ---');
const state1 = engine.getStateForPlayer('player1');
const state2 = engine.getStateForPlayer('player2');

console.log('Player 1 hand:');
state1.hand.forEach((c: any, i: number) => console.log(`  Card ${i + 1} | [${c.type}] ${c.question.text}`));
console.log('\nPlayer 2 hand:');
state2.hand.forEach((c: any, i: number) => console.log(`  Card ${i + 1} | [${c.type}] ${c.question.text}`));

console.log('\n--- SIMULATING PLAYING CARDS ---');

// We need the internal engine card id and correctOptionId to play successfully
const p1InternalHand = (engine as any).players.get('player1').hand;
const cardToPlay = p1InternalHand[0];

console.log(`Player 1 plays their first card: ${cardToPlay.question.questionText}`);
engine.playCard('player1', cardToPlay.id, cardToPlay.correctOptionId);

const newState1 = engine.getStateForPlayer('player1');
console.log(`\nPlayer 1's NEW hand (last card is the freshly drawn one):`);
newState1.hand.forEach((c: any, i: number) => console.log(`  Card ${i + 1} | [${c.type}] ${c.question.text}`));

console.log(`\nNotice that Player 1's new card is the EXACT SAME card that Player 2 will get if they play a card!`);
