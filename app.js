const express = require('express');
const fs = require('fs');
const bodyParser = require('body-parser');

const port = process.env.PORT || 5000;
const file = './users.json';
const config = JSON.parse(fs.readFileSync('./config.json'));
const accountSid = config.accountSid;
const authToken = config.authToken;

const app = express();

var users;
try {
    users = JSON.parse(fs.readFileSync(file));
} catch (err) {
    users = {};
}
console.log(`Num subscribed users ${Object.keys(users).length}`);

app.use(bodyParser.json()); // support json POST bodies
app.use(bodyParser.urlencoded({ extended: true })); // support form encoded POST bodies

app.post('/users', (req, res) => {
    console.log('POST /users');
    console.log(`${req.body.From}: ${req.body.Body}`);

    let msg = `Thanks for signing up ${req.body.Body}. We'll let you know when lunch arrives.`;
    if (users[req.body.From]) {
        msg = `Looks like you are already registered as ${users[req.body.From]}. We'll let you know when lunch arrives.`;
    } else {
        users[req.body.From] = req.body.Body;
        fs.writeFile(file, JSON.stringify(users), (err) => {
            if (err) console.log('Unable to persist users...');
        });
    }

    res.send(`
        <Response>
            <Message>${msg}</Message>
        </Response>
    `);
});

app.get('/users', (req, res) => {
    console.log('GET /users');
    res.send(users);
});

app.post('/lunch', (req, res) => {
    console.log('POST /lunch');
    res.send('Notifying');
});

app.listen(port, () => {
    console.log(`Listening on port ${port}...`);
});

