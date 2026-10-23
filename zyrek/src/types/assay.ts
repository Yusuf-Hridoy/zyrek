export interface Dimension { label: string; score: number; note?: string }
export interface Reviewer { role: 'RECRUITER' | 'HIRING MGR' | 'FACT-CHECK'; title: string; comment: string }
export interface FormAnswer { question: string; answer: string }
export interface SkillSignal {
  skill: string
  demand: 'REQUIRED' | 'PREFERRED'
  evidence: 'STRONG' | 'WEAK' | 'MISSING'
}
export interface AssayResult {
  roleTitle: string
  company: string
  companyContext: string
  verdict: 'STRONG MATCH' | 'GOOD MATCH' | 'PARTIAL MATCH' | 'WEAK MATCH'
  overallScore: number
  summary: string
  dimensions: Dimension[]
  reviewers: Reviewer[]
  tailoredCv: string
  coverLetter: string
  formAnswers: FormAnswer[]
  signals: SkillSignal[]
}

export type PrepCategory = 'GAP_PROBE' | 'TECHNICAL' | 'DOMAIN' | 'BEHAVIORAL'
export type PrepConfidence = 'READY' | 'PRACTICE' | 'RISKY'
export interface PrepQuestion {
  question: string
  category: PrepCategory
  whyAsked: string
  answer: string
  confidence: PrepConfidence
}
export interface InterviewPrep {
  generatedAt: number
  questions: PrepQuestion[]
}
