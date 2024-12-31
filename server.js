const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const fs = require('fs');

const app = express();
app.use(express.json());

// Load Firebase service account JSON file
const serviceAccount = require('./config/firebase-service-account.json');

// Define Firebase project ID
const FIREBASE_PROJECT_ID = 'mecocevent2025';

// Function to generate Firebase access token
function getFirebaseAccessToken() {
    const jwtPayload = {
        iss: serviceAccount.client_email,
        sub: serviceAccount.client_email,
        aud: 'https://oauth2.googleapis.com/token',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        scope: 'https://www.googleapis.com/auth/firebase.messaging',
    };

    const token = jwt.sign(jwtPayload, serviceAccount.private_key, { algorithm: 'RS256' });

    return axios.post('https://oauth2.googleapis.com/token', null, {
        params: {
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: token,
        },
    }).then(response => response.data.access_token);
}

// Function to send FCM notification
async function sendFcmNotification(token, title, body) {
    const accessToken = await getFirebaseAccessToken();

    const fcmMessage = {
        message: {
            token: token,
            notification: {
                title: title,
                body: body,
            },
            android: {
                priority: 'high',
            },
        },
    };

    try {
        const response = await axios.post(
            `https://fcm.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/messages:send`,
            fcmMessage,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            }
        );
        return response.data;
    } catch (error) {
        console.error('FCM Error Details:', error.response?.data || error.message);
        throw error;
    }
}

app.post('/send-notification', async (req, res) => {
    const { token, title, body } = req.body;

    if (!token || !title || !body) {
        return res.status(400).json({ error: 'Missing required parameters' });
    }

    try {
        const result = await sendFcmNotification(token, title, body);
        res.json({ success: true, message: 'Notification sent successfully', result });
    } catch (error) {
        console.error('Error sending notification:', error.response?.data || error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to send notification',
            details: error.response?.data || error.message 
        });
    }
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
