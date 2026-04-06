const { MongoClient, ObjectId } = require('mongodb');


if (!process.env.MONGODB_URI) {
    throw new Error('Please define the MONGODB_URI environment variable inside .env');
}

let cachedClient = null;
let cachedDb = null;

async function connectToDB() {
    if (cachedClient && cachedDb) {
        return cachedDb;
    }

    const options = {
    };

    const client = await MongoClient.connect(process.env.MONGODB_URI, options);
    
    const db = client.db('FYPDB'); 

    db.client = client;

    cachedClient = client;
    cachedDb = db;

    console.log("New MongoDB Connection Established");
    return db;
}

module.exports = { connectToDB, ObjectId };
