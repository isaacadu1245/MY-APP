const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const bodyParser = require('body-parser');
const crypto = require('crypto'); // Added crypto for webhook verification

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// API keys and configuration
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_PUBLIC_KEY = process.env.PAYSTACK_PUBLIC_KEY;

// Paystack API endpoint for payment verification
const PAYSTACK_VERIFY_URL = 'https://api.paystack.co/transaction/verify/';

// Vercel serverless function entry point
const server = app;

// Simple route to check if the server is running
app.get('/', (req, res) => {
    res.send('Server is running!');
});

// Route to handle webhook events from Paystack
app.post('/webhook', (req, res) => {
    const hash = crypto.createHmac('sha512', PAYSTACK_SECRET_KEY).update(JSON.stringify(req.body)).digest('hex');
    if (hash === req.headers['x-paystack-signature']) {
        const event = req.body;
        if (event.event === 'charge.success') {
            console.log('Payment was successful');
            // Here, you would fulfill the order, update your database, etc.
            // You can access the transaction details from `event.data`
            // Example: const customerEmail = event.data.customer.email;
        }
    }
    res.sendStatus(200);
});

// Route to handle payment initialization
app.post('/initialize-payment', async (req, res) => {
    const { amount, email } = req.body;

    const url = 'https://api.paystack.co/transaction/initialize';
    const body = {
        amount: amount * 100, // Paystack amount is in kobo (cents)
        email: email,
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
            },
            body: JSON.stringify(body),
        });

        const data = await response.json();
        res.status(response.status).json(data);
    } catch (error) {
        console.error('Error initializing payment:', error);
        res.status(500).json({ error: 'Failed to initialize payment' });
    }
});

module.exports = server;
