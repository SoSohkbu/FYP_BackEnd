var express = require('express');
var router = express.Router();
var { connectToDB, ObjectId } = require('../utils/db'); 

router.post('/save', async function(req, res) {
  const db = await connectToDB();
  
  try {
    const { userId, inputText, overview, keywords, sentences } = req.body;

    if (!userId || !inputText || !overview) {
      return res.status(400).json({ message: 'Missing required data' });
    }

    const resultDoc = {
      userId: new ObjectId(userId), 
      originalText: inputText,
      overallLabel: overview.label,
      scores: {
        positive: overview.posPct,
        neutral: overview.neuPct,
        negative: overview.negPct
      },
      keyTerms: keywords,
      sentences: sentences,
      analysisDate: new Date()
    };

    const result = await db.collection('sentiment_results').insertOne(resultDoc);
    
    if (result.acknowledged) {
      res.status(201).json({ message: 'Saved successfully', id: result.insertedId });
    } else {
      res.status(500).json({ message: 'Failed to save' });
    }

  } catch (err) {
    console.error('Save Error:', err);
    res.status(500).json({ message: err.message });
  }
});

router.post('/save-report', async function(req, res) {
  try {
    const { userId, reportName, sourceName, analyzedData } = req.body;
    
    if (!reportName || !analyzedData || analyzedData.length === 0) {
      return res.status(400).json({ success: false, message: 'Missing report name or data.' });
    }

    const db = await connectToDB();

    const reportDoc = {
      userId: userId ? new ObjectId(userId) : null,
      reportName: reportName,
      sourceName: sourceName || 'Unknown Source',
      analyzedData: analyzedData,
      createdAt: new Date()
    };

    const result = await db.collection('batch_reports').insertOne(reportDoc);
    
    if (result.acknowledged) {
      res.status(201).json({ 
        success: true, 
        message: 'Report saved successfully!', 
        reportId: result.insertedId 
      });
    } else {
      res.status(500).json({ success: false, message: 'Failed to save to database.' });
    }
  } catch (error) {
    console.error('Save Report Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/', async function(req, res) {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ message: 'Missing userId' });
    }

    const db = await connectToDB();
    const userObjectId = new ObjectId(userId);
    
    const singleHistory = await db.collection('sentiment_results')
      .find({ userId: userObjectId })
      .toArray();
      
    const formattedSingle = singleHistory.map(item => ({
      ...item,
      recordType: 'single', 
      displayDate: item.analysisDate
    }));

    const batchHistory = await db.collection('batch_reports')
      .find({ userId: userObjectId })
      .toArray();
      
    const formattedBatch = batchHistory.map(item => {
      let posCount = 0, negCount = 0, neuCount = 0;
      if (Array.isArray(item.analyzedData)) {
          item.analyzedData.forEach(r => {
              if (r.overview && r.overview.type === 'positive') posCount++;
              else if (r.overview && r.overview.type === 'negative') negCount++;
              else neuCount++;
          });
      }
      
      const total = posCount + negCount + neuCount;
      let overall = 'Neutral';
      if (posCount > negCount && posCount > neuCount) overall = 'Positive';
      if (negCount > posCount && negCount > neuCount) overall = 'Negative';

      return {
        ...item,
        recordType: 'batch',
        displayDate: item.createdAt,
        overallLabel: overall,
        originalText: `[Batch Report] ${item.reportName} - Analysed ${total} sentences from ${item.sourceName}.`,
        scores: {
          positive: total > 0 ? (posCount / total) : 0,
          neutral: total > 0 ? (neuCount / total) : 0,
          negative: total > 0 ? (negCount / total) : 0
        }
      }
    });

    const combinedHistory = [...formattedSingle, ...formattedBatch]
      .sort((a, b) => new Date(b.displayDate) - new Date(a.displayDate));

    res.json(combinedHistory);
  } catch (err) {
    console.error('Fetch History Error:', err);
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', async function(req, res) {
  try {
    const { id } = req.params;
    const db = await connectToDB();
    const objectId = new ObjectId(id);

    let result = await db.collection('sentiment_results').deleteOne({ _id: objectId });

    if (result.deletedCount === 0) {
      result = await db.collection('batch_reports').deleteOne({ _id: objectId });
    }

    if (result.deletedCount === 1) {
      res.json({ message: 'Deleted successfully' });
    } else {
      res.status(404).json({ message: 'Record not found' });
    }
  } catch (err) {
    console.error('Delete Error:', err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;