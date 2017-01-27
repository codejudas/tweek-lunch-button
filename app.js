'use strict';

const express = require('express');
const https = require('https');
const fs = require('fs');
const bodyParser = require('body-parser');
const twilio = require('twilio');
const cron = require('cron');
const log4js = require('log4js');
const util = require('util');
const lodash = require('lodash');
const sleep = require('sleep');

const slack = require('./slack.js');
const notify = require('./notify.js');
const cater2me = require('./cater2me.js');

const RegistrationCommand = require('./util.js').RegistrationCommand;

const port = process.env.PORT || 5000;
const config = require('./config.json');
const accountSid = config.accountSid;
const authToken = config.authToken;
const logger = log4js.getLogger('app');
const numberToNotifyAtOnce = 2;

const twilioClient = new twilio(accountSid, authToken);

const FILE_USERS = './users.json';
const FILE_DISPLAYS = './displays.json';

process.on('SIGTERM', () => { logger.warn('Received SIGTERM, shutting down...'); process.exit(0); });

logger.warn('Starting up...');
let credentials = null;
/* Twilio does not accept self signed certificate */
// try {
//     credentials = {
//         key: fs.readFileSync('ssl/server.key', 'utf-8'),
//         cert: fs.readFileSync('ssl/server.crt', 'utf-8')
//     };
//     logger.info('HTTPS Enabled.');
// } catch (err) {
//     logger.info('HTTPS Disabled.');
// }

/* Read registered users */
let users = fs.existsSync(FILE_USERS) ? require(FILE_USERS) : {};
let displays = fs.existsSync(FILE_DISPLAYS) ? require(FILE_DISPLAYS) : {};

logger.info(`Num subscribed users ${Object.keys(users).length}`);

/* Load todays menu */
let cater2MeMenu = null;
let cater2MeMenuLoaded = null;

logger.info('Starting cater2me cron job...');
let cater2MeCron = new cron.CronJob({
    cronTime: '0 8 * * 1-5', /* Run at 8am PST every day Mon-Fri */
    timeZone: 'America/Los_Angeles',
    start: true,
    runOnInit: true,
    onTick: function() {
        cater2MeMenuLoaded = new Promise((resolve, reject) => {
            cater2me.loadTodaysMenu().then(
                (res) => { 
                    cater2MeMenu = res;
                    logger.info(`Got Cater2Me menu ${cater2MeMenu}`);
                    return resolve(res);
                },
                (err) => {
                    logger.warn(`Failed to load Cater2Me menu: ${err}`);
                    return reject(err);
                }
            );
        });
    },
    onComplete: function() { logger.info('Stopping cater2me cron job'); }
});

/* Setup web server */
let app = express();

app.use(bodyParser.json()); // support json POST bodies
app.use(bodyParser.urlencoded({ extended: true })); // support form encoded POST bodies

/* Allow CORS */
app.all('/', function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With");
    next();
});

/* Endpoint to register a new user */
app.post('/users', (req, res) => {
    logger.info(`POST /users From:${req.body.From} Body: ${req.body.Body}`);
    let promises = [];
    let command = null;
    try {
        command = new RegistrationCommand(req.body.Body);
    } catch (err) {
        res.send(`
            <Response>
                <Message>Register by texting:\n[ldap username]: [comma separated list of channels to be notified on]</Message>
                <Message>Supported channels are ${RegistrationCommand.VALID_CHANNELS.join(', ')}.\nEx: jdoe: sms, slack, ios</Message>
                <Message>If you would like to unsubscribe text:\n[ldap username]: stop</Message>
            </Response>
        `);
        return;
    }

    if (command.isUnsubscribe) {
        if (users[command.identity]) {
            for (var bindType in users[command.identity]) {
                if (bindType != "slack" && bindType != null) {
                    notify.deleteBinding(users[command.identity][bindType]);
                }
            }
            delete users[command.identity];

            //persist to user file 
            fs.writeFile(file, JSON.stringify(users, null, 2), (err) => {
                if (err) logger.warn('Unable to persist users...');
            });
        }
        res.send(`
            <Response>
                <Message>You have been unsubscribed, ${command.identity}</Message>
            </Response>
        `);
    } else {
        if (!command.channels.length) {
            res.send(`
                <Response>
                    <Message>You must specify at least one valid channel</Message>
                    <Message>Supported channels are ${RegistrationCommand.VALID_CHANNELS.join(', ')}.\nEx: jdoe: sms, slack, ios</Message>
                </Response>
            `);
            return;
        }

        let msg = `Thanks for signing up ${command.identity}. You're signed up to receive notifications on ${command.channels.join(', ')}.`;
        if (users[command.identity]) {
            msg = `Looks like you are already registered ${command.identity}.\nWe've updated your notification preferences to ${command.channels.join(', ')}.`;
        }

        /* Build new user object */
        users[command.identity] = {
            notifications: {},
            team: ''
        };
        command.channels.forEach((channel) => {
            if (channel === 'slack') {
                users[command.identity]['notifications'][channel] = 'https://www.slack.com/notifyme';
            } else {
                //TODO: Support android/ios alerts
                promises.push(new Promise((resolve, reject) => {
                    notify.addBinding(command.identity, "sms", req.body.From, []).then(
                        (res) => {
                            users[command.identity]['notifications'][channel] = res;
                            return resolve(res);
                        },
                        (err) => {
                            logger.warn(`Failed to add Binding for user ${command.identity}: ${err}`);
                            return reject(err);
                        });
                }));
            }
        });

        res.send(`
            <Response>
                <Message>${msg}\nWell let you know when lunch arrives.</Message>
            </Response>
        `);
    }

    Promise.all(promises)
        .then(() => {
            /* Persist updated users */
            fs.writeFile(FILE_USERS, JSON.stringify(users, null, 3), (err) => {
                err && logger.warn('Unable to persist users: ', err);
            });
        }).catch(function () {
            console.log("Promise Rejected");
        });
});

/* List users */
app.get('/users', (req, res) => {
    logger.info('GET /users');
    res.send(users);
});

app.post('/gcm', (req, res) => {
    if (!req.body.User || !req.body.Token) {
        res.status(400);
        res.send('Must provide User and Token params');
        return;
    }

    let user = req.body.User.toLowerCase().trim();
    let gcmToken = req.body.Token.trim();

    logger.info(`POST /gcm User: ${user} Token: ${gcmToken}`);
    res.send('Registered GCM!');
});

/* Notify registered users lunch has arrived*/
app.post('/lunch', (req, res) => {
    logger.info('POST /lunch');

    Object.keys(displays).forEach(d => {
        logger.info(`Notifying display ${d}`)
        twilioClient.messages.create({
            messagingServiceSid: config.copilotServiceSid,
            body: util.format('%s:lunch', d.toLowerCase()),
            to: "+14843348260"
        });
    });

    for (var u in users) {
        if (users[u]['notifications'].hasOwnProperty('slack')) {
                slack.notifyUser(u, '*Lunch has arrived!*', [cater2MeMenu]);
            }
        if (users[u]['notifications'].hasOwnProperty('sms')) {
            notify.notifyUserByIdentity(u, `*Lunch has arrived!* Vendor: ${cater2MeMenu.vendor}`);
         }
    }

    res.send('Notifying');

    /* //don't alert everyone at once 
    var userArray = [];
    var shuffledUsers = [];
    for (var u in users) {
        userArray.push(u);
    }

    shuffledUsers = lodash.shuffle(userArray);
    var pos = 0;
    while (pos < shuffledUsers.length) {
        for (var i = pos; i < (pos + numberToNotifyAtOnce); i++) {
            var userIdentity = shuffledUsers[i];
            console.log(userIdentity);
            console.log(users[userIdentity]);
            if (users[userIdentity].hasOwnProperty('slack')) {
                slack.notifyUser(userIdentity, '*Lunch has arrived!*', [cater2MeMenu]);
            }
            if (users[userIdentity].hasOwnProperty('sms')) {
                notify.notifyUserByIdentity(userIdentity, `*Lunch has arrived!* Vendor: ${cater2MeMenu.Vendor}`);
            }
        }
        pos = pos + numberToNotifyAtOnce;
        sleep.sleep(10);
    } */
}); 


app.post('/display', (req, res) => {
    logger.info('POST /display');
    const newRoom = req.body.newRoom;
    const oldRoom = req.body.oldRoom;

    if (!newRoom) {
        res.send('Error');
    }

    displays[newRoom] = {};
    if (oldRoom) {
        delete displays[oldRoom];
    }

    fs.writeFile(FILE_DISPLAYS, JSON.stringify(displays, null, 2), (err) => {
        err && logger.warn('Unable to persist displays: ', err);
    });

    res.send("done")
});

if (credentials) {
    app = https.createServer(credentials, app);
}

/* Once all initialization is done, start server */
logger.info('Waiting for initialization to complete...');
Promise.all([cater2MeMenuLoaded])
    .then((values) => {
        app.listen(port, () => {
            logger.info(`Listening on port ${port}...`);
        });
    }, (err) => {
        logger.error('Failed to initialize web server'); 
        throw err;
    });
