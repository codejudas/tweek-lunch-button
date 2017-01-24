'use strict';

const request = require('request');
const fs = require('fs');

/* Get this from client_guid field of https://cater2.me/clients/users/available_profiles.json */
const clientId = JSON.parse(fs.readFileSync('./config.json')).cater2me.clientId;
/* Get this from guid field of https://cater2.me/clients/users/me.json */
const userId = JSON.parse(fs.readFileSync('./config.json')).cater2me.userId;
/* Get this from id fields of https://cater2.me/clients/users/available_profiles.json */
const profileIds = JSON.parse(fs.readFileSync('./config.json')).cater2me.profileIds;

const cater2meOrdersUrl = `https://cater2.me/clients/${clientId}/calendars/orders_feed.json?cal_by_profile_ids=${encodeURIComponent(profileIds.join(','))}&cal_sort_by=order_for&cal_by_user_id=${userId}`;
const cater2meOrderBaseUrl = `https://cater2.me/clients/${clientId}/calendars/order_details.json?order_id=`;

class Cater2MeMenu {
    constructor(menuJsonResponse) {
        console.log('Constructing');
        this.vendor = menuJsonResponse.vendor_name || 'unknown';
        this.vendorImage = menuJsonResponse.vendor_image_timeline_url || null;
        this.office = menuJsonResponse.office_name || 'unknown';
        this.menuItems = (menuJsonResponse.menu_items || []).map((item) => {
            var item_notes = item.item_notes ? ` (${item.item_notes})` : '';
            return {
                item: `${item.item_display_name}${item_notes}`,
                description: item.item_description
            }
        });
    }

    toString() {
        return `Cater2MeMenu { vendor: ${this.vendor}, office: ${this.office}, menuItems: ${this.menuItems.map((e) => {return e.item;}).join(', ')} }`
    }
}

module.exports.Cater2MeMenu = Cater2MeMenu;

module.exports.loadTodaysMenu = function() {
    let today = new Date();
    return new Promise((resolve, reject) => {
        console.log('Fetching todays menu from cater2.me...');
        request.get(cater2meOrdersUrl, (err, resp, body) => {
            if (err) { return reject(Error(`Error getting cater2me orders.`)); };
            if (resp.statusCode !== 200) { return reject(Error(`Error getting cater2me order: received ${resp.statusCode} status code.`)); };

            /* Find todays order */
            body = JSON.parse(body);
            let order = body.orders.find((order) => {
                let orderDate = new Date(order.order_for);
                return orderDate.toDateString() === today.toDateString();
            });
            if (!order) { return reject(Error(`No orders found for ${today.toLocaleDateString('en-US', {timezone: 'America/Los_Angeles'})}.`)); }

            /* Get menu for todays order */
            request.get(cater2meOrderBaseUrl + order.id, (err, resp, body) => {
                if (err) { return reject(Error(`Error getting cater2me menu for order ${order.id}.`)); };
                if (resp.statusCode !== 200) { return reject(Error(`Error getting cater2me menu for order ${order.id}: received ${resp.statusCode} status code.`)); };
                
                let menu = JSON.parse(body).order;
                if (!menu) { return reject(Error(`No menu found for order ${order.id}.`)); }

                let output = new Cater2MeMenu(menu);
                resolve(output);
            });
        });
    });
};
