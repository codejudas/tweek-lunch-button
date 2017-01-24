const express = require('express');
const https = require('https');
const fs = require('fs');
const bodyParser = require('body-parser');
const slack = require('./slack.js');

if (!fs.existsSync('./config.json')) {
    throw new Error('App requires ./config.json to exist.');
}

const port = process.env.PORT || 5000;
const file = './users.json';
const config = JSON.parse(fs.readFileSync('./config.json'));
const accountSid = config.accountSid;
const authToken = config.authToken;
const validChannels = ['sms', 'slack', 'android', 'ios'];

if (!accountSid || !authToken) {
    throw new Error('./config.json must contain twilio account sid and auth token.');
}

console.log('===Starting up===');
let credentials = null;
/* Twilio does not accept self signed certificate */
// try {
//     credentials = {
//         key: fs.readFileSync('ssl/server.key', 'utf-8'),
//         cert: fs.readFileSync('ssl/server.crt', 'utf-8')
//     };
//     console.log('HTTPS Enabled.');
// } catch (err) {
//     console.log('HTTPS Disabled.');
// }

var users;
try {
    users = JSON.parse(fs.readFileSync(file));
} catch (err) {
    users = {};
}

console.log(`Num subscribed users ${Object.keys(users).length}`);

let app = express();

app.use(bodyParser.json()); // support json POST bodies
app.use(bodyParser.urlencoded({ extended: true })); // support form encoded POST bodies

app.post('/users', (req, res) => {
    /* 
     * Expects a text formatted as follows:
     * {identity}: sms, android, ios
     * {identity}: [unsubscribe|stop]
     */
    console.log(`POST /users From:${req.body.From} Body: ${req.body.Body}`);

    let body = req.body.Body.toLowerCase()
                            .split(':', 2)
                            .map((e) => { return e.trim(); });
    if (body.length !== 2) {
        res.send(`
            <Response>
                <Message>Register by texting:\n[ldap username]: [comma separated list of channels to be notified on]</Message>
                <Message>Supported channels are ${validChannels.join(', ')}.\nEx: jdoe: sms, slack, ios</Message>
                <Message>If you would like to unsubscribe text:\n[ldap username]: stop</Message>
            </Response>
        `);
        return;
    }

    let identity = body[0];
    if (body[1] === 'stop' || body[1] === 'unsubscribe') {
        if (users[identity]) {
            /* TODO: Hit notify API to delete bindings*/
            delete users[identity];
        }
        res.send(`
            <Response>
                <Message>You have been unsubscribed, ${identity}</Message>
            </Response>
        `);
    } else {
        let channels = body[1].split(',')
                              .map((e) => { return e.trim(); })
                              .filter((e) => { return validChannels.includes(e); });

        if (!channels.length) {
            res.send(`
                <Response>
                    <Message>You must specify at least one valid channel</Message>
                    <Message>Supported channels are ${validChannels.join(', ')}.\nEx: jdoe: sms, slack, ios</Message>
                </Response>
            `);
            return;
        }

        let msg = `Thanks for signing up ${identity}. You're signed up to receive notifications on ${channels.join(', ')}.`;
        if (users[identity]) {
            msg = `Looks like you are already registered ${identity}.\nWe've updated your notification preferences to ${channels.join(', ')}.`;
        } else {
            users[identity] = {};
            channels.forEach((channel) => {
                if (channel === 'slack') {
                    users[identity][channel] = 'https://www.slack.com/notifyme';
                } else {
                    users[identity][channel] = 'BSXXXXXXXXXXXXXXXXXXXXX';
                }
            });
        }
        res.send(`
            <Response>
                <Message>${msg}\nWe'll let you know when lunch arrives.</Message>
            </Response>
        `);
    }

    /* Persist updated users */
    fs.writeFile(file, JSON.stringify(users), (err) => {
        if (err) console.log('Unable to persist users...');
    });
});

app.get('/users', (req, res) => {
    console.log('GET /users');
    res.send(users);
});

app.post('/lunch', (req, res) => {
    console.log('POST /lunch');
    res.send('Notifying');
    // slack.notifyUser('efossier', 'Lunch has arrived!');
});

if (credentials) {
    app = https.createServer(credentials, app);
}
app.listen(port, () => {
    console.log(`Listening on port ${port}...`);
});

