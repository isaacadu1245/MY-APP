const express = require('express');
const axios = require('axios');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const dotenv = require('dotenv');

dotenv.config(); // Load environment variables from .env file

const app = express();

// Middleware to parse JSON bodies. Paystack webhook needs the raw body
// for signature verification, so we save it on the request object.
app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));

// Load environment variables. Raise an error if they are not set.
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const DATAMART_API_KEY = process.env.DATAMART_API_KEY;
const DATAMART_API_URL = process.env.DATAMART_API_URL;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_EMAIL_PASSWORD = process.env.ADMIN_EMAIL_PASSWORD;

if (!PAYSTACK_SECRET_KEY || !DATAMART_API_KEY || !DATAMART_API_URL || !ADMIN_EMAIL || !ADMIN_EMAIL_PASSWORD) {
    console.error('ERROR: Missing one or more required environment variables.');
    process.exit(1);
}

// --- Network Mapping ---
// The frontend uses simple names, but the DataMart API might need specific ones.
const networkMap = {
    'mtn_momo': 'MTN',
    'telecel_cash': 'Telecel',
    'at_money': 'AT'
};

// --- Email Transporter Configuration ---
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: ADMIN_EMAIL,
        pass: ADMIN_EMAIL_PASSWORD
    }
});

// --- Data Bundle Delivery Logic ---
async function sendDataBundle(recipientNumber, dataAmount, network) {
    console.log(`Attempting to send ${dataAmount}GB data to ${recipientNumber} on ${network} via DataMart.`);
    try {
        const payload = {
            api_key: DATAMART_API_KEY,
            recipient_number: recipientNumber,
            amount: dataAmount,
            network: network
        };

        const response = await axios.post(DATAMART_API_URL, payload, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.data.status === 'success') {
            console.log('Data bundle sent successfully:', response.data);
            return { success: true, message: 'Data bundle sent successfully.' };
        } else {
            console.error('Data bundle delivery failed:', response.data);
            return { success: false, message: response.data.message || 'Data bundle delivery failed.' };
        }
    } catch (error) {
        console.error('Error sending data bundle:', error.response?.data || error.message);
        return { success: false, message: 'An error occurred during data bundle delivery.' };
    }
}

// --- Email Notification Logic ---
async function sendNotificationEmail(toEmail, subject, text) {
    try {
        const mailOptions = {
            from: ADMIN_EMAIL,
            to: toEmail,
            subject: subject,
            text: text
        };
        await transporter.sendMail(mailOptions);
        console.log('Notification email sent successfully.');
    } catch (error) {
        console.error('Error sending notification email:', error.message);
    }
}

// --- Paystack Initialization Endpoint (Client-side Call) ---
app.post('/initialize-payment', async (req, res) => {
    try {
        const { amount, email, planName, recipientNumber, buyerNumber, network, dataAmount } = req.body;

        console.log('Received request to initialize payment with:', req.body);

        if (!amount || !email) {
            return res.status(400).json({ message: 'Amount and email are required.' });
        }

        const response = await axios.post('https://api.paystack.co/transaction/initialize', {
            email: email,
            amount: amount,
            metadata: {
                recipientNumber,
                buyerNumber,
                network,
                planName,
                dataAmount
            }
        }, {
            headers: {
                'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('Paystack response:', response.data);
        res.status(200).json(response.data);

    } catch (error) {
        console.error('Error initializing payment:', error.response?.data?.message || error.message);
        res.status(500).json({ message: error.response?.data?.message || 'An error occurred while initializing payment.' });
    }
});

// --- Paystack Webhook Endpoint (Server-to-Server Call) ---
// This is the secure, recommended way to verify payments.
app.post('/paystack-webhook', async (req, res) => {
    // Verify the webhook signature for security
    const hash = crypto.createHmac('sha512', PAYSTACK_SECRET_KEY).update(req.rawBody).digest('hex');
    const paystackSignature = req.headers['x-paystack-signature'];

    if (hash !== paystackSignature) {
        console.error('Webhook signature verification failed.');
        return res.status(400).send('Invalid signature');
    }

    const payload = req.body;
    const eventType = payload.event;

    // We only care about successful charges
    if (eventType === 'charge.success') {
        const data = payload.data;
        const { recipientNumber, planName, network, dataAmount } = data.metadata;
        const amountInCedi = data.amount / 100;
        const paystackReference = data.reference;

        // Ensure we have the required metadata
        if (!recipientNumber || !planName || !network || !dataAmount) {
            console.error('Required metadata missing from webhook payload.');
            return res.status(400).send('Bad Request: Missing metadata');
        }

        // Map the network name to the format the DataMart API expects
        const apiNetwork = networkMap[network] || 'MTN'; // Default to MTN if not found

        // Step 1: Send the data bundle
        const dataDeliveryResult = await sendDataBundle(recipientNumber, dataAmount, apiNetwork);

        // Step 2: Send a notification email to the admin
        const emailSubject = `New Data Purchase: ${planName} to ${recipientNumber}`;
        const emailText = `A new data bundle has been purchased.\n\n`
            + `Plan: ${planName}\n`
            + `Amount: GHC ${amountInCedi}\n`
            + `Recipient Number: ${recipientNumber}\n`
            + `Buyer's Number: ${data.metadata.buyerNumber}\n`
            + `Network: ${apiNetwork}\n`
            + `Paystack Reference: ${paystackReference}\n`
            + `DataMart Delivery Status: ${dataDeliveryResult.message}`;
        
        await sendNotificationEmail(ADMIN_EMAIL, emailSubject, emailText);

        // Acknowledge receipt of the webhook
        res.status(200).send('Webhook received and processed.');

    } else {
        // Acknowledge other events without processing
        res.status(200).send('Event received, but not handled.');
    }
});

// A simple endpoint to serve your HTML file
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// Export the Express app as a serverless function
module.exports = app;
