const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const bodyParser = require('body-parser');
const crypto = require('crypto'); 

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// API keys and configuration
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_PUBLIC_KEY = process.env.PAYSTACK_PUBLIC_KEY;

const server = app;

// Simple route to check if the server is running
app.get('/', (req, res) => {
    res.send('Server is running!');
});

// Route to handle webhook events from Paystack
app.post('/webhook', async (req, res) => {
    // Verify that the webhook request is genuinely from Paystack
    const hash = crypto.createHmac('sha512', PAYSTACK_SECRET_KEY).update(JSON.stringify(req.body)).digest('hex');
    if (hash === req.headers['x-paystack-signature']) {
        const event = req.body;
        
        // Process only if the payment was successful
        if (event.event === 'charge.success') {
            console.log('Payment was successful');
            
            // Extract the necessary data from the Paystack webhook
            const transactionDetails = event.data;
            const customerEmail = transactionDetails.customer.email;
            const amount = transactionDetails.amount / 100; // Convert back to GHC
            const reference = transactionDetails.reference;

            // Extract the custom metadata you sent earlier
            const recipientNumber = transactionDetails.metadata.custom_fields.find(field => field.variable_name === 'recipient_number')?.value;
            const selectedPlan = transactionDetails.metadata.custom_fields.find(field => field.variable_name === 'selected_plan')?.value;

            // --- THIS IS THE CRITICAL PART: THE FINAL STEP TO DELIVER THE DATA BUNDLE ---
            // Replace this placeholder with your actual logic to connect to your DataMart Dashboard
            
            console.log(`Sending a request to transfer ${selectedPlan} to ${recipientNumber}...`);

            try {
                // The URL below is a placeholder. You need to use your DataMart's real URL.
                // The 'body' is also a placeholder. You need to use the data format
                // required by your DataMart's API.
                
                const response = await fetch('YOUR_DATAMART_API_ENDPOINT_HERE', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        // You might need an API key or other authentication here
                        // 'Authorization': 'Bearer YOUR_API_KEY',
                    },
                    body: JSON.stringify({
                        recipient: recipientNumber,
                        plan: selectedPlan,
                        transactionId: reference,
                    }),
                });

                if (response.ok) {
                    console.log(`Data bundle transfer successful for ${recipientNumber}!`);
                    // This is where you would get a confirmation that the data was sent
                } else {
                    console.error(`Failed to transfer data bundle. Status: ${response.status}`);
                }
            } catch (error) {
                console.error('Error during data bundle transfer:', error);
            }
        }
    }
    // Acknowledge receipt of the webhook to Paystack
    res.sendStatus(200);
});

// Route to handle payment initialization
app.post('/initialize-payment', async (req, res) => {
    const { amount, email, recipientNumber, plan } = req.body;

    const url = 'https://api.paystack.co/transaction/initialize';
    const body = {
        amount: amount * 100, // Paystack amount is in kobo (cents)
        email: email,
        metadata: {
            custom_fields: [
                {
                    display_name: "Recipient Phone",
                    variable_name: "recipient_number",
                    value: recipientNumber
                },
                {
                    display_name: "Selected Plan",
                    variable_name: "selected_plan",
                    value: plan
                }
            ]
        }
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
