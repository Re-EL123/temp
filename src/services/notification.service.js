const { Expo } = require('expo-server-sdk');
const User = require('../models/user');

let expo = new Expo();

/**
 * Send push notification to a specific user
 * @param {string} userId - The ID of the recipient user
 * @param {object} messageData - Notification content { title, body, data }
 */
const sendNotification = async (userId, { title, body, data }) => {
    try {
        const user = await User.findById(userId);
        if (!user || !user.pushToken) {
            console.log(`[NotificationService] User ${userId} not found or no push token registered.`);
            return;
        }

        const pushToken = user.pushToken;
        if (!Expo.isExpoPushToken(pushToken)) {
            console.error(`[NotificationService] Invalid push token: ${pushToken}`);
            return;
        }

        const messages = [{
            to: pushToken,
            sound: 'default',
            title,
            body,
            data: data || {},
        }];

        let chunks = expo.chunkPushNotifications(messages);
        let tickets = [];

        for (let chunk of chunks) {
            try {
                let ticketChunk = await expo.sendPushNotificationsAsync(chunk);
                tickets.push(...ticketChunk);
            } catch (error) {
                console.error('[NotificationService] Error sending chunk:', error);
            }
        }

        console.log(`[NotificationService] Successfully sent notification to user ${userId}`);
    } catch (error) {
        console.error('[NotificationService] Fatal error:', error);
    }
};

module.exports = {
    sendNotification
};
