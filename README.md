# Study Buddy – AI tutor for school kids

Live demo: https://edu-buddy-hghkugcf5-cc-fraud-detection.vercel.app

## What it does
- Pick a class (3–10) and the tutor adapts its language and examples
- Explain mode: clear, simple explanations
- Guide me mode (Socratic): asks guiding questions instead of giving answers
- Quiz me: generates 3 questions on what was just discussed
- Kid-safe system prompt: stays on educational topics

## Tech stack
Next.js, Vercel AI SDK, Groq (open-source GPT-OSS model), deployed on Vercel

## Run locally
1. git clone https://github.com/asreekar-06/edu-buddy.git
2. cd edu-buddy && npm install
3. Create .env.local with: GROQ_API_KEY=your_key_here (free key from console.groq.com)
4. npm run dev, then open http://localhost:3000

## Design decisions
- Socratic mode because learning sticks better when students think
- Grade-level prompting so the same question gets age-appropriate answers
- System prompt restricts the bot to educational topics for child safety

## Limitations and next steps
- No login or saved chat history yet
- Topic-specific quizzes with scoring
- Parent/teacher dashboard
