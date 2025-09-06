// server.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fetch = require('node-fetch'); // Make sure to install this package

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cors());

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

    // TODO: Add your Hubtel payment processing logic here
    // This is where you would make an API call to Hubtel using your private keys.
    // The keys would be stored as environment variables on your server for security.

    // Example of how to send the data to Formspree
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
            // Send a success message back to your website
            res.status(200).json({ status: 'success', message: 'Payment processing and data submitted!' });
        } else {
            throw new Error('Formspree submission failed.');
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ status: 'error', message: 'Something went wrong on the server.' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
