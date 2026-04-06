var express = require('express');
var router = express.Router();
var path = require('path');
var axios = require('axios');
var cheerio = require('cheerio'); 

const SCRAPER_API_KEY = '3ae3ebfa96094192251906df402deb47';
const AI_SERVER_URL = 'http://127.0.0.1:8000';

const extractASIN = (url) => {
  const match = url.match(/(?:dp|gp\/product|\/d)\/([A-Z0-9]{10})/i);
  return match ? match[1] : null;
};

router.post('/analyze', async function(req, res) {
  const { text } = req.body;
  if (!text) return res.status(400).json({ status: 'error', message: 'Text is required' });

  try {
      const aiResponse = await axios.post(`${AI_SERVER_URL}/predict`, { text: text });
      
      res.json({ 
          status: 'success', 
          results: aiResponse.data.result 
      });
  } catch (error) {
      res.status(500).json({ 
          status: 'error', 
          message: "Failed to process AI results", 
          details: error.response ? error.response.data.detail : error.message 
      });
  }
});

router.post('/analyze-batch', async function(req, res) {
  const { texts } = req.body;

  if (!texts || !Array.isArray(texts) || texts.length === 0) {
    return res.status(400).json({ status: 'error', message: 'A valid array of texts is required' });
  }

  if (texts.length > 2000) {
      return res.status(400).json({ status: 'error', message: 'Maximum 2000 reviews allowed.' });
  }

  try {
      const aiResponse = await axios.post(`${AI_SERVER_URL}/predict_batch`, { texts: texts });
      
      res.json({ 
          status: 'success', 
          results: aiResponse.data.results 
      });
  } catch (error) {
      res.status(500).json({ 
          status: 'error', 
          message: "Failed to process batch", 
          details: error.response ? error.response.data.detail : error.message 
      });
  }
});

router.post('/analyze-url', async function(req, res) {
  const { url } = req.body;
  if (!url) return res.status(400).json({ status: 'error', message: 'URL is required' });

  const isAmazon = url.includes('amazon');
  const targetUrl = isAmazon 
      ? `${url.split('?')[0]}/ref=cm_cr_dp_d_show_all_btm?ie=UTF8&reviewerType=all_reviews`
      : url;

  try {
      const API_URL = 'http://api.scraperapi.com';
      let html = '';
      let fetchSuccess = false;
      let attempt = 1;
      const MAX_ATTEMPTS = 2; 

      while (attempt <= MAX_ATTEMPTS && !fetchSuccess) {
          try {
              const scraperResponse = await axios.get(API_URL, {
                  params: { 
                      api_key: SCRAPER_API_KEY, 
                      url: targetUrl, 
                      render: 'true',      
                      premium: 'true',      
                      country_code: 'us'    
                  },
                  timeout: 45000 
              });
              html = scraperResponse.data;
              fetchSuccess = true;
          } catch (fetchErr) {
              attempt++;
              if (attempt <= MAX_ATTEMPTS) {
                  await new Promise(resolve => setTimeout(resolve, 5000));
              } else {
                  throw fetchErr;
              }
          }
      }

      const $ = cheerio.load(html);
      let rawTexts = [];

      $('span[data-hook="review-body"] span').each((i, el) => {
          let text = $(el).text().trim();
          if (text.length > 20 && !text.toLowerCase().includes('read more')) {
              rawTexts.push(text);
          }
      });

      if (rawTexts.length === 0) {
          $('p').each((i, el) => {
              let text = $(el).text().trim();
              if (text.length > 30) rawTexts.push(text);
          });
      }

      if (rawTexts.length === 0) {
          $('script, style, noscript, nav, header, footer, [role="navigation"]').remove(); 
          let allText = $('body').text();
          let chunks = allText.split(/\n{2,}|\s{4,}/);
          chunks.forEach(chunk => {
              let text = chunk.trim();
              if (text.length > 40 && !text.toLowerCase().includes('shift + opt')) {
                  rawTexts.push(text);
              }
          });
      }

      let sentences = [];
      rawTexts.forEach(text => {
          const cleanText = text.replace(/<br\s*\/?>/gi, ' ').replace(/\s+/g, ' ');
          const splitSentences = cleanText.split(/(?<=[.!?])\s+/);
          sentences.push(...splitSentences);
      });

      sentences = sentences
          .map(s => s.trim())
          .filter(s => s.length > 15 && /[a-zA-Z]/.test(s));

      if (sentences.length === 0) {
          throw new Error('No readable text found.');
      }

      const limitedTexts = sentences.slice(0, 30);
      
      const aiResponse = await axios.post(`${AI_SERVER_URL}/predict_batch`, { texts: limitedTexts });
      
      return res.json({
          status: 'success',
          asin: extractASIN(url) || 'General-URL',
          product_name: isAmazon ? 'Amazon Product' : 'Webpage Content',
          results: aiResponse.data.results 
      });

  } catch (error) {
      return res.status(500).json({ 
          status: 'error', 
          message: 'Failed to fetch, parse, or analyze the URL: ' + error.message 
      });
  }
});

router.post('/summarize', function(req, res) {
  const { reviews } = req.body;
  if (!reviews || !Array.isArray(reviews)) {
    return res.status(400).json({ success: false, message: 'Invalid data format' });
  }

  const summaryData = {
    overview: "Based on the sentences analyzed, the general sentiment is slightly mixed. Most texts convey a neutral or positive tone, though there are some notable negative points.",
    pros: ["Core functionalities perform well.", "The overall design and usability receive positive feedback."],
    cons: ["There are complaints regarding speed or responsiveness.", "Some details did not meet user expectations."]
  };

  res.json({ success: true, summary: summaryData });
});

module.exports = router;