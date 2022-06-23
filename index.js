import express from 'express'
import cors from 'cors'
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());


const client = new MongoClient(process.env.MONGO_URI);
let db;

client.connect().then(() => {
    db = client.db("batePapoUol");
})




app.listen(5000, () => {
    console.log("servidor funfando")
})