const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// Main endpoint to initialize payment with Paystack
app.post('/initialize-payment', async (req, res) => {
    try {
        const { email, amount, planName, recipientNumber, buyerNumber, network, dataAmount } = req.body;

        // Your Paystack secret key from environment variables
        const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;

        if (!paystackSecretKey) {
            console.error('PAYSTACK_SECRET_KEY is not set.');
            return res.status(500).json({ error: 'Server configuration error: Paystack secret key missing.' });
        }

        const headers = {
            Authorization: `Bearer ${paystackSecretKey}`,
            'Content-Type': 'application/json'
        };

        const paystackPayload = {
            email,
            amount, // amount in kobo/pesewas (1 GHC = 100 pesewas)
            callback_url: "https://bangerhitz-digital-media.vercel.app/payment-successful", // Replace with your actual callback URL
            metadata: {
                custom_fields: [
                    {
                        display_name: "Plan Name",
                        variable_name: "plan_name",
                        value: planName
                    },
                    {
                        display_name: "Recipient Number",
                        variable_name: "recipient_number",
                        value: recipientNumber
                    },
                    {
                        display_name: "Buyer Number",
                        variable_name: "buyer_number",
                        value: buyerNumber
                    },
                    {
                        display_name: "Network",
                        variable_name: "network",
                        value: network
                    },
                    {
                        display_name: "Data Amount",
                        variable_name: "data_amount",
                        value: dataAmount
                    },
                ]
            }
        };

        const response = await axios.post('https://api.paystack.co/transaction/initialize', paystackPayload, { headers });
        console.log('Paystack response:', response.data);
        res.status(200).json(response.data);

    } catch (error) {
        console.error('Error during payment initialization:', error.response ? error.response.data : error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to initialize payment.',
            error: error.response ? error.response.data : error.message
        });
    }
});

// Paystack webhook endpoint (to handle payment status updates)
app.post('/paystack-webhook', (req, res) => {
    const hash = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
        .update(JSON.stringify(req.body))
        .digest('hex');

    if (hash === req.headers['x-paystack-signature']) {
        const event = req.body;
        // Handle successful payment event
        if (event.event === 'charge.success') {
            console.log('Payment was successful:', event.data);
            const { reference, metadata } = event.data;
            const customFields = metadata.custom_fields.reduce((acc, field) => {
                acc[field.variable_name] = field.value;
                return acc;
            }, {});
            const { recipient_number, data_amount } = customFields;
            // Here you would add logic to send the data bundle to the recipient's phone number
            // For example, you might call a third-party API here.
            console.log(`Sending ${data_amount}GB to ${recipient_number} with transaction reference ${reference}`);
        }
    }
    res.sendStatus(200);
});

// Simple GET endpoint for a health check
app.get('/', (req, res) => {
    res.send('Bangerhitz Digital Media server is running!');
});

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from the 'public' directory. This is where your index.html should be.
app.use(express.static(path.join(__dirname, 'public')));

// Set up a route to serve the index.html file directly at the root URL.
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server and listen on the specified port.
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
