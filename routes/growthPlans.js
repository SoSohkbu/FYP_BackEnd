const express = require('express');
const router = express.Router();
const { connectToDB, ObjectId } = require('../utils/db'); 

router.get('/', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ message: 'User ID is required' });

    const db = await connectToDB();
    
    const plans = await db.collection('growth_plans')
      .find({ userId: userId }) 
      .sort({ createdAt: -1 })
      .toArray();

    res.json(plans);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { userId, name, description } = req.body;
    
    if (!userId || !name) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const db = await connectToDB();
    
    const newPlan = {
      userId: userId,
      name: name,
      description: description || '',
      dataPoints: [],
      createdAt: new Date()
    };

    const result = await db.collection('growth_plans').insertOne(newPlan);
    newPlan._id = result.insertedId;
    
    res.status(201).json(newPlan);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/:id/data-points', async (req, res) => {
  try {
    const { id } = req.params;
    const { sourceType, sourceName, posPct, neuPct, negPct, analyzedCount, originalData } = req.body;

    const db = await connectToDB();

    const newDataPoint = {
      _id: new ObjectId(),
      date: new Date(),
      sourceType,
      sourceName: sourceName || 'Batch Analysis',
      posPct,
      neuPct,
      negPct,
      analyzedCount,
      originalData: originalData || []
    };

    const result = await db.collection('growth_plans').updateOne(
      { _id: new ObjectId(id) },
      { $push: { dataPoints: newDataPoint } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'Plan not found' });
    }

    res.json({ message: 'Data point added successfully', dataPoint: newDataPoint });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.delete('/:id/data-points/:pointId', async (req, res) => {
  try {
    const { id, pointId } = req.params;
    const db = await connectToDB();

    const result = await db.collection('growth_plans').updateOne(
      { _id: new ObjectId(id) },
      { $pull: { dataPoints: { _id: new ObjectId(pointId) } } }
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({ message: 'Data point not found or already removed' });
    }

    res.json({ message: 'Data point removed successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = await connectToDB();

    const result = await db.collection('growth_plans').deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Plan not found' });
    }

    res.json({ message: 'Plan deleted successfully' });
  } catch (error) {
    console.error('Error deleting plan:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;