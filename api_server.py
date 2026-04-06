import os
import re
import warnings
import numpy as np
import pickle
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List

warnings.filterwarnings("ignore")
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'

try:
    from tensorflow.keras.models import load_model
    from tensorflow.keras.preprocessing.sequence import pad_sequences
except ImportError as e:
    import sys
    sys.exit(1)

current_dir = os.path.dirname(os.path.abspath(__file__))
model_path = os.path.join(current_dir, 'sentiment_3class_downsampled.keras')
tokenizer_path = os.path.join(current_dir, 'tokenizer_3class_downsampled.pkl')
MAX_LEN = 180

if not os.path.exists(model_path) or not os.path.exists(tokenizer_path):
    raise FileNotFoundError("Model (.keras) or tokenizer (.pkl) file not found.")

model = load_model(model_path)
with open(tokenizer_path, 'rb') as f:
    tokenizer = pickle.load(f)

app = FastAPI(title="Sentiment Analysis API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SingleRequest(BaseModel):
    text: str

class BatchRequest(BaseModel):
    texts: List[str]

def format_prediction(input_text: str, probs, sentences_data=[]):
    neg_score = round(float(probs[0]) * 100)
    neu_score = round(float(probs[1]) * 100)
    pos_score = round(float(probs[2]) * 100)
    
    max_idx = np.argmax(probs)
    if max_idx == 0:
        main_label, main_type = "Negative", "negative"
    elif max_idx == 1:
        main_label, main_type = "Neutral", "neutral"
    else:
        main_label, main_type = "Positive", "positive"

    return {
        "text": input_text,
        "overview": {
            "label": main_label,
            "type": main_type,
            "posPct": pos_score,
            "negPct": neg_score,
            "neuPct": neu_score
        },
        "sentences": sentences_data
    }

def process_text_optimized(input_text: str):
    seq = tokenizer.texts_to_sequences([input_text])
    padded = pad_sequences(seq, maxlen=MAX_LEN, padding='post', truncating='post')
    probs = model.predict(padded, verbose=0)[0]

    sentences_text = re.split(r'(?<=[.!?])\s+', input_text)
    valid_sentences = [s.strip() for s in sentences_text if len(s.strip()) > 3]
    sentences_data = []
    
    if valid_sentences:
        s_seqs = tokenizer.texts_to_sequences(valid_sentences)
        s_padded = pad_sequences(s_seqs, maxlen=MAX_LEN, padding='post', truncating='post')
        s_probs_batch = model.predict(s_padded, verbose=0)
        
        for i, clean_s in enumerate(valid_sentences):
            s_probs = s_probs_batch[i]
            s_max_idx = np.argmax(s_probs)
            if s_max_idx == 0: s_type = "negative"
            elif s_max_idx == 1: s_type = "neutral"
            else: s_type = "positive"
            sentences_data.append({"text": clean_s, "type": s_type})

    return format_prediction(input_text, probs, sentences_data)

def process_batch_optimized(texts: List[str]):
    valid_texts = [text for text in texts if text and text.strip()]
    if not valid_texts:
        return []

    seqs = tokenizer.texts_to_sequences(valid_texts)
    padded = pad_sequences(seqs, maxlen=MAX_LEN, padding='post', truncating='post')
    
    batch_probs = model.predict(padded, batch_size=64, verbose=0)
    
    results_array = []
    for i, text in enumerate(valid_texts):
        res = format_prediction(text, batch_probs[i], [])
        results_array.append(res)
        
    return results_array

@app.post("/predict")
def predict_single(req: SingleRequest):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    
    try:
        result = process_text_optimized(req.text)
        return {"status": "success", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/predict_batch")
def predict_batch(req: BatchRequest):
    if not req.texts:
        raise HTTPException(status_code=400, detail="Text list cannot be empty")
    
    try:
        results_array = process_batch_optimized(req.texts)
        return {"status": "success", "results": results_array}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api_server:app", host="127.0.0.1", port=8000, reload=True)