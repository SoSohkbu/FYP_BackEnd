const express = require('express');
const router = express.Router();

router.post('/summary', async (req, res) => {
  try {
    const { text, overview, keywords } = req.body;

    if (!text) {
      return res.status(400).json({ status: 'error', message: 'Text is required' });
    }

    const keywordList = keywords && keywords.length > 0 
      ? keywords.map(k => k.text).join(', ') 
      : 'No specific keywords';

    const prompt = `
      Act as a professional data analyst. Based on the following text and sentiment analysis data, write a concise and professional summary (max 3-4 sentences), highlighting the core themes and the overall emotional tone.

      Original Text: "${text}"
      Sentiment Distribution: Positive ${overview.posPct}%, Neutral ${overview.neuPct}%, Negative ${overview.negPct}%.
      Extracted Keywords: ${keywordList}
    `;

    const deepseekResponse = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'You are an expert in sentiment analysis and data insights. Please provide an objective and professional summary.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 200
      })
    });

    if (!deepseekResponse.ok) {
      const errorData = await deepseekResponse.json();
      throw new Error(errorData.error?.message || 'DeepSeek API request failed');
    }

    const data = await deepseekResponse.json();
    const summary = data.choices[0].message.content.trim();

    res.json({ status: 'success', summary });

  } catch (error) {
    console.error('DeepSeek AI Summary Error:', error.message);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

module.exports = router;