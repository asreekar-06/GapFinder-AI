# GapFinder AI

**Live demo:** https://edu-buddy-mu.vercel.app/

An AI-powered study app that finds what a student doesn't understand, explains why, and tells them what to study next.

## Features (implemented)
1. **Upload study materials**: syllabus, notes, textbooks and past papers (PDF or text)
2. **Topic map**: organizes material into topics and subtopics, rates importance, and maps past exam questions to topics
3. **Diagnostic quiz with RAG**: questions are generated from the uploaded material using retrieval, and each answer shows its source excerpt
4. **Answer evaluation**: marks answers right or wrong and explains the mistakes
5. **Knowledge gap detection**: classifies each topic as Weak, Medium or Strong
6. **Personalized revision plan**: prioritizes by topic importance and weakness, based on hours per day and number of days
7. **Progress tracking**: retest with new questions, compare attempts, and the plan updates automatically
8. **Study assistant**: answers only from the uploaded material, with chunk citations

## Scope decisions (not implemented)
- **Login and database**: student data (materials, topic map, attempts, plan) is saved in the browser's localStorage instead of a backend. A real account system would be the next step.
- **Embedding-based retrieval**: retrieval uses lightweight keyword scoring (TF-IDF style) so the whole app runs on free tiers with no vector database.

## How it works
Uploaded text is split into chunks. The topic map is generated from those chunks. For each quiz, the most relevant chunks per topic are retrieved and passed to the model, which writes questions grounded only in them. Quiz scores per topic become Weak/Medium/Strong levels, which feed the revision planner. The assistant retrieves chunks for each question and is instructed to answer only from them.

## Tech stack
- Next.js (App Router) and React
- Vercel AI SDK with Groq (open-source GPT-OSS model)
- unpdf for PDF text extraction
- Deployed on Vercel

## Run locally
1. `git clone https://github.com/asreekar-06/GapFinder-AI.git`
2. `cd GapFinder-AI`
3. `npm install`
4. Create a `.env.local` file containing: `GROQ_API_KEY=your_key_here` (free key from https://console.groq.com)
5. `npm run dev`, then open http://localhost:3000

## Limitations
- PDFs larger than about 4 MB may fail on the free Vercel plan; text PDFs work best (scanned images are not read)
- Keyword retrieval can miss paraphrased questions
- Free-tier AI limits can make generation slow at peak times

## Author
Sreekar (GitHub: asreekar-06)
