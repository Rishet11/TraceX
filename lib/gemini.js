import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function analyzeTweetSimilarity(originalTweet, candidateTweet) {
  if (!process.env.GEMINI_API_KEY) {
    console.warn('GEMINI_API_KEY is not set');
    return null;
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `
      You are an expert at detecting plagiarism and idea theft on social media.
      Compare the following two tweets and determine if the second one is a copy of the first one, 
      even if the wording is different (i.e., idea theft or "engagement farming" copy).

      Original Tweet: "${originalTweet}"
      Candidate Tweet: "${candidateTweet}"

      Provide your analysis in JSON format with the following fields:
      - score: A number between 0 and 100 representing the likelihood of it being a copy/idea theft.
      - verdict: A short string (e.g., "Direct Copy", "Idea Theft", "Likely Coincidence", "Not a Match").
      - explanation: A concise 1-2 sentence explanation of why.

      JSON Output:
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Clean up potential markdown code blocks in response
    const jsonStr = text.replace(/```json|```/g, '').trim();
    return JSON.parse(jsonStr);

  } catch (error) {
    console.error('Gemini Analysis Error:', error);
    return null;
  }
}
