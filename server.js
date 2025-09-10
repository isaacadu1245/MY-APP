const express = require('express');
const axios = require('axios');
const nodemailer = require('nodemailer');
const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Load environment variables.
// NOTE: For local development, you should use a .env file and a library like `dotenv`.
// In production on Vercel, these are set in the dashboard.
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const DATAMART_API_KEY = process.env.DATAMART_API_KEY;
const DATAMART_API_URL = process.env.DATAMART_API_URL;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_EMAIL_PASSWORD = process.env.ADMIN_EMAIL_PASSWORD;

// --- Email Transporter Configuration ---
const transporter = nodemailer.createTransport({
    service: 'gmail', // You can use other services or an SMTP server
    auth: {
        user: ADMIN_EMAIL,
        pass: ADMIN_EMAIL_PASSWORD
    }
});

// --- Data Bundle Delivery Logic ---
async function sendDataBundle(recipientNumber, amount, network) {
    console.log(`Attempting to send ${amount} data to ${recipientNumber} on ${network} via DataMart.`);
    try {
        const payload = {
            api_key: DATAMART_API_KEY,
            recipient_number: recipientNumber,
            amount: amount,
            network: network // Assuming network names match DataMart's requirements
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

// --- Paystack Initialization Endpoint ---
app.post('/initialize-payment', async (req, res) => {
    try {
        const { amount, email, plan, recipientNumber, buyerNumber, network } = req.body;

        if (!amount || !email) {
            return res.status(400).json({ message: 'Amount and email are required.' });
        }

        const response = await axios.post('https://api.paystack.co/transaction/initialize', {
            email: email,
            amount: amount,
            plan: plan,
            metadata: {
                recipientNumber,
                buyerNumber,
                network
            }
        }, {
            headers: {
                'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        res.status(200).json(response.data);

    } catch (error) {
        console.error('Error initializing payment:', error.response?.data || error.message);
        res.status(500).json({ message: 'An error occurred while initializing payment.' });
    }
});

// --- Paystack Verification Endpoint ---
app.get('/verify-payment/:reference', async (req, res) => {
    try {
        const { reference } = req.params;

        const response = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
            headers: {
                'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const data = response.data.data;
        if (data.status === 'success') {
            const { recipientNumber, plan, network } = data.metadata;
            const amountInCedi = data.amount / 100;

            // Step 1: Send the data bundle
            const dataDeliveryResult = await sendDataBundle(recipientNumber, amountInCedi, network);

            // Step 2: Send a notification email to the admin
            const emailSubject = `New Data Purchase: ${plan} to ${recipientNumber}`;
            const emailText = `A new data bundle has been purchased.\n\n`
                + `Plan: ${plan}\n`
                + `Amount: GHC ${amountInCedi}\n`
                + `Recipient Number: ${recipientNumber}\n`
                + `Buyer's Number: ${data.metadata.buyerNumber}\n`
                + `Network: ${network}\n`
                + `Paystack Reference: ${reference}\n`
                + `DataMart Delivery Status: ${dataDeliveryResult.message}`;
            
            await sendNotificationEmail(ADMIN_EMAIL, emailSubject, emailText);

            // Respond to the client
            res.status(200).json({ message: 'Payment verified, and transaction processed.', deliveryStatus: dataDeliveryResult.message });
        } else {
            res.status(400).json({ message: 'Payment verification failed.' });
        }
    } catch (error) {
        console.error('Error verifying payment:', error.response?.data || error.message);
        res.status(500).json({ message: 'An error occurred while verifying payment.' });
    }
});

// A simple endpoint to serve your HTML file
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
