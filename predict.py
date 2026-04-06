const axios = require('axios');

async function analyzeSingleReview(text) {
    try {
        const response = await axios.post('http://127.0.0.1:8000/predict', {
            text: text
        });
        
       
        return response.data;
        
    } catch (error) {
        console.error("AI ERROR:", error.response ? error.response.data : error.message);
        throw error;
    }
}