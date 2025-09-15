const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const app = express();

// Load environment variables if not on Vercel
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve the HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// The Paystack verification route
app.post('/verify-payment', async (req, res) => {
    const { reference } = req.body;

    // Check for required environment variables
    const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
    const formspreeUrl = process.env.FORMSPREE_URL;

    if (!paystackSecretKey) {
        console.error('PAYSTACK_SECRET_KEY is not set in environment variables.');
        return res.status(500).json({ status: 'error', message: 'Server configuration error: Paystack key is missing.' });
    }

    if (!formspreeUrl) {
        console.error('FORMSPREE_URL is not set in environment variables.');
        return res.status(500).json({ status: 'error', message: 'Server configuration error: Formspree URL is missing.' });
    }

    if (!reference) {
        return res.status(400).json({ status: 'error', message: 'Payment reference is missing.' });
    }

    // Paystack verification URL
    const paystackUrl = `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`;

    try {
        const paystackResponse = await axios.get(paystackUrl, {
            headers: {
                Authorization: `Bearer ${paystackSecretKey}`,
            },
        });

        const paystackData = paystackResponse.data;

        // Check if the Paystack transaction was successful
        if (paystackData.status && paystackData.data.status === 'success') {
            try {
                // Prepare form data for Formspree
                const formData = {
                    name: 'Payment Notification',
                    email: paystackData.data.customer.email,
                    message: `A payment of ${paystackData.data.amount / 100} GHS was made by ${paystackData.data.customer.email} for data bundle.`
                };

                await axios.post(formspreeUrl, formData);

                return res.json({ status: 'success', message: 'Payment verified and form submitted.' });
            } catch (formspreeError) {
                console.error('Formspree submission error:', formspreeError.response ? formspreeError.response.data : formspreeError.message);
                return res.status(500).json({ status: 'error', message: 'An error occurred while submitting to Formspree.' });
            }
        } else {
            return res.status(400).json({ status: 'error', message: 'Payment verification failed.' });
        }
    } catch (paystackError) {
        console.error('Paystack verification error:', paystackError.response ? paystackError.response.data : paystackError.message);
        return res.status(500).json({ status: 'error', message: 'An error occurred while verifying the payment with Paystack.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
