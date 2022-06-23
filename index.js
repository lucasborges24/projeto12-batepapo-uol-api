import express from 'express'
import cors from 'cors'
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import dayjs from 'dayjs'

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());


const client = new MongoClient(process.env.MONGO_URI);


app.post("/participants", async (req, res) => {
    const { name } = req.body
    try {
        await client.connect();
        const db = client.db("batePapoUol");

        // fazer as validações com JOI
        const NameAlreadyExist = await db.collection("users").find({ name }).toArray();

        // user conflit
        if (NameAlreadyExist.length > 0) {
            res.sendStatus(409);
            client.close();
            return;
        }

        // send user to server
        await db.collection("users").insertOne({
            name,
            lastStatus: Date.now()
        })
        // send message about user entered
        await db.collection("messages").insertOne({
            from: name,
            to: 'Todos',
            text: 'entra na sala...',
            type: 'status',
            time: dayjs().format('HH:mm:ss')
        })
        client.close();
    } catch (error) {
        console.log("deu erro")
        client.close();
    }
    res.status(201).send("OK")
})




app.listen(5000, () => {
    console.log("servidor funfando")
})