// server.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors'); // This line imports the cors middleware
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// --- THIS IS THE SECTION YOU NEED TO UPDATE ---
// Replace the domain below with your live website URL
const corsOptions = {
    origin: 'https://purchase-data-bundle.onrender.com', 
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
// --- END OF THE SECTION TO UPDATE ---

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

    // Extract the price from the data plan string
    const priceMatch = dataPlan.match(/GHC (\d+\.\d{2})/);
    const amount = priceMatch ? parseFloat(priceMatch[1]) : null;

    if (!amount) {
        return res.status(400).json({ status: 'error', message: 'Invalid data plan or price.' });
    }

    // Hubtel API Integration
    const hubtelApiKey = process.env.HUBTEL_API_KEY;
    const hubtelClientSecret = process.env.HUBTEL_CLIENT_SECRET;
    const hubtelPaymentUrl = 'https://api.hubtel.com/v1/merchantaccount/merchants/{{0205306718}}/receive/mobilemoney';

    const hubtelPayload = {
        amount: amount,
        customerMsisdn: buyerPhone,
        channel: paymentMethod,
        description: `Payment for ${dataPlan}`,
        callbackUrl: 'https://your-server.vercel.app/hubtel-callback'
    };

    try {
        const hubtelResponse = await fetch(hubtelPaymentUrl, {
            method: 'POST',
            body: JSON.stringify(hubtelPayload),
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Basic ' + Buffer.from(`${hubtelApiKey}:${hubtelClientSecret}`).toString('base64')
            }
        });

        const hubtelResult = await hubtelResponse.json();
        console.log('Hubtel API Response:', hubtelResult);

        // You would handle success/failure here.
        // If successful, continue to Formspree submission.

        // ... Formspree submission code ...
        const formspreeUrl = 'https://formspree.io/f/xkgvknwg';
        const formspreeData = new URLSearchParams();
        formspreeData.append('Data Plan', dataPlan);
        formspreeData.append('Recipient Phone', recipientPhone);
        formspreeData.append('Buyer Phone', buyerPhone);
        formspreeData.append('Payment Method', paymentMethod);

        try {
            const response = await fetch(formspreeUrl, {
                method: 'POST',
                body: formspreeData,
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });
            
            if (response.ok) {
                console.log('Data successfully sent to Formspree.');
                res.status(200).json({ status: 'success', message: 'Payment processing and data submitted!' });
            } else {
                throw new Error('Formspree submission failed.');
            }
        } catch (error) {
            console.error('Error:', error);
            res.status(500).json({ status: 'error', message: 'Something went wrong on the server.' });
        }
    } catch (error) {
        console.error('Hubtel API error:', error);
        res.status(500).json({ status: 'error', message: 'Payment processing failed.' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
