import { describe, expect, it } from 'vitest'
import { answerKey, decodeQuiz, encodeQuiz, formatAnswers, matchAnswer, parseAnswers, validateQuiz, type TableQuiz } from './model'

const quiz: TableQuiz = {
  id: 'test',
  title: 'Capitales',
  description: '',
  category: 'Géographie',
  tags: [],
  time: 120,
  hint: 'Pays',
  answer: 'Capitale',
  rows: [
    { hint: 'Égypte', answer: 'Le Caire' },
    { hint: 'États-Unis', answer: 'Washington', alts: ['Washington DC'] },
    { hint: 'Brésil 1958', answer: 'Brésil' },
    { hint: 'Brésil 1962', answer: 'Brésil' },
    { hint: 'Niger', answer: 'Niamey' },
  ],
}

describe('answerKey', () => {
  it('ignore casse, accents, ponctuation et article initial', () => {
    expect(answerKey('Le Caire')).toBe(answerKey('caire'))
    expect(answerKey('  BRÉSIL ')).toBe(answerKey('bresil'))
    expect(answerKey("L'Équateur")).toBe(answerKey('equateur'))
    expect(answerKey('Saint-Jean')).toBe(answerKey('saint jean'))
    expect(answerKey('København')).toBe(answerKey('kobenhavn'))
    expect(answerKey('Łódź')).toBe(answerKey('lodz'))
  })
})

describe('matchAnswer', () => {
  it('accepte un pays dans n’importe quelle langue, même dans un quiz de joueur', () => {
    const quiz = { id: 'q', title: 'Voisins', description: '', category: 'Géographie', tags: [], time: 60, answer: 'Pays', rows: [{ answer: 'Allemagne' }, { answer: 'Japon' }] } as TableQuiz
    expect(matchAnswer(quiz, 'Germany', new Set())).toEqual([0])
    expect(matchAnswer(quiz, 'Германия', new Set())).toEqual([0])
    expect(matchAnswer(quiz, '日本', new Set())).toEqual([1])
    expect(answerKey('Германия')).toBe('германия')
  })


  it('reconnaît la réponse et ses variantes', () => {
    expect(matchAnswer(quiz, 'caire', new Set())).toEqual([0])
    expect(matchAnswer(quiz, 'washington dc', new Set())).toEqual([1])
  })

  it('remplit d’un coup toutes les lignes qui partagent la réponse', () => {
    expect(matchAnswer(quiz, 'bresil', new Set())).toEqual([2, 3])
  })

  it('ignore une réponse déjà trouvée ou incomplète', () => {
    expect(matchAnswer(quiz, 'niamey', new Set([4]))).toEqual([])
    expect(matchAnswer(quiz, 'nia', new Set())).toEqual([])
  })
})

describe('parseAnswers', () => {
  it('lit « indice ; réponse ; variantes » ou « réponse / variante »', () => {
    expect(parseAnswers('France ; Paris ; Lutèce / Paname\n\nÉtats-Unis / USA')).toEqual([
      { hint: 'France', answer: 'Paris', alts: ['Lutèce', 'Paname'] },
      { answer: 'États-Unis', alts: ['USA'] },
    ])
  })

  it('se relit à l’identique après mise en texte', () => {
    expect(parseAnswers(formatAnswers(quiz.rows))).toEqual(quiz.rows)
  })
})

describe('partage', () => {
  it('fait l’aller-retour par le lien', () => {
    expect(decodeQuiz(encodeQuiz(quiz))).toEqual(quiz)
  })

  it('refuse un lien abîmé ou un quiz invalide', () => {
    expect(decodeQuiz('pas-du-base64!')).toBeNull()
    expect(validateQuiz({ ...quiz, rows: [] })).toBeNull()
    expect(validateQuiz({ ...quiz, title: '' })).toBeNull()
    expect(validateQuiz({ ...quiz, time: -5 })?.time).toBe(10)
  })
})
