import express from 'express'
import cors from 'cors'
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import dayjs from 'dayjs'
import joi from 'joi';
import Joi from 'joi';

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

        const NameAlreadyExist = await db.collection("users").find({ name }).toArray();

        const nameSchema = Joi.object({
            name: Joi.string().required()
        })
        const validation = nameSchema.validate({name: name})

        // invalid user
        if (validation.error) {
            res.sendStatus(422);
            client.close();
            return;
        }

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

app.get("/participants", async (req, res) => {
    let participants;
    try {
        await client.connect();
        const db = client.db("batePapoUol");

        participants = await db.collection("users").find({}).toArray();
        client.close();
    } catch (error) {
        res.sendStatus(500);
        client.close();
    }
    res.send(participants)
})

app.post("/messages", async (req, res) => {
    const { to, text, type } = req.body;
    const { user } = req.headers;

    // to and text validation
    const isNotString = typeof (to) !== 'string' || typeof (text) !== 'string';
    const isEmpty = to.length === 0 || to == null || text.length === 0 || text == null;

    if (isNotString || isEmpty) {
        res.sendStatus(422);
        return;
    }

    // type validation
    const errorInType = type !== 'message' && type !== 'private_message';
    if (errorInType) {
        res.sendStatus(422);
        return;
    }

    try {
        await client.connect();
        const db = client.db("batePapoUol");


        // tem que fazer a validação do "from" com o JOI
        const participant = await db.collection("users").find({ name: user }).toArray();
        if (participant.length !== 1) {
            console.log(`${user} is not a valid user`)
            res.sendStatus(422);
            client.close();
            return;
        }

        await db.collection("messages").insertOne({
            from: user,
            to,
            text,
            type,
            time: dayjs().format('HH:mm:ss')
        })
        client.close();
    } catch (error) {
        res.sendStatus(500);
        client.close();
    }
    res.status(201).send("OK")
})

app.get("/messages", async (req, res) => {
    const limit = parseInt(req.query.limit);
    const { user } = req.headers;
    let messagesFiltered;

    try {
        await client.connect();
        const db = client.db("batePapoUol");

        messagesFiltered = await db.collection("messages").find({
            $or:
                [
                    { to: { $in: ["Todos", user] } },
                    { from: user }
                ]
        }).toArray();
        if (limit !== undefined) {
            messagesFiltered = messagesFiltered.slice(-limit)
        }
        client.close()
    } catch (error) {
        res.sendStatus(500);
        client.close();
        return;
    }
    res.send(messagesFiltered)
})

app.listen(5000, () => {
    console.log("servidor funfando")
})