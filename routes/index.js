var express = require('express');
var router = express.Router();
const crypto = require('crypto');
const { connectToDB } = require('../utils/db');

router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

router.post('/api/login', async function (req, res) {
  const db = await connectToDB();

  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required' });
    }

    const user = await db.collection('users').findOne({ email: email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (user.password !== password) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const { password: p, ...safeUser } = user;
    res.json(safeUser);

  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ message: err.message });
  }
});


router.post('/api/register', async function (req, res) {
  const db = await connectToDB();

  try {
    const { email, password, username, role, companyName } = req.body;

    if (!email || !password || !username) {
      return res.status(400).json({ message: 'Username, Email and Password are required' });
    }

    const validRoles = ['User', 'Business', 'Admin'];
    const userRole = validRoles.includes(role) ? role : 'User';

    const existing = await db.collection('users').findOne({ email: email });
    if (existing) {
      return res.status(409).json({ message: 'User already exists' });
    }

    const userDoc = {
      username: username,
      email: email,
      password: password,          
      role: userRole,
      companyName: userRole === 'Business' ? companyName : null,
      createdAt: new Date()
    };

    const result = await db.collection('users').insertOne(userDoc);

    if (!result.acknowledged) {
      return res.status(500).json({ message: 'Failed to create user' });
    }

    userDoc._id = result.insertedId;
    
    
    const { password: p, ...safeUser } = userDoc;
    res.status(201).json(safeUser);

  } catch (err) {
    console.error('Register Error:', err);
    res.status(500).json({ message: err.message });
  }
});



module.exports = router;
