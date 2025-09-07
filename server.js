// server.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// CORS configuration to allow your Render site to communicate with the Vercel server
const corsOptions = {
    origin: 'https://purchase-data-bundle.onrender.com', 
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
};

app.use(cors(corsOptions));

// This explicitly handles the CORS preflight OPTIONS request
app.options('/process-payment', cors(corsOptions));

// A simple endpoint to test if the server is working
app.get('/', (req, res) => {
    res.send('Server is running!');
});

// Endpoint to handle the form submission from your website
app.post('/process-payment', async (req, res) => {
    console.log('Received form data:', req.body);

    const {
        'Data Plan': dataPlan,
        'Recipient Phone': recipientPhone,
        'Buyer Phone': buyerPhone,
        'Payment Method': paymentMethod
    } = req.body;

    // Check if the buyer's phone number is provided
    if (!buyerPhone) {
        return res.status(400).json({ status: 'error', message: 'Buyer Phone number is required for payment.' });
    }

    const priceMatch = dataPlan.match(/GHC (\d+\.\d{2})/);
    // Convert to Ghana pesewas (amount * 100) as required by Paystack
    const amountInPesewas = priceMatch ? parseFloat(priceMatch[1]) * 100 : null;

    if (!amountInPesewas) {
        return res.status(400).json({ status: 'error', message: 'Invalid data plan or price.' });
    }

    // Paystack API Integration
    // You must add your Paystack Secret Key to Vercel's environment variables
    const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
    const paystackInitUrl = 'https://api.paystack.co/transaction/initialize';

    try {
        // Initialize a payment transaction with Paystack
        const paystackResponse = await fetch(paystackInitUrl, {
            method: 'POST',
            body: JSON.stringify({
                email: 'customer@example.com', // Use a default email or get one from the user
                amount: amountInPesewas,
                currency: 'GHS',
                metadata: {
                    recipient_phone: recipientPhone,
                    data_plan: dataPlan,
                    buyer_phone: buyerPhone,
                    payment_method: paymentMethod
                }
            }),
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${paystackSecretKey}`
            }
        });

        const paystackResult = await paystackResponse.json();
        console.log('Paystack API Response:', paystackResult);

        // If the transaction initialization is successful, send the authorization URL back to the client
        if (paystackResult.status && paystackResult.data.authorization_url) {
            res.status(200).json({
                status: 'success',
                message: 'Payment initialized.',
                paymentUrl: paystackResult.data.authorization_url
            });
        } else {
            console.error('Paystack Initialization Failed:', paystackResult.message);
            res.status(400).json({ status: 'error', message: 'Paystack initialization failed.' });
        }
    } catch (error) {
        console.error('Paystack API error:', error);
        res.status(500).json({ status: 'error', message: 'Payment processing failed.' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
