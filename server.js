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
            const amount = transactionDetails.amount / 100; // Convert back to GHC
            const reference = transactionDetails.reference;

            // Extract the custom metadata you sent earlier
            const buyerNumber = transactionDetails.metadata.custom_fields.find(field => field.variable_name === 'buyer_number')?.value;
            const recipientNumber = transactionDetails.metadata.custom_fields.find(field => field.variable_name === 'recipient_number')?.value;
            const selectedPlan = transactionDetails.metadata.custom_fields.find(field => field.variable_name === 'selected_plan')?.value;

            // --- SEND DATA TO FORMSPREE (optional) ---
            const formspreeUrl = 'https://formspree.io/f/xbjnyppd'; 

            try {
                const formspreeResponse = await fetch(formspreeUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        plan: selectedPlan,
                        buyer_phone: buyerNumber,
                        recipient_phone: recipientNumber,
                        amount: amount,
                        transaction_id: reference
                    })
                });

                if (formspreeResponse.ok) {
                    console.log('Transaction details successfully sent to Formspree.');
                } else {
                    console.error('Failed to send transaction details to Formspree.');
                }
            } catch (error) {
                console.error('Error sending data to Formspree:', error);
            }
        }
    }
    // Acknowledge receipt of the webhook to Paystack
    res.sendStatus(200);
});

// Route to handle payment initialization
app.post('/initialize-payment', async (req, res) => {
    const { amount, buyerNumber, recipientNumber, plan } = req.body;

    // Paystack requires an email, so we create a dummy one from buyer's number
    const dummyEmail = `${buyerNumber}@buyer.bangerhitz.com`;

    const url = 'https://api.paystack.co/transaction/initialize';
    const body = {
        amount: amount * 100, // Paystack expects kobo (or pesewas)
        email: dummyEmail,
        metadata: {
            custom_fields: [
                {
                    display_name: "Buyer Phone",
                    variable_name: "buyer_number",
                    value: buyerNumber
                },
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

// Start server if run directly
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}
