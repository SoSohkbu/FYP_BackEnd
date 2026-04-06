const axios = require('axios');

async function analyzeBatchReviews(textArray) {
    try {
        const response = await axios.post('http://127.0.0.1:8000/predict_batch', {
            texts: textArray
        });
        
       
        return response.data;
        
    } catch (error) {
        console.error("AI ERROR", error.response ? error.response.data : error.message);
        throw error;
    }
}