const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_EMAIL_PASSWORD = process.env.ADMIN_EMAIL_PASSWORD;

// Email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: ADMIN_EMAIL,
    pass: ADMIN_EMAIL_PASSWORD
  }
});

// Server check
app.get('/', (req, res) => res.send('Server is running!'));

// Webhook from Paystack
app.post('/webhook', async (req, res) => {
  const hash = crypto.createHmac('sha512', PAYSTACK_SECRET_KEY)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (hash === req.headers['x-paystack-signature']) {
    const event = req.body;

    if (event.event === 'charge.success') {
      const tx = event.data;
      const amount = tx.amount / 100;
      const reference = tx.reference;

      const buyerNumber = tx.metadata.custom_fields.find(f => f.variable_name === 'buyer_number')?.value;
      const recipientNumber = tx.metadata.custom_fields.find(f => f.variable_name === 'recipient_number')?.value;
      const selectedPlan = tx.metadata.custom_fields.find(f => f.variable_name === 'selected_plan')?.value;

      // Send email to Admin
      try {
        await transporter.sendMail({
          from: `"BangerHitz App" <${ADMIN_EMAIL}>`,
          to: ADMIN_EMAIL,
          subject: "New Payment Received",
          text: `✅ Payment Received\n\nPlan: ${selectedPlan}\nRecipient: ${recipientNumber}\nBuyer: ${buyerNumber}\nAmount: ${amount} GHS\nReference: ${reference}`
        });
        console.log("Admin notified.");
      } catch (err) {
        console.error("Admin email error:", err);
      }

      // Send email to Buyer
      try {
        await transporter.sendMail({
          from: `"BangerHitz App" <${ADMIN_EMAIL}>`,
          to: `${buyerNumber}@buyer.bangerhitz.com`, // fake email using phone
          subject: "Your Data Bundle Purchase",
          text: `Hello,\n\nYour payment was successful!\nPlan: ${selectedPlan}\nRecipient: ${recipientNumber}\nAmount: ${amount} GHS\nTransaction Ref: ${reference}\n\nThanks for using BangerHitz Digital Media.`
        });
        console.log("Buyer notified.");
      } catch (err) {
        console.error("Buyer email error:", err);
      }
    }
  }
  res.sendStatus(200);
});

// Initialize payment
app.post('/initialize-payment', async (req, res) => {
  const { amount, buyerNumber, recipientNumber, plan } = req.body;
  const dummyEmail = `${buyerNumber}@buyer.bangerhitz.com`;

  const url = 'https://api.paystack.co/transaction/initialize';
  const body = {
    amount: amount * 100,
    email: dummyEmail,
    metadata: {
      custom_fields: [
        { display_name: "Buyer Phone", variable_name: "buyer_number", value: buyerNumber },
        { display_name: "Recipient Phone", variable_name: "recipient_number", value: recipientNumber },
        { display_name: "Selected Plan", variable_name: "selected_plan", value: plan }
      ]
    }
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error("Init payment error:", err);
    res.status(500).json({ error: "Failed to initialize payment" });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
