// server.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fetch = require('node-fetch');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware for parsing forms and JSON
app.use(bodyParser.urlencoded({ extended: true }));

// Special middleware for Paystack webhooks to read raw body
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));

// CORS configuration for your Render site
const corsOptions = {
    origin: 'https://purchase-data-bundle.onrender.com', 
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
};

app.use(cors(corsOptions));
app.options('/process-payment', cors(corsOptions));

// Endpoints
app.get('/', (req, res) => {
    res.send('Server is running!');
});

// Endpoint to handle the payment initiation
app.post('/process-payment', async (req, res) => {
    console.log('Received form data:', req.body);
    const {
        'Data Plan': dataPlan,
        'Recipient Phone': recipientPhone,
        'Buyer Phone': buyerPhone,
        'Payment Method': paymentMethod
    } = req.body;

    if (!buyerPhone) {
        return res.status(400).json({ status: 'error', message: 'Buyer Phone number is required for payment.' });
    }

    const priceMatch = dataPlan.match(/GHC (\d+\.\d{2})/);
    const amountInPesewas = priceMatch ? parseFloat(priceMatch[1]) * 100 : null;

    if (!amountInPesewas) {
        return res.status(400).json({ status: 'error', message: 'Invalid data plan or price.' });
    }

    const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
    const paystackInitUrl = 'https://api.paystack.co/transaction/initialize';

    try {
        const paystackResponse = await fetch(paystackInitUrl, {
            method: 'POST',
            body: JSON.stringify({
                email: 'customer@example.com',
                amount: amountInPesewas,
                currency: 'GHS',
                callback_url: 'https://purchase-data-bundle.onrender.com',
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
        console.error('API error:', error);
        res.status(500).json({ status: 'error', message: 'Payment processing failed.' });
    }
});

// *** CORRECTED WEBHOOK ENDPOINT FOR AUTOMATED DATA DELIVERY ***
app.post('/webhook', (req, res) => {
    // We now use the PAYSTACK_SECRET_KEY for webhook verification as a workaround
    const secret = process.env.PAYSTACK_SECRET_KEY;
    const hash = crypto.createHmac('sha512', secret)
        .update(req.rawBody)
        .digest('hex');

    if (hash !== req.headers['x-paystack-signature']) {
        return res.status(400).send('Invalid signature');
    }

    const event = req.body;
    if (event.event === 'charge.success') {
        const transactionDetails = event.data;
        console.log('Received successful payment webhook:', transactionDetails);

        const recipientPhone = transactionDetails.metadata.recipient_phone;
        const dataPlan = transactionDetails.metadata.data_plan;

        const planParts = dataPlan.split(' ');
        const capacity = planParts[0];
        const network = planParts[2];
        const networkMap = {
            'MTN': 'YELLO',
            'Vodafone': 'TELECEL',
            'AirtelTigo': 'AT_PREMIUM',
        };
        const datamartNetwork = networkMap[network];

        console.log(`Sending data bundle: ${dataPlan} to phone: ${recipientPhone}`);

        const topUpApiKey = process.env.TOPUP_API_KEY;
        const topUpApiUrl = 'https://api.datamartgh.shop/api/developer/purchase';

        try {
             fetch(topUpApiUrl, {
                 method: 'POST',
                 headers: {
                     'Content-Type': 'application/json',
                     'X-API-Key': topUpApiKey
                 },
                 body: JSON.stringify({
                     phoneNumber: recipientPhone,
                     network: datamartNetwork,
                     capacity: capacity,
                     gateway: 'wallet'
                 })
             }).then(res => res.json()).then(topUpResult => {
                 console.log('DataMart API Response:', topUpResult);
                 if (topUpResult.status === 'success') {
                     console.log('Data bundle successfully delivered!');
                 } else {
                     console.error('Data bundle delivery failed:', topUpResult.message);
                 }
             }).catch(error => {
                console.error('DataMart API call failed:', error);
             });
        } catch (error) {
            console.error('DataMart API call failed:', error);
        }
    }
    
    res.status(200).send('OK');
});

app.listen(PORT, () => {
    console.log(`Server is running on http://
