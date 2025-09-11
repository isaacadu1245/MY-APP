const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Serve the index.html file for the root URL
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Secure endpoint to verify Paystack payment
app.post('/verify-payment', async (req, res) => {
    const { reference, planDetails, recipientNumber, buyerNumber, paymentMethod } = req.body;
    const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
    const formspreeUrl = process.env.FORMSPREE_URL;

    if (!paystackSecretKey || !formspreeUrl) {
        return res.status(500).json({ status: 'error', message: 'Server is not configured correctly. Missing environment variables.' });
    }

    try {
        // Step 1: Verify the payment with Paystack
        const verificationResponse = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
            headers: {
                Authorization: `Bearer ${paystackSecretKey}`
            }
        });

        const paystackData = verificationResponse.data;

        if (paystackData.status && paystackData.data.status === 'success') {
            // Step 2: If verification is successful, submit to Formspree
            const formData = {
                plan: planDetails.name,
                price: planDetails.price,
                recipient_number: recipientNumber,
                buyer_number: buyerNumber,
                payment_method: paymentMethod,
                transaction_reference: reference
            };

            await axios.post(formspreeUrl, formData, {
                headers: { 'Accept': 'application/json' }
            });

            console.log(`Payment confirmed and data submitted for reference: ${reference}`);
            return res.status(200).json({ status: 'success', message: 'Payment confirmed and data submitted.' });
        } else {
            // Payment verification failed
            console.log(`Payment verification failed for reference: ${reference}`);
            return res.status(400).json({ status: 'error', message: 'Payment verification failed.' });
        }
    } catch (error) {
        console.error('Error in payment verification:', error.response ? error.response.data : error.message);
        return res.status(500).json({ status: 'error', message: 'An internal server error occurred.' });
    }
});

// For any other GET request, send the index.html file as well
// This is a catch-all to prevent 404 errors for things like sub-routes in single-page apps
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
