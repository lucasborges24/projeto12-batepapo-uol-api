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
        const validation = nameSchema.validate({ name: name })

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

    const messageSchema = Joi.object({
        to: joi.string()
            .required(),
        text: joi.string()
            .required(),
        type: joi.string()
            .valid("message")
            .valid("private_message")
            .required(),
    })
    const validation = messageSchema.validate({ to, text, type }, { abortEarly: true })

    if (validation.error) {
        res.sendStatus(422);
        return;
    }

    try {
        await client.connect();
        const db = client.db("batePapoUol");


        // tem que fazer a validação do "from" com o JOI
        const participant = await db.collection("users").findOne({ name: user })
        if (!participant) {
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

app.post("/status", async (req, res) => {
    const { user } = req.headers

    try {
        await client.connect();
        const db = client.db("batePapoUol");

        const participant = await db.collection("users").findOne({ name: user })
        if (!participant) {
            res.sendStatus(404);
            return;
        }
        await db.collection("users").updateOne({
            name: user,
        }, {
            $set: { lastStatus: Date.now() }
        })
        client.close();
        res.sendStatus(200)
    } catch (error) {
        res.status(500).send("Internal Error")
        client.close()
        return;
    }
})

setInterval(async () => {
    console.log("set interval passando mais uma vez")
    try {
        await client.connect();
        const db = client.db("batePapoUol");

        const itWillDeleted = await db.collection("users").find({
            lastStatus: { $lt: (Date.now() - 10000) }
        }).toArray()
        if (itWillDeleted.length === 0) {
            client.close();
            console.log("n tem nenhum usuário pra ser deletado")
            return;
        }

        for (let i = 0; i < itWillDeleted.length; i++) {
            const id = itWillDeleted[i]._id
            await db.collection("users").deleteOne({ _id: id })
            await db.collection("messages").insertOne({
                from: itWillDeleted[i].name,
                to: "Todos",
                text: "sai da sala...",
                type: "status",
                time: dayjs().format('HH:mm:ss')
            })
        }
        client.close()
    } catch (error) {

        client.close()
    }
}, 15000)

app.listen(5000, () => {
    console.log("servidor funfando")
})