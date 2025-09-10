const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const bodyParser = require("body-parser");
const crypto = require("crypto");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const DATAMART_API_KEY = process.env.DATAMART_API_KEY;
const DATAMART_API_URL = process.env.DATAMART_API_URL; // e.g. https://api.datamart.com/buy

// 🔹 Mapping: Plan → Datamart Code
const datamartPlans = {
  "1GB": "DM001",
  "2GB": "DM002"
};

// Health check
app.get("/", (req, res) => res.send("Server running"));

// Initialize payment
app.post("/initialize-payment", async (req, res) => {
  const { amount, buyerPhone, recipientNumber, plan } = req.body;

  const body = {
    amount: amount * 100,
    email: `${buyerPhone}@bangerhitz.com`, // Paystack requires email
    metadata: {
      custom_fields: [
        { display_name: "Recipient Phone", variable_name: "recipient_number", value: recipientNumber },
        { display_name: "Buyer Phone", variable_name: "buyer_phone", value: buyerPhone },
        { display_name: "Selected Plan", variable_name: "selected_plan", value: plan }
      ]
    }
  };

  try {
    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Payment init failed" });
  }
});

// Webhook
app.post("/webhook", async (req, res) => {
  const hash = crypto.createHmac("sha512", PAYSTACK_SECRET_KEY)
    .update(JSON.stringify(req.body)).digest("hex");

  if (hash === req.headers["x-paystack-signature"]) {
    const event = req.body;

    if (event.event === "charge.success") {
      const plan = event.data.metadata.custom_fields.find(f => f.variable_name === "selected_plan").value;
      const recipient = event.data.metadata.custom_fields.find(f => f.variable_name === "recipient_number").value;

      const datamartCode = datamartPlans[plan];
      if (datamartCode) {
        try {
          const dmRes = await fetch(DATAMART_API_URL, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${DATAMART_API_KEY}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              planCode: datamartCode,
              phoneNumber: recipient
            })
          });

          const dmData = await dmRes.json();
          console.log("Datamart Response:", dmData);
        } catch (err) {
          console.error("Datamart error:", err);
        }
      }
    }
  }

  res.sendStatus(200);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
