// Import required modules
const express = require('express');
const path = require('path');
const https = require('https');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Serve static files from the root directory
// This will serve your index.html file
app.use(express.static(path.join(__dirname)));

// API endpoint to verify a Paystack transaction
app.post('/verify-payment', async (req, res) => {
    const { reference, planDetails, recipientPhoneNumber } = req.body;

    if (!reference) {
        return res.status(400).json({ status: 'error', message: 'No transaction reference provided.' });
    }

    try {
        const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
        if (!paystackSecretKey) {
            console.error('PAYSTACK_SECRET_KEY is not set in environment variables.');
            return res.status(500).json({ status: 'error', message: 'Server configuration error.' });
        }

        const options = {
            hostname: 'api.paystack.co',
            port: 443,
            path: `/transaction/verify/${encodeURIComponent(reference)}`,
            method: 'GET',
            headers: {
                Authorization: `Bearer ${paystackSecretKey}`,
                'Content-Type': 'application/json'
            }
        };

        const paystackReq = https.request(options, paystackRes => {
            let data = '';

            paystackRes.on('data', chunk => {
                data += chunk;
            });

            paystackRes.on('end', async () => {
                const paystackResponse = JSON.parse(data);

                if (paystackResponse.data && paystackResponse.data.status === 'success') {
                    // Payment is verified. Now send details to Formspree.
                    const formspreeUrl = process.env.FORMSPREE_URL;
                    const formData = {
                        'plan-name': planDetails.name,
                        'plan-price': planDetails.price,
                        'recipient-number': recipientPhoneNumber,
                        'transaction-reference': reference,
                        'status': 'Payment Verified and Confirmed'
                    };

                    const formspreeRes = await fetch(formspreeUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(formData)
                    });

                    if (formspreeRes.ok) {
                        return res.status(200).json({ status: 'success', message: 'Payment verified and data submitted to Formspree.' });
                    } else {
                        return res.status(500).json({ status: 'error', message: 'Failed to submit data to Formspree.' });
                    }
                } else {
                    return res.status(400).json({ status: 'error', message: 'Payment verification failed.' });
                }
            });
        });

        paystackReq.on('error', e => {
            console.error(e);
            res.status(500).json({ status: 'error', message: 'Internal server error during verification.' });
        });

        paystackReq.end();
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ status: 'error', message: 'Server error.' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
