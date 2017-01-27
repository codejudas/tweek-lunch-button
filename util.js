'use strict';

module.exports.RegistrationCommand = class RegistrationCommand {
    static get VALID_CHANNELS() { return ['sms', 'slack']; }

    /* 
     * Expects a text formatted as follows:
     * {identity}: sms, android, ios
     * {identity}: [unsubscribe|stop]
     */
    constructor(inputString) {
        let body = inputString.toLowerCase()
                              .split(':', 2)
                              .map(e => e.trim());

        if (body.length !== 2) { 
            throw new Error('Invalid user input');
        }

        this.identity = body[0];
        this.command = body[1];
    }

    get isUnsubscribe() {
        return this.command === 'stop' || this.command === 'unsubscribe';
    }

    get channels() {
        return this.command.split(',')
                           .map(e => e.trim())
                           .filter(e => RegistrationCommand.VALID_CHANNELS.includes(e));
    }
};
