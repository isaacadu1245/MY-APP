const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const bodyParser = require("body-parser");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const DATAMART_API_URL = process.env.DATAMART_API_URL || "https://api.datamart.shop/buy";
const DATAMART_API_KEY = process.env.DATAMART_API_KEY;

// --- Simple check route ---
app.get("/", (req, res) => {
  res.send("Server is running!");
});

// --- Initialize Paystack Payment ---
app.post("/initialize-payment", async (req, res) => {
  const { amount, buyerNumber, recipientNumber, plan, network } = req.body;

  const url = "https://api.paystack.co/transaction/initialize";
  const body = {
    amount: amount * 100, // Paystack expects kobo (cents)
    email: `${buyerNumber}@bangerhitz.app`, // Fake email for Paystack since we’re using phone
    metadata: {
      custom_fields: [
        { display_name: "Recipient Phone", variable_name: "recipient_number", value: recipientNumber },
        { display_name: "Selected Plan", variable_name: "selected_plan", value: plan },
        { display_name: "Selected Network", variable_name: "selected_network", value: network },
        { display_name: "Buyer Number", variable_name: "buyer_number", value: buyerNumber }
      ]
    }
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error("Error initializing payment:", error);
    res.status(500).json({ error: "Failed to initialize payment" });
  }
});

// --- Paystack Webhook ---
app.post("/webhook", async (req, res) => {
  const hash = crypto.createHmac("sha512", PAYSTACK_SECRET_KEY)
    .update(JSON.stringify(req.body))
    .digest("hex");

  if (hash === req.headers["x-paystack-signature"]) {
    const event = req.body;

    if (event.event === "charge.success") {
      console.log("✅ Payment su
