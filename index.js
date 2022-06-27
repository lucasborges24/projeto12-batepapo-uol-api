import express from 'express'
import cors from 'cors'
import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
import dayjs from 'dayjs'
import joi from 'joi';
import chalk from 'chalk';
import { stripHtml } from 'string-strip-html'
import { sanitaze } from './sanitaze.js'
import { nameSchema, messageSchema, userSchema } from './joi.js'

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGO_URI);

app.post("/participants", async (req, res) => {
    let { name } = req.body

    const validationBeforeSanitizing = nameSchema.validate({ name })
    if (validationBeforeSanitizing.error) return res.sendStatus(422);

    name = sanitaze(name)
    const validationAfterSanitizing = nameSchema.validate({ name })
    if (validationAfterSanitizing.error) return res.sendStatus(422);

    try {
        await client.connect();
        const db = client.db("batePapoUol");

        const NameAlreadyExist = await db.collection("users").findOne({ name });

        if (NameAlreadyExist) {
            client.close();
            return res.sendStatus(409);
        }

        await db.collection("users").insertOne({
            name,
            lastStatus: Date.now()
        })

        await db.collection("messages").insertOne({
            from: name,
            to: 'Todos',
            text: 'entra na sala...',
            type: 'status',
            time: dayjs().format('HH:mm:ss')
        })
        res.status(201).send("OK")
        client.close();
    } catch (error) {
        res.sendStatus(500)
        client.close();
    }
})

app.get("/participants", async (req, res) => {
    try {
        await client.connect();
        const db = client.db("batePapoUol");

        const participants = await db.collection("users").find({}).toArray();
        res.send(participants)
        client.close();
    } catch (error) {
        res.sendStatus(500);
        client.close();
    }
})

app.post("/messages", async (req, res) => {
    let { to, text, type } = req.body;
    let { user } = req.headers;
    const validationBeforeBody = messageSchema.validate({ to, text, type })
    const validationBeforeHeader = userSchema.validate({ user })
    if (validationBeforeBody.error || validationBeforeHeader.error) return res.sendStatus(422);

    to = sanitaze(to);
    text = sanitaze(text);
    type = sanitaze(type);
    user = sanitaze(user);
    const validationAfterBody = messageSchema.validate({ to, text, type })
    const validationAfterHeader = userSchema.validate({ user })
    if (validationAfterHeader.error || validationAfterBody.error) return res.sendStatus(422);

    try {
        await client.connect();
        const db = client.db("batePapoUol");

        const participant = await db.collection("users").findOne({ name: user })
        if (!participant) {
            console.log(chalk.redBright(`${user} is not a valid user`))
            client.close();
            return res.sendStatus(422);
        }

        await db.collection("messages").insertOne({
            from: user,
            to,
            text,
            type,
            time: dayjs().format('HH:mm:ss')
        })
        res.status(201).send("OK")
        client.close();
    } catch (error) {
        res.sendStatus(500);
        client.close();
    }
})

app.get("/messages", async (req, res) => {
    let limit;
    if (!req.query.limit || !parseInt(req.query.limit)) {
        limit = null;
    } else {
        limit = parseInt(req.query.limit);
    }
    let { user } = req.headers;
    const { error } = userSchema.validate({ user })
    if (error) {
        res.status(422).send("Something with users is wrong");
        return;
    }

    user = sanitaze(user);
    const errorAfter = userSchema.validate({ user })
    if (errorAfter.error) {
        res.status(422).send("Something with users is wrong");
        return;
    }
    try {
        await client.connect();
        const db = client.db("batePapoUol");

        let messagesFiltered = await db.collection("messages").find({
            $or:
                [
                    { type: { $in: ["message", "status"] } },
                    { to: user },
                    { from: user }
                ]
        }).toArray();

        if (limit && messagesFiltered) {
            messagesFiltered = messagesFiltered.slice(-limit)
        }

        res.send(messagesFiltered)
        client.close()
    } catch (error) {
        client.close();
        return res.sendStatus(500);
    }
})

app.post("/status", async (req, res) => {
    const { error } = userSchema.validate(req.headers)
    if (error) {
        res.status(422).send(error.details[0].message);
        return;
    }

    const user = sanitaze(req.headers.user);
    const errorAfter = userSchema.validate({ user })
    if (errorAfter.error) {
        res.status(422).send(errorAfter.error.details[0].message);
        return;
    }
    try {
        await client.connect();
        const db = client.db("batePapoUol");

        const participant = await db.collection("users").findOne({ name: user })

        if (!participant) return res.sendStatus(404);

        await db.collection("users").updateOne({
            name: user,
        }, {
            $set: { lastStatus: Date.now() }
        })
        console.log(chalk.greenBright(`The ${user} acess was updated`))
        res.sendStatus(200);
        client.close();
    } catch (error) {
        client.close();
        return res.status(500).send("Internal Error");
    }
})

app.delete("/messages/:idMessage", async (req, res) => {
    let { idMessage } = req.params

    const { error } = userSchema.validate(req.headers)
    if (error) {
        res.status(422).send(error.details[0].message);
        return;
    }

    const user = sanitaze(req.headers.user);
    const errorAfter = userSchema.validate({ user })
    if (errorAfter.error) {
        res.status(422).send(errorAfter.error.details[0].message);
        return;
    }
    try {
        await client.connect();
        const db = client.db("batePapoUol");

        const message = await db.collection("messages").findOne({ _id: ObjectId(idMessage) })

        if (!message) return res.sendStatus(404);
        if (message.from !== user) return res.sendStatus(401);

        await db.collection("messages").deleteOne({ _id: ObjectId(idMessage) })

        res.sendStatus(200)
        client.close()
    } catch (error) {
        console.log(error)
        res.sendStatus(500);
        client.close()
    }
})

app.put("/messages/:idMessage", async (req, res) => {
    let { idMessage } = req.params
    

    const validationBeforeBody = messageSchema.validate(req.body)
    const validationBeforeHeader = userSchema.validate(req.headers)
    if (validationBeforeBody.error || validationBeforeHeader.error) {
        return res.sendStatus(422);
    }
    
    const to = sanitaze(req.body.to);
    const text = sanitaze(req.body.text)
    const type = sanitaze(req.body.type)
    const user = sanitaze(req.headers.user)
    const validationAfterBody = messageSchema.validate({to, text, type})
    const validationAfterHeader = userSchema.validate({ user })
    if (validationAfterBody.error || validationAfterHeader.error) {
        return res.status(422).send(validationAfterBody.error.details);
    }
    try {
        await client.connect();
        const db = client.db("batePapoUol");

        const participant = await db.collection("users").findOne({ name: user })
        if (!participant) {
            console.log(`${user} is not a valid user`)
            client.close();
            return res.sendStatus(422);
        }

        const message = await db.collection("messages").findOne({ _id: ObjectId(idMessage) })
        
        if (!message) return res.sendStatus(404);
        if (message.from !== user) return res.sendStatus(401);

        await db.collection("messages").updateOne({
            _id: ObjectId(idMessage),
        }, {
            $set:
            {
                text: text,
                time: dayjs().format('HH:mm:ss')
            }
        })
        res.sendStatus(201)
        client.close();
    } catch (error) {
        res.sendStatus(500);
        client.close();
    }
})

setInterval(async () => {
    try {
        await client.connect();
        const db = client.db("batePapoUol");

        const itWillDeleted = await db.collection("users").find({
            lastStatus: { $lt: (Date.now() - 10000) }
        }).toArray()

        if (itWillDeleted.length === 0) {
            client.close();
            return console.log("there is no user to be deleted")
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
            console.log(`${itWillDeleted[i].name} left the room`)
        }
        client.close()
    } catch (error) {
        res.sendStatus(500)
        client.close()
    }
}, 15000)

app.listen(5000, () => {
    console.log("server running")
})