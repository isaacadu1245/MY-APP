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
                callback_url: 'https://purchase-data-bundle.onrender.com', // Replace with your Render URL
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
            // *** NEW CODE STARTS HERE ***
            // Now, we submit the data to Formspree after a successful Paystack initiation.
            const formspreeUrl = 'https://formspree.io/f/xkgvknwg';
            const formspreeData = new URLSearchParams();
            formspreeData.append('Data Plan', dataPlan);
            formspreeData.append('Recipient Phone', recipientPhone);
            formspreeData.append('Buyer Phone', buyerPhone);
            formspreeData.append('Payment Method', paymentMethod);

            const formspreeResponse = await fetch(formspreeUrl, {
                method: 'POST',
                body: formspreeData,
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });
            
            if (formspreeResponse.ok) {
                console.log('Data successfully sent to Formspree.');
                res.status(200).json({ 
                    status: 'success', 
                    message: 'Payment initialized and data submitted!',
                    paymentUrl: paystackResult.data.authorization_url
                });
            } else {
                console.error('Formspree submission failed.');
                // Even if Formspree fails, we still want to proceed with the payment
                res.status(200).json({
                    status: 'success',
                    message: 'Payment initialized. (Formspree submission failed)',
                    paymentUrl: paystackResult.data.authorization_url
                });
            }
        } else {
            console.error('Paystack Initialization Failed:', paystackResult.message);
            res.status(400).json({ status: 'error', message: 'Paystack initialization failed.' });
        }
    } catch (error) {
        console.error('API error:', error);
        res.status(500).json({ status: 'error', message: 'Payment processing failed.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
