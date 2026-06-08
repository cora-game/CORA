import { QuestionDealer } from '../src/QuestionDealer';
import type { Question as SchemaQuestion } from '@shared/question';
import { test, expect, describe } from 'bun:test';

describe('QuestionDealer', () => {
  const mockQuestions: SchemaQuestion[] = [
    {
      id: 'seq1',
      category: 'sequence',
      questionText: 'seq 1',
      options: [{ id: 'a', text: '1', score: true }, { id: 'b', text: '2', score: false }, { id: 'c', text: '3', score: false }, { id: 'd', text: '4', score: false }],
      explanation: ''
    },
    {
      id: 'seq2',
      category: 'sequence',
      questionText: 'seq 2',
      options: [{ id: 'a', text: '1', score: true }, { id: 'b', text: '2', score: false }, { id: 'c', text: '3', score: false }, { id: 'd', text: '4', score: false }],
      explanation: ''
    },
    {
      id: 'log1',
      category: 'logical',
      questionText: 'log 1',
      options: [{ id: 'a', text: '1', score: true }, { id: 'b', text: '2', score: false }, { id: 'c', text: '3', score: false }, { id: 'd', text: '4', score: false }],
      explanation: ''
    },
    {
      id: 'log2',
      category: 'logical',
      questionText: 'log 2',
      options: [{ id: 'a', text: '1', score: true }, { id: 'b', text: '2', score: false }, { id: 'c', text: '3', score: false }, { id: 'd', text: '4', score: false }],
      explanation: ''
    },
    {
      id: 'math1',
      category: 'math',
      questionText: 'math 1',
      options: [{ id: 'a', text: '1', score: true }, { id: 'b', text: '2', score: false }, { id: 'c', text: '3', score: false }, { id: 'd', text: '4', score: false }],
      explanation: ''
    }
  ];

  test('deals questions in a balanced round-robin way across categories', () => {
    const dealer = new QuestionDealer(mockQuestions);
    
    const card1 = dealer.dealOne();
    const card2 = dealer.dealOne();
    const card3 = dealer.dealOne();

    // The first 3 cards should cover all 3 categories in some random order
    const categoriesDrawn = [
      card1?.question.category,
      card2?.question.category,
      card3?.question.category
    ];

    expect(categoriesDrawn).toContain('sequence');
    expect(categoriesDrawn).toContain('logical');
    expect(categoriesDrawn).toContain('math');
  });

  test('exhausts pool without duplicates and returns null', () => {
    const dealer = new QuestionDealer(mockQuestions);
    
    const drawnIds = new Set<string>();
    
    for (let i = 0; i < mockQuestions.length; i++) {
      const card = dealer.dealOne();
      expect(card).not.toBeNull();
      if (card) {
        expect(drawnIds.has(card.question.id)).toBe(false);
        drawnIds.add(card.question.id);
      }
    }

    // Should have drawn all 5 questions
    expect(drawnIds.size).toBe(5);

    // Further draws should return null
    const extraCard = dealer.dealOne();
    expect(extraCard).toBeNull();
  });

  test('handles uneven categories correctly', () => {
    const dealer = new QuestionDealer(mockQuestions);
    
    // Draw all 5
    const cards = [];
    for (let i = 0; i < 5; i++) {
      cards.push(dealer.dealOne());
    }

    // Categories are seq(2), log(2), math(1)
    // The sequence of categories drawn should be balanced initially, then exhaust 'math'
    const categories = cards.map(c => c?.question.category);
    expect(categories.filter(c => c === 'math').length).toBe(1);
    expect(categories.filter(c => c === 'logical').length).toBe(2);
    expect(categories.filter(c => c === 'sequence').length).toBe(2);
  });

  test('deals exactly 1 heal card in each batch of 5 cards', () => {
    const manyQuestions: SchemaQuestion[] = Array.from({ length: 15 }, (_, index) => ({
      id: `q-${index + 1}`,
      category: (['sequence', 'logical', 'math'] as SchemaQuestion['category'][])[index % 3],
      questionText: `question ${index + 1}`,
      options: [
        { id: 'a', text: '1', score: true },
        { id: 'b', text: '2', score: false },
        { id: 'c', text: '3', score: false },
        { id: 'd', text: '4', score: false },
      ],
      explanation: '',
    }));

    const dealer = new QuestionDealer(manyQuestions);
    const cards = Array.from({ length: 15 }, () => dealer.dealOne()).filter(Boolean);

    expect(cards).toHaveLength(15);

    for (let start = 0; start < cards.length; start += 5) {
      const batch = cards.slice(start, start + 5);
      const healCount = batch.filter(card => card?.type === 'heal').length;
      expect(healCount).toBe(1);
    }
  });
});
